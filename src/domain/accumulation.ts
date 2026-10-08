import { identity } from "./academic";
import type { RowView, ReviewSummary } from "./import-contract";

export function reviewAccumulation(previous: RowView[], current: RowView[]) {
  const old = new Map(
    previous.map((r) => [identity(r.identity).normalized, r]),
  );
  const summaries: Record<string, ReviewSummary> = {};
  const oldActivities = new Map<string, Set<string>>();
  for (const row of previous) {
    const ids = oldActivities.get(row.careerId) ?? new Set<string>();
    row.values.forEach((v) => ids.add(v.activityId));
    oldActivities.set(row.careerId, ids);
  }
  const summaryFor = (careerId: string) =>
    (summaries[careerId] ??= {
      newActivities: [],
      added: 0,
      changed: 0,
      unchanged: 0,
      preserved: 0,
      numericCleared: 0,
    });
  const incoming = new Map(
    current.map((r) => [
      identity(r.identity).normalized,
      new Set(r.values.map((v) => v.activityId)),
    ]),
  );
  for (const row of previous)
    summaryFor(row.careerId).preserved += row.values.filter(
      (v) =>
        !incoming.get(identity(row.identity).normalized)?.has(v.activityId),
    ).length;
  const rows = current.map((row) => {
    const values = new Map(
      old
        .get(identity(row.identity).normalized)
        ?.values.map((v) => [v.activityId, v]) ?? [],
    );
    const summary = summaryFor(row.careerId);
    const review = row.values.map((value) => {
      const before = values.get(value.activityId);
      const kind = !before
        ? "added"
        : before.state === value.state &&
            JSON.stringify(before.raw) === JSON.stringify(value.raw)
          ? "unchanged"
          : "changed";
      const numericCleared =
        before?.state === "numerica" &&
        ["vacia", "guion"].includes(value.state);
      summary[kind]++;
      if (numericCleared) summary.numericCleared++;
      if (
        !oldActivities.get(row.careerId)?.has(value.activityId) &&
        !summary.newActivities.includes(value.activityId)
      )
        summary.newActivities.push(value.activityId);
      return {
        activityId: value.activityId,
        label: value.label ?? value.activityId,
        before: before ?? null,
        after: value,
        kind,
        numericCleared,
      } as const;
    });
    return { ...row, review: review.filter((v) => v.kind === "changed") };
  });
  return { rows, summaries };
}

// Las ausencias no son celdas vacías. Solo una celda explícita reemplaza su valor.
export function accumulateRows(
  previous: RowView[],
  current: RowView[],
): RowView[] {
  const index = (rows: RowView[]) => {
    const map = new Map<string, RowView>();
    for (const row of rows) {
      const key = identity(row.identity).normalized;
      if (
        !key ||
        map.has(key) ||
        new Set(row.values.map((v) => v.activityId)).size !== row.values.length
      )
        throw new Error("Identidad o actividad ambigua en acumulación");
      map.set(key, row);
    }
    return map;
  };
  // La revisión pertenece exclusivamente a la propuesta actual, no a celdas ausentes.
  const result = index(previous.map((row) => ({ ...row, review: [] })));
  for (const [key, row] of index(current)) {
    const old = result.get(key);
    const values = new Map(old?.values.map((v) => [v.activityId, v]) ?? []);
    for (const value of row.values) {
      const before = values.get(value.activityId);
      if (
        before &&
        ((before.additional ?? false) !== (value.additional ?? false) ||
          before.unit !== value.unit)
      )
        throw new Error(
          "La correspondencia estable de actividad cambió: revisar mapeo",
        );
      values.set(value.activityId, value);
    }
    const merged = [...values.values()].sort((a, b) =>
      a.activityId.localeCompare(b.activityId),
    );
    result.set(key, {
      ...row,
      values: merged,
      issues: [...new Set([...(old?.issues ?? []), ...row.issues])].filter(
        (code) =>
          code !== "calificacion_invalida" ||
          merged.some((v) => v.state === "invalida"),
      ),
    });
  }
  if (
    result.size > 10000 ||
    [...result.values()].reduce((sum, r) => sum + r.values.length, 0) >
      200000 ||
    new Set(
      [...result.values()].flatMap((r) => r.values.map((v) => v.activityId)),
    ).size > 256
  )
    throw new Error("Acumulación fuera de límites; revisar el alcance");
  return [...result]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row], i) => ({ ...row, id: String(i + 1).padStart(6, "0") }));
}
