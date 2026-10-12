// Uso local exclusivamente. No ejecutar con fuentes privadas en CI.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import * as XLSX from "xlsx";
const require = createRequire(import.meta.url);
const {
  prepareApprovedPackage,
} = require("../functions/lib/src/importing/approved-matrix.js");
const manifest = JSON.parse(
  fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""),
);
const output = path.resolve(manifest.output);
const privateRoot = path.resolve("private");
if (!output.startsWith(privateRoot + path.sep))
  throw new Error("Salida obligatoria dentro de private/");
function load(file, id) {
  const bytes = fs.readFileSync(file);
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Fuente fuera de límite");
  const book = XLSX.read(bytes, {
    type: "buffer",
    raw: true,
    cellDates: false,
  });
  if (book.Workbook?.WBProps?.date1904)
    throw new Error(
      "Convertir explícitamente época de matriz antes de usar este adaptador",
    );
  return {
    book,
    source: {
      id,
      name: path.basename(file),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      sheet: book.SheetNames[0],
    },
  };
}
const matrix = load(manifest.matrix, "MATRIZ"),
  roster = load(manifest.roster, "P02"),
  catalog = load(manifest.catalog, "C02");
roster.source.sheet = "CSV";
const rows = (book, name) =>
  XLSX.utils.sheet_to_json(book.Sheets[name], {
    header: 1,
    defval: null,
    blankrows: true,
  });
const result = prepareApprovedPackage({
  cycle: manifest.cycle,
  calendar: manifest.calendar,
  schedule: manifest.schedule,
  sources: [matrix.source, roster.source, catalog.source],
  sheets: Object.fromEntries(
    matrix.book.SheetNames.map((name) => [name, rows(matrix.book, name)]),
  ),
  roster: rows(roster.book, roster.book.SheetNames[0]),
  catalog: rows(catalog.book, catalog.book.SheetNames[0]),
});
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result.package, null, 2));
fs.writeFileSync(
  output.replace(/\.json$/, "-reconciliation.json"),
  JSON.stringify(
    {
      controls: result.controls,
      discrepancies: result.discrepancies,
      observations: result.result.observations,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(result.controls, null, 2));
if (result.controls.discrepancies || result.controls.pending)
  process.exitCode = 1;
