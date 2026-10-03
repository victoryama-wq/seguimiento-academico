import { describe, it, expect } from "vitest";
import {
  addValue,
  emptyCounts,
  percentages,
  registration,
  csvCell,
} from "../../src/domain/metrics";
import { grade } from "../../src/domain/academic";
import { metricOperations } from "../../src/domain/metrics-contract";

describe("métricas de actividades seleccionadas", () => {
  it("fixture manual: siete observaciones, cuatro numéricas y un cero incluido", () => {
    const c = emptyCounts();
    [0, "-", "", 8, "texto", 4, 6].forEach((v) => addValue(c, grade(v)));
    expect(c).toEqual({ N: 4, G: 1, V: 1, E: 1, Z: 1, D: 7 });
    expect(c.D).toBe(c.N + c.G + c.V + c.E);
    expect(percentages(c)).toEqual({ coverage: 400 / 7, dashes: 100 / 7 });
    expect(registration(c)).toBe("parcial");
    // 50 % y 100 % con D=6 y D=1 no se promedian como 75 %.
    expect(percentages(c).coverage).not.toBe(75);
  });
  it("D cero no es cobertura cero; distingue ninguna numérica y todo numérico", () => {
    expect(percentages(emptyCounts())).toEqual({
      coverage: null,
      dashes: null,
    });
    const c = emptyCounts();
    addValue(c, grade("-"));
    expect(registration(c)).toBe("ninguna_numerica");
    const n = emptyCounts();
    addValue(n, grade(0));
    expect(registration(n)).toBe("completo");
    expect(percentages(n).coverage).toBe(100);
  });
  it.each(["=SUM(1)", "+1", "-1", "@cmd", " \t=1"])(
    "neutraliza fórmulas %s conservando texto entre comillas",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );
  it("rechaza filtros, selecciones y cursores manipulados", () => {
    const input = { cutId: "metricas", filters: {}, view: "institucion" };
    for (const extra of [
      { offset: -1 },
      { role: "admin" },
      { snapshotId: "../privado" },
      { filters: { careers: ["ajena"] } },
    ])
      expect(
        metricOperations.dashboard.safeParse({ ...input, ...extra }).success,
      ).toBe(false);
    expect(
      metricOperations.configureMetrics.safeParse({
        cutId: "metricas",
        courseId: "c",
        versionId: "v",
        expected: null,
        activities: ["A", "A"],
        teachers: null,
        reason: "prueba",
      }).success,
    ).toBe(false);
  });
});
