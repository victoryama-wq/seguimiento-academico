// Read-only source inspection. The manifest and report MUST remain under ignored private/.
// No Firebase, uploads, telemetry or network calls. Never prints private cell values.
import { readFileSync, writeFileSync, realpathSync, mkdirSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { readTable } = require("../functions/lib/src/importing/files.js");
const { parseMoodle } = require("../functions/lib/src/importing/mapping.js");
const {
  identity,
  civilDate,
  group,
} = require("../functions/lib/src/domain/academic.js");
const root = resolve("private");
mkdirSync(root, { recursive: true });
const manifestPath = realpathSync(
  process.argv[2] ?? "private/pilot-manifest.json",
);
const inside = relative(realpathSync(root), manifestPath);
if (inside.startsWith("..") || resolve(root, inside) !== manifestPath)
  throw new Error("Manifest debe estar en private/");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const hashes = [];
const load = (path) => {
  const bytes = readFileSync(path);
  const hash = createHash("sha256").update(bytes).digest("hex");
  hashes.push({ path, hash });
  return readTable(bytes, basename(path));
};
const roster = load(manifest.roster);
const column = (name) => {
  const index = roster.headers.indexOf(name);
  if (index < 0) throw new Error("Columna de padrón requerida ausente");
  return index;
};
const indices = Object.fromEntries(
  Object.entries(manifest.rosterColumns).map(([key, value]) => [
    key,
    column(value),
  ]),
);
const byIdentity = new Map();
const provisional = {
  missingIdentity: 0,
  invalidDate: 0,
  invalidGroup: 0,
  baseDate: 0,
  specialDateOrGroup: 0,
  otherCycle: 0,
  excludedDate: 0,
  practiceDate: 0,
  unmappedDate: 0,
};
for (const row of roster.rows) {
  const raw = (key) => row.cells[indices[key]]?.raw;
  const person = identity(raw("identity"));
  const date = civilDate(raw("date"), roster.source.epoch);
  const parsedGroup = group(String(raw("group") ?? ""), false);
  if (!person.normalized) provisional.missingIdentity++;
  if (!date) provisional.invalidDate++;
  if (parsedGroup.issues.length) provisional.invalidGroup++;
  if (parsedGroup.cycle && parsedGroup.cycle !== manifest.cycle)
    provisional.otherCycle++;
  if (parsedGroup.special || date === "2026-08-29")
    provisional.specialDateOrGroup++;
  else if (date === "2026-08-31") provisional.baseDate++;
  else if (date === "2026-08-30") provisional.practiceDate++;
  else if (["2026-08-28", "2026-08-27", "2026-08-26"].includes(date))
    provisional.excludedDate++;
  else provisional.unmappedDate++;
  if (person.normalized) {
    const rows = byIdentity.get(person.normalized) ?? [];
    rows.push({
      row: row.row,
      date,
      group: raw("group"),
      career: raw("career"),
      special: parsedGroup.special,
    });
    byIdentity.set(person.normalized, rows);
  }
}
const books = manifest.books.map((input) => {
  const table = load(input.path);
  const parsed = parseMoodle(table, {
    ...input.mapping,
    version: "inspeccion-local-provisional",
    approvedBy: "inspeccion-tecnica-no-aprobacion-academica",
  });
  const states = {};
  const discrepancies = [];
  let present = 0;
  for (const row of parsed.accepted) {
    const matches = byIdentity.get(row.person.normalized) ?? [];
    if (matches.length) present++;
    // Private report keeps row provenance; no identities are needed to revisit the source.
    if (!matches.length)
      discrepancies.push({
        reportRow: row.row,
        kind: "sin_padron",
        rosterRows: [],
      });
    else if (matches.length > 1)
      discrepancies.push({
        reportRow: row.row,
        kind: "varias_inscripciones_conservadas",
        rosterRows: matches.map((r) => r.row),
      });
    for (const value of row.values) {
      states[value.grade.state] = (states[value.grade.state] ?? 0) + 1;
      if (value.grade.state === "numerica" && Number(value.grade.raw) === 0)
        states.zero = (states.zero ?? 0) + 1;
    }
  }
  return {
    source: table.source,
    rows: table.rows.length,
    candidateActivities: parsed.activities.map((a) => a.activityId),
    selectionStatus:
      "Candidatas para inspección; NO selección académica aprobada, NO denominador final",
    studentsWithoutDuplicateConflict: parsed.accepted.length,
    teacherRows: parsed.teachers.length,
    unresolvedRows: parsed.unresolved.length,
    matchesInRoster: present,
    absentFromRoster: parsed.accepted.length - present,
    states,
    issues: parsed.issues,
    discrepancies,
  };
});
for (const { path, hash } of hashes) {
  if (createHash("sha256").update(readFileSync(path)).digest("hex") !== hash)
    throw new Error("La fuente cambió durante lectura");
}
writeFileSync(
  resolve(root, "pilot-reconciliation.json"),
  JSON.stringify(
    {
      status: "provisional",
      sourceUnchanged: true,
      pending: [
        "catalogo autorizado carrera/plan/coordinacion",
        "suplemento o declaracion no aplica",
        "bajas aprobadas",
        "excepciones y afiliacion base aprobadas",
        "corte y actividades seleccionadas",
      ],
      roster: {
        source: roster.source,
        rows: roster.rows.length,
        uniqueIdentities: byIdentity.size,
        multipleEnrollmentPeople: [...byIdentity.values()].filter(
          (rows) => rows.length > 1,
        ).length,
        provisional,
      },
      books,
    },
    null,
    2,
  ),
);
console.log(
  "Conciliación provisional guardada en private/pilot-reconciliation.json; originales intactos. No publicar el informe privado.",
);
