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
