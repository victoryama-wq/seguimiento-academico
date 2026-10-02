import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  applySupplement,
  resolveAffiliations,
} from "../../src/domain/academic";
import { readTable } from "../../src/importing/files";
import { prepareRoster } from "../../src/importing/roster";
import { context, enrollment } from "../fixtures/synthetic/academic";

const fields = [
  "identity",
  "name",
  "careerId",
  "group",
  "modality",
  "shift",
  "date",
  "cycle",
];
const mapping = Object.fromEntries(
  fields.map((header) => [header, { header }]),
);
function row(
  cycle: string | number | null = "27-1",
  group = "27-1 LAF 24 01A",
  date: string | number = "2026-08-31",
  person = "000SINT01",
) {
  return [
    person,
    "Persona sintética",
    "laf-plan-1",
    group,
    "Ejecutivo",
    "Vespertino",
    date,
    cycle,
  ];
}
function source(
  rows: (string | number | null)[][],
  format: "xlsx" | "ods" | "csv" = "xlsx",
  epoch: "1900" | "1904" = "1900",
) {
  let bytes: Buffer;
  if (format === "csv")
    bytes = Buffer.from(
      [fields, ...rows]
        .map((r) =>
          r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(","),
        )
        .join("\n"),
    );
  else {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([fields, ...rows]),
      "Padrón sintético",
    );
    book.Workbook = { WBProps: { date1904: epoch === "1904" } };
    bytes = XLSX.write(book, {
      type: "buffer",
      bookType: format,
      compression: true,
    }) as Buffer;
  }
  return readTable(bytes, `padron-sintetico-${epoch}.${format}`);
}

describe.each(["ods", "xlsx", "csv"] as const)(
  "ciclo desde archivo %s hasta afiliación",
  (format) => {
    it.each([true, false])(
      "excepción de otro ciclo con campo mapeado=%s",
      (explicit) => {
        const table = source([row(), row("26-3", "26-3 LAF 24 05C.A")], format);
        const map = explicit
          ? mapping
          : Object.fromEntries(
              Object.entries(mapping).filter(([key]) => key !== "cycle"),
            );
        const preview = prepareRoster(table, map, "padron-v1", "27-1");
        expect(preview.issues).toEqual([]);
        expect(
          preview.enrollments.map((r) => [r.cycle, r.trackingCycle]),
        ).toEqual([
          ["27-1", "27-1"],
          ["26-3", "27-1"],
        ]);
        const special = preview.enrollments[1]!;
        expect(special.provenance).toMatchObject({
          sourceVersion: "padron-v1",
          row: 3,
          source: table.source,
          originals: {
            cycle: explicit ? "26-3" : null,
            cycleBasis: explicit ? "mapped" : "group",
            group: "26-3 LAF 24 05C.A",
            date: "2026-08-31",
          },
        });
        expect(preview.records[1]!.original.cells[7]!.raw).toBe("26-3");
        const unapproved = resolveAffiliations(preview.enrollments, context);
        expect(unapproved.issues.map((i) => i.code)).toContain(
          "ciclo_sin_excepcion",
        );
        const exception = {
          version: "excepcion-v1",
          approvedBy: "admin-sintetico",
          reason: "Excepción sintética confirmada",
          enrollmentId: special.id,
          originalCycle: "26-3",
          targetCycle: "27-1",
          cutId: context.cutId,
          baseEnrollmentId: preview.enrollments[0]!.id,
        };
        const result = resolveAffiliations(preview.enrollments, {
          ...context,
          exceptions: [exception],
        });
        expect(result.issues).toEqual([]);
        expect(result.enrollments[1]).toMatchObject({
          cycle: "26-3",
          trackingCycle: "27-1",
          kind: "especial",
          provenance: special.provenance,
          exception,
        });
        expect(result.persons[0]!.baseEnrollmentId).toBe(
          preview.enrollments[0]!.id,
        );
        expect(result.persons[0]!.enrollmentIds).toHaveLength(2);
      },
    );
    it("no sustituye discrepancias de ciclo por el seguimiento", () => {
      const table = source([row("26-3", "27-1 LAF 24 05C.A")], format);
      const preview = prepareRoster(table, mapping, "conflicto-v1", "27-1");
      expect(preview.enrollments).toEqual([]);
      expect(preview.issues.map((i) => i.code)).toContain(
        "ciclo_grupo_discrepante",
      );
      expect(preview.records[0]!.values.cycle!.raw).toBe("26-3");
      expect(preview.records[0]!.values.group!.raw).toBe("27-1 LAF 24 05C.A");
    });
  },
);

describe("ciclo de origen explícito y seguimiento separado", () => {
  it("respeta ciclo mapeado cuando grupo es ilegible, conservando incidencia académica", () => {
    const preview = prepareRoster(
      source([row("26-3", "grupo ilegible 05C.A")]),
      mapping,
      "v1",
      "27-1",
    );
    expect(preview.enrollments[0]).toMatchObject({
      cycle: "26-3",
      trackingCycle: "27-1",
    });
    expect(
      resolveAffiliations(preview.enrollments, context).issues.map(
        (i) => i.code,
      ),
    ).toEqual(
      expect.arrayContaining(["grupo_ilegible", "ciclo_sin_excepcion"]),
    );
  });
  it.each([null, "", 273, "ciclo-desconocido"])(
    "no repara un campo mapeado inválido %s",
    (cycle) => {
      const preview = prepareRoster(
        source([row(cycle)]),
        mapping,
        "v1",
        "27-1",
      );
      expect(preview.enrollments).toEqual([]);
      expect(preview.issues.map((i) => i.code)).toContain(
        "ciclo_origen_no_resuelto",
      );
    },
  );
  it("sin campo ni grupo válido no usa el seguimiento como ciclo de origen", () => {
    const map = Object.fromEntries(
      Object.entries(mapping).filter(([key]) => key !== "cycle"),
    );
    const preview = prepareRoster(
      source([row(null, "ilegible")]),
      map,
      "v1",
      "27-1",
    );
    expect(preview.enrollments).toEqual([]);
    expect(preview.records).toHaveLength(1);
    expect(preview.issues.map((i) => i.code)).toContain(
      "ciclo_origen_no_resuelto",
    );
  });
  it("un borrador de seguimiento distinto no resuelve una base del corte", () => {
    const preview = prepareRoster(source([row()]), mapping, "v1", "28-1");
    const result = resolveAffiliations(preview.enrollments, context);
    expect(result.persons[0]!.baseEnrollmentId).toBeNull();
    expect(result.issues.map((i) => i.code)).toContain(
      "ciclo_seguimiento_discrepante",
    );
  });
});

describe("fechas de libros mezclados", () => {
  it.each(["America/Cancun", "Pacific/Kiritimati", "America/Los_Angeles"])(
    "1900/1904 conservan 2026-08-31 bajo %s",
    (tz) => {
      const previous = process.env.TZ;
      try {
        process.env.TZ = tz;
        const table1900 = source(
          [row("27-1", "27-1 LAF 24 01A", 46265)],
          "xlsx",
          "1900",
        );
        const table1904 = source(
          [row("27-1", "27-1 LAF 24 01A", 44803, "000SINT02")],
          "xlsx",
          "1904",
        );
        const first = prepareRoster(table1900, mapping, "fuente-1900", "27-1");
        const second = prepareRoster(table1904, mapping, "fuente-1904", "27-1");
        expect([...first.issues, ...second.issues]).toEqual([]);
        expect(second.enrollments[0]).toMatchObject({
          date: "2026-08-31",
          provenance: {
            source: { epoch: "1904", sha256: table1904.source.sha256 },
            originals: { date: 44803 },
          },
        });
        expect(first.enrollments[0]).toMatchObject({
          date: "2026-08-31",
          provenance: { source: { epoch: "1900" }, originals: { date: 46265 } },
        });
        for (const rows of [
          [...first.enrollments, ...second.enrollments],
          [...second.enrollments, ...first.enrollments],
        ]) {
          const result = resolveAffiliations(rows, context);
          expect(result.issues).toEqual([]);
          expect(result.enrollments.map((r) => [r.date, r.kind])).toEqual([
            ["2026-08-31", "base"],
            ["2026-08-31", "base"],
          ]);
          expect(result.persons.every((p) => p.baseEnrollmentId !== null)).toBe(
            true,
          );
        }
        // La frontera de dominio también exige época propia si recibe un serial.
        expect(
          resolveAffiliations(
            [{ ...second.enrollments[0], date: 44803 }],
            context,
          ).enrollments[0]!.date,
        ).toBe("2026-08-31");
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    },
  );
  it("un serial sin procedencia no hereda una época del calendario", () => {
    const result = resolveAffiliations([enrollment({ date: 44803 })], context);
    expect(result.enrollments[0]!.date).toBeNull();
    expect(result.persons[0]!.baseEnrollmentId).toBeNull();
    expect(result.issues.map((i) => i.code)).toContain(
      "fecha_sin_epoca_de_origen",
    );
  });
  it("fecha inválida retiene original en lugar de convertirla en otra fecha", () => {
    const preview = prepareRoster(
      source([row("27-1", "27-1 LAF 24 01A", 60)], "xlsx", "1900"),
      mapping,
      "v1",
      "27-1",
    );
    expect(preview.enrollments).toEqual([]);
    expect(preview.records[0]!.values.date!.raw).toBe(60);
    expect(preview.issues.map((i) => i.code)).toContain(
      "fecha_origen_no_resuelta",
    );
  });
});

function permutations<T>(values: T[]): T[][] {
  if (!values.length) return [[]];
  return values.flatMap((v, i) =>
    permutations(values.filter((_, j) => j !== i)).map((rest) => [v, ...rest]),
  );
}
describe("suplementos desde archivo, independientes del orden del lote", () => {
  // Las filas preparadas de ambos libros atraviesan la misma frontera que el padrón.
  const original = prepareRoster(
    source([row(), row("27-1", "27-1 LAF 24 05C.A")]),
    mapping,
    "padron",
    "27-1",
  ).enrollments;
  const incoming = prepareRoster(
    source(
      [
        row("27-1", "27-1 LAF 24 02A", 44803),
        row("27-1", "27-1 LAF 24 03A", 44803),
      ],
      "xlsx",
      "1904",
    ),
    mapping,
    "suplemento",
    "27-1",
  ).enrollments;
  function change(
    id: string,
    replacesId: string | null,
    record = incoming[0]!,
  ) {
    return {
      id,
      replacesId,
      enrollment: record,
      version: "suplemento-v1",
      approvedBy: "admin-sintetico",
      reason: "Corrección de fixture",
    };
  }
  it("A→B→C se rechaza íntegra en ambas permutaciones y preserva otra corrección independiente", () => {
    const first = change("paso-1", original[0]!.id);
    const second = change("paso-2", incoming[0]!.id, incoming[1]!);
    const independent = change("independiente", original[1]!.id, {
      ...original[1]!,
      group: "27-1 LAF 24 06C.A",
    });
    const results = permutations([first, second, independent]).map((batch) =>
      applySupplement(original, batch),
    );
    for (const result of results) {
      expect(result).toEqual(results[0]);
      expect(result.active[0]).toEqual(original[0]);
      expect(result.active[1]!.group).toBe("27-1 LAF 24 06C.A");
      expect(result.history).toEqual([
        { previous: original[1], changeId: "independiente" },
      ]);
      expect(result.issues).toEqual([
        { code: "suplemento_encadenado_requiere_resolucion", refs: ["paso-1"] },
        { code: "suplemento_encadenado_requiere_resolucion", refs: ["paso-2"] },
      ]);
      expect(resolveAffiliations(result.active, context).issues).toEqual([]);
    }
  });
  it.each(["alta", "ciclo", "destino-existente"])(
    "rechaza dependencias %s sin efectos parciales",
    (scenario) => {
      const batch =
        scenario === "alta"
          ? [change("a", null), change("b", incoming[0]!.id, incoming[1]!)]
          : scenario === "ciclo"
            ? [
                change("a", original[0]!.id, {
                  ...incoming[0]!,
                  id: original[1]!.id,
                }),
                change("b", original[1]!.id, {
                  ...incoming[1]!,
                  id: original[0]!.id,
                }),
              ]
            : [
                change("a", original[0]!.id, {
                  ...incoming[0]!,
                  id: original[1]!.id,
                }),
                change("b", original[1]!.id, incoming[1]!),
              ];
      const first = applySupplement(original, batch),
        reversed = applySupplement(original, [...batch].reverse());
      expect(first).toEqual(reversed);
      expect(first.active).toEqual(original);
      expect(first.history).toEqual([]);
      expect(first.issues).toHaveLength(2);
    },
  );
  it("correcciones independientes sí se aplican con historial y fecha 1904 normalizada", () => {
    const batch = [
      change("a", original[0]!.id),
      change("b", original[1]!.id, {
        ...incoming[1]!,
        group: "27-1 LAF 24 06C.A",
      }),
    ];
    const first = applySupplement(original, batch);
    expect(first).toEqual(applySupplement(original, [...batch].reverse()));
    expect(first.issues).toEqual([]);
    expect(first.history).toHaveLength(2);
    expect(first.active[0]).toMatchObject({
      date: "2026-08-31",
      provenance: { source: { epoch: "1904" }, originals: { date: 44803 } },
    });
    expect(resolveAffiliations(first.active, context).issues).toEqual([]);
    expect(original[0]!.group).toBe("27-1 LAF 24 01A");
  });
});
