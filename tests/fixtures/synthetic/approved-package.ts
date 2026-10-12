import type { AcademicPackage } from "../../../src/domain/decision-package";
import { enrollmentKey } from "../../../src/importing/decisions";

export function enrollment(
  identity: string,
  group = "27-1 LAF 11 01A",
  date = "31/08/2026",
  row = 2,
  modality = "Escolarizado",
  occurrence = 1,
): AcademicPackage["enrollments"][number] {
  const original = {
    identity,
    name: "Persona sintética",
    career: "Programa declarado",
    group,
    date,
    modality,
    shift: "Matutino",
  };
  return {
    key: enrollmentKey(original, occurrence),
    occurrence,
    original,
    sourceId: "roster",
    row,
  };
}
export function approvedPackage(): AcademicPackage {
  return {
    schemaVersion: 1,
    rulesVersion: "approved-2026-10",
    cycle: "27-1",
    reason: "Aprobación sintética",
    calendar: {
      "2026-08-31": "base",
      "2026-08-29": "especial",
      "2026-08-30": "practica",
      "2026-08-28": "excluida",
    },
    schedule: {
      escolarizado: [
        [1, 2],
        [3, 4, 5],
        [6, 7],
      ],
      ejecutivo: [[1], [2], [3], [4], [5], [6], [7]],
      virtual: null,
      flexible: true,
      cumulative: true,
      completedWeek: true,
    },
    sources: [
      {
        id: "roster",
        name: "padron-sintetico.csv",
        sha256: "a".repeat(64),
        bytes: 200,
        sheet: "CSV",
      },
    ],
    catalog: [
      {
        id: "laf-plan-1",
        abbreviation: "LAF",
        plan: "Plan original",
        coordination: "Responsable sintético A",
        responsible: "Responsable sintético A",
        kind: "carrera",
        architecture: false,
      },
      {
        id: "arq-plan-1",
        abbreviation: "ARQ",
        plan: "Plan B",
        coordination: "Responsable sintético B",
        kind: "carrera",
        architecture: true,
      },
    ],
    enrollments: [
      enrollment("000SINT01"),
      enrollment("000SINT02", "27-1 ARQ 11 01A", "31/08/2026", 3),
    ],
    decisions: [],
    reviews: [],
  };
}
export function decision(
  enrollmentId: string,
  changes: Partial<AcademicPackage["decisions"][number]> = {},
): AcademicPackage["decisions"][number] {
  return {
    enrollmentId,
    primary: false,
    rule: "DEC-sintética",
    reason: "Resolución de prueba",
    decisionDate: "2026-10-07",
    sourceReference: "Acta sintética",
    ...changes,
  };
}
