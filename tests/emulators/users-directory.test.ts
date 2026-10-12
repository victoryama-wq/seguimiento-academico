import { beforeAll, expect, it } from "vitest";
import {
  apiRaw as api,
  seedBase,
  stores,
  people,
} from "../fixtures/synthetic/stage03";
import {
  accessCatalogSchema,
  directorySchema,
  newUserReviewSchema,
  newUserResultSchema,
} from "../../src/domain/access-contract";
let sessions: Awaited<ReturnType<typeof seedBase>>;
beforeAll(async () => {
  sessions = await seedBase();
}, 60000);
async function review(email: string) {
  const c = accessCatalogSchema.parse(
    await api("accessCatalog", { cycleId: "27-1" }, sessions.admin),
  );
  return newUserReviewSchema.parse(
    await api(
      "reviewNewUser",
      {
        name: "Nueva persona sintética",
        email,
        cycleId: "27-1",
        catalogVersion: c.version,
        member: {
          role: "coordinator",
          active: true,
          careers: ["laf-plan-1", "arq-plan-1"],
        },
      },
      sessions.admin,
    ),
  );
}
it("directorio paginado incluye cuentas sin permisos, deshabilitadas y alcance institucional sin hashes ni UID", async () => {
  await stores().auth.createUser({
    uid: "zz-directory-match",
    email: "last-match@example.invalid",
    displayName: "Coincidencia al final del directorio",
  });
  const searched = directorySchema.parse(
    await api(
      "listAccessUsers",
      { search: "Coincidencia al final", pageSize: 1 },
      sessions.admin,
    ),
  );
  expect(searched.users.map((u) => u.email)).toEqual([
    "last-match@example.invalid",
  ]);
  await stores().auth.createUser({
    email: "directory-disabled@example.invalid",
    disabled: true,
  });
  const all = [];
  let pageToken: string | undefined;
  do {
    const p = directorySchema.parse(
      await api(
        "listAccessUsers",
        { pageSize: 1, ...(pageToken ? { pageToken } : {}) },
        sessions.admin,
      ),
    );
    expect(p.users.length).toBeLessThanOrEqual(1);
    all.push(...p.users);
    pageToken = p.nextPageToken ?? undefined;
  } while (pageToken);
  expect(
    all.find((u) => u.email === "directory-disabled@example.invalid"),
  ).toMatchObject({ disabled: true, member: null });
  expect(all.find((u) => u.member?.role === "admin")?.careerNames).toEqual([
    "Alcance institucional",
  ]);
  const raw = await api(
    "listAccessUsers",
    { search: people.a },
    sessions.admin,
  );
  expect(JSON.stringify(raw)).not.toMatch(/passwordHash|passwordSalt|"uid"/);
  expect(
    directorySchema.parse(raw).users.every((u) => u.email.includes(people.a)),
  ).toBe(true);
});
it("alta nueva con múltiples carreras, reintento concurrente y activación emulada sin enlaces en respuesta", async () => {
  const r = await review("nuevo-sintetico@example.invalid");
  const outcomes = await Promise.all(
    [1, 2].map(() => api("confirmNewUser", { reviewId: r.id }, sessions.admin)),
  );
  expect(
    outcomes.map((v) => newUserResultSchema.parse(v).permissionsAssigned),
  ).toEqual([true, true]);
  const u = await stores().auth.getUserByEmail(r.email);
  expect(
    (await stores().db.doc(`memberships/${u.uid}`).get()).data()?.careers,
  ).toEqual(["laf-plan-1", "arq-plan-1"]);
  expect(
    (
      await stores()
        .db.collection("accessAudit")
        .where("reviewId", "==", r.id)
        .get()
    ).size,
  ).toBe(1);
  const activation = await api(
    "activateAccessUser",
    { reviewId: r.id, attemptId: "attempt-one" },
    sessions.admin,
  );
  expect(newUserResultSchema.parse(activation).activation).toBe("accepted");
  expect(JSON.stringify(activation)).not.toMatch(/oobCode|https:|password/);
  await stores().db.doc(`memberships/${u.uid}`).update({ careers: [] });
  await api("confirmNewUser", { reviewId: r.id }, sessions.admin);
  expect(
    (await stores().db.doc(`memberships/${u.uid}`).get()).data()?.careers,
  ).toEqual([]);
});
it("correo existente y carrera de otra versión no sustituyen identidad ni permisos", async () => {
  const existing = await review(`${people.a}@example.invalid`);
  expect(existing.existing).toBe(true);
  expect(existing.id).toBeUndefined();
  const r = await review("race-sintetico@example.invalid");
  const u = await stores().auth.createUser({
    email: r.email,
    displayName: "Identidad externa conservada",
  });
  const v = newUserResultSchema.parse(
    await api("confirmNewUser", { reviewId: r.id }, sessions.admin),
  );
  expect(v.existing).toBe(true);
  expect(v.permissionsAssigned).toBe(false);
  expect((await stores().auth.getUser(u.uid)).displayName).toBe(
    "Identidad externa conservada",
  );
  expect((await stores().db.doc(`memberships/${u.uid}`).get()).exists).toBe(
    false,
  );
});
it("recupera cuenta creada antes de fallo; revisión obsoleta conserva cuenta sin conceder permisos", async () => {
  const r = await review("partial-sintetico@example.invalid");
  const ref = stores().db.doc(`userCreations/${r.id}`),
    data = (await ref.get()).data()!;
  await stores().auth.createUser({
    uid: data.uid,
    email: r.email,
    displayName: data.name,
  });
  expect(
    newUserResultSchema.parse(
      await api("confirmNewUser", { reviewId: r.id }, sessions.admin),
    ).permissionsAssigned,
  ).toBe(true);
  const stale = await review("stale-sintetico@example.invalid");
  const staleRef = stores().db.doc(`userCreations/${stale.id}`),
    v = (await staleRef.get()).data()!;
  await stores().auth.createUser({ uid: v.uid, email: stale.email });
  await staleRef.update({ accountCreated: true, createdAt: 0 });
  expect(
    newUserResultSchema.parse(
      await api("confirmNewUser", { reviewId: stale.id }, sessions.admin),
    ),
  ).toMatchObject({
    accountCreated: true,
    permissionsAssigned: false,
    needsReview: true,
  });
  expect((await stores().db.doc(`memberships/${v.uid}`).get()).exists).toBe(
    false,
  );
});
it("coordinadores y cuentas sin acceso no listan, crean ni activan usuarios", async () => {
  for (const session of [sessions.a, sessions.b, undefined])
    for (const op of [
      "listAccessUsers",
      "reviewNewUser",
      "confirmNewUser",
      "activateAccessUser",
    ])
      await expect(api(op, {}, session)).rejects.toThrow(
        /PERMISSION_DENIED|UNAUTHENTICATED/,
      );
});

it("recupera respuesta incierta de activación sin duplicar permisos y rechaza catálogo obsoleto antes de crear", async () => {
  const r = await review("activation-retry@example.invalid");
  await api("confirmNewUser", { reviewId: r.id }, sessions.admin);
  const ref = stores().db.doc(`userCreations/${r.id}`);
  await ref.update({
    activation: "uncertain",
    activationAttempt: "lost-response",
    activationStartedAt: 1,
  });
  expect(
    newUserResultSchema.parse(
      await api(
        "activateAccessUser",
        { reviewId: r.id, attemptId: "lost-response" },
        sessions.admin,
      ),
    ).activation,
  ).toBe("uncertain");
  const attempt = { reviewId: r.id, attemptId: "explicit-retry" };
  expect(
    newUserResultSchema.parse(
      await api("activateAccessUser", attempt, sessions.admin),
    ).activation,
  ).toBe("accepted");
  await api("activateAccessUser", attempt, sessions.admin);
  expect((await ref.collection("activationAttempts").get()).size).toBe(1);
  expect(
    (
      await stores()
        .db.collection("accessAudit")
        .where("reviewId", "==", r.id)
        .get()
    ).size,
  ).toBe(1);
  const stale = await review("catalog-stale@example.invalid");
  await stores()
    .db.doc(`userCreations/${stale.id}`)
    .update({ sourceVersion: "obsolete" });
  await expect(
    api("confirmNewUser", { reviewId: stale.id }, sessions.admin),
  ).rejects.toThrow("FAILED_PRECONDITION");
  await expect(stores().auth.getUserByEmail(stale.email)).rejects.toThrow();
});
