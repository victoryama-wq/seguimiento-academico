// Solo lectura local; salida privada. No abre conexiones a Firebase.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  resolveAcademicPackage,
} = require("../functions/lib/src/importing/decisions.js");
const { readTable } = require("../functions/lib/src/importing/files.js");
const { parseMoodle } = require("../functions/lib/src/importing/mapping.js");
const root = fs.realpathSync("private");
const local = (file) => {
  const resolved = fs.realpathSync(file);
  if (!resolved.startsWith(root + path.sep))
    throw new Error("Entrada de control debe estar en private/");
  return JSON.parse(fs.readFileSync(resolved, "utf8").replace(/^\uFEFF/, ""));
};
const p = local(process.argv[2]),
  manifest = local(process.argv[3]);
const result = resolveAcademicPackage(
  p,
  p.cycle,
  "conciliacion-privada",
  "9999-12-31",
  "conciliacion-local",
  "operador-local",
);
const persons = new Map(result.academic.persons.map((p) => [p.identity, p]));
const records = new Map(result.academic.enrollments.map((e) => [e.id, e]));
const files = manifest.books.map((book, i) => {
  const table = readTable(fs.readFileSync(book.path), path.basename(book.path));
  const parsed = parseMoodle(table, {
    ...book.mapping,
    version: `M0${i + 1}`,
    approvedBy: "conciliacion-local",
  });
  const details = [...parsed.accepted, ...parsed.unresolved].map((row) => {
    const person = persons.get(row.person.normalized);
    const principal = person?.baseEnrollmentId
      ? records.get(person.baseEnrollmentId)
      : null;
    const enrollments =
      person?.enrollmentIds.map((id) => records.get(id)) ?? [];
    return {
      row: row.row,
      identity: row.person.original,
      principal: principal?.id ?? null,
      career: principal?.careerId ?? null,
      excluded:
        enrollments.length > 0 &&
        enrollments.every((e) =>
          ["baja", "excluida", "practica", "docente"].includes(e.kind),
        ),
      issues: enrollments.flatMap((e) => e.problems),
      kinds: enrollments.map((e) => e.exclusionReason ?? e.kind),
      values: row.values,
    };
  });
  const states = { numerica: 0, guion: 0, vacia: 0, invalida: 0 };
  for (const row of details.filter((r) => r.principal))
    for (const v of row.values) states[v.grade.state]++;
  return {
    source: table.source,
    details,
    controls: {
      source: `M0${i + 1}`,
      rows: table.rows.length,
      teachers: parsed.teachers.length,
      accepted: parsed.accepted.length,
      unresolved: parsed.unresolved.length,
      withPrincipal: details.filter((r) => r.principal).length,
      excluded: details.filter((r) => r.excluded).length,
      withoutAttribution: details.filter((r) => !r.principal && !r.excluded)
        .length,
      withRosterObservations: details.filter((r) => r.issues.length).length,
      activities: parsed.mapping.columns.filter((c) => c.kind === "activity")
        .length,
      states,
    },
    issues: parsed.issues,
  };
});
const report = {
  status:
    "conciliacion privada; sin publicación; selección de actividades requiere validación por corte",
  files,
  pendingSourceObservations: result.observations.filter(
    (o) => o.state === "pendiente",
  ),
};
fs.writeFileSync(
  path.join(root, "approved-pilot-reconciliation.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    files.map((f) => f.controls),
    null,
    2,
  ),
);
