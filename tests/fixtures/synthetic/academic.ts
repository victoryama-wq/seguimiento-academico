import type {
  AcademicContext,
  AcademicEnrollment,
} from "../../../src/domain/academic";

export const context: AcademicContext = {
  cycle: "27-1",
  cutId: "corte-sintetico-1",
  cutDate: "2026-09-21",
  catalogVersion: "catalogo-sintetico-v1",
  catalog: [
    {
      id: "laf-plan-1",
      plan: "plan-sintetico-1",
      abbreviation: "LAF",
      coordination: "coord-ficticia",
      architecture: false,
      kind: "carrera",
    },
    {
      id: "arquitectura-plan-1",
      plan: "plan-sintetico-1",
      abbreviation: "ARQ",
      coordination: "coord-ficticia",
      architecture: true,
      kind: "carrera",
    },
    {
      id: "ingles",
      plan: "plan-sintetico-1",
      abbreviation: "ING",
      coordination: "coord-ficticia",
      architecture: false,
      kind: "ingles",
    },
    {
      id: "clinicos",
      plan: "plan-sintetico-1",
      abbreviation: "CLI",
      coordination: "coord-ficticia",
      architecture: false,
      kind: "clinicos",
    },
    {
      id: "deportes",
      plan: "plan-sintetico-1",
      abbreviation: "DEP",
      coordination: "coord-ficticia",
      architecture: false,
      kind: "deportes",
    },
  ],
  calendar: {
    cycle: "27-1",
    epoch: "1900",
    dates: {
      "2026-08-31": "base",
      "2026-08-29": "especial",
      "2026-08-30": "practica",
      "2026-08-28": "excluida",
      "2026-08-27": "excluida",
      "2026-08-26": "excluida",
    },
  },
  withdrawals: [],
  exceptions: [],
  baseResolutions: [],
};
export function enrollment(
  overrides: Partial<AcademicEnrollment> = {},
): AcademicEnrollment {
  return {
    id: "inscripcion-base",
    identity: " 000SINT01@example.invalid ",
    group: "27-1 LAF 24 01A",
    date: "2026-08-31",
    careerId: "laf-plan-1",
    cycle: "27-1",
    modality: "",
    shift: "",
    provenance: { sourceVersion: "padron-sintetico-v1", row: 2 },
    ...overrides,
  };
}
