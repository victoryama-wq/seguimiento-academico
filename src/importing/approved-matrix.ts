import { civilDate, group, identity } from "../domain/academic";
import {
  academicPackageSchema,
  type AcademicPackage,
} from "../domain/decision-package";
import { enrollmentKey, resolveAcademicPackage } from "./decisions";

type Cell = string | number | boolean | null;
type Matrix = Cell[][];
type Input = {
  sheets: Record<string, Matrix>;
  roster: Matrix;
  catalog: Matrix;
  sources: AcademicPackage["sources"];
  cycle: string;
  calendar: AcademicPackage["calendar"];
  schedule: AcademicPackage["schedule"];
};
const text = (v: Cell | undefined) => String(v ?? "");
const requireValue = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

/** Adaptador de la matriz aprobada. Los identificadores privados solo existen en la salida local. */
export function prepareApprovedPackage(input: Input) {
  const { sheets, cycle } = input;
  const registrations = sheets["Inscripciones actuales"]!;
  const affiliates = sheets["Afiliaciones actuales"]!;
  const reviews = sheets["Excepciones actuales"]!;
  requireValue(
    registrations?.[0]?.[0] === "Fila P02" &&
      affiliates?.[0]?.[0] === "Matrícula" &&
      reviews?.[0]?.[0] === "Caso",
    "Estructura de matriz no reconocida",
  );
  requireValue(
    input.roster[0]?.join("|") ===
      "matricula|nombre|modalidad|turno|carrera|grupo|fecha de inscripcion",
    "Encabezados de padrón distintos",
  );
  const confirmations =
    sheets.Coordinaciones?.filter((r) => /^CAT-\d+$/.test(text(r[0]))) ?? [];
  const sources = sheets.Fuentes ?? [];
  for (const id of ["P02", "C02"])
    requireValue(
      sources.some(
        (r) =>
          r[0] === id &&
          r[3] === input.sources.find((s) => s.id === id)?.sha256,
      ),
      "La fuente cambió después de aprobar la matriz",
    );
  const abbreviation = (raw: string) =>
    group(`${cycle} ${raw} 11 01A`, false, true).career;
  const catalog = input.catalog
    .slice(1)
    .filter((r) => r.some((v) => v !== null && v !== ""))
    .map((r, i) => {
      const confirmation = confirmations.find(
        (c) => c[0] === `CAT-${String(i + 1).padStart(3, "0")}`,
      );
      const label = (v: Cell | undefined) =>
        text(v).replace(/\s/g, "").toLowerCase();
      requireValue(
        confirmation &&
          abbreviation(text(r[0])) ===
            abbreviation(text(confirmation[14] ?? confirmation[3])) &&
          label(r[5]) === label(confirmation[15]),
        "Catálogo y confirmación discrepan",
      );
      const abbr = abbreviation(text(r[0]));
      requireValue(abbr, "Abreviatura no interpretable");
      return {
        id: abbr!.toLowerCase(),
        abbreviation: abbr!,
        program: text(confirmation![13] ?? r[1]),
        plan: text(r[3]),
        responsible: text(confirmation![15]),
        // Etiqueta institucional, nunca identidad de autenticación ni permiso.
        coordination: text(confirmation![15]),
        architecture: abbr === "ARQ" || abbr === "LARQ",
        kind: /ingl[eé]s/i.test(text(r[1]))
          ? ("ingles" as const)
          : ("carrera" as const),
        original: Object.fromEntries(
          input.catalog[0]!.map((h, n) => [text(h), text(r[n])]),
        ),
        sourceReference: `C02 · fila ${i + 2}; MATRIZ · ${text(confirmation![0])}`,
        faculty: text(confirmation![16]),
        campus:
          text(confirmation![5]) === "No indicado explícitamente"
            ? ""
            : text(confirmation![5]),
      };
    });
  const occurrence = new Map<string, number>();
  const enrollments = input.roster.slice(1).map((r, i) => {
    const original = {
      identity: text(r[0]),
      name: text(r[1]),
      modality: text(r[2]),
      shift: text(r[3]),
      career: text(r[4]),
      group: text(r[5]),
      date: text(r[6]),
    };
    const signature = JSON.stringify(original),
      n = (occurrence.get(signature) ?? 0) + 1;
    occurrence.set(signature, n);
    return {
      key: enrollmentKey(original, n),
      occurrence: n,
      original,
      sourceId: "P02",
      row: i + 2,
    };
  });
  requireValue(
    enrollments.length === registrations.length - 1,
    "Padrón y matriz tienen cantidades distintas",
  );
  const byRow = new Map(enrollments.map((e) => [e.row, e]));
  const decisions: AcademicPackage["decisions"] = [];
  for (const row of registrations.slice(1)) {
    const e = byRow.get(Number(row[0]));
    requireValue(
      e &&
        [
          e.original.identity,
          e.original.name,
          e.original.modality,
          e.original.shift,
          e.original.career,
          e.original.group,
          e.original.date,
        ].every((v, i) => v === text(row[i + 1])),
      "Original de inscripción distinto de matriz aprobada",
    );
    const status = text(row[17]),
      provenance = text(row[20]);
    const rule = provenance.match(/DEC-\d+/)?.[0] ?? "DEC-24";
    const approved = sheets["Decisiones aprobadas"]?.find((r) => r[0] === rule);
    requireValue(
      approved && civilDate(approved[4]),
      "Falta autoría o fecha de la decisión aprobada",
    );
    const decision: AcademicPackage["decisions"][number] = {
      enrollmentId: e!.key,
      primary: false,
      rule,
      reason: provenance || status,
      decisionDate: civilDate(approved![4])!,
      sourceReference: `MATRIZ · Inscripciones actuales · fila ${registrations.indexOf(row) + 1}; P02 · fila ${e!.row}; autor declarado: ${text(approved![3])}`,
    };
    let changed = false;
    const referenced = [...provenance.matchAll(/P02 fila (\d+)/g)].map(
      (match) => byRow.get(Number(match[1])),
    );
    requireValue(
      referenced.every(
        (ref) =>
          ref &&
          identity(ref.original.identity).normalized ===
            identity(e!.original.identity).normalized,
      ),
      "Referencia de sustitución no verificable",
    );
    if (referenced.length) {
      decision.relatedEnrollmentIds = [
        ...new Set(referenced.map((ref) => ref!.key)),
      ];
      changed = true;
    }
    if (
      group(e!.original.group, false, true).issues.includes("grupo_ilegible")
    ) {
      requireValue(
        row[10] === cycle &&
          abbreviation(text(row[11])) ===
            group(e!.original.group, false, true).career,
        "Grupo parcial sin confirmación coherente",
      );
      decision.groupApproved = true;
      decision.reason += `; interpretación confirmada en Inscripciones actuales, sin inventar sección ni grado`;
      changed = true;
    }
    if (status === "Excluida por baja") {
      decision.kind = "baja";
      decision.exclusionReason = "baja";
      decision.rule = "DEC-17";
      changed = true;
    } else if (status === "Excluida por otro ciclo") {
      decision.kind = "excluida";
      decision.exclusionReason = "ciclo";
      decision.rule = "DEC-16";
      changed = true;
    } else if (status === "Descartada por error de captura confirmado") {
      decision.kind = "excluida";
      decision.exclusionReason = "error_captura";
      changed = true;
    } else if (
      status === "Antecedente por cambio de modalidad" ||
      status === "Sustituida por corrección aprobada"
    ) {
      decision.kind = "excluida";
      decision.exclusionReason = "antecedente_sustituido";
      changed = true;
    } else
      requireValue(
        status === "Dentro del ciclo",
        "Situación no reconocida; requiere revisión",
      );
    if (row[21] !== null && row[21] !== undefined && row[21] !== "") {
      decision.date = civilDate(row[21])!;
      requireValue(decision.date, "Fecha de corrección inválida");
      changed = true;
    }
    if (/Grupo base vigente/.test(text(row[19]))) {
      decision.kind = "base";
      decision.primary = true;
      changed = true;
    }
    // Clasificación individual aprobada de ambos registros, no solo la elección
    // del principal. Nunca agregar C.A. al original ni inventar una fecha base.
    const individual = text(row[19]).match(
      /^Grupo (base|especial) vigente por decisión individual$/,
    );
    if (individual) {
      requireValue(
        text(row[12]).toLowerCase() === individual[1] &&
          status === "Dentro del ciclo",
        "Clasificación individual contradictoria",
      );
      decision.kind = individual[1] as "base" | "especial";
      decision.primary = individual[1] === "base";
      if (
        /Fecha original .* conservada y aceptada para esta clasificación individual/.test(
          provenance,
        )
      ) {
        requireValue(
          civilDate(e!.original.date) && !decision.date,
          "Aceptación de fecha original contradictoria o inválida",
        );
        decision.originalDateApproved = true;
      }
      changed = true;
    }
    if (changed) decisions.push(decision);
  }
  const resolvedReviews = reviews.slice(1).map((r, i) => {
    requireValue(r[12] === "Resuelta" && text(r[9]), "Revisión aún pendiente");
    const rows = text(r[4])
      .split(/[,;]\s*/)
      .map(Number);
    const keys = rows
      .map((n) => byRow.get(n))
      .filter(
        (e) =>
          e &&
          identity(e.original.identity).normalized ===
            identity(text(r[2])).normalized,
      )
      .map((e) => e!.key);
    requireValue(
      keys.length === rows.length,
      "Referencias de revisión ambiguas",
    );
    return {
      id: text(r[0]),
      enrollmentKeys: keys,
      rule: "decisión institucional vigente",
      reason: text(r[9]),
      decisionDate: civilDate(r[11])!,
      sourceReference: `MATRIZ · Excepciones actuales · fila ${i + 2}; autor declarado: ${text(r[10])}`,
      status: "resolved" as const,
    };
  });
  const p = academicPackageSchema.parse({
    schemaVersion: 1,
    rulesVersion: "approved-2026-10",
    cycle,
    reason: "Importación de matriz aprobada; sustituye diagnósticos históricos",
    approvals: (sheets["Decisiones aprobadas"] ?? [])
      .slice(1)
      .filter((r) => /^DEC-\d+$/.test(text(r[0])))
      .map((r) => ({
        rule: text(r[0]),
        statement: text(r[1]),
        scope: text(r[2]),
        declaredAuthor: text(r[3]),
        decisionDate: civilDate(r[4]),
        sourceReference: `MATRIZ · Decisiones aprobadas · ${text(r[0])}`,
      })),
    calendar: input.calendar,
    schedule: input.schedule,
    sources: input.sources,
    catalog,
    enrollments,
    decisions,
    reviews: resolvedReviews,
  });
  const result = resolveAcademicPackage(
    p,
    cycle,
    "conciliacion",
    "9999-12-31",
    "conciliacion-privada",
    "administrador-local",
  );
  const discrepancies: unknown[] = [];
  const actual = new Map(
    result.academic.persons.map((person) => [person.identity, person]),
  );
  const expectedIdentities = affiliates
    .slice(1)
    .map((r) => identity(text(r[0])).normalized);
  requireValue(
    expectedIdentities.every((id) => id !== null && actual.has(id)) &&
      new Set(expectedIdentities).size === actual.size &&
      expectedIdentities.length === actual.size,
    "Universo de afiliaciones distinto del padrón",
  );
  const resolved = new Map(result.academic.enrollments.map((e) => [e.id, e]));
  for (const row of affiliates.slice(1)) {
    const person = actual.get(identity(text(row[0])).normalized ?? "");
    const principal = person?.baseEnrollmentId
      ? resolved.get(person.baseEnrollmentId)
      : null;
    const expected = row[5] ? group(text(row[5]), true, true).normalized : "";
    if (
      (principal?.parsed.normalized ?? "") !== expected ||
      (principal &&
        (principal.kind !== text(row[6]).toLowerCase() ||
          principal.catalog?.program !== row[7] ||
          principal.catalog?.responsible !== row[8]))
    )
      discrepancies.push({
        identity: row[0],
        expected: row.slice(4, 9),
        actual: principal ?? null,
      });
  }
  return {
    package: p,
    result,
    discrepancies,
    controls: {
      rows: enrollments.length,
      identities: actual.size,
      principals: result.academic.persons.filter((p) => p.baseEnrollmentId)
        .length,
      excludedPersons: result.academic.persons.filter(
        (p) => !p.baseEnrollmentId,
      ).length,
      reviews: resolvedReviews.length,
      pending: result.observations.filter((o) => o.state === "pendiente")
        .length,
      discrepancies: discrepancies.length,
      catalog: catalog.length,
      responsibles: new Set(catalog.map((c) => c.responsible)).size,
    },
  };
}
