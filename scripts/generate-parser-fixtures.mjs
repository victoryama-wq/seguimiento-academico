// Solo fixtures sintéticos reproducibles; no lee fuentes privadas.
import { writeFileSync, mkdirSync } from "node:fs";
import * as XLSX from "xlsx";

const destination = new URL(
  "../tests/fixtures/synthetic/parsers/",
  import.meta.url,
);
mkdirSync(destination, { recursive: true });
const headers = [
  "Correo",
  "Tarea: Uno",
  "Tarea: Dos",
  "Cuestionario: Futuro",
  "Categoría: Unidad",
  "Total del curso",
  "Último descargado desde este curso",
];
const data = [
  headers,
  ["000SINT01@example.invalid", 0, "-", "", 80, 80, "2026-09-01"],
  ["TUP-D7@example.invalid", 9, 9, 9, 90, 90, "2026-09-01"],
  ["SINT02@example.invalid", "NP", 7.5, "", 70, 70, "2026-09-01"],
];
for (const bookType of ["xlsx", "ods"]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet(data),
    "Sintético",
  );
  writeFileSync(
    new URL(`1 Curso Sintético 27-1.${bookType}`, destination),
    XLSX.write(book, { type: "buffer", bookType, compression: true }),
  );
}
// CSV se escribe directamente para que al menos una fuente no provenga de SheetJS.
writeFileSync(
  new URL("1 Curso Sintético 27-1.csv", destination),
  data
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n") + "\r\n",
);
const roster = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  roster,
  XLSX.utils.aoa_to_sheet([
    [
      "Matrícula",
      "Nombre",
      "Carrera",
      "Grupo",
      "Modalidad",
      "Turno",
      "Fecha de inscripción",
    ],
    [
      "000SINT01",
      "Persona Sintética 01",
      "laf-plan-1",
      "27-1 LAF 24 01A",
      "Ejecutivo",
      "Vespertino",
      46265,
    ],
  ]),
  "Padrón sintético",
);
writeFileSync(
  new URL("padron.xlsx", destination),
  XLSX.write(roster, { type: "buffer", bookType: "xlsx", compression: true }),
);
