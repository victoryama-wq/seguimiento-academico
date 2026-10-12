import { expect, it } from "vitest";
import {
  groupPossibleWithdrawals,
  cycleWithdrawalSchema,
} from "../../src/domain/possible-withdrawals";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";
import {
  resolveAcademicPackage,
  validateAcademicPackage,
} from "../../src/importing/decisions";
import { intakeFixture } from "../fixtures/synthetic/intake";
import { buildAdministration } from "../../src/importing/intake";

it("agrupa por matrícula, nunca por nombre; conserva variantes, materias y procedencia sin duplicar reintentos", () => {
  const a = {
    identity: "000A@example.invalid",
    name: "Nombre sintético",
    status: "posible baja" as const,
    courseId: "c1",
    courseName: "Curso 1",
    provenance: "v1:fila:2",
  };
  const rows = groupPossibleWithdrawals([
    a,
    a,
    {
      ...a,
      identity: "000a",
      name: "Variante sintética",
      courseId: "c2",
      status: "baja confirmada",
    },
    { ...a, identity: "000B" },
    { ...a, identity: "" },
  ]);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    identity: "000a",
    status: "baja confirmada",
    names: ["Nombre sintético", "Variante sintética"],
    provenance: ["v1:fila:2"],
  });
  expect(rows[0]?.courses).toHaveLength(2);
  expect(rows[0]?.observations).toHaveLength(1);
});
it("baja individual del ciclo admite ausencia del padrón sin inventar inscripción y rechaza duplicados o identidad inválida", () => {
  const p = trackingPackage();
  p.cycleWithdrawals = [
    {
      identity: "000AUSENTE",
      reason: "Decisión sintética",
      sourceReference: "Autorización sintética",
    },
  ];
  const r = resolveAcademicPackage(
    p,
    "27-1",
    "c1",
    "2026-09-20",
    "v1",
    "admin-real",
  );
  expect(r.academic.context.withdrawals).toContainEqual(
    expect.objectContaining({
      identity: "000AUSENTE",
      approvedBy: "admin-real",
      version: "v1",
      confirmedCutId: "c1",
    }),
  );
  expect(r.academic.persons).toHaveLength(5);
  expect(
    cycleWithdrawalSchema.safeParse({ ...p.cycleWithdrawals[0], identity: 123 })
      .success,
  ).toBe(false);
  expect(() =>
    validateAcademicPackage(
      {
        ...p,
        cycleWithdrawals: [
          ...p.cycleWithdrawals!,
          { ...p.cycleWithdrawals![0], identity: "000ausente@example.invalid" },
        ],
      },
      "27-1",
    ),
  ).toThrow("duplicadas");
});
it("actualizar padrón/catalogo conserva decisiones de baja independientes de las inscripciones", () => {
  const f = intakeFixture();
  const prior = {
    ...f.initial.package,
    cycleWithdrawals: [
      {
        identity: "000AUSENTE",
        reason: "Decisión sintética",
        sourceReference: "Autorización sintética",
      },
    ],
  };
  // Las revisiones auditadas serializan las claves en orden canónico.
  prior.catalog = prior.catalog.map((c) => ({
    ...c,
    original: Object.fromEntries(Object.entries(c.original!).reverse()),
  }));
  // La misma ruta usada por la revisión visual de fuentes.
  const r = buildAdministration(f.roster, f.catalog, f.config, "admin", prior);
  expect(r.issues).toEqual([]);
  expect(r.package.cycleWithdrawals).toEqual(prior.cycleWithdrawals);
});
