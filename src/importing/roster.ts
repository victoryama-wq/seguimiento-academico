import {
  enrollmentInputSchema,
  academicCycleSchema,
  civilDate,
  group,
  type AcademicEnrollment,
  type Issue,
} from "../domain/academic";
import type { Table } from "./files";
import { mapRecords } from "./mapping";

/** Prepara borradores puros. Cada inscripción conserva una fila, aunque la persona se repita. */
export function prepareRoster(
  table: Table,
  mapping: unknown,
  version: string,
  trackingCycleInput: string,
) {
  const trackingCycle = academicCycleSchema.parse(trackingCycleInput);
  const records = mapRecords(table, "roster", mapping, version);
  const enrollments: AcademicEnrollment[] = [];
  const issues: Issue[] = [];
  for (const record of records) {
    const raw = (field: string) => record.values[field]?.raw;
    const groupOriginal = raw("group");
    const groupCycle =
      typeof groupOriginal === "string"
        ? group(groupOriginal, false).cycle
        : null;
    const mappedCycle = record.values.cycle;
    const cycleResult = academicCycleSchema.safeParse(
      mappedCycle ? mappedCycle.raw : groupCycle,
    );
    if (!cycleResult.success)
      record.issues.push({
        code: "ciclo_origen_no_resuelto",
        refs: [version, String(record.original.row)],
      });
    else if (mappedCycle && groupCycle && cycleResult.data !== groupCycle)
      record.issues.push({
        code: "ciclo_grupo_discrepante",
        refs: [version, String(record.original.row)],
      });
    const date = civilDate(raw("date"), table.source.epoch);
    if (!date)
      record.issues.push({
        code: "fecha_origen_no_resuelta",
        refs: [version, String(record.original.row)],
      });
    issues.push(...record.issues);
    const parsed = enrollmentInputSchema.safeParse({
      id: `${version}:fila:${record.original.row}`,
      identity: raw("identity"),
      group: raw("group"),
      date,
      careerId: raw("careerId"),
      cycle: cycleResult.success ? cycleResult.data : null,
      trackingCycle,
      modality: raw("modality"),
      shift: raw("shift"),
      provenance: {
        sourceVersion: version,
        row: record.original.row,
        source: table.source,
        originals: {
          cycle: mappedCycle?.raw ?? null,
          cycleBasis: mappedCycle ? "mapped" : "group",
          group: groupOriginal,
          date: raw("date"),
        },
      },
    });
    if (parsed.success && !record.issues.length) enrollments.push(parsed.data);
    else
      issues.push({
        code: "inscripcion_requiere_resolucion",
        refs: [version, String(record.original.row)],
      });
  }
  return { enrollments, records, issues };
}
