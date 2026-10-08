import { expect, it } from "vitest";
import { unitsForProgress } from "../../src/domain/report-policy";
import {
  accumulateRows,
  reviewAccumulation,
} from "../../src/domain/accumulation";
import type { RowView } from "../../src/domain/import-contract";

it("avance explícito independiente por modalidad, sin fechas; rechaza rangos y modalidades desconocidas", () => {
  for (const [schoolCut, expected] of [
    [1, 2],
    [2, 5],
    [3, 7],
  ]) {
    const p = { schoolCut: schoolCut!, executiveUnit: 3, virtualUnit: 6 };
    expect(unitsForProgress(p, "Escolarizado")).toHaveLength(expected!);
    expect(unitsForProgress(p, "Ejecutivo")).toEqual([1, 2, 3]);
    expect(unitsForProgress(p, "Virtual")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => unitsForProgress(p, "desconocida")).toThrow();
    expect(() =>
      unitsForProgress({ ...p, executiveUnit: 0 }, "Ejecutivo"),
    ).toThrow();
  }
});
it("revisión distingue cero, vacío, guion, ausencia y conserva el historial original en cada versión", () => {
  const row: RowView = {
    id: "1",
    identity: "000A",
    careerId: "a",
    row: 2,
    issues: [],
    values: [
      {
        activityId: "u1",
        state: "numerica",
        raw: 0,
        sourceVersion: "original",
      },
      {
        activityId: "u2",
        state: "numerica",
        raw: 8,
        sourceVersion: "original",
      },
      {
        activityId: "ausente",
        state: "numerica",
        raw: 9,
        sourceVersion: "original",
      },
      {
        activityId: "igual",
        state: "guion",
        raw: "-",
        sourceVersion: "original",
      },
    ],
  };
  const incoming = {
    ...row,
    values: [
      { activityId: "u1", state: "vacia", raw: "", sourceVersion: "nuevo" },
      { activityId: "u2", state: "guion", raw: "-", sourceVersion: "nuevo" },
      { activityId: "igual", state: "guion", raw: "-", sourceVersion: "nuevo" },
      { activityId: "u3", state: "numerica", raw: 0, sourceVersion: "nuevo" },
    ],
  };
  const result = reviewAccumulation([row], [incoming]);
  expect(result.summaries.a).toEqual({
    newActivities: ["u3"],
    added: 1,
    changed: 2,
    unchanged: 1,
    preserved: 1,
    numericCleared: 2,
  });
  expect(result.rows[0]!.review[0]).toMatchObject({
    before: { raw: 0, sourceVersion: "original" },
    after: { raw: "", sourceVersion: "nuevo" },
    numericCleared: true,
  });
  const merged = accumulateRows([row], result.rows);
  expect(merged[0]!.values.find((v) => v.activityId === "ausente")).toEqual(
    row.values[2],
  );
  expect(row.values[0]!.raw).toBe(0);
  expect(accumulateRows(merged, [])[0]!.review).toEqual([]);
});
