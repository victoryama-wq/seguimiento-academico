import { HttpsError } from "firebase-functions/v2/https";
import {
  accessOperations,
  memberSchema,
} from "../../src/domain/access-contract";
import { catalogSchema } from "../../src/domain/academic";
import { academicPackageSchema } from "../../src/domain/decision-package";
import {
  admin,
  membership,
  auth,
  db,
  canonical,
  hash,
  jsonFile,
} from "./store";
const stale = () =>
  new HttpsError(
    "failed-precondition",
    "La revisión venció o la cuenta, sus permisos o el catálogo cambiaron. Busca la cuenta y revisa de nuevo antes de confirmar.",
  );
export const fingerprint = (v: unknown) => hash(canonical(v ?? null));
export async function account(email: string) {
  try {
    const user = await auth.getUserByEmail(email);
    return {
      uid: user.uid,
      email: user.email!,
      name: user.displayName ?? "Sin nombre registrado",
      disabled: user.disabled,
      createdAt: user.metadata.creationTime,
    };
  } catch (e) {
    if ((e as { code?: string }).code === "auth/user-not-found") return null;
    throw e;
  }
}
export async function catalog(cycleId: string) {
  const cycle = (await db.doc(`cycles/${cycleId}`).get()).data();
  const kind = cycle?.sources?.academicPackage ? "academicPackage" : "catalog";
  const version = (cycle?.sources?.[kind] as string | undefined) ?? null;
  if (!version) return { version, kind, sourceVersion: "", careers: [] };
  const source = await db.doc(`sources/${version}`).get();
  const v = source.data();
  if (
    !v?.approvedBy ||
    !v.publishedAt ||
    v.cycleId !== cycleId ||
    v.kind !== kind ||
    !v.artifact
  )
    throw new HttpsError(
      "failed-precondition",
      "El catálogo no está confirmado. Revisa las fuentes en Administración.",
    );
  const artifact = await jsonFile<{ data: unknown }>(String(v.artifact));
  const rows =
    kind === "academicPackage"
      ? academicPackageSchema.parse(artifact.data).catalog
      : catalogSchema.parse(artifact.data);
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new HttpsError(
      "failed-precondition",
      "El catálogo tiene identificaciones repetidas; requiere revisión administrativa.",
    );
  return {
    version,
    kind,
    sourceVersion: source.updateTime!.toMillis().toString(),
    careers: rows
      .filter((r) => r.kind === "carrera")
      .map((r) => ({
        id: r.id,
        name: r.program ?? `Carrera ${r.abbreviation}`,
        abbreviation: r.abbreviation,
        responsible: r.responsible ?? "Sin responsable informado",
        plan: r.plan,
      })),
  };
}
export async function accessOperation(
  op: keyof typeof accessOperations,
  raw: unknown,
  actor: string,
) {
  admin(await membership(actor));
  if (op === "accessCatalog")
    return catalog(accessOperations.accessCatalog.parse(raw).cycleId);
  if (op === "lookupAccess") {
    const input = accessOperations.lookupAccess.parse(raw),
      a = await account(input.email);
    const snap = a ? await db.doc(`memberships/${a.uid}`).get() : null;
    const member = snap?.exists ? memberSchema.parse(snap.data()) : null;
    const labels = new Map<
      string,
      Awaited<ReturnType<typeof catalog>>["careers"][number]
    >();
    if (member?.careers.length) {
      const cycles = await db.collection("cycles").get();
      for (const cycle of cycles.docs) {
        const view = await catalog(cycle.id);
        for (const row of view.careers)
          if (member.careers.includes(row.id)) labels.set(row.id, row);
      }
    }
    return {
      found: !!a,
      account: a
        ? { email: a.email, name: a.name, disabled: a.disabled }
        : null,
      accountVersion: fingerprint(a),
      memberVersion: fingerprint(snap?.updateTime?.toMillis() ?? null),
      member,
      existingCareers: [...labels.values()],
    };
  }
  if (op === "reviewAccess") {
    const input = accessOperations.reviewAccess.parse(raw),
      a = await account(input.email);
    if (!a)
      throw new HttpsError(
        "not-found",
        "No existe una cuenta con ese correo. No se creó ninguna cuenta ni se envió invitación.",
      );
    if (a.uid === actor)
      throw new HttpsError(
        "failed-precondition",
        "No modifiques tu propio acceso.",
      );
    const c = await catalog(input.cycleId);
    if (!c.version)
      throw new HttpsError(
        "failed-precondition",
        "Carga y confirma el catálogo del ciclo en Administración → Fuentes.",
      );
    if (
      c.version !== input.catalogVersion ||
      fingerprint(a) !== input.accountVersion
    )
      throw stale();
    const ref = db.collection("accessReviews").doc();
    return db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const current = await tx.get(db.doc(`memberships/${a.uid}`));
      const cycle = await tx.get(db.doc(`cycles/${input.cycleId}`));
      const source = await tx.get(db.doc(`sources/${c.version}`));
      if (
        fingerprint(current.updateTime?.toMillis() ?? null) !==
          input.memberVersion ||
        (cycle.data()?.sources?.academicPackage ??
          cycle.data()?.sources?.catalog) !== c.version ||
        source.updateTime?.toMillis().toString() !== c.sourceVersion
      )
        throw stale();
      const previous = current.exists
        ? memberSchema.parse(current.data())
        : null;
      const before = previous?.careers ?? [],
        after = [...new Set(input.member.careers)];
      const added = after.filter((id) => !before.includes(id)),
        removed = before.filter((id) => !after.includes(id));
      if (added.some((id) => !c.careers.some((r) => r.id === id)))
        throw new HttpsError(
          "invalid-argument",
          "Una carrera seleccionada no existe en el catálogo confirmado. Revisa la selección.",
        );
      const retained = after.filter((id) => before.includes(id));
      tx.create(ref, {
        actor,
        uid: a.uid,
        accountVersion: input.accountVersion,
        email: a.email,
        cycleId: input.cycleId,
        catalogVersion: c.version,
        catalogKind: c.kind,
        sourceVersion: c.sourceVersion,
        memberVersion: input.memberVersion,
        previous,
        member: { ...input.member, careers: after },
        added,
        removed,
        retained,
        createdAt: Date.now(),
      });
      return { id: ref.id, added, removed, retained };
    });
  }
  const { reviewId } = accessOperations.assignMember.parse(raw),
    ref = db.doc(`accessReviews/${reviewId}`);
  const initial = (await ref.get()).data();
  if (!initial || initial.actor !== actor)
    throw new HttpsError(
      "permission-denied",
      "Revisión no disponible para esta cuenta.",
    );
  const a = await account(String(initial.email));
  if (!a || fingerprint(a) !== initial.accountVersion) throw stale();
  return db.runTransaction(async (tx) => {
    admin(await membership(actor, tx));
    const review = (await tx.get(ref)).data()!;
    if (review.appliedAt) return { ok: true }; // Un reintento no vuelve a conceder permisos retirados.
    const current = await tx.get(db.doc(`memberships/${a.uid}`));
    const cycle = await tx.get(db.doc(`cycles/${review.cycleId}`));
    const source = await tx.get(db.doc(`sources/${review.catalogVersion}`));
    if (
      Date.now() - Number(review.createdAt) > 30 * 60 * 1000 ||
      fingerprint(current.updateTime?.toMillis() ?? null) !==
        review.memberVersion ||
      (cycle.data()?.sources?.academicPackage ??
        cycle.data()?.sources?.catalog) !== review.catalogVersion ||
      source.updateTime?.toMillis().toString() !== review.sourceVersion
    )
      throw stale();
    tx.set(current.ref, memberSchema.parse(review.member));
    tx.create(db.collection("accessAudit").doc(), {
      uid: a.uid,
      previous: review.previous,
      member: review.member,
      catalogCycle: review.cycleId,
      catalogVersion: review.catalogVersion,
      reviewId,
      approvedBy: actor,
      createdAt: Date.now(),
    });
    tx.update(ref, { appliedAt: Date.now() });
    return { ok: true };
  });
}
