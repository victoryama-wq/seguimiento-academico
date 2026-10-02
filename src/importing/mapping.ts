import { z } from "zod";
import { grade, identity, type Issue } from "../domain/academic";
import type { Cell, Table } from "./files";

const selectorSchema = z.strictObject({
  header: z.string().min(1),
  column: z.number().int().nonnegative().optional(),
});
export type Selector = z.infer<typeof selectorSchema>;
export function selectColumn(headers: string[], input: unknown): number {
  const selector = selectorSchema.parse(input);
  const candidates = headers.flatMap((h, i) =>
    h === selector.header ? [i] : [],
  );
  if (selector.column !== undefined) {
    if (headers[selector.column] !== selector.header)
      throw new Error("El encabezado cambió: revisar mapeo");
    return selector.column;
  }
  if (candidates.length !== 1)
    throw new Error("Encabezado ausente o ambiguo: indicar columna revisada");
  return candidates[0]!;
}

const requiredFields = {
  roster: [
    "identity",
    "name",
    "careerId",
    "group",
    "modality",
    "shift",
    "date",
  ],
  supplement: [
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
  ],
  catalog: ["careerId", "abbreviation", "coordination", "kind", "plan"],
} as const;

export function mapRecords(
  table: Table,
  kind: keyof typeof requiredFields,
  mappingInput: unknown,
  version: string,
) {
  const mapping = z.record(z.string(), selectorSchema).parse(mappingInput);
  z.string().trim().min(1).parse(version);
  for (const field of requiredFields[kind])
    if (!mapping[field]) throw new Error(`Falta mapeo: ${field}`);
  const columns = Object.entries(mapping).map(([field, selector]) => ({
    field,
    index: selectColumn(table.headers, selector),
  }));
  if (new Set(columns.map((c) => c.index)).size !== columns.length)
    throw new Error("Una columna no puede mapear varios campos");
  return table.rows.map((row) => {
    const issues: Issue[] = [];
    const values: Record<string, Cell> = Object.create(null) as Record<
      string,
      Cell
    >;
    for (const c of columns) {
      const cell = row.cells[c.index]!;
      values[c.field] = cell;
      if (cell.formula || cell.type === "e")
        issues.push({
          code: "celda_no_literal",
          refs: [String(row.row), c.field],
        });
      if (
        requiredFields[kind].includes(c.field as never) &&
        (cell.raw === null || cell.raw === "") &&
        c.field !== "replacesId"
      )
        issues.push({
          code: "campo_faltante",
          refs: [String(row.row), c.field],
        });
    }
    if (values.identity && !identity(values.identity.raw).normalized)
      issues.push({
        code: "identidad_no_textual_o_faltante",
        refs: [String(row.row)],
      });
    return {
      values,
      original: row,
      provenance: {
        ...table.source,
        sourceVersion: version,
        row: row.row,
        mapping,
      },
      issues,
    };
  });
}

export function suggestColumn(
  header: string,
): "total" | "category" | "metadata" | "activity" | "review" {
  if (/^total\b|^course total\b/i.test(header)) return "total";
  if (/^categor[ií]a[: ]/i.test(header)) return "category";
  if (/^Último descargado desde este curso$/i.test(header)) return "metadata";
  if (/^(tarea|cuestionario|foro|assignment|quiz)[: ]/i.test(header))
    return "activity";
  return "review";
}

const moodleMappingSchema = z.strictObject({
  version: z.string().trim().min(1),
  approvedBy: z.string().trim().min(1),
  sourceSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  identity: selectorSchema,
  columns: z.array(
    z.strictObject({
      selector: selectorSchema,
      kind: z.enum(["activity", "category", "total", "metadata"]),
      activityId: z.string().trim().min(1).optional(),
    }),
  ),
});

// Un mapa aprobado conserva IDs explícitos. Un texto nuevo exige revisión; nunca deriva IDs del tipo ni del orden.
export function parseMoodle(table: Table, mappingInput: unknown) {
  const mapping = moodleMappingSchema.parse(mappingInput);
  if (
    (new Set(table.headers).size !== table.headers.length ||
      mapping.sourceSha256) &&
    mapping.sourceSha256 !== table.source.sha256
  )
    throw new Error(
      "Encabezados repetidos: revisar mapeo para este hash de fuente",
    );
  const identityColumn = selectColumn(table.headers, mapping.identity);
  const columns = mapping.columns.map((c) => ({
    ...c,
    index: selectColumn(table.headers, c.selector),
  }));
  if (
    new Set([identityColumn, ...columns.map((c) => c.index)]).size !==
      table.headers.length ||
    columns.length + 1 !== table.headers.length
  )
    throw new Error("Mapear cada columna exactamente una vez");
  const activities = columns.filter((c) => c.kind === "activity");
  if (
    activities.some((c) => !c.activityId) ||
    new Set(activities.map((c) => c.activityId)).size !== activities.length ||
    columns.some((c) => c.kind !== "activity" && c.activityId)
  )
    throw new Error("IDs de actividades ausentes o repetidos");
  const issues: Issue[] = [];
  const parsed = table.rows.map((row) => {
    const cell = row.cells[identityColumn]!;
    const person = identity(
      cell.formula || cell.type === "e" ? null : cell.raw,
    );
    if (!person.normalized)
      issues.push({
        code: "identidad_faltante_o_no_literal",
        refs: [String(row.row)],
      });
    const values = activities.map((c) => {
      const source = row.cells[c.index]!;
      const result =
        source.formula || source.type === "e"
          ? { state: "invalida" as const, raw: source.raw }
          : grade(source.raw);
      if (result.state === "invalida")
        issues.push({
          code: "calificacion_invalida",
          refs: [String(row.row), c.activityId!],
        });
      return { activityId: c.activityId!, grade: result, source };
    });
    return { row: row.row, person, values, original: row.cells };
  });
  const accepted: typeof parsed = [],
    teachers: typeof parsed = [],
    unresolved: typeof parsed = [];
  // Índice construido una vez; no recorrer el reporte completo por identidad.
  const byIdentity = new Map<string, typeof parsed>();
  for (const row of parsed) {
    const id = row.person.normalized;
    if (id === null) continue;
    const matches = byIdentity.get(id);
    if (matches) matches.push(row);
    else byIdentity.set(id, [row]);
  }
  const processed = new Set<string>();
  for (const row of parsed) {
    const id = row.person.normalized;
    if (!id) {
      unresolved.push(row);
      continue;
    }
    if (processed.has(id)) continue;
    processed.add(id);
    const matches = byIdentity.get(id)!;
    // Normaliza solo identidad para comparar; los demás originales se conservan en su totalidad.
    const fingerprints = new Set(
      matches.map((r) =>
        JSON.stringify(
          r.original.map((cell, i) => (i === identityColumn ? id : cell)),
        ),
      ),
    );
    if (matches.length > 1)
      issues.push({
        code: fingerprints.size === 1 ? "fila_duplicada" : "filas_conflictivas",
        refs: matches.map((r) => String(r.row)),
      });
    // Incluso duplicados idénticos requieren resolución: ninguna fila gana por orden.
    if (matches.length > 1) unresolved.push(...matches);
    else if (row.person.teacher) teachers.push(row);
    else accepted.push(row);
  }
  return {
    source: table.source,
    mapping,
    activities,
    accepted,
    teachers,
    unresolved,
    issues,
  };
}

// Resolución explícita por filas: queda un registro auditable; no publica ni persiste.
export function resolveDuplicateRows(table: Table, input: unknown) {
  const decision = z
    .strictObject({
      rows: z.array(z.number().int().positive()).min(2),
      keep: z.number().int().positive(),
      approvedBy: z.string().trim().min(1),
      reason: z.string().trim().min(1),
      version: z.string().trim().min(1),
      identity: selectorSchema,
    })
    .parse(input);
  const col = selectColumn(table.headers, decision.identity);
  const rows = table.rows.filter((r) => decision.rows.includes(r.row));
  if (
    rows.length !== decision.rows.length ||
    new Set(decision.rows).size !== rows.length ||
    !decision.rows.includes(decision.keep)
  )
    throw new Error("Resolución de filas inválida");
  const ids = new Set(rows.map((r) => identity(r.cells[col]!.raw).normalized));
  if (
    ids.size !== 1 ||
    ids.has(null) ||
    rows.some((r) => r.cells[col]!.formula)
  )
    throw new Error("Solo resolver filas de la misma identidad textual");
  return {
    table: {
      ...table,
      rows: table.rows.filter(
        (r) => !decision.rows.includes(r.row) || r.row === decision.keep,
      ),
    },
    audit: { ...decision, source: table.source, originals: rows },
  };
}
