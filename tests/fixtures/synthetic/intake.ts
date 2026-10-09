import * as XLSX from "xlsx";
import { readTable } from "../../../src/importing/files";
import {
  buildAdministration,
  suggestFields,
} from "../../../src/importing/intake";
import { intakeOperations } from "../../../src/domain/intake-contract";

export const rosterHeaders = [
  "matricula",
  "nombre",
  "carrera",
  "grupo",
  "fecha",
  "modalidad",
  "turno",
];
export const catalogHeaders = [
  "Programa",
  "Plan",
  "Abreviatura",
  "Coordinadora",
  "Tipo",
  "Campus",
];
export const rosterRows = [
  [
    "000ESC",
    "Persona sintética E",
    "Finanzas",
    "27-1 LAF 11 01A",
    "31/08/2026",
    "Escolarizado",
    "Matutino",
  ],
  [
    "000EJE",
    "Persona sintética J",
    "Finanzas",
    "27-1 LAF 23 01CA",
    "29/08/2026",
    "Ejecutivo",
    "Matutino",
  ],
  [
    "000VIR",
    "Persona sintética V",
    "Arquitectura",
    "27-1 ARQ 53 01A",
    "31/08/2026",
    "Virtual",
    "Sabatino Matutino",
  ],
  [
    "000BAJA",
    "Persona sintética X",
    "Finanzas",
    "27-1 LAF 11 01A",
    "28/08/2026",
    "Escolarizado",
    "Matutino",
  ],
];
export const catalogRows = [
  [
    "Finanzas",
    "Plan A",
    "LAF",
    "Coordinación sintética A",
    "carrera",
    "Campus sintético",
  ],
  [
    "Arquitectura",
    "Plan B",
    "ARQ",
    "Coordinación sintética B",
    "carrera",
    "Campus sintético",
  ],
];
export const csv = (rows: unknown[][]) =>
  Buffer.from(
    rows
      .map((r) =>
        r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\n"),
  );
export function book(
  rows: unknown[][],
  type: "xlsx" | "ods" = "xlsx",
  epoch1904 = false,
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Datos");
  wb.Workbook = { WBProps: { date1904: epoch1904 } };
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: type }));
}
export function intakeFixture(rows = rosterRows) {
  const roster = readTable(csv([rosterHeaders, ...rows]), "padron.csv");
  const catalog = readTable(
    book([catalogHeaders, ...catalogRows]),
    "catalogo.xlsx",
  );
  const config = intakeOperations.prepareAdministration.parse({
    roster: {
      id: "a".repeat(64),
      columns: suggestFields(roster.headers, "roster"),
      options: {},
    },
    catalog: {
      id: "b".repeat(64),
      columns: suggestFields(catalog.headers, "catalog"),
      options: {},
    },
    cycle: "27-1",
    expected: null,
  });
  return {
    roster,
    catalog,
    config,
    initial: buildAdministration(roster, catalog, config, "admin-sintetico"),
  };
}
