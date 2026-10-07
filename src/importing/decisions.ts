import { createHash } from "node:crypto";
import {
  academicPackageSchema,
  type AcademicPackage,
  type Observation,
} from "../domain/decision-package";
import {
  group,
  identity,
  resolveAffiliations,
  type AcademicEnrollment,
} from "../domain/academic";

export function enrollmentKey(
  original: AcademicPackage["enrollments"][number]["original"],
  occurrence = 1,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        identity(original.identity).normalized,
        original.name,
        original.career,
        original.group,
        original.date,
        original.modality,
        original.shift,
        occurrence,
      ]),
    )
    .digest("hex");
}
export function validateAcademicPackage(input: unknown, cycle: string) {
  const p = academicPackageSchema.parse(input);
  if (p.cycle !== cycle) throw new Error("Decisiones de otro ciclo");
  const keys = new Set(p.enrollments.map((e) => e.key));
  if (
    keys.size !== p.enrollments.length ||
    new Set(p.catalog.map((c) => c.id)).size !== p.catalog.length ||
    new Set(p.sources.map((s) => s.id)).size !== p.sources.length
  )
    throw new Error("Claves ambiguas en paquete");
  for (const e of p.enrollments) {
    if (
      enrollmentKey(e.original, e.occurrence) !== e.key ||
      !p.sources.some((s) => s.id === e.sourceId)
    )
      throw new Error("Original o procedencia cambió; revisar decisión");
  }
  const seen = new Set<string>();
  for (const d of p.decisions) {
    if (!keys.has(d.enrollmentId) || seen.has(d.enrollmentId))
      throw new Error("Resolución huérfana o contradictoria");
    if (
      (d.originalDateApproved &&
        (!["base", "especial"].includes(d.kind ?? "") || d.date)) ||
      (d.kind === "baja" && d.exclusionReason !== "baja") ||
      (d.kind === "excluida" && !d.exclusionReason) ||
      (d.exclusionReason && !["baja", "excluida"].includes(d.kind ?? "")) ||
      (d.primary && ["baja", "excluida"].includes(d.kind ?? ""))
    )
      throw new Error("Clasificación y motivo de exclusión contradictorios");
    seen.add(d.enrollmentId);
    const owner = identity(
      p.enrollments.find((e) => e.key === d.enrollmentId)!.original.identity,
    ).normalized;
    if (
      d.relatedEnrollmentIds?.some(
        (key) =>
          !keys.has(key) ||
          identity(p.enrollments.find((e) => e.key === key)!.original.identity)
            .normalized !== owner,
      )
    )
      throw new Error("Referencia de corrección ajena o inexistente");
  }
  if (
    new Set(p.reviews.map((r) => r.id)).size !== p.reviews.length ||
    p.reviews.some((r) => r.enrollmentKeys.some((k) => !keys.has(k)))
  )
    throw new Error("Revisión sin inscripción verificable");
  return p;
}
export function resolveAcademicPackage(
  input: unknown,
  cycle: string,
  cutId: string,
  cutDate: string,
  version: string,
  actor: string,
) {
  const p = validateAcademicPackage(input, cycle);
  const decisions = p.decisions.map((d) => ({
    ...d,
    version,
    approvedBy: actor,
  }));
  const preparation: Observation[] = [];
  const enrollments: AcademicEnrollment[] = p.enrollments.flatMap((e) => {
    const parsed = group(e.original.group, false, true);
    const candidates = p.catalog.filter(
      (c) =>
        group(`${cycle} ${c.abbreviation} 11 01A`, c.architecture, true)
          .career === parsed.career,
    );
    const catalog = candidates.length === 1 ? candidates[0] : undefined;
    const source = p.sources.find((s) => s.id === e.sourceId)!;
    if (!catalog || !parsed.cycle)
      preparation.push({
        id: e.key,
        identity: e.original.identity,
        careerId: null,
        group: e.original.group,
        file: source.name,
        sheet: source.sheet,
        row: e.row,
        original: e.original,
        effective: null,
        reason: !catalog
          ? "Catálogo ausente o ambiguo para abreviatura"
          : "Ciclo de origen no interpretable",
        rule: "grupo_catalogo",
        state: "pendiente",
        action: "Revisión administrativa del original",
        sourceVersion: version,
      });
    // Una fila sin ciclo conserva su original y observación, nunca recibe uno inventado.
    if (!parsed.cycle) return [];
    return [
      {
        id: e.key,
        identity: e.original.identity,
        group: e.original.group,
        date: e.original.date,
        careerId: catalog?.id ?? "sin-catalogo",
        cycle: parsed.cycle,
        trackingCycle: cycle,
        modality: e.original.modality,
        shift: e.original.shift,
        provenance: {
          sourceVersion: version,
          row: e.row,
          source: {
            originalName: source.name,
            sha256: source.sha256,
            bytes: source.bytes,
            parserVersion: "academic-package/1",
            sheet: source.sheet,
            epoch: "1900" as const,
          },
          originals: {
            cycle: parsed.cycle,
            cycleBasis: "group",
            group: e.original.group,
            date: e.original.date,
          },
        },
      },
    ];
  });
  const result = resolveAffiliations(enrollments, {
    rulesVersion: p.rulesVersion,
    enrollmentDecisions: decisions,
    cycle,
    cutId,
    cutDate,
    catalogVersion: version,
    catalog: p.catalog.map((c) => ({
      ...c,
      abbreviation:
        group(`${cycle} ${c.abbreviation} 11 01A`, c.architecture, true)
          .career ?? c.abbreviation,
    })),
    calendar: { cycle, dates: p.calendar },
    withdrawals: decisions
      .filter((d) => d.kind === "baja")
      .map((d) => ({
        version,
        approvedBy: actor,
        reason: d.reason,
        identity: p.enrollments.find((e) => e.key === d.enrollmentId)!.original
          .identity,
        effectiveDate: null,
        confirmedCutId: cutId,
      })),
    exceptions: [],
    baseResolutions: [],
  });
  const persons = new Map(
    result.persons.map((person) => [person.identity, person]),
  );
  const observations: Observation[] = [...preparation];
  for (const e of result.enrollments) {
    const raw = p.enrollments.find((r) => r.key === e.id)!;
    const source = p.sources.find((s) => s.id === raw.sourceId)!;
    const excluded = ["baja", "excluida", "practica", "docente"].includes(
      e.kind,
    );
    const pending =
      !excluded &&
      (e.problems.length > 0 ||
        !persons.get(e.person.normalized ?? "")?.baseEnrollmentId);
    observations.push({
      id: e.id,
      identity: e.identity,
      careerId: e.catalog?.id ?? null,
      group: e.group,
      file: source.name,
      sheet: source.sheet,
      row: e.provenance.row,
      original: raw.original,
      effective: {
        audit: e.decision ?? null,
        group: e.parsed.normalized,
        date: e.date,
        kind: e.kind,
        modality: e.parsed.modality,
        shift: e.parsed.shift,
        primary:
          persons.get(e.person.normalized ?? "")?.baseEnrollmentId === e.id,
      },
      reason: excluded
        ? (e.exclusionReason ?? e.kind)
        : pending
          ? e.problems.join(", ") || "Afiliación principal ambigua"
          : (e.decision?.reason ?? "Normalización y clasificación aprobadas"),
      rule: e.decision?.rule ?? p.rulesVersion,
      state: excluded ? "excluido" : pending ? "pendiente" : "resuelto",
      action: pending
        ? "Solicitar corrección administrativa y volver a validar"
        : "Resolución vigente conservada",
      sourceVersion: version,
    });
  }
  return { academic: result, observations, package: p };
}
