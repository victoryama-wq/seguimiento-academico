import { approvedPackage, decision, enrollment } from "./approved-package";
import { approvedSchedule } from "../../../src/domain/report-policy";
export function trackingPackage() {
  const p = approvedPackage();
  p.schedule = approvedSchedule("2026-09-06");
  p.enrollments = [
    enrollment("000ESC", "27-1 LAF 11 01A", "31/08/2026", 2, "Escolarizado"),
    enrollment("000EJE", "27-1 LAF 24 02A", "31/08/2026", 3, "Ejecutivo"),
    enrollment("000VIR", "27-1 ARQ 53 03CA", "29/08/2026", 4, "Virtual"),
    enrollment("000BAJA", "27-1 LAF 11 01A", "31/08/2026", 5),
    enrollment("000CICLO", "26-3 LAF 11 01A", "31/08/2026", 6),
  ];
  p.decisions = [
    decision(p.enrollments[3]!.key, { kind: "baja", exclusionReason: "baja" }),
    decision(p.enrollments[4]!.key, {
      kind: "excluida",
      exclusionReason: "ciclo",
    }),
  ];
  return p;
}
export const fullTrackingCsv = [
  "Dirección Email,Tarea:Actividad | Unidad 1 (Real),Tarea:Actividad | Unidad 3 (Real),Tarea:Sesión virtual (Real),Total del curso (Real)",
  "000ESC@example.invalid,0,-,,999",
  "000EJE@example.invalid,-,7,0,999",
  "000VIR@example.invalid,,inválida,-,999",
  "000BAJA@example.invalid,10,10,10,999",
  "000CICLO@example.invalid,10,10,10,999",
].join("\n");
