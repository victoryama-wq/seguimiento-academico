import { identity } from "./academic";
import { addValue, emptyCounts, percentages } from "./metrics";
import type { Dashboard } from "./metrics-contract";
import type { Correspondence } from "./history-contract";
import { comparisonSchema } from "./history-contract";
import type { z } from "zod";

export function calendarDates(first: string, count: number): string[] {
  const start = Date.parse(`${first}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 21 * 86400000).toISOString().slice(0, 10),
  );
}
export function validateCorrespondences(pairs: Correspondence[]) {
  for (const side of ["before", "after"] as const) {
    const keys = pairs.map((p) => JSON.stringify([p.courseId, p[side]]));
    if (new Set(keys).size !== keys.length)
      throw new Error(
        "Correspondencia ambigua: cada actividad debe tener una sola pareja.",
      );
  }
}
/** Only authorized, selected, immutable observations enter this pure function. */
export function compareHistory(
  left: Dashboard,
  right: Dashboard,
  pairs: Correspondence[],
): z.infer<typeof comparisonSchema> {
  validateCorrespondences(pairs);
  const key = (course: string, student: string) =>
    JSON.stringify([course, identity(student).normalized]);
  const a = new Map(left.details.map((r) => [key(r.courseId, r.identity), r]));
  const b = new Map(right.details.map((r) => [key(r.courseId, r.identity), r]));
  const common: z.infer<typeof comparisonSchema>["common"] = [];
  const changes: z.infer<typeof comparisonSchema>["changes"] = [];
  const before = emptyCounts(),
    after = emptyCounts();
  const byCourse = new Map<string, Correspondence[]>();
  for (const pair of pairs)
    byCourse.set(pair.courseId, [...(byCourse.get(pair.courseId) ?? []), pair]);
  for (const [id, row] of a) {
    const other = b.get(id);
    if (!other) {
      const withdrawal = right.exclusions.find(
        (e) =>
          e.courseId === row.courseId &&
          identity(e.identity).normalized ===
            identity(row.identity).normalized &&
          /baja/i.test(e.reason),
      );
      changes.push({
        kind: withdrawal ? "baja" : "fuera_del_universo",
        student: row.identity,
        courseId: row.courseId,
        description: withdrawal
          ? "Baja; no representa recuperación."
          : "Sin observación elegible en el segundo corte dentro del alcance autorizado.",
        provenance: withdrawal?.provenance ?? row.versionId,
      });
      continue;
    }
    if (
      JSON.stringify([row.careerId, row.group, row.modality, row.shift]) !==
      JSON.stringify([other.careerId, other.group, other.modality, other.shift])
    )
      changes.push({
        kind: "afiliacion",
        student: row.identity,
        courseId: row.courseId,
        description: `${row.careerId} / ${row.group} → ${other.careerId} / ${other.group}`,
        provenance: JSON.stringify([row.sourceVersions, other.sourceVersions]),
      });
    for (const pair of byCourse.get(row.courseId) ?? []) {
      const v1 = row.values.find((v) => v.activityId === pair.before),
        v2 = other.values.find((v) => v.activityId === pair.after);
      if (!v1 || !v2) continue;
      common.push({
        student: identity(row.identity).normalized!,
        courseId: row.courseId,
        beforeActivity: pair.before,
        afterActivity: pair.after,
        before: v1,
        after: v2,
        beforeVersion: row.versionId,
        afterVersion: other.versionId,
      });
      addValue(before, v1);
      addValue(after, v2);
    }
  }
  for (const [id, row] of b)
    if (!a.has(id))
      changes.push({
        kind: "incorporacion",
        student: row.identity,
        courseId: row.courseId,
        description:
          "Incorporación al universo autorizado; fuera del cálculo común.",
        provenance: row.versionId,
      });
  for (const [data, side] of [
    [left, "before"],
    [right, "after"],
  ] as const) {
    for (const course of data.courses) {
      if (!course.versionId)
        changes.push({
          kind: "sin_archivo",
          student: "",
          courseId: course.id,
          description: `${data.cutId}: sin archivo publicado`,
          provenance: data.snapshotId,
        });
      for (const activity of course.activities)
        if (!(byCourse.get(course.id) ?? []).some((p) => p[side] === activity))
          changes.push({
            kind:
              side === "before"
                ? "actividad_retirada_o_sin_correspondencia"
                : "actividad_anadida_o_sin_correspondencia",
            student: "",
            courseId: course.id,
            description: `${data.cutId}: ${activity}`,
            provenance: course.selectionId ?? "",
          });
    }
    for (const e of data.exclusions)
      changes.push({
        kind: "exclusion",
        student: e.identity,
        courseId: e.courseId ?? "",
        description: `${data.cutId}: ${e.reason}`,
        provenance: e.provenance,
      });
  }
  common.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
  changes.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
  const beforeCoverage = percentages(before).coverage,
    afterCoverage = percentages(after).coverage;
  return {
    beforeCut: left.cutId,
    afterCut: right.cutId,
    mappingId: null,
    comparable: before.D > 0,
    reason: before.D
      ? "Universo común explícito. El guion no demuestra falta de entrega ni retraso docente."
      : pairs.length
        ? "No comparable: sin denominador común elegible."
        : "No comparable: sin correspondencias aprobadas.",
    before,
    after,
    beforeCoverage,
    afterCoverage,
    differencePoints:
      beforeCoverage === null || afterCoverage === null
        ? null
        : afterCoverage - beforeCoverage,
    universe: common.length,
    students: new Set(common.map((r) => r.student)).size,
    common,
    changes,
    total: common.length,
    next: null,
    snapshots: [left.snapshotId, right.snapshotId],
    mappingAudit: "",
  };
}
