import { identity } from "./academic";
import type { RowView } from "./import-contract";

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
  const result = index(previous);
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
