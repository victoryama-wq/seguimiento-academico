import {
  enrollmentInputSchema,
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
  cycle: string,
) {
  const records = mapRecords(table, "roster", mapping, version);
  const enrollments: AcademicEnrollment[] = [];
  const issues: Issue[] = [];
  for (const record of records) {
    issues.push(...record.issues);
    const raw = (field: string) => record.values[field]?.raw;
    const parsed = enrollmentInputSchema.safeParse({
      id: `${version}:fila:${record.original.row}`,
      identity: raw("identity"),
      group: raw("group"),
      date: raw("date"),
      careerId: raw("careerId"),
      cycle,
      modality: raw("modality"),
      shift: raw("shift"),
      provenance: { sourceVersion: version, row: record.original.row },
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
