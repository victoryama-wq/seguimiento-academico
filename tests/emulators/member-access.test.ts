import { beforeAll, expect, it } from "vitest";
import {
  apiRaw as api,
  seedBase,
  source,
  stores,
  people,
} from "../fixtures/synthetic/stage03";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";
import {
  accessAccountSchema,
  accessCatalogSchema,
  accessReviewSchema,
} from "../../src/domain/access-contract";
let sessions: Awaited<ReturnType<typeof seedBase>>;
const email = `${people.a}@example.invalid`;
beforeAll(async () => {
  sessions = await seedBase();
  const p = trackingPackage();
  p.catalog = p.catalog.map((c, i) => ({
    ...c,
    program: i ? "Arquitectura sintética" : "Finanzas sintéticas",
    responsible: "Responsable sintético A",
  }));
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(p),
    {},
    "catalogo-confirmado.json",
  );
}, 60000);
const lookup = async () =>
  accessAccountSchema.parse(
    await api("lookupAccess", { email }, sessions.admin),
  );
const catalog = async () =>
  accessCatalogSchema.parse(
    await api("accessCatalog", { cycleId: "27-1" }, sessions.admin),
  );
async function proposal(careers: string[], role = "coordinator") {
  const a = await lookup(),
    c = await catalog();
  return accessReviewSchema.parse(
    await api(
      "reviewAccess",
      {
        email,
        cycleId: "27-1",
        catalogVersion: c.version,
        accountVersion: a.accountVersion,
        memberVersion: a.memberVersion,
        member: { role, active: true, careers },
      },
      sessions.admin,
    ),
  );
}
it("catálogo confirmado, identidad exacta, selección múltiple y auditoría sin crear cuentas", async () => {
  const before = (await stores().auth.listUsers()).users.length;
  const a = await lookup(),
    c = await catalog();
  expect(a.member?.careers).toEqual(["laf-plan-1"]);
  expect(c.careers[0]!.responsible).toBe("Responsable sintético A");
  expect(c.careers.map((r) => r.id)).not.toContain("LAF");
  const p = await proposal(c.careers.map((r) => r.id));
  expect((await lookup()).member?.careers).toEqual(["laf-plan-1"]);
  expect(p.added).toEqual(["arq-plan-1"]);
  await api("assignMember", { reviewId: p.id }, sessions.admin);
  expect((await lookup()).member?.careers.slice().sort()).toEqual([
    "arq-plan-1",
    "laf-plan-1",
  ]);
  expect(
    (
      await stores()
        .db.collection("accessAudit")
        .where("reviewId", "==", p.id)
        .get()
    ).size,
  ).toBe(1);
  await api("assignMember", { reviewId: p.id }, sessions.admin);
  expect((await stores().auth.listUsers()).users.length).toBe(before);
});
it("cuenta inexistente no se crea, correo parcial y asignación directa se rechazan", async () => {
  expect(
    accessAccountSchema.parse(
      await api(
        "lookupAccess",
        { email: "missing@example.invalid" },
        sessions.admin,
      ),
    ).found,
  ).toBe(false);
  await expect(
    api("lookupAccess", { email: "coordinador" }, sessions.admin),
  ).rejects.toThrow("INVALID_ARGUMENT");
  await expect(
    api(
      "assignMember",
      { uid: people.a, member: { role: "admin", active: true, careers: [] } },
      sessions.admin,
    ),
  ).rejects.toThrow("INVALID_ARGUMENT");
  await expect(proposal(["LAF"])).rejects.toThrow("INVALID_ARGUMENT");
});
it("permisos fuera del catálogo se conservan o retiran explícitamente; cambiar ciclo no limita temporalmente", async () => {
  await stores()
    .db.doc(`memberships/${people.a}`)
    .set({
      role: "coordinator",
      active: true,
      careers: ["laf-plan-1", "legado-sintetico"],
    });
  const p = await proposal(["laf-plan-1", "legado-sintetico"]);
  expect(p.retained).toContain("legado-sintetico");
  await api("assignMember", { reviewId: p.id }, sessions.admin);
  const next = await proposal(["laf-plan-1"]);
  expect(next.removed).toEqual(["legado-sintetico"]);
  await api("assignMember", { reviewId: next.id }, sessions.admin);
  await api("assignMember", { reviewId: p.id }, sessions.admin);
  expect((await lookup()).member?.careers).toEqual(["laf-plan-1"]);
  expect(
    Object.keys(
      (await stores().db.doc(`memberships/${people.a}`).get()).data()!,
    ).sort(),
  ).toEqual(["active", "careers", "role"]);
});
it("edición concurrente y sustitución del catálogo invalidan la revisión; administrador revocado tampoco confirma", async () => {
  const p = await proposal(["laf-plan-1", "arq-plan-1"]);
  await stores().db.doc(`memberships/${people.a}`).update({ active: false });
  await expect(
    api("assignMember", { reviewId: p.id }, sessions.admin),
  ).rejects.toThrow("FAILED_PRECONDITION");
  const q = await proposal(["laf-plan-1"]);
  const pack = trackingPackage();
  pack.catalog[0]!.program = "Nombre revisado sintético";
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(pack),
    {},
    "catalogo-actualizado.json",
  );
  await expect(
    api("assignMember", { reviewId: q.id }, sessions.admin),
  ).rejects.toThrow("FAILED_PRECONDITION");
  const r = await proposal(["laf-plan-1"]);
  await stores()
    .db.doc(`memberships/${people.admin}`)
    .update({ active: false });
  await expect(
    api("assignMember", { reviewId: r.id }, sessions.admin),
  ).rejects.toThrow("PERMISSION_DENIED");
  await stores().db.doc(`memberships/${people.admin}`).update({ active: true });
});
it("coordinador no consulta usuarios ni catálogo de acceso ni revisa/confirma permisos", async () => {
  for (const [op, input] of [
    ["lookupAccess", { email }],
    ["accessCatalog", { cycleId: "27-1" }],
    ["reviewAccess", {}],
    ["assignMember", { reviewId: "ajeno" }],
  ] as const)
    await expect(api(op, input, sessions.b)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  await api(
    "createCycle",
    { id: "28-1", dates: { "2027-08-31": "base" } },
    sessions.admin,
  );
  expect(
    accessCatalogSchema.parse(
      await api("accessCatalog", { cycleId: "28-1" }, sessions.admin),
    ),
  ).toMatchObject({ version: null, careers: [] });
});
it("cambio de correo o identidad tras revisión requiere nueva búsqueda", async () => {
  const p = await proposal(["laf-plan-1"]);
  await stores().auth.updateUser(people.a, {
    displayName: "Nombre sintético actualizado",
  });
  await expect(
    api("assignMember", { reviewId: p.id }, sessions.admin),
  ).rejects.toThrow("FAILED_PRECONDITION");
});
