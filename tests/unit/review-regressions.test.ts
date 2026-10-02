import { describe, expect, it } from "vitest";
import { resolveAffiliations } from "../../src/domain/academic";
import { LIMITS, readTable } from "../../src/importing/files";
import { parseMoodle, resolveDuplicateRows } from "../../src/importing/mapping";
import { context, enrollment } from "../fixtures/synthetic/academic";

const withdrawal = {
  identity: "000sint01",
  version: "bajas-sinteticas-v2",
  approvedBy: "admin-sintetico",
  reason: "Confirmación sintética",
  effectiveDate: "2026-09-01",
  confirmedCutId: context.cutId,
};

describe("revisión: bajas requieren identidad resuelta", () => {
  it.each(["", "   ", "@example.invalid", "  @example.invalid  "])(
    "no asocia la identidad inválida %j con una baja inválida ni válida",
    (raw) => {
      const original = enrollment({ identity: raw });
      const result = resolveAffiliations([original], {
        ...context,
        withdrawals: [
          { ...withdrawal, identity: "@example.invalid" },
          withdrawal,
        ],
      });
      expect(result.enrollments[0]).toMatchObject({
        identity: raw,
        person: { normalized: null },
        provenance: original.provenance,
        problems: ["identidad_faltante"],
      });
      expect(result.enrollments[0]!.withdrawal).toBeUndefined();
      expect(result.enrollments[0]!.kind).not.toBe("baja");
      expect(result.persons).toEqual([]);
      expect(result.issues).toEqual([
        { code: "identidad_faltante", refs: [original.id] },
      ]);
    },
  );

  it.each([null, 123, false])(
    "rechaza identidad no textual %j en la frontera",
    (raw) => {
      expect(() =>
        resolveAffiliations([{ ...enrollment(), identity: raw }], context),
      ).toThrow();
    },
  );

  it.each(["2026-09-01", null])(
    "mantiene bajas válidas y su auditoría con fecha %j",
    (effectiveDate) => {
      const confirmed = {
        ...withdrawal,
        identity: " 000SINT01@example.invalid ",
        effectiveDate,
      };
      const result = resolveAffiliations(
        [
          enrollment(),
          enrollment({ id: "otra-inscripcion", group: "27-1 LAF 24 05C.A" }),
          enrollment({ id: "otra-persona", identity: "000SINT02" }),
        ],
        {
          ...context,
          withdrawals: [
            { ...withdrawal, identity: "@example.invalid" },
            confirmed,
          ],
        },
      );
      expect(result.enrollments.map((r) => r.kind)).toEqual([
        "baja",
        "baja",
        "base",
      ]);
      expect(result.enrollments[0]!.withdrawal).toEqual({
        ...confirmed,
        identity: confirmed.identity.trim(),
      });
      expect(result.enrollments[1]!.withdrawal).toEqual(
        result.enrollments[0]!.withdrawal,
      );
      expect(result.enrollments[2]!.withdrawal).toBeUndefined();
      expect(result.issues).toEqual([]);
    },
  );
});

const csv = (text: string) =>
  readTable(Buffer.from(text), "revision-sintetica.csv");

describe("revisión: límites CSV durante la lectura", () => {
  it("rechaza la primera fila más ancha antes de leer una celda truncada", () => {
    // El primer separador ya prueba que habrá más columnas que en el encabezado.
    expect(() => csv('Identidad\n000SINT01,"sin cierre')).toThrow(
      "filas desiguales",
    );
  });

  it("rechaza encabezado estrecho seguido por miles de filas anchas", () => {
    const wide = Array(LIMITS.columns).fill("sintetico").join(",");
    const bytes = Buffer.from(
      "Identidad\n" + (wide + "\n").repeat(1000) + '"sin cierre',
    );
    expect(bytes.length).toBeLessThan(LIMITS.bytes);
    expect(() => readTable(bytes, "ancho.csv")).toThrow("filas desiguales");
  });

  it("rechaza una fila corta al terminarla, antes de leer la siguiente", () => {
    expect(() => csv('Identidad,Nota\n000SINT01\n"sin cierre')).toThrow(
      "filas desiguales",
    );
    expect(() => csv("Identidad,Nota\n000SINT01")).toThrow("filas desiguales");
  });

  const width = 25;
  const header = Array.from({ length: width }, (_, i) => `Columna${i}`).join(
    ",",
  );
  // Encabezados y celdas vacías cuentan; las comas/saltos citados no son celdas nuevas.
  const row = ['"texto,con\nsalto"', ...Array<string>(width - 1).fill("")].join(
    ",",
  );
  const atLimit = header + "\n" + (row + "\n").repeat(LIMITS.cells / width - 1);

  it("acepta exactamente 200000 celdas reales, incluido encabezado y vacías", () => {
    const table = csv(atLimit);
    expect(table.rows).toHaveLength(LIMITS.cells / width - 1);
    expect(
      table.headers.length +
        table.rows.reduce((sum, r) => sum + r.cells.length, 0),
    ).toBe(LIMITS.cells);
    expect(table.rows.at(-1)!.cells.map((c) => c.raw)).toEqual([
      "texto,con\nsalto",
      ...Array<string>(width - 1).fill(""),
    ]);
  });

  it("rechaza la celda 200001 sin esperar a completar la fila", () => {
    expect(() => csv(atLimit + 'extra,"sin cierre')).toThrow("celdas CSV");
  });

  it("rechaza también el exceso al final del archivo o en una fila completa", () => {
    expect(() => csv(atLimit + "extra")).toThrow("celdas CSV");
    expect(() => csv(atLimit + row)).toThrow("celdas CSV");
  });
});

const mapping = {
  version: "moodle-revision-v1",
  approvedBy: "admin-sintetico",
  identity: { header: "Correo" },
  columns: [
    { selector: { header: "Tarea" }, kind: "activity", activityId: "tarea-1" },
    { selector: { header: "Total" }, kind: "total" },
  ],
};

describe("revisión: agrupación Moodle cerca del límite", () => {
  it("clasifica 9999 filas sin perder originales y resuelve duplicados con auditoría", () => {
    const regular = Array.from(
      { length: LIMITS.rows - 9 },
      (_, i) =>
        `000SINT${String(i).padStart(5, "0")}@example.invalid,${i % 2 ? "-" : "0"},10`,
    );
    const table = csv(
      [
        "Correo,Tarea,Total",
        "DUP@example.invalid,0,10",
        ",-,10",
        ...regular,
        "CONFLICT@example.invalid,0,10",
        "TUP-D1@example.invalid,-,10",
        " dup ,0,10",
        "@example.invalid,0,10",
        "conflict,5,10",
        "tup-d2,0,10",
      ].join("\n"),
    );
    expect(table.rows).toHaveLength(LIMITS.rows - 1);
    const original = structuredClone(table);
    const report = parseMoodle(table, mapping);
    expect(report.accepted.map((r) => r.person.normalized)).toEqual(
      regular.map((r) => r.split("@")[0]!.toLowerCase()),
    );
    expect(report.accepted[0]!.values[0]!.grade).toMatchObject({
      state: "numerica",
      value: 0,
    });
    expect(report.accepted[1]!.values[0]!.grade.state).toBe("guion");
    expect(report.teachers.map((r) => r.person.normalized)).toEqual([
      "tup-d1",
      "tup-d2",
    ]);
    expect(report.unresolved).toHaveLength(6);
    expect(report.source).toEqual(table.source);
    expect(report.mapping).toEqual(mapping);
    expect(report.issues.map((i) => i.code)).toEqual([
      "identidad_faltante_o_no_literal",
      "identidad_faltante_o_no_literal",
      "fila_duplicada",
      "filas_conflictivas",
    ]);
    const all = [
      ...report.accepted,
      ...report.teachers,
      ...report.unresolved,
    ].sort((a, b) => a.row - b.row);
    expect(all.map((r) => ({ row: r.row, cells: r.original }))).toEqual(
      table.rows,
    );
    expect(new Set(all.map((r) => r.row)).size).toBe(table.rows.length);

    let resolved = table;
    for (const issue of report.issues.filter((i) =>
      ["fila_duplicada", "filas_conflictivas"].includes(i.code),
    )) {
      const rows = issue.refs.map(Number);
      const decision = {
        rows,
        keep: rows[1]!,
        approvedBy: "admin-sintetico",
        reason: "Verificación del fixture sintético",
        version: `resolucion-${issue.code}`,
        identity: mapping.identity,
      };
      const result = resolveDuplicateRows(resolved, decision);
      expect(result.audit).toEqual({
        ...decision,
        source: table.source,
        originals: table.rows.filter((r) => rows.includes(r.row)),
      });
      resolved = result.table;
    }
    const final = parseMoodle(resolved, mapping);
    expect(final.accepted).toHaveLength(regular.length + 2);
    expect(
      final.accepted.find((r) => r.person.normalized === "conflict")!.values[0]!
        .grade,
    ).toMatchObject({ value: 5 });
    expect(final.teachers).toEqual(report.teachers);
    expect(final.unresolved.map((r) => r.row)).toEqual([3, LIMITS.rows - 2]);
    expect(final.issues.map((i) => i.code)).toEqual([
      "identidad_faltante_o_no_literal",
      "identidad_faltante_o_no_literal",
    ]);
    expect(table).toEqual(original);
  });

  it("retiene también docentes duplicados o conflictivos hasta resolverlos", () => {
    const table = csv(
      "Correo,Tarea,Total\nTUP-D1,0,10\ntup-d1@example.invalid,0,10\ntup-d2,0,10\nTUP-D2,5,10",
    );
    const report = parseMoodle(table, mapping);
    expect(report.teachers).toEqual([]);
    expect(report.accepted).toEqual([]);
    expect(report.unresolved.map((r) => r.row)).toEqual([2, 3, 4, 5]);
    expect(report.issues).toEqual([
      { code: "fila_duplicada", refs: ["2", "3"] },
      { code: "filas_conflictivas", refs: ["4", "5"] },
    ]);
  });
});
