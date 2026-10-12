import { it, expect } from "vitest";
import { prepareApprovedPackage } from "../../src/importing/approved-matrix";
import { approvedPackage } from "../fixtures/synthetic/approved-package";

function fixture() {
  const p = approvedPackage();
  const input: Parameters<typeof prepareApprovedPackage>[0] = {
    cycle: p.cycle,
    calendar: p.calendar,
    schedule: p.schedule,
    sources: [
      { ...p.sources[0]!, id: "P02" },
      { ...p.sources[0]!, id: "C02", name: "catalogo.xlsx" },
    ],
    roster: [
      [
        "matricula",
        "nombre",
        "modalidad",
        "turno",
        "carrera",
        "grupo",
        "fecha de inscripcion",
      ],
      [
        "000A",
        "Persona ficticia",
        "Escolarizado",
        "Matutino",
        "Programa declarado",
        "27-1 LAF 11 01A",
        "31/08/2026",
      ],
    ],
    catalog: [
      [
        "Abreviatura",
        "Nombre del programa",
        "Estado",
        "Plan",
        "Abreviatura estado",
        "Coordinador",
        "Observaciones",
      ],
      [
        "LAF",
        "Programa oficial",
        "Activo",
        "Plan conservado",
        "Activo",
        "Responsable ficticio",
        "Campus demo",
      ],
    ],
    sheets: {
      "Inscripciones actuales": [
        ["Fila P02"],
        [
          2,
          "000A",
          "Persona ficticia",
          "Escolarizado",
          "Matutino",
          "Programa declarado",
          "27-1 LAF 11 01A",
          "31/08/2026",
          "000a",
          "27-1 LAF 11 01A",
          "27-1",
          "LAF",
          "Base",
          "Programa oficial",
          "Responsable ficticio",
          null,
          2,
          "Dentro del ciclo",
          1,
          null,
          null,
          null,
        ],
      ],
      "Afiliaciones actuales": [
        ["Matrícula"],
        [
          "000A",
          "Persona ficticia",
          1,
          "2",
          "Principal resuelto",
          "27-1 LAF 11 01A",
          "Base",
          "Programa oficial",
          "Responsable ficticio",
        ],
      ],
      "Excepciones actuales": [["Caso"]],
      "Decisiones aprobadas": [
        ["Decisión"],
        [
          "DEC-24",
          "Fuente operativa única",
          "Sin suplemento duplicado",
          "Autor ficticio",
          "2026-10-07",
          "Acta ficticia",
        ],
      ],
      Coordinaciones: [
        [
          "CAT-001",
          "Programa oficial",
          "Plan conservado",
          "LAF",
          "Responsable ficticio",
          "Campus demo",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "Responsable ficticio",
          null,
        ],
      ],
      Fuentes: [
        ["P02", null, "CSV", "a".repeat(64)],
        ["C02", null, "Hoja1", "a".repeat(64)],
      ],
    },
  };
  return input;
}
it("convierte fuentes coincidentes sin retipar resoluciones ni asignar permisos", () => {
  const r = prepareApprovedPackage(fixture());
  expect(r.controls).toMatchObject({
    rows: 1,
    identities: 1,
    principals: 1,
    discrepancies: 0,
    pending: 0,
  });
  expect(r.package.catalog[0]).toMatchObject({
    id: "laf",
    program: "Programa oficial",
    plan: "Plan conservado",
    responsible: "Responsable ficticio",
    campus: "Campus demo",
  });
  expect(r.package.enrollments[0]?.original.career).toBe("Programa declarado");
  expect(r.package).not.toHaveProperty("memberships");
  expect(r.package.approvals?.[0]?.declaredAuthor).toBe("Autor ficticio");
});
it("no convierte fuentes nuevas, originales divergentes o revisiones pendientes en aprobaciones", () => {
  const hash = fixture();
  hash.sources[0]!.sha256 = "b".repeat(64);
  expect(() => prepareApprovedPackage(hash)).toThrow("fuente cambió");
  const altered = fixture();
  altered.roster[1]![5] = "27-1 LAF 11 02A";
  expect(() => prepareApprovedPackage(altered)).toThrow("Original");
  const pending = fixture();
  pending.sheets["Excepciones actuales"]!.push([
    "REV-001",
    "Tipo",
    "000A",
    "Persona",
    "2",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "Pendiente",
  ]);
  expect(() => prepareApprovedPackage(pending)).toThrow("pendiente");
});

it("importa ambos extremos base/especial, conserva fechas y cambia el principal por resolución individual", () => {
  const input = fixture();
  const first = input.sheets["Inscripciones actuales"]![1]!;
  const second = structuredClone(first);
  second[0] = 3;
  second[6] = second[9] = "27-1 LAF 24 02A";
  second[7] = "29/08/2026";
  first[7] = "12/09/2026";
  first[19] = "Grupo base vigente por decisión individual";
  second[12] = "Especial";
  second[19] = "Grupo especial vigente por decisión individual";
  for (const row of [first, second]) {
    row[20] = `DEC-36: Fecha original ${String(row[7])} conservada y aceptada para esta clasificación individual; P02 fila ${row === first ? 3 : 2}.`;
  }
  input.sheets["Inscripciones actuales"]!.push(second);
  input.roster = [input.roster[0]!, first.slice(1, 8), second.slice(1, 8)];
  input.sheets["Decisiones aprobadas"]!.push([
    "DEC-36",
    "Clasificación individual",
    "Dos registros",
    "Autor ficticio",
    "2026-10-07",
  ]);
  input.sheets["Excepciones actuales"]!.push([
    "REV-075",
    "Clasificación",
    "000A",
    "Persona ficticia",
    "2,3",
    null,
    null,
    null,
    null,
    "Base y especial aprobados",
    "Autor ficticio",
    "2026-10-07",
    "Resuelta",
  ]);
  const r = prepareApprovedPackage(input);
  expect(r.controls).toMatchObject({
    rows: 2,
    principals: 1,
    reviews: 1,
    pending: 0,
    discrepancies: 0,
  });
  expect(
    r.package.decisions.map((d) => [
      d.kind,
      d.primary,
      d.originalDateApproved,
      d.date,
    ]),
  ).toEqual([
    ["base", true, true, undefined],
    ["especial", false, true, undefined],
  ]);
  expect(
    r.result.academic.enrollments.map((e) => [
      e.date,
      e.originalDate,
      e.group,
      e.kind,
    ]),
  ).toEqual([
    ["2026-09-12", "2026-09-12", "27-1 LAF 11 01A", "base"],
    ["2026-08-29", "2026-08-29", "27-1 LAF 24 02A", "especial"],
  ]);
  expect(r.result.academic.persons[0]?.baseEnrollmentId).toBe(
    r.package.enrollments[0]?.key,
  );
  expect(r.package.decisions[0]?.relatedEnrollmentIds).toEqual([
    r.package.enrollments[1]?.key,
  ]);
  const specialFirst = structuredClone(input);
  const rows = specialFirst.sheets["Inscripciones actuales"]!;
  rows[1]![7] = "17/09/2026";
  rows[1]![12] = "Especial";
  rows[1]![19] = "Grupo especial vigente por decisión individual";
  rows[2]![7] = "31/08/2026";
  rows[2]![12] = "Base";
  rows[2]![19] = "Grupo base vigente por decisión individual";
  specialFirst.roster = [
    input.roster[0]!,
    rows[1]!.slice(1, 8),
    rows[2]!.slice(1, 8),
  ];
  specialFirst.sheets["Afiliaciones actuales"]![1]![5] = rows[2]![6]!;
  const reversed = prepareApprovedPackage(specialFirst);
  expect(reversed.controls).toMatchObject({ pending: 0, discrepancies: 0 });
  expect(reversed.result.academic.persons[0]?.baseEnrollmentId).toBe(
    reversed.package.enrollments[1]?.key,
  );
});
