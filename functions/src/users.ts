import { HttpsError } from "firebase-functions/v2/https";
import {
  accessOperations,
  memberSchema,
} from "../../src/domain/access-contract";
import { account, catalog, fingerprint } from "./access";
import { admin, auth, db, membership } from "./store";

export const userOperations = [
  "listAccessUsers",
  "reviewNewUser",
  "confirmNewUser",
  "activateAccessUser",
];
const stale = () =>
  new HttpsError(
    "failed-precondition",
    "La propuesta cambió o venció. Revisa la cuenta y el catálogo nuevamente; los permisos no se aplicaron.",
  );
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export async function userOperation(op: string, raw: unknown, actor: string) {
  admin(await membership(actor));
  if (op === "listAccessUsers") {
    const input = accessOperations.listAccessUsers.parse(raw);
    // Buscar más allá de la página inicial, sin enviar cuentas no coincidentes.
    // El presupuesto acota cada petición; el cursor conserva la continuación.
    let page = await auth.listUsers(input.pageSize, input.pageToken);
    const matches = (u: (typeof page.users)[number]) =>
      normalize(`${u.displayName ?? ""} ${u.email ?? ""}`).includes(
        normalize(input.search),
      );
    let users = page.users.filter(matches);
    for (
      let scanned = 1;
      !users.length && page.pageToken && scanned < 40;
      scanned++
    ) {
      page = await auth.listUsers(input.pageSize, page.pageToken);
      users = page.users.filter(matches);
    }
    const labels = new Map<string, string>();
    const cycles = await db.collection("cycles").get();
    for (const cycle of cycles.docs) {
      const c = await catalog(cycle.id);
      for (const row of c.careers)
        labels.set(row.id, `${row.name} (${row.abbreviation}) · ${row.plan}`);
    }
    return {
      users: await Promise.all(
        users.map(async (u) => {
          const snap = await db.doc(`memberships/${u.uid}`).get();
          const member = snap.exists ? memberSchema.parse(snap.data()) : null;
          const creations = await db
            .collection("userCreations")
            .where("uid", "==", u.uid)
            .limit(10)
            .get();
          const pending = creations.docs.find(
            (d) =>
              d.data().actor === actor &&
              !["accepted", "synthetic_not_sent"].includes(
                String(d.data().activation),
              ),
          );
          return {
            pendingCreation: pending?.id ?? null,
            email: u.email ?? "",
            name: u.displayName ?? "Sin nombre registrado",
            disabled: u.disabled,
            member,
            careerNames:
              member?.role === "admin"
                ? ["Alcance institucional"]
                : (member?.careers ?? []).map(
                    (id) =>
                      labels.get(id) ??
                      "Asignación fuera del catálogo vigente — revisar",
                  ),
          };
        }),
      ),
      nextPageToken: page.pageToken ?? null,
    };
  }
  if (op === "reviewNewUser") {
    const input = accessOperations.reviewNewUser.parse(raw);
    if (await account(input.email))
      return { existing: true, email: input.email };
    const c = await catalog(input.cycleId);
    if (!c.version || c.version !== input.catalogVersion) throw stale();
    if (
      input.member.careers.some((id) => !c.careers.some((row) => row.id === id))
    )
      throw new HttpsError(
        "invalid-argument",
        "Revisa las carreras del catálogo confirmado.",
      );
    const ref = db.collection("userCreations").doc();
    await ref.create({
      ...input,
      member: { ...input.member, careers: [...new Set(input.member.careers)] },
      actor,
      uid: `managed-${ref.id}`,
      sourceVersion: c.sourceVersion,
      createdAt: Date.now(),
      activation: "pending",
    });
    return { id: ref.id, existing: false, email: input.email };
  }
  const input =
    op === "activateAccessUser"
      ? accessOperations.activateAccessUser.parse(raw)
      : accessOperations.confirmNewUser.parse(raw);
  const ref = db.doc(`userCreations/${input.reviewId}`);
  const initial = (await ref.get()).data();
  if (!initial || initial.actor !== actor)
    throw new HttpsError(
      "permission-denied",
      "Alta no disponible para esta cuenta.",
    );
  const result = (v: typeof initial, extra = {}) => ({
    id: ref.id,
    email: String(v.email),
    existing: !!v.existing,
    accountCreated: !!v.accountCreated,
    permissionsAssigned: !!v.appliedAt || !!v.recoveredAssignmentAt,
    activation: String(v.activation),
    ...extra,
  });
  if (op === "activateAccessUser") {
    const currentMember = await db.doc(`memberships/${initial.uid}`).get();
    if (
      (!initial.appliedAt && !currentMember.exists) ||
      initial.existing ||
      !initial.accountCreated
    )
      throw new HttpsError(
        "failed-precondition",
        "Primero confirma los permisos del alta.",
      );
    const attempt = accessOperations.activateAccessUser.parse(raw).attemptId;
    const a = await account(String(initial.email));
    if (!a || a.uid !== initial.uid || a.disabled) throw stale();
    const claimed = await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const v = (await tx.get(ref)).data()!;
      const current = await tx.get(db.doc(`memberships/${v.uid}`));
      if (!current.exists || !memberSchema.parse(current.data()).active)
        throw new HttpsError(
          "failed-precondition",
          "El acceso está inactivo; revisa los permisos antes de activar.",
        );
      if (
        v.activation === "accepted" ||
        v.activationAttempt === attempt ||
        (v.activationStartedAt &&
          Date.now() - Number(v.activationStartedAt) < 60000)
      )
        return false;
      tx.update(ref, {
        activation: "uncertain",
        activationAttempt: attempt,
        activationStartedAt: Date.now(),
        ...(!v.appliedAt
          ? {
              recoveredAssignmentAt: Date.now(),
              recoveredMemberVersion: fingerprint(
                current.updateTime?.toMillis(),
              ),
            }
          : {}),
      });
      tx.create(ref.collection("activationAttempts").doc(attempt), {
        actor,
        requestedAt: Date.now(),
        status: "uncertain",
      });
      return true;
    });
    if (!claimed) return result((await ref.get()).data()!);
    const finish = async (status: string) => {
      const batch = db.batch();
      batch.update(ref, { activation: status });
      batch.update(ref.collection("activationAttempts").doc(attempt), {
        status,
        finishedAt: Date.now(),
      });
      await batch.commit();
    };
    // Las pruebas en nube nunca envían correo. El emulador sí verifica el
    // protocolo OOB sin entrega externa; no se guarda ni devuelve su enlace.
    if (
      !process.env.FIREBASE_AUTH_EMULATOR_HOST &&
      String(initial.email).endsWith("@example.invalid")
    ) {
      await finish("synthetic_not_sent");
      return result((await ref.get()).data()!);
    }
    const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const key = host ? "demo-only" : process.env.TRACKING_AUTH_WEB_KEY;
    if (!key) {
      await finish("pending");
      return result((await ref.get()).data()!);
    }
    try {
      const response = await fetch(
        `${host ? `http://${host}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com"}/v1/accounts:sendOobCode?key=${key}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Firebase-Locale": "es",
          },
          body: JSON.stringify({
            requestType: "PASSWORD_RESET",
            email: initial.email,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      // Respuesta aceptada por Firebase no demuestra entrega en el buzón.
      await finish(response.ok ? "accepted" : "pending");
    } catch {
      /* Estado incierto: un reintento explícito nunca reasigna permisos. */
    }
    return result((await ref.get()).data()!);
  }
  // Se comprueba antes y después de crear en Auth: no hay transacción distribuida.
  const check = async (apply: boolean) =>
    db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const v = (await tx.get(ref)).data()!;
      const cycle = await tx.get(db.doc(`cycles/${v.cycleId}`));
      const source = await tx.get(db.doc(`sources/${v.catalogVersion}`));
      const member = await tx.get(db.doc(`memberships/${v.uid}`));
      if (v.appliedAt) return; // Jamás reponer permisos cambiados después.
      if (
        Date.now() - Number(v.createdAt) > 30 * 60000 ||
        (cycle.data()?.sources?.academicPackage ??
          cycle.data()?.sources?.catalog) !== v.catalogVersion ||
        source.updateTime?.toMillis().toString() !== v.sourceVersion ||
        member.exists
      )
        throw stale();
      if (apply) {
        tx.create(member.ref, memberSchema.parse(v.member));
        tx.update(ref, { appliedAt: Date.now() });
        tx.create(db.collection("accessAudit").doc(), {
          uid: v.uid,
          previous: null,
          member: v.member,
          approvedBy: actor,
          createdAt: Date.now(),
          reviewId: ref.id,
          catalogCycle: v.cycleId,
          catalogVersion: v.catalogVersion,
        });
      }
    });
  if (initial.appliedAt || initial.existing) return result(initial);
  try {
    await check(false);
  } catch (e) {
    if (initial.accountCreated) return result(initial, { needsReview: true });
    throw e;
  }
  let a = await account(String(initial.email));
  if (!a) {
    try {
      await auth.createUser({
        uid: String(initial.uid),
        email: String(initial.email),
        displayName: String(initial.name),
        emailVerified: false,
      });
    } catch (e) {
      if (
        !["auth/email-already-exists", "auth/uid-already-exists"].includes(
          (e as { code: string }).code,
        )
      )
        throw e;
    }
    a = await account(String(initial.email));
  }
  if (!a || a.uid !== initial.uid) {
    await ref.update({ existing: true });
    return result((await ref.get()).data()!);
  }
  if (initial.identity && initial.identity !== fingerprint(a))
    return result(initial, { needsReview: true });
  await ref.update({ accountCreated: true, identity: fingerprint(a) });
  const fresh = await account(String(initial.email));
  if (fingerprint(fresh) !== fingerprint(a))
    return result((await ref.get()).data()!, { needsReview: true });
  try {
    await check(true);
  } catch {
    return result((await ref.get()).data()!, { needsReview: true });
  }
  return result((await ref.get()).data()!);
}
