// Datos inventados exclusivamente para pruebas. No corresponden a expedientes.
export const syntheticPerson = {
  id: "persona-sintetica",
  matriculaOriginal: " 0007-Test@ejemplo.invalid ",
  matriculaNormalizada: "0007-test",
};
export const syntheticEnrollment = {
  id: "inscripcion-base",
  personId: syntheticPerson.id,
  cycleId: "27-1",
  rosterVersionId: "padron-v1",
  sourceRow: 2,
  groupOriginal: "27-1 DEMO 24 01A",
  groupDateOriginal: "31/08/2026",
  groupDate: "2026-08-31",
  classification: "base",
  baseEnrollmentId: null,
  coordinationId: null,
};
export const syntheticCut = {
  id: "corte-01",
  cycleId: "27-1",
  date: "2026-09-21",
  rosterVersionId: "padron-v1",
  catalogVersionId: "catalogo-v1",
  exceptionVersionId: null,
  status: "abierto",
};
