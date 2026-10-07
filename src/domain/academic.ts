import { z } from "zod";
import { civilDateSchema } from "./schemas";
import { scheduleSchema } from "./report-policy";

export type Issue = { code: string; refs: string[] };
const text = z.string().trim().min(1);
export const academicCycleSchema = text.regex(/^\d{2}-\d+$/);
const originalCellValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export const provenanceSchema = z.strictObject({
  sourceVersion: text,
  row: z.number().int().positive(),
  source: z
    .strictObject({
      originalName: text,
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      bytes: z.number().int().positive(),
      parserVersion: text,
      sheet: text,
      epoch: z.enum(["1900", "1904"]),
    })
    .optional(),
  originals: z
    .strictObject({
      cycle: originalCellValue,
      cycleBasis: z.enum(["mapped", "group"]),
      group: z.string(),
      date: originalCellValue,
    })
    .optional(),
});
export function identity(raw: unknown) {
  if (typeof raw !== "string")
    return { original: raw, normalized: null, teacher: false };
  const normalized = raw.trim().split("@")[0]!.trim().toLowerCase();
  return {
    original: raw,
    normalized: normalized || null,
    teacher: /^tup-d\d+$/.test(normalized),
  };
}

// No Date local ni coerción de identificadores numéricos.
export function civilDate(
  raw: unknown,
  epoch: "1900" | "1904" = "1900",
): string | null {
  let value: string;
  if (typeof raw === "number") {
    if (
      !Number.isInteger(raw) ||
      raw < 0 ||
      raw > 100000 ||
      (epoch === "1900" && raw === 60)
    )
      return null;
    const offset = epoch === "1904" ? raw : raw > 60 ? raw - 1 : raw;
    value = new Date(
      Date.UTC(
        epoch === "1904" ? 1904 : 1899,
        epoch === "1904" ? 0 : 11,
        epoch === "1904" ? 1 : 31,
      ) +
        offset * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  } else if (typeof raw === "string") {
    value = raw.trim();
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (match) value = `${match[3]}-${match[2]}-${match[1]}`;
  } else return null;
  return civilDateSchema.safeParse(value).success ? value : null;
}

const schedules: Record<string, readonly [string, string]> = {
  "11": ["Escolarizado", "Matutino"],
  "12": ["Escolarizado", "Vespertino"],
  "23": ["Ejecutivo", "Matutino"],
  "24": ["Ejecutivo", "Vespertino"],
  "53": ["Virtual", "Sabatino Matutino"],
  "48": ["Escolarizado", "Nocturno"],
};
export function group(raw: string, architecture: boolean, approved = false) {
  let normalized = raw
    .trim()
    .toUpperCase()
    .replace(/\bCOMPUB\b/g, "CONPUB");
  if (approved)
    normalized = normalized
      .replace(/\s+/g, " ")
      .replace(/^(\d{2})\s*-\s*(\d+)\s+/, "$1-$2 ")
      .replace(/\bDIGRAF\b/g, "DIGRAFT")
      .replace(/(?:C\.A\.?|CA)$/, "C.A");
  const architectureSpecial =
    approved && /^(\d{2}-\d+) ARQ EJEC\. ESP\.?$/.exec(normalized);
  const special = /C\.A$/.test(normalized) || !!architectureSpecial;
  const match = (
    approved
      ? /^(\d{2}-\d+) ([A-Z-]+) (\d{2}) (\d{2})([A-Z]|C\.A)$/
      : /^(\d{2}-\d+) ([A-Z]+) (\d{2}) (\d{2})([A-Z]|C\.A)$/
  ).exec(normalized);
  const issues: string[] = [];
  const prefix = approved
    ? /^(\d{2}-\d+) ([A-Z-]+)(?: |$)/.exec(normalized)
    : null;
  if (!match && !architectureSpecial) issues.push("grupo_ilegible");
  const code = match?.[3];
  const schedule = code ? schedules[code] : undefined;
  if (match && !schedule) issues.push("codigo_desconocido");
  if (code === "48" && !architecture) issues.push("48_fuera_arquitectura");
  return {
    original: raw,
    normalized,
    special,
    cycle:
      match?.[1] ??
      (architectureSpecial ? architectureSpecial[1]! : (prefix?.[1] ?? null)),
    career: match?.[2] ?? (architectureSpecial ? "ARQ" : (prefix?.[2] ?? null)),
    grade: match?.[4] ?? null,
    section: match?.[5] ?? null,
    modality: schedule?.[0] ?? (architectureSpecial ? "Ejecutivo" : null),
    shift: schedule?.[1] ?? null,
    issues,
  };
}

export const enrollmentInputSchema = z.strictObject({
  id: text,
  identity: z.string(),
  group: z.string(),
  date: z.union([z.string(), z.number()]),
  careerId: text,
  // Ciclo de origen de la inscripción; nunca sustituirlo por el del corte.
  cycle: academicCycleSchema,
  trackingCycle: academicCycleSchema.optional(),
  modality: z.string().default(""),
  shift: z.string().default(""),
  provenance: provenanceSchema,
});
export type AcademicEnrollment = z.infer<typeof enrollmentInputSchema>;
export const catalogSchema = z.array(
  z.strictObject({
    id: text,
    plan: text,
    abbreviation: text,
    coordination: text.nullable(),
    architecture: z.boolean(),
    kind: z.enum(["carrera", "ingles", "clinicos", "deportes", "practica"]),
    program: text.optional(),
    responsible: text.optional(),
    faculty: z.string().optional(),
    campus: z.string().optional(),
    original: z.record(z.string(), z.string()).optional(),
    sourceReference: z.string().optional(),
  }),
);
const calendarSchema = z.strictObject({
  cycle: text,
  dates: z.record(
    civilDateSchema,
    z.enum(["base", "especial", "practica", "excluida"]),
  ),
});
const audit = { version: text, approvedBy: text, reason: text };
export const enrollmentDecisionSchema = z.strictObject({
  ...audit,
  enrollmentId: text,
  date: civilDateSchema.optional(),
  originalDateApproved: z.boolean().optional(),
  kind: z.enum(["base", "especial", "excluida", "baja"]).optional(),
  exclusionReason: z
    .enum(["baja", "ciclo", "antecedente_sustituido", "error_captura"])
    .optional(),
  primary: z.boolean().default(false),
  groupApproved: z.boolean().optional(),
  relatedEnrollmentIds: z
    .array(z.string().regex(/^[a-f0-9]{64}$/))
    .max(100)
    .optional(),
  rule: text,
  decisionDate: civilDateSchema,
  sourceReference: text,
});
export const contextSchema = z.strictObject({
  trackingSchedule: scheduleSchema.optional(),
  rulesVersion: z.literal("approved-2026-10").optional(),
  enrollmentDecisions: z.array(enrollmentDecisionSchema).optional(),
  cycle: text,
  cutId: text,
  cutDate: civilDateSchema,
  catalogVersion: text,
  catalog: catalogSchema,
  calendar: calendarSchema,
  withdrawals: z.array(
    z.strictObject({
      ...audit,
      identity: text,
      effectiveDate: civilDateSchema.nullable(),
      confirmedCutId: text,
    }),
  ),
  exceptions: z.array(
    z.strictObject({
      ...audit,
      enrollmentId: text,
      originalCycle: text,
      targetCycle: text,
      cutId: text,
      baseEnrollmentId: text,
    }),
  ),
  baseResolutions: z
    .array(
      z.strictObject({
        ...audit,
        identity: text,
        cutId: text,
        baseEnrollmentId: text,
      }),
    )
    .default([]),
});
export type AcademicContext = z.infer<typeof contextSchema>;

export function resolveAffiliations(input: unknown, contextInput: unknown) {
  const rows = z.array(enrollmentInputSchema).parse(input);
  const context = contextSchema.parse(contextInput);
  if (context.calendar.cycle !== context.cycle)
    throw new Error("Calendario de otro ciclo");
  if (new Set(context.catalog.map((c) => c.id)).size !== context.catalog.length)
    throw new Error("Catálogo ambiguo");
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new Error("ID de inscripción repetido: resolver antes de clasificar");
  const issues: Issue[] = [];
  const classified = rows.map((row) => {
    const person = identity(row.identity);
    const catalog = context.catalog.find((c) => c.id === row.careerId);
    const approved = context.rulesVersion === "approved-2026-10";
    const decisions = (context.enrollmentDecisions ?? []).filter(
      (d) => d.enrollmentId === row.id,
    );
    if (decisions.length > 1)
      throw new Error("Decisión de inscripción ambigua");
    const decision = decisions[0];
    const parsed = group(row.group, catalog?.architecture ?? false, approved);
    // Un serial requiere la época de su propia fuente, no la del calendario.
    const originalDate =
      typeof row.date === "number" && !row.provenance.source
        ? null
        : civilDate(row.date, row.provenance.source?.epoch);
    const date = decision?.date ?? originalDate;
    const problems = parsed.issues.filter(
      (code) =>
        !(approved && decision?.groupApproved && code === "grupo_ilegible"),
    );
    if (typeof row.date === "number" && !row.provenance.source)
      problems.push("fecha_sin_epoca_de_origen");
    if (row.trackingCycle && row.trackingCycle !== context.cycle)
      problems.push("ciclo_seguimiento_discrepante");
    if (!person.normalized) problems.push("identidad_faltante");
    if (!catalog?.coordination) problems.push("carrera_sin_coordinacion");
    if (catalog && parsed.career && parsed.career !== catalog.abbreviation)
      problems.push("carrera_discrepante");
    if (!approved && row.modality && row.modality !== parsed.modality)
      problems.push("modalidad_discrepante");
    if (!approved && row.shift && row.shift !== parsed.shift)
      problems.push("turno_discrepante");
    if (parsed.cycle && parsed.cycle !== row.cycle)
      problems.push("ciclo_grupo_discrepante");
    const exceptions = context.exceptions.filter(
      (e) =>
        e.enrollmentId === row.id &&
        e.originalCycle === row.cycle &&
        e.targetCycle === context.cycle &&
        e.cutId === context.cutId,
    );
    if (exceptions.length > 1) problems.push("excepcion_ambigua");
    if (row.cycle !== context.cycle && exceptions.length !== 1)
      problems.push("ciclo_sin_excepcion");
    if (
      !date ||
      (!context.calendar.dates[date] &&
        !(approved && (parsed.special || decision?.originalDateApproved)))
    )
      problems.push("fecha_desconocida");
    const withdrawal = context.withdrawals.find(
      (w) =>
        person.normalized !== null &&
        identity(w.identity).normalized === person.normalized &&
        (w.effectiveDate
          ? w.effectiveDate <= context.cutDate
          : w.confirmedCutId === context.cutId),
    );
    let kind:
      | "docente"
      | "baja"
      | "excluida"
      | "base"
      | "especial"
      | "practica"
      | "por_resolver";
    if (person.teacher) kind = "docente";
    else if (withdrawal) kind = "baja";
    else if (
      catalog &&
      ["ingles", "clinicos", "deportes"].includes(catalog.kind)
    )
      kind = "excluida";
    else if (date && context.calendar.dates[date] === "excluida")
      kind = "excluida";
    else if (catalog?.kind === "practica") kind = "practica";
    else if (parsed.special) kind = "especial";
    else
      kind = date
        ? (context.calendar.dates[date] ?? "por_resolver")
        : "por_resolver";
    if (decision?.kind && !person.teacher && !withdrawal) kind = decision.kind;
    // Los valores administrativos originales prevalecen sobre una deducción del
    // código en el perfil aprobado; nunca convertir Ejecutivo en Virtual por 53.
    if (approved) {
      if (row.modality) parsed.modality = row.modality;
      if (row.shift) parsed.shift = row.shift;
      if (row.modality === "Virtual") parsed.shift = "Sabatino Matutino";
    }
    if (exceptions.length === 1 && kind !== "especial")
      problems.push("excepcion_no_especial");
    for (const code of problems) issues.push({ code, refs: [row.id] });
    return {
      ...row,
      person,
      parsed,
      date,
      originalDate,
      decision,
      exclusionReason: decision?.exclusionReason ?? null,
      kind,
      problems,
      catalog,
      withdrawal,
      exception: exceptions.length === 1 ? exceptions[0] : undefined,
    };
  });
  const persons = [
    ...new Set(
      classified
        .map((r) => r.person.normalized)
        .filter((p): p is string => p !== null),
    ),
  ].map((person) => {
    const enrollments = classified.filter(
      (r) => r.person.normalized === person,
    );
    const bases = enrollments.filter(
      (r) => r.kind === "base" && r.problems.length === 0,
    );
    const candidates = enrollments.filter((r) => r.kind === "base");
    const specials = enrollments.filter((r) => r.kind === "especial");
    let baseId =
      bases.length === 1 && candidates.length === 1 ? bases[0]!.id : null;
    if (context.rulesVersion && !candidates.length) {
      const eligible = specials.filter((r) => !r.problems.length);
      if (eligible.length === 1) baseId = eligible[0]!.id;
    }
    const selected = enrollments.filter((r) => r.decision?.primary);
    if (selected.length) {
      baseId =
        selected.length === 1 &&
        !selected[0]!.problems.length &&
        ["base", "especial"].includes(selected[0]!.kind)
          ? selected[0]!.id
          : null;
      if (!baseId)
        issues.push({
          code: "decision_principal_invalida",
          refs: selected.map((r) => r.id),
        });
    }
    const resolutions = context.baseResolutions.filter(
      (r) =>
        identity(r.identity).normalized === person && r.cutId === context.cutId,
    );
    const resolution =
      resolutions.length === 1 &&
      bases.some((b) => b.id === resolutions[0]!.baseEnrollmentId)
        ? resolutions[0]!
        : null;
    if (resolution) baseId = resolution.baseEnrollmentId;
    if (resolutions.length && !resolution) {
      baseId = null;
      issues.push({
        code: "resolucion_base_invalida",
        refs: enrollments.map((r) => r.id),
      });
    }
    if (candidates.length > 1 && !resolution && !selected.length)
      issues.push({ code: "varias_bases", refs: candidates.map((r) => r.id) });
    if (!baseId && specials.length)
      issues.push({
        code: "sin_grupo_base_confirmado",
        refs: specials.map((r) => r.id),
      });
    for (const row of specials)
      if (row.exception && row.exception.baseEnrollmentId !== baseId) {
        issues.push({
          code: "excepcion_base_no_resuelta",
          refs: [row.id, row.exception.baseEnrollmentId],
        });
        baseId = null;
      }
    return {
      identity: person,
      baseEnrollmentId: baseId,
      enrollmentIds: enrollments.map((r) => r.id),
      resolution,
    };
  });
  return { context, enrollments: classified, persons, issues };
}

export const supplementSchema = z.array(
  z.strictObject({
    ...audit,
    id: text,
    replacesId: text.nullable(),
    enrollment: enrollmentInputSchema,
  }),
);
export function applySupplement(
  originalInput: unknown,
  supplementInput: unknown,
) {
  const original = z.array(enrollmentInputSchema).parse(originalInput);
  // Orden canónico solo para la salida; no decide qué corrección prevalece.
  const changes = supplementSchema.parse(supplementInput).sort((a, b) => {
    const left = JSON.stringify(a),
      right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const active = [...original];
  const history: { previous: AcademicEnrollment; changeId: string }[] = [];
  const issues: Issue[] = [];
  const rejected = new Set<string>();
  const chained = new Set<string>();
  for (const change of changes) {
    if (
      changes.filter(
        (c) =>
          c.id === change.id ||
          (change.replacesId !== null && c.replacesId === change.replacesId) ||
          c.enrollment.id === change.enrollment.id,
      ).length > 1
    )
      rejected.add(change.id);
    // Si otra operación produce/consume este ID, el lote necesita una revisión
    // conjunta. Rechazar TODOS los extremos evita aplicar prefijos de cadenas,
    // ciclos o renombrados según el orden de llegada.
    if (
      changes.some(
        (c) =>
          c !== change &&
          (c.replacesId === change.enrollment.id ||
            change.replacesId === c.enrollment.id),
      )
    ) {
      chained.add(change.id);
    }
  }
  if (new Set(original.map((r) => r.id)).size !== original.length)
    throw new Error("Inscripciones originales duplicadas");
  for (const change of changes) {
    if (chained.has(change.id) && !rejected.has(change.id)) {
      issues.push({
        code: "suplemento_encadenado_requiere_resolucion",
        refs: [change.id],
      });
      continue;
    }
    const target = active.findIndex((r) => r.id === change.replacesId);
    if (
      rejected.has(change.id) ||
      (change.replacesId && target === -1) ||
      active.some((r, i) => r.id === change.enrollment.id && i !== target)
    ) {
      issues.push({ code: "suplemento_conflictivo", refs: [change.id] });
      continue;
    }
    if (target >= 0) {
      const previous = active[target]!;
      if (
        identity(previous.identity).normalized !==
        identity(change.enrollment.identity).normalized
      ) {
        issues.push({
          code: "cambio_identidad_requiere_resolucion",
          refs: [change.id],
        });
        continue;
      }
      history.push({ previous, changeId: change.id });
      active[target] = change.enrollment;
    } else active.push(change.enrollment);
  }
  return { active, history, changes, issues };
}

export function grade(raw: unknown) {
  if (
    raw === "" ||
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim() === "")
  )
    return { state: "vacia" as const, raw };
  if (typeof raw === "string" && raw.trim() === "-")
    return { state: "guion" as const, raw };
  if (
    (typeof raw === "number" && Number.isFinite(raw)) ||
    (typeof raw === "string" &&
      /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw.trim()) &&
      Number.isFinite(Number(raw)))
  )
    return { state: "numerica" as const, raw, value: Number(raw) };
  return { state: "invalida" as const, raw };
}

export function courseNameKey(name: string) {
  return name
    .normalize("NFC")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
export function courseFilename(original: string) {
  // Solo un prefijo etiquetado se puede separar sin adivinar cuál número es el ID.
  const prefix = /^(?:muestra|orden)\s+(\d+)\s*[-_]\s*/i.exec(original);
  const filename = prefix ? original.slice(prefix[0].length) : original;
  const match =
    /^(\d+)(?:\._|[ _]+)(.+?)[ _]+(\d{2}-\d+)(?:[-_ ](?:calificaciones|grades))?\.(ods|xlsx|csv)$/i.exec(
      filename,
    );
  if (
    !match ||
    /^\d+(?:\._|[ ._-])/.test(match[2]!) ||
    /\b\d{2}-\d+\b/.test(match[2]!)
  )
    throw new Error(
      "Nombre de curso ambiguo: confirmar ID, nombre y ciclo mediante mapeo revisado",
    );
  return {
    original,
    externalId: match[1]!,
    name: match[2]!.replaceAll("_", " "),
    cycle: match[3]!,
    ...(prefix ? { orderPrefix: prefix[0] } : {}),
  };
}

export const courseFilenameResolutionSchema = z.strictObject({
  ...audit,
  externalId: text.regex(/^\d+$/),
  name: text,
  cycle: text.regex(/^\d{2}-\d+$/),
});
export function resolveCourseFilename(original: string, decision: unknown) {
  const resolution = courseFilenameResolutionSchema.parse(decision);
  return { original, ...resolution };
}

export function courseCollisions(
  courses: { externalId: string; cycle: string; instanceId: string }[],
): Issue[] {
  const groups = new Map<string, Set<string>>();
  for (const c of courses) {
    const key = `${c.cycle}/${c.externalId}`;
    const set = groups.get(key) ?? new Set<string>();
    set.add(c.instanceId);
    groups.set(key, set);
  }
  return [...groups]
    .filter(([, ids]) => ids.size > 1)
    .map(([key, ids]) => ({ code: "colision_id_curso", refs: [key, ...ids] }));
}
