import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { civilDate } from "../../src/domain/academic";
import { LIMITS, readTable } from "../../src/importing/files";
import {
  mapRecords,
  parseMoodle,
  resolveDuplicateRows,
  selectColumn,
  suggestColumn,
} from "../../src/importing/mapping";
import { odsFixture, zipFixture } from "../fixtures/synthetic/zip";
import { prepareRoster } from "../../src/importing/roster";
import { resolveAffiliations } from "../../src/domain/academic";
import { context } from "../fixtures/synthetic/academic";

const mapping = {
  version: "moodle-sintetico-v1",
  approvedBy: "admin-sintetico",
  identity: { header: "Correo" },
  columns: [
    {
      selector: { header: "Tarea: Uno" },
      kind: "activity",
      activityId: "tarea-1",
    },
    {
      selector: { header: "Tarea: Dos" },
      kind: "activity",
      activityId: "tarea-2",
    },
    {
      selector: { header: "Cuestionario: Futuro" },
      kind: "activity",
      activityId: "quiz-futuro",
    },
    { selector: { header: "Categoría: Unidad" }, kind: "category" },
    { selector: { header: "Total del curso" }, kind: "total" },
    {
      selector: { header: "Último descargado desde este curso" },
      kind: "metadata",
    },
  ],
};
function fixture(extension: string) {
  const name = `1 Curso Sintético 27-1.${extension}`;
  return readTable(
    readFileSync(
      new URL(`../fixtures/synthetic/parsers/${name}`, import.meta.url),
    ),
    name,
  );
}
function workbook(
  rows: (string | number | null)[][],
  format: "xlsx" | "ods" = "xlsx",
  edit?: (book: XLSX.WorkBook) => void,
) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Datos");
  edit?.(book);
  return XLSX.write(book, {
    type: "buffer",
    bookType: format,
    compression: true,
  }) as Buffer;
}

describe.each(["ods", "xlsx", "csv"])("archivo sintético %s", (extension) => {
  it("lee bytes reales y conserva fuente, identidad y estados distintos", () => {
    const table = fixture(extension),
      report = parseMoodle(table, mapping);
    expect(table.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(table.source.bytes).toBeGreaterThan(0);
    expect(table.headers).toHaveLength(7);
    expect(report.accepted).toHaveLength(2);
    expect(report.teachers).toHaveLength(1);
    expect(report.accepted[0]!.person.normalized).toBe("000sint01");
    expect(report.accepted[0]!.values.map((v) => v.grade.state)).toEqual([
      "numerica",
      "guion",
      "vacia",
    ]);
    expect(report.accepted[0]!.values[0]!.grade).toMatchObject({ value: 0 });
    expect(report.issues).toContainEqual({
      code: "calificacion_invalida",
      refs: ["4", "tarea-1"],
    });
    expect(report.activities.map((a) => a.activityId)).toEqual([
      "tarea-1",
      "tarea-2",
      "quiz-futuro",
    ]);
    expect(report).not.toHaveProperty("coverage"); // Etapa 04; futuro no se selecciona por defecto.
  });
  it("reordenar columnas conserva IDs y notas, no fusiona tareas", () => {
    const table = fixture(extension),
      order = [6, 3, 2, 0, 5, 1, 4];
    const reordered = {
      ...table,
      headers: order.map((i) => table.headers[i]!),
      rows: table.rows.map((row) => ({
        ...row,
        cells: order.map((i) => row.cells[i]!),
      })),
    };
    expect(
      parseMoodle(reordered, mapping).accepted.map((r) => r.values),
    ).toEqual(parseMoodle(table, mapping).accepted.map((r) => r.values));
  });
  it("duplicados y conflictos quedan retenidos hasta resolución auditada", () => {
    const table = fixture(extension);
    const original = table.rows[0]!;
    const duplicated = { ...table, rows: [original, { ...original, row: 9 }] };
    const report = parseMoodle(duplicated, mapping);
    expect(report.accepted).toHaveLength(0);
    expect(report.unresolved).toHaveLength(2);
    expect(report.issues[0]!.code).toBe("fila_duplicada");
    const cells = original.cells.map((c) => ({ ...c }));
    cells[1]!.raw = 4;
    const conflict = { ...table, rows: [original, { cells, row: 9 }] };
    expect(parseMoodle(conflict, mapping).issues[0]!.code).toBe(
      "filas_conflictivas",
    );
    const resolved = resolveDuplicateRows(conflict, {
      rows: [2, 9],
      keep: 9,
      approvedBy: "admin-sintetico",
      reason: "Fixture validado",
      version: "resolucion-v1",
      identity: mapping.identity,
    });
    expect(
      parseMoodle(resolved.table, mapping).accepted[0]!.values[0]!.grade,
    ).toMatchObject({ value: 4 });
    expect(resolved.audit.originals).toHaveLength(2);
  });
});

describe("mapeos revisables", () => {
  it("encabezados repetidos ligan la revisión al hash exacto", () => {
    const table = readTable(
      Buffer.from("Correo,Tarea,Tarea\nSINT01,0,-\n"),
      "duplicadas.csv",
    );
    const approved = {
      ...mapping,
      sourceSha256: table.source.sha256,
      columns: [
        {
          selector: { header: "Tarea", column: 1 },
          kind: "activity",
          activityId: "t1",
        },
        {
          selector: { header: "Tarea", column: 2 },
          kind: "activity",
          activityId: "t2",
        },
      ],
    };
    expect(
      parseMoodle(table, approved).accepted[0]!.values.map(
        (v) => v.grade.state,
      ),
    ).toEqual(["numerica", "guion"]);
    const changed = readTable(
      Buffer.from("Correo,Tarea,Tarea\nSINT01,-,0\n"),
      "duplicadas.csv",
    );
    expect(() => parseMoodle(changed, approved)).toThrow("hash");
  });
  it("integra padrón con dominio y retiene filas sin identidad en revisión", () => {
    const headers = [
      "identity",
      "name",
      "careerId",
      "group",
      "modality",
      "shift",
      "date",
    ];
    const values = [
      "000SINT01",
      "Persona Sintética",
      "laf-plan-1",
      "27-1 LAF 24 01A",
      "Ejecutivo",
      "Vespertino",
      "2026-08-31",
    ];
    const bytes = workbook([headers, values, [null, ...values.slice(1)]]);
    const table = readTable(bytes, "padron.xlsx");
    const preview = prepareRoster(
      table,
      Object.fromEntries(headers.map((header) => [header, { header }])),
      "padron-v1",
      "27-1",
    );
    expect(preview.records).toHaveLength(2);
    expect(preview.enrollments).toHaveLength(1);
    expect(preview.issues.map((i) => i.code)).toContain(
      "inscripcion_requiere_resolucion",
    );
    expect(
      resolveAffiliations(preview.enrollments, context).persons[0]!
        .baseEnrollmentId,
    ).toBe("padron-v1:fila:2");
  });
  it("no acepta actividades nuevas, renombradas o IDs duplicados sin revisar", () => {
    const table = fixture("csv");
    expect(() =>
      parseMoodle(
        {
          ...table,
          headers: table.headers.map((h) =>
            h === "Tarea: Uno" ? "Tarea: Nueva" : h,
          ),
        },
        mapping,
      ),
    ).toThrow("ausente");
    expect(() =>
      parseMoodle(table, {
        ...mapping,
        columns: mapping.columns.map((c) =>
          c.activityId ? { ...c, activityId: "misma" } : c,
        ),
      }),
    ).toThrow("repetidos");
    expect(() =>
      parseMoodle(table, { ...mapping, columns: mapping.columns.slice(1) }),
    ).toThrow("cada columna");
  });
  it("encabezados idénticos requieren columna; cambios de texto invalidan selector", () => {
    expect(() => selectColumn(["Tarea", "Tarea"], { header: "Tarea" })).toThrow(
      "ambiguo",
    );
    expect(
      selectColumn(["Tarea", "Tarea"], { header: "Tarea", column: 1 }),
    ).toBe(1);
    expect(() =>
      selectColumn(["Otra", "Tarea"], { header: "Tarea", column: 0 }),
    ).toThrow("cambió");
  });
  it("categorías, totales y descarga solo son sugerencias, columna desconocida requiere revisión", () => {
    expect(
      [
        "Tarea: 1",
        "Categoría: A",
        "Total del curso",
        "Último descargado desde este curso",
        "Actividad sin tipo",
      ].map(suggestColumn),
    ).toEqual(["activity", "category", "total", "metadata", "review"]);
  });
  it("padrón conserva fecha serial y encabezado aprobado", () => {
    const table = readTable(
      readFileSync(
        new URL("../fixtures/synthetic/parsers/padron.xlsx", import.meta.url),
      ),
      "padron.xlsx",
    );
    const headers = [
      "Matrícula",
      "Nombre",
      "Carrera",
      "Grupo",
      "Modalidad",
      "Turno",
      "Fecha de inscripción",
    ];
    const keys = [
      "identity",
      "name",
      "careerId",
      "group",
      "modality",
      "shift",
      "date",
    ];
    const map = Object.fromEntries(
      keys.map((key, i) => [key, { header: headers[i] }]),
    );
    const row = mapRecords(table, "roster", map, "padron-v1")[0]!;
    expect(row.issues).toEqual([]);
    expect(row.values.identity!.raw).toBe("000SINT01");
    expect(row.values.date!.raw).toBe(46265);
    expect(civilDate(row.values.date!.raw, table.source.epoch)).toBe(
      "2026-08-31",
    );
    expect(row.provenance.mapping.date).toEqual({
      header: "Fecha de inscripción",
    });
    expect(() => mapRecords(table, "roster", {}, "v1")).toThrow("Falta mapeo");
  });
  it.each(["ods", "xlsx", "csv"] as const)(
    "catálogo y suplemento con encabezados configurables %s",
    (format) => {
      const fields = [
        "identity",
        "name",
        "careerId",
        "group",
        "modality",
        "shift",
        "date",
        "replacesId",
        "approvedBy",
        "reason",
        "abbreviation",
        "coordination",
        "kind",
        "plan",
      ];
      const headers = fields.map((f) => `Fuente ${f}`);
      const raw = fields.map((f) =>
        f === "identity" ? "000SINT01" : `sintetico-${f}`,
      );
      const bytes =
        format === "csv"
          ? Buffer.from([headers.join(","), raw.join(",")].join("\n"))
          : workbook([headers, raw], format);
      const table = readTable(bytes, `datos.${format}`);
      const map = Object.fromEntries(
        fields.map((f, i) => [f, { header: headers[i] }]),
      );
      for (const kind of ["catalog", "supplement"] as const)
        expect(mapRecords(table, kind, map, "fuente-v1")[0]!.issues).toEqual(
          [],
        );
    },
  );
  it("no convierte matrícula numérica con formato de ceros ni fórmulas a identidad válida", () => {
    const bytes = workbook(
      [
        ["Correo", "Nota"],
        [1, 5],
      ],
      "xlsx",
      (book) => {
        book.Sheets.Datos!.A2!.z = "0000";
        book.Sheets.Datos!.B2!.f = "1+4";
      },
    );
    const table = readTable(bytes, "reporte.xlsx");
    const result = parseMoodle(table, {
      ...mapping,
      columns: [
        { selector: { header: "Nota" }, kind: "activity", activityId: "uno" },
      ],
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.issues.map((i) => i.code)).toContain("calificacion_invalida");
  });
});

describe("validación de formatos y límites", () => {
  it("ODS independiente de SheetJS preserva fecha civil y texto", () => {
    const xml =
      '<table:table-row><table:table-cell office:value-type="string"><text:p>Fecha</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Identidad</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="date" office:date-value="2026-08-31"><text:p>31/08/2026</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>000SINT01</text:p></table:table-cell></table:table-row>';
    const table = readTable(odsFixture(xml), "independiente.ods");
    expect(civilDate(table.rows[0]!.cells[0]!.raw, table.source.epoch)).toBe(
      "2026-08-31",
    );
    expect(table.rows[0]!.cells[1]!.raw).toBe("000SINT01");
  });
  it("limita repeticiones, producto filas-columnas ODS, DTD y rutas ZIP", () => {
    expect(() =>
      readTable(
        odsFixture('<table:table-row table:number-rows-repeated="1000000"/>'),
        "bomba.ods",
      ),
    ).toThrow("Repetición");
    expect(() =>
      readTable(
        odsFixture(
          '<table:table-row table:number-rows-repeated="1000"><table:table-cell table:number-columns-repeated="256"/></table:table-row>',
        ),
        "bomba.ods",
      ),
    ).toThrow("Dimensiones");
    expect(() =>
      readTable(
        odsFixture("", '<!DOCTYPE foo [<!ENTITY x "payload">]>'),
        "entidad.ods",
      ),
    ).toThrow("entidades");
    expect(() =>
      readTable(zipFixture({ "../escape.xml": "sin datos" }), "ruta.ods"),
    ).toThrow("inseguro");
  });
  it.each(["xlsx", "ods"] as const)(
    "%s verifica contenido real, ZIP truncado y CRC",
    (format) => {
      const bytes = workbook([["Identidad"], ["SINT01"]], format);
      expect(() =>
        readTable(Buffer.from("Identidad\nSINT01"), `falso.${format}`),
      ).toThrow();
      expect(() =>
        readTable(bytes.subarray(0, bytes.length - 5), `truncado.${format}`),
      ).toThrow();
      expect(() =>
        readTable(bytes, format === "ods" ? "falso.xlsx" : "falso.ods"),
      ).toThrow();
      const corrupt = Buffer.from(bytes);
      corrupt[40] = corrupt[40]! ^ 255;
      expect(() => readTable(corrupt, `corrupto.${format}`)).toThrow();
    },
  );
  it("requiere seleccionar hoja y rechaza combinaciones", () => {
    const bytes = workbook([["Uno"], ["Sintético"]], "xlsx", (book) =>
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.aoa_to_sheet([["Dos"], ["Otro"]]),
        "Otra",
      ),
    );
    expect(() => readTable(bytes, "multi.xlsx")).toThrow("Elegir hoja");
    expect(readTable(bytes, "multi.xlsx", { sheet: "Otra" }).headers).toEqual([
      "Dos",
    ]);
    const merged = workbook(
      [
        ["A", "B"],
        ["sintetico", "otro"],
      ],
      "xlsx",
      (book) => {
        book.Sheets.Datos!["!merges"] = [XLSX.utils.decode_range("A1:B1")];
      },
    );
    expect(() => readTable(merged, "merged.xlsx")).toThrow("combinadas");
  });
  it("CSV conserva ceros, delimitador explícito, comas/comillas y saltos dentro de texto", () => {
    const table = readTable(
      Buffer.from(
        '\uFEFFIdentidad;Texto\r\n000SINT01;"Nombre, sintético\ncon ""comillas"""\r\n',
      ),
      "datos.csv",
      { delimiter: ";" },
    );
    expect(table.rows[0]!.cells.map((c) => c.raw)).toEqual([
      "000SINT01",
      'Nombre, sintético\ncon "comillas"',
    ]);
  });
  it.each([
    'a,b\n"sin cierre,2',
    "a,b\n1,2,3",
    "<html>falso</html>",
    'a,b\n"uno"texto,2',
    "\u0000no-csv",
  ])("rechaza CSV mal formado", (raw) =>
    expect(() => readTable(Buffer.from(raw), "falso.csv")).toThrow(),
  );
  it("rechaza archivo vacío, sobredimensionado, extensión y UTF-8 inválido", () => {
    expect(() => readTable(Buffer.alloc(0), "a.csv")).toThrow("Tamaño");
    expect(() => readTable(Buffer.alloc(LIMITS.bytes + 1), "a.csv")).toThrow(
      "Tamaño",
    );
    expect(() => readTable(Buffer.from([255, 255]), "a.csv")).toThrow();
    expect(() => readTable(Buffer.from("a\nb"), "a.xls")).toThrow("Formato");
  });
  it("limita columnas, filas y expansión declarada del ZIP", () => {
    expect(() =>
      readTable(Buffer.from(Array(257).fill("col").join(",")), "a.csv"),
    ).toThrow("columnas");
    expect(() =>
      readTable(Buffer.from("col\n" + "x\n".repeat(10001)), "a.csv"),
    ).toThrow("filas");
    const bytes = workbook([["Identidad"], ["Sintético"]]);
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt32LE(LIMITS.expanded + 1, central + 24);
    expect(() => readTable(bytes, "bomba.xlsx")).toThrow("límites");
  });
  it("fecha serial 1904 se interpreta con procedencia del libro", () => {
    const bytes = workbook([["Fecha"], [44803]], "xlsx", (book) => {
      book.Workbook = { WBProps: { date1904: true } };
    });
    const table = readTable(bytes, "fecha.xlsx");
    expect(table.source.epoch).toBe("1904");
    expect(civilDate(table.rows[0]!.cells[0]!.raw, table.source.epoch)).toBe(
      "2026-08-31",
    );
  });
});
