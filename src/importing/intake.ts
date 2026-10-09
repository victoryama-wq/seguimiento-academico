import { createHash } from "node:crypto";
import { civilDate, group, identity } from "../domain/academic";
import type { AcademicPackage } from "../domain/decision-package";
import { intakeOperations } from "../domain/intake-contract";
import { z } from "zod";
import type { Table } from "./files";
import {
  enrollmentKey,
  resolveAcademicPackage,
  validateAcademicPackage,
} from "./decisions";

export const fieldLabels: Record<string, string> = {
  identity: "Matrícula o correo",
  name: "Nombre del alumno",
  career: "Programa o carrera",
  group: "Grupo",
  date: "Fecha de inscripción",
  modality: "Modalidad",
  shift: "Turno",
  program: "Nombre del programa",
  abbreviation: "Abreviatura",
  plan: "Plan",
  responsible: "Responsable",
  coordination: "Coordinación",
  campus: "Campus",
  kind: "Tipo administrativo",
};
const aliases: Record<string, string[]> = {
  identity: [
    "matricula",
    "matricula del alumno",
    "direccion email",
    "correo",
    "email",
  ],
  name: ["nombre", "nombre completo", "alumno"],
  career: ["carrera", "programa", "programa original"],
  group: ["grupo", "grupo original"],
  date: [
    "fecha de inscripcion",
    "fecha inscripcion",
    "fecha del grupo",
    "fecha",
  ],
  modality: ["modalidad"],
  shift: ["turno"],
  program: ["programa", "carrera", "nombre del programa", "programa educativo"],
  abbreviation: ["abreviatura", "siglas"],
  plan: ["plan", "plan de estudios", "nombre del plan"],
  responsible: [
    "responsable",
    "coordinador",
    "coordinadora",
    "coordinador responsable",
  ],
  coordination: ["coordinacion", "coordinador", "coordinadora"],
  campus: ["campus", "plantel"],
  kind: ["tipo", "tipo administrativo"],
};
export const normalizeHeader = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
export function suggestFields(headers: string[], kind: string) {
  const fields =
    kind === "roster"
      ? ["identity", "name", "career", "group", "date", "modality", "shift"]
      : kind === "catalog"
        ? [
            "program",
            "abbreviation",
            "plan",
            "responsible",
            "coordination",
            "campus",
            "kind",
          ]
        : ["identity"];
  return Object.fromEntries(
    fields.flatMap((field) => {
      const matches = headers.flatMap((h, i) =>
        aliases[field]!.includes(normalizeHeader(h)) ? [i] : [],
      );
      return matches.length === 1 ? [[field, matches[0]!]] : [];
    }),
  );
}
export type IntakeIssue = {
  code: string;
  message: string;
  row?: number;
  previousKey?: string;
  candidates?: { key: string; label: string }[];
};
type Configuration = z.infer<typeof intakeOperations.prepareAdministration>;
export const standardSchedule: AcademicPackage["schedule"] = {
  escolarizado: [
    [1, 2],
    [3, 4, 5],
    [6, 7],
  ],
  ejecutivo: [[1], [2], [3], [4], [5], [6], [7]],
  virtual: [[1], [2], [3], [4], [5], [6], [7]],
  flexible: true,
  cumulative: true,
  completedWeek: true,
};
// Calendario académico ya aprobado, distinto del avance operativo del corte.
export const approvedCalendar: AcademicPackage["calendar"] = {
  "2026-08-31": "base",
  "2026-08-29": "especial",
  "2026-08-30": "practica",
  "2026-08-28": "excluida",
  "2026-08-27": "excluida",
  "2026-08-26": "excluida",
};
const signature = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export const tableMatrix = (t: Table) => [
  t.headers,
  ...t.rows.map((r) => r.cells.map((c) => c.raw)),
];
export function sourceFor(t: Table, id: string) {
  return {
    id,
    name: t.source.originalName,
    sha256: t.source.sha256,
    sheet: t.source.sheet,
    bytes: t.source.bytes,
  };
}
export function buildAdministration(
  roster: Table,
  catalog: Table,
  config: Configuration,
  actor: string,
  base?: AcademicPackage,
  initial?: AcademicPackage,
) {
  const issues: IntakeIssue[] = [];
  for (const keys of [
    config.individualChoices.map((c) => c.key),
    config.matrixChoices.map((c) => c.key),
    config.continuity.map((c) => c.previousKey),
    config.calendarChoices.map((c) => c.date),
    config.catalogChoices.map((c) => String(c.row)),
    config.programMappings.map((c) =>
      JSON.stringify([c.program, c.abbreviation]),
    ),
  ]) {
    if (new Set(keys).size !== keys.length)
      throw new Error(
        "Hay decisiones repetidas para el mismo dato. Conserva una resolución explícita por incidencia.",
      );
  }
  const read = (
    t: Table,
    columns: Record<string, number>,
    row: Table["rows"][number],
    field: string,
  ) => {
    const index = columns[field];
    if (index === undefined) return "";
    const cell = row.cells[index];
    if (!cell || cell.formula || cell.type === "e") {
      issues.push({
        code: "literal",
        row: row.row,
        message: `La columna ${fieldLabels[field]} contiene una fórmula, un error o ya no existe.`,
      });
      return "";
    }
    if (field === "identity" && typeof cell.raw !== "string") {
      issues.push({
        code: "identity",
        row: row.row,
        message:
          "La matrícula debe ser texto. Corrige la exportación para conservar prefijos y ceros.",
      });
      return "";
    }
    if (field === "date" && typeof cell.raw === "number")
      return civilDate(cell.raw, t.source.epoch) ?? String(cell.raw);
    return String(cell.raw ?? "");
  };
  for (const [which, fields, table] of [
    ["roster", ["identity", "name", "career", "group", "date"], roster],
    ["catalog", ["program", "abbreviation", "plan"], catalog],
  ] as const) {
    const cols = config[which].columns;
    for (const field of fields)
      if (cols[field] === undefined || !table.headers[cols[field]!])
        throw new Error(
          `Selecciona la columna ${fieldLabels[field]} del ${which === "roster" ? "padrón" : "catálogo"}.`,
        );
    const indices = Object.values(cols);
    if (which === "roster" && new Set(indices).size !== indices.length)
      throw new Error(
        "Selecciona una columna distinta para cada dato del padrón.",
      );
  }
  const occurrences = new Map<string, number>();
  const enrollments = roster.rows
    .filter((r) => r.cells.some((c) => c.raw !== null && c.raw !== ""))
    .map((row) => {
      const original = Object.fromEntries(
        [
          "identity",
          "name",
          "career",
          "group",
          "date",
          "modality",
          "shift",
        ].map((f) => [f, read(roster, config.roster.columns, row, f)]),
      ) as AcademicPackage["enrollments"][number]["original"];
      const sig = JSON.stringify(original),
        occurrence = (occurrences.get(sig) ?? 0) + 1;
      occurrences.set(sig, occurrence);
      return {
        original,
        occurrence,
        key: enrollmentKey(original, occurrence),
        row: row.row,
        sourceId: "P02",
      };
    });
  // Una matriz es una propuesta explícita: nunca restaura silenciosamente decisiones antiguas.
  let prior = base ?? initial;
  if (initial && base) {
    const combined = new Map(base.decisions.map((d) => [d.enrollmentId, d]));
    for (const incoming of initial.decisions) {
      const previous = combined.get(incoming.enrollmentId);
      if (!previous) {
        combined.set(incoming.enrollmentId, incoming);
        continue;
      }
      if (JSON.stringify(previous) === JSON.stringify(incoming)) continue;
      const choice = config.matrixChoices.find(
        (c) => c.key === incoming.enrollmentId,
      );
      if (!choice)
        issues.push({
          code: "matrix_conflict",
          previousKey: incoming.enrollmentId,
          message: `La matriz propone cambiar una decisión vigente (${previous.rule}). Revisa ambos motivos antes de decidir. Vigente: ${previous.reason}. Matriz: ${incoming.reason}.`,
        });
      else if (choice.useMatrix)
        combined.set(incoming.enrollmentId, {
          ...incoming,
          reason: `${incoming.reason}; revisión: ${choice.reason}`,
          sourceReference: `${incoming.sourceReference}; confirmado por ${actor}`,
        });
    }
    prior = {
      ...base,
      ...initial,
      decisions: [...combined.values()],
      enrollments: [
        ...new Map(
          [...base.enrollments, ...initial.enrollments].map((e) => [e.key, e]),
        ).values(),
      ],
      reviews: [
        ...new Map(
          [...base.reviews, ...initial.reviews].map((r) => [r.id, r]),
        ).values(),
      ],
      approvals: [
        ...new Map(
          [...(base.approvals ?? []), ...(initial.approvals ?? [])].map((a) => [
            JSON.stringify(a),
            a,
          ]),
        ).values(),
      ],
      catalogMappings: base.catalogMappings ?? [],
      sources: [
        ...new Map(
          [...base.sources, ...initial.sources].map((s) => [s.id, s]),
        ).values(),
      ],
    };
  }
  const nextCatalog = catalog.rows
    .filter((r) => r.cells.some((c) => c.raw !== null && c.raw !== ""))
    .map((row) => {
      const cell = (f: string) => read(catalog, config.catalog.columns, row, f);
      const original = Object.fromEntries(
        catalog.headers.map((h, i) => [h, String(row.cells[i]?.raw ?? "")]),
      );
      const abbreviation =
        group(`${config.cycle} ${cell("abbreviation")} 11 01A`, false, true)
          .career ?? cell("abbreviation").trim();
      const matches =
        prior?.catalog.filter(
          (c) => c.abbreviation === abbreviation && c.plan === cell("plan"),
        ) ?? [];
      if (matches.length > 1)
        throw new Error(
          "El catálogo previo tiene programas ambiguos para la misma abreviatura y plan. Revisa la fuente institucional.",
        );
      const same = matches[0];
      const unchanged =
        same && JSON.stringify(same.original) === JSON.stringify(original);
      const choice = config.catalogChoices.find((c) => c.row === row.row);
      const previousCatalog = base?.catalog.find(
        (c) => c.abbreviation === abbreviation && c.plan === cell("plan"),
      );
      const matrixChange =
        initial &&
        previousCatalog &&
        same &&
        ["program", "coordination", "kind", "responsible"].some(
          (k) =>
            previousCatalog[k as keyof typeof previousCatalog] !==
            same[k as keyof typeof same],
        );
      if (
        ((same && !unchanged && !initial) || matrixChange) &&
        !choice?.acceptChange
      )
        issues.push({
          code: "catalog_changed",
          row: row.row,
          message: `Cambió ${cell("program")} (${cell("plan")}). Revisa programa, responsable y coordinación; confirma la modificación con motivo.`,
        });
      const coordination =
        choice?.coordination ??
        (unchanged || initial ? same?.coordination : undefined) ??
        (cell("coordination") || null);
      if (!coordination)
        issues.push({
          code: "coordination",
          row: row.row,
          message: `Confirma la coordinación de ${cell("program")}. El responsable por sí solo no concede una coordinación ni permisos.`,
        });
      const kindRaw = normalizeHeader(cell("kind"));
      const kinds = [
        "carrera",
        "ingles",
        "clinicos",
        "deportes",
        "practica",
      ] as const;
      const kind =
        choice?.kind ?? same?.kind ?? kinds.find((k) => k === kindRaw);
      if (!kind)
        issues.push({
          code: "kind",
          row: row.row,
          message: `Confirma el tipo administrativo de ${cell("program")}; el archivo no lo determina.`,
        });
      return {
        id:
          same?.id ??
          `carrera-${signature([abbreviation, cell("plan"), cell("program")]).slice(0, 24)}`,
        abbreviation,
        plan: cell("plan"),
        program:
          unchanged || initial
            ? (same?.program ?? cell("program"))
            : cell("program"),
        responsible:
          unchanged || initial
            ? (same?.responsible ?? (cell("responsible") || undefined))
            : cell("responsible") || undefined,
        coordination,
        kind: kind ?? ("carrera" as const),
        architecture: ["ARQ", "LARQ"].includes(abbreviation),
        original,
        sourceReference: `${same?.sourceReference ?? "C02"}; C02 · fila ${row.row}`,
        ...(same?.faculty ? { faculty: same.faculty } : {}),
        campus: cell("campus") || same?.campus || "",
      };
    });
  const keys = new Set(enrollments.map((e) => e.key));
  const decisions: AcademicPackage["decisions"] = [];
  const remaps = new Map<string, string | null>();
  const referenced = new Set([
    ...(prior?.decisions ?? []).flatMap((d) => [
      d.enrollmentId,
      ...(d.relatedEnrollmentIds ?? []),
    ]),
    ...(prior?.reviews ?? []).flatMap((r) => r.enrollmentKeys),
  ]);
  for (const key of referenced) {
    if (keys.has(key)) {
      remaps.set(key, key);
      continue;
    }
    const old = prior!.enrollments.find((e) => e.key === key)!;
    const owner = identity(old.original.identity).normalized;
    const candidates = owner
      ? enrollments.filter(
          (e) => identity(e.original.identity).normalized === owner,
        )
      : [];
    const choice = config.continuity.find((c) => c.previousKey === key);
    if (
      !choice ||
      (choice.nextKey && !candidates.some((e) => e.key === choice.nextKey))
    ) {
      issues.push({
        code: "decision_changed",
        previousKey: key,
        message: `La decisión o revisión de ${old.original.identity}, grupo ${old.original.group}, ya no coincide con un original. Elige la inscripción revisada o conserva la decisión solo en el historial.`,
        candidates: candidates.map((e) => ({
          key: e.key,
          label: `${e.original.group} · ${e.original.date} · ${e.original.career}`,
        })),
      });
    } else remaps.set(key, choice.nextKey);
  }
  for (const choice of config.individualChoices) {
    if (!keys.has(choice.key))
      throw new Error(
        "La excepción individual no corresponde a estas fuentes.",
      );
    const previous = decisions.find((d) => d.enrollmentId === choice.key);
    const decision: AcademicPackage["decisions"][number] = {
      ...previous,
      enrollmentId: choice.key,
      kind: choice.kind,
      primary: choice.primary,
      originalDateApproved: choice.originalDateApproved,
      groupApproved: choice.groupApproved,
      rule: previous?.rule ?? "excepcion_individual_confirmada",
      reason: choice.reason,
      decisionDate: new Date().toISOString().slice(0, 10),
      sourceReference: `Revisión visual individual por ${actor}`,
      ...(["baja", "excluida"].includes(choice.kind)
        ? {
            exclusionReason:
              choice.kind === "baja" ? ("baja" as const) : ("ciclo" as const),
          }
        : {}),
    };
    if (!["baja", "excluida"].includes(choice.kind))
      delete decision.exclusionReason;
    if (choice.originalDateApproved) delete decision.date;
    const index = decisions.findIndex((d) => d.enrollmentId === choice.key);
    if (index >= 0) decisions.splice(index, 1);
    decisions.push(decision);
  }
  for (const d of prior?.decisions ?? []) {
    const key = remaps.get(d.enrollmentId);
    if (!key) continue;
    const choice = config.continuity.find(
      (c) => c.previousKey === d.enrollmentId,
    );
    const related = d.relatedEnrollmentIds
      ?.map((k) => (keys.has(k) ? k : remaps.get(k)))
      .filter((k): k is string => !!k);
    if (related && related.length !== d.relatedEnrollmentIds?.length) {
      issues.push({
        code: "related_changed",
        message:
          "Una decisión tiene antecedentes ausentes. Revisa las fuentes y conserva la cadena completa antes de publicar.",
      });
      continue;
    }
    decisions.push({
      ...d,
      enrollmentId: key,
      ...(related ? { relatedEnrollmentIds: related } : {}),
      ...(choice
        ? {
            reason: choice.reason,
            sourceReference: `${d.sourceReference}; revisión de original por ${actor}`,
          }
        : {}),
    });
  }
  const mappings = [...(prior?.catalogMappings ?? [])];
  for (const m of config.programMappings) {
    const i = mappings.findIndex(
      (v) => v.program === m.program && v.abbreviation === m.abbreviation,
    );
    if (i >= 0) mappings.splice(i, 1);
    mappings.push({
      ...m,
      sourceReference: `Confirmación general por ${actor}; ciclo ${config.cycle}`,
    });
  }
  for (const m of mappings)
    if (!nextCatalog.some((c) => c.id === m.careerId))
      issues.push({
        code: "mapping_changed",
        message: `La correspondencia general de ${m.program} ya no tiene un destino en el catálogo. Revisa la fuente.`,
      });
  const knownKeys = new Set(prior?.enrollments.map((e) => e.key) ?? []);
  const seenPrograms = new Set<string>();
  for (const e of enrollments) {
    const abbreviation = group(e.original.group, false, true).career;
    if (!abbreviation || knownKeys.has(e.key)) continue;
    if (
      mappings.some(
        (m) =>
          m.program === e.original.career && m.abbreviation === abbreviation,
      )
    )
      continue;
    const candidates = nextCatalog.filter(
      (c) => c.abbreviation === abbreviation,
    );
    if (
      candidates.length === 1 &&
      normalizeHeader(candidates[0]!.program) ===
        normalizeHeader(e.original.career)
    )
      continue;
    const combo = JSON.stringify([e.original.career, abbreviation]);
    if (!seenPrograms.has(combo)) {
      seenPrograms.add(combo);
      issues.push({
        code: "program",
        previousKey: combo,
        message: `Confirma la correspondencia de «${e.original.career}» / ${abbreviation}, sin deducir el plan por semejanza.`,
        candidates: nextCatalog.map((c) => ({
          key: c.id,
          label: `${c.program} · ${c.plan} · ${c.abbreviation}`,
        })),
      });
    }
  }
  const reviews = (prior?.reviews ?? []).flatMap((r) => {
    const mapped = r.enrollmentKeys.map((k) => remaps.get(k));
    if (mapped.some((k) => !k)) return []; // Se conserva íntegra en la versión anterior; continuidad exige decisión explícita.
    return [{ ...r, enrollmentKeys: mapped as string[] }];
  });
  const p: AcademicPackage = {
    schemaVersion: 1,
    rulesVersion: "approved-2026-10",
    cycle: config.cycle,
    reason: "Revisión visual de originales y decisiones conservadas",
    calendar: {
      ...(prior?.calendar ?? (config.cycle === "27-1" ? approvedCalendar : {})),
      ...Object.fromEntries(
        config.calendarChoices.map((c) => [c.date, c.kind]),
      ),
    },
    schedule: prior?.schedule ?? standardSchedule,
    sources: [
      ...(prior?.sources ?? []).filter((s) => !["P02", "C02"].includes(s.id)),
      sourceFor(roster, "P02"),
      sourceFor(catalog, "C02"),
    ],
    catalog: nextCatalog,
    enrollments,
    decisions,
    reviews,
    ...(prior?.approvals ? { approvals: prior.approvals } : {}),
    catalogMappings: mappings.filter((m) =>
      nextCatalog.some((c) => c.id === m.careerId),
    ),
  };
  if (!Object.keys(p.calendar).length)
    issues.push({
      code: "calendar",
      candidates: [
        ...new Set(
          enrollments
            .map((e) => civilDate(e.original.date))
            .filter((d): d is string => !!d),
        ),
      ].map((date) => ({ key: date, label: date })),
      message:
        "Este ciclo todavía no tiene calendario académico aprobado; requiere configuración institucional antes de clasificar inscripciones.",
    });
  const resolved = resolveAcademicPackage(
    validateAcademicPackage(p, config.cycle),
    config.cycle,
    "preview",
    "9999-12-31",
    "preview",
    actor,
  );
  return {
    package: p,
    issues,
    resolved,
    preservedDecisions: decisions.filter((d) =>
      prior?.decisions.some((old) => old.enrollmentId === d.enrollmentId),
    ).length,
    continuity: config.continuity,
    catalogChoices: config.catalogChoices,
    programMappings: config.programMappings,
  };
}
