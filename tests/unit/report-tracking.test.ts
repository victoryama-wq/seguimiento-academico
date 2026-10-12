import { it, expect } from "vitest";
import * as XLSX from "xlsx";
import { courseFilename } from "../../src/domain/academic";
import {
  approvedSchedule,
  unitsForPrincipal,
  scheduleSchema,
} from "../../src/domain/report-policy";
import { readTable } from "../../src/importing/files";
import { institutionalMapping } from "../../src/importing/report-layout";
import { parseMoodle } from "../../src/importing/mapping";

it("interpreta nombres institucionales y prefijos etiquetados, sin confundir dos números", () => {
  expect(
    courseFilename("777._CURSO_DE_PRUEBA_27-1 Calificaciones.ods"),
  ).toEqual({
    original: "777._CURSO_DE_PRUEBA_27-1 Calificaciones.ods",
    externalId: "777",
    name: "CURSO DE PRUEBA",
    cycle: "27-1",
  });
  expect(
    courseFilename("Muestra 2 - 777._Curso_27-1 Calificaciones.xlsx"),
  ).toMatchObject({ externalId: "777", orderPrefix: "Muestra 2 - " });
  expect(() => courseFilename("2 777 Curso 27-1.csv")).toThrow("ambiguo");
  expect(() => courseFilename("2._777._Curso_27-1.csv")).toThrow("ambiguo");
});
it("aplica semana vencida por modalidad, con Virtual independiente y calendario versionado", () => {
  const schedule = approvedSchedule("2026-09-06");
  expect(unitsForPrincipal(schedule, "Escolarizado", "2026-09-20", 1)).toEqual([
    1, 2,
  ]);
  expect(unitsForPrincipal(schedule, "Ejecutivo", "2026-09-20")).toEqual([
    1, 2, 3,
  ]);
  expect(unitsForPrincipal(schedule, "Virtual", "2026-09-20")).toEqual([
    1, 2, 3,
  ]);
  expect(unitsForPrincipal(schedule, "Virtual", "2026-09-05")).toEqual([]);
  expect(unitsForPrincipal(schedule, "Escolarizado", "2026-10-04", 2)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(unitsForPrincipal(schedule, "Escolarizado", "2026-10-18", 3)).toEqual([
    1, 2, 3, 4, 5, 6, 7,
  ]);
  expect(
    unitsForPrincipal(approvedSchedule("2027-01-10"), "Virtual", "2027-01-10"),
  ).toEqual([1]);
  expect(() =>
    unitsForPrincipal(schedule, "No informada", "2026-09-20"),
  ).toThrow("Modalidad");
  expect(() => scheduleSchema.parse({ ...schedule, virtual: null })).toThrow();
  expect(unitsForPrincipal(schedule, "Escolarizado", "2026-09-05", 2)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(() =>
    unitsForPrincipal(schedule, "Escolarizado", "2026-10-18"),
  ).toThrow();
});
for (const format of ["ods", "xlsx", "csv"] as const)
  it(`identifica unidades, sesiones, cierre, adicionales y totales en ${format}`, () => {
    const headers = [
      "Nombre",
      "Dirección Email",
      "Tarea:Actividad | Unidad 3 (Real)",
      "Examen:Cuestionario. Sesión 1 (Real)",
      "Tarea:Actividad de Cierre. (Real)",
      "Examen:Cuestionario Final (Real)",
      "Tarea:SESION VIRTUAL (Real)",
      "Total del curso (Real)",
      "Subtotal categoría",
      "Último descargado desde este curso",
    ];
    const rows = [
      headers,
      [
        "Persona sintética",
        "000TEST@example.invalid",
        0,
        "",
        "-",
        "incorrecta",
        0,
        999,
        999,
        "metadato",
      ],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(rows),
      "Calificaciones",
    );
    const bytes = XLSX.write(wb, { type: "buffer", bookType: format });
    const table = readTable(bytes, `777._Curso_27-1.${format}`);
    const mapping = institutionalMapping(table);
    const parsed = parseMoodle(table, {
      ...mapping,
      version: "sintetica",
      approvedBy: "admin",
    });
    expect(parsed.activities.map((a) => a.unit)).toEqual([
      3,
      1,
      7,
      7,
      undefined,
    ]);
    expect(parsed.activities.at(-1)?.additional).toBe(true);
    expect(parsed.accepted[0]?.values.map((v) => v.grade.state)).toEqual([
      "numerica",
      "vacia",
      "guion",
      "invalida",
      "numerica",
    ]);
    const reordered = { ...table, headers: [...table.headers].reverse() };
    const ids = (m: ReturnType<typeof institutionalMapping>) =>
      Object.fromEntries(
        m.columns
          .filter((c) => "activityId" in c)
          .map((c) => [c.selector.header, c.activityId]),
      );
    expect(ids(institutionalMapping(reordered))).toEqual(ids(mapping));
    const bad = structuredClone(mapping);
    const total = bad.columns.find(
      (c) => c.selector.header === "Total del curso (Real)",
    )!;
    Object.assign(total, { kind: "activity", activityId: "total" });
    expect(() =>
      parseMoodle(table, { ...bad, version: "v", approvedBy: "admin" }),
    ).toThrow("total");
  });
it("no inventa identidad, unidad ni actividad ante encabezados ambiguos", () => {
  const table = readTable(Buffer.from("Nombre,Nota\nPersona,0\n"), "x.csv");
  expect(() => institutionalMapping(table)).toThrow("Matrícula");
  for (const header of [
    "Tarea:Unidad 8",
    "Tarea:Unidad 1 y Unidad 2",
    "Dato desconocido",
  ]) {
    const t = readTable(
      Buffer.from(`Correo,${header}\n000A@example.invalid,0\n`),
      "x.csv",
    );
    expect(() => institutionalMapping(t)).toThrow();
  }
});
