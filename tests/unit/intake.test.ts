import { it, expect } from "vitest";
import {
  intakeFixture,
  rosterRows,
  rosterHeaders,
  book,
} from "../fixtures/synthetic/intake";
import { suggestFields, buildAdministration } from "../../src/importing/intake";
import { readTable } from "../../src/importing/files";
import { decision } from "../fixtures/synthetic/approved-package";
import * as XLSX from "xlsx";
import { workbookData } from "../../src/importing/files";
import { decisionSheets } from "../../src/importing/approved-matrix";

it("reconoce encabezados exactos acentuados, no elige dos candidatas ni equipara responsable con coordinación", () => {
  expect(
    suggestFields(["MATRÍCULA", " Matrícula del alumno ", "Nombre"], "roster"),
  ).toEqual({ name: 2 });
  expect(suggestFields(["Responsable", "Plan", "Carrera"], "catalog")).toEqual({
    responsible: 0,
    plan: 1,
    program: 2,
  });
  expect(suggestFields(["Coordinadora"], "catalog")).toMatchObject({
    coordination: 0,
    responsible: 0,
  });
});
it("integra CSV y XLSX sin JSON: base, principal C.A., Virtual y exclusión separados", () => {
  const { initial } = intakeFixture();
  expect(initial.issues).toEqual([]);
  expect(
    initial.resolved.observations.filter((o) => o.state === "pendiente"),
  ).toEqual([]);
  expect(
    initial.resolved.academic.persons.filter((p) => p.baseEnrollmentId),
  ).toHaveLength(3);
  expect(
    initial.resolved.observations
      .filter((o) => o.state === "excluido")
      .map((o) => o.identity),
  ).toEqual(["000BAJA"]);
});
it("normaliza época de ODS/XLSX sin alterar ceros ni originales textuales", () => {
  const f = intakeFixture();
  const rows = [
    [...rosterRows[0]!.slice(0, 4), 44803, ...rosterRows[0]!.slice(5)],
  ];
  const roster = readTable(
    book([rosterHeaders, ...rows], "xlsx", true),
    "1904.xlsx",
  );
  const actual = buildAdministration(roster, f.catalog, f.config, "admin");
  expect(actual.package.enrollments[0]!.original.date).toBe("2026-08-31");
  const ods = readTable(
    book([rosterHeaders, ...rosterRows], "ods"),
    "padron.ods",
  );
  expect(
    buildAdministration(ods, f.catalog, f.config, "admin").package
      .enrollments[0]!.original.identity,
  ).toBe("000ESC");
});
it("conserva excepciones individuales y revisiones; un original cambiado exige continuidad explícita", () => {
  const f = intakeFixture();
  const previous = f.initial.package;
  const e = previous.enrollments[0]!;
  previous.decisions = [
    decision(e.key, {
      kind: "base",
      primary: true,
      originalDateApproved: true,
    }),
  ];
  previous.reviews = [
    {
      id: "REV-75",
      enrollmentKeys: [e.key],
      rule: "DEC-36",
      reason: "Sintético",
      decisionDate: "2026-10-06",
      sourceReference: "Matriz",
      status: "resolved",
    },
  ];
  const same = buildAdministration(
    f.roster,
    f.catalog,
    f.config,
    "admin",
    previous,
  );
  expect(same.package.decisions).toEqual(previous.decisions);
  expect(same.package.reviews).toEqual(previous.reviews);
  const changed = intakeFixture(
    rosterRows.map((r, i) =>
      i ? r : r.map((c, j) => (j === 1 ? "Nombre corregido sintético" : c)),
    ),
  );
  const pending = buildAdministration(
    changed.roster,
    f.catalog,
    f.config,
    "admin",
    previous,
  );
  expect(pending.issues.map((i) => i.code)).toContain("decision_changed");
  const nextKey = changed.initial.package.enrollments[0]!.key;
  const resolved = buildAdministration(
    changed.roster,
    f.catalog,
    {
      ...f.config,
      continuity: [
        {
          previousKey: e.key,
          nextKey,
          reason: "Corrección del nombre revisada",
        },
      ],
    },
    "admin",
    previous,
  );
  expect(resolved.issues).toEqual([]);
  expect(resolved.package.decisions[0]!.enrollmentId).toBe(nextKey);
  expect(resolved.package.reviews[0]!.enrollmentKeys).toEqual([nextKey]);
  const foreign = buildAdministration(
    changed.roster,
    f.catalog,
    {
      ...f.config,
      continuity: [
        {
          previousKey: e.key,
          nextKey: previous.enrollments[1]!.key,
          reason: "No permitido",
        },
      ],
    },
    "admin",
    previous,
  );
  expect(foreign.issues.map((i) => i.code)).toContain("decision_changed");
});
it("una matriz antigua no reemplaza silenciosamente una decisión más reciente", () => {
  const f = intakeFixture();
  const current = structuredClone(f.initial.package),
    matrix = structuredClone(f.initial.package);
  const key = current.enrollments[0]!.key;
  current.decisions = [
    decision(key, {
      kind: "baja",
      exclusionReason: "baja",
      reason: "Baja vigente",
    }),
  ];
  matrix.decisions = [
    decision(key, { kind: "base", primary: true, reason: "Matriz anterior" }),
  ];
  const pending = buildAdministration(
    f.roster,
    f.catalog,
    f.config,
    "admin",
    current,
    matrix,
  );
  expect(pending.issues.map((i) => i.code)).toContain("matrix_conflict");
  expect(pending.package.decisions[0]!.kind).toBe("baja");
  const kept = buildAdministration(
    f.roster,
    f.catalog,
    {
      ...f.config,
      matrixChoices: [
        { key, useMatrix: false, reason: "La baja sigue vigente" },
      ],
    },
    "admin",
    current,
    matrix,
  );
  expect(kept.issues).toEqual([]);
  expect(kept.package.decisions[0]!.kind).toBe("baja");
});
it("una resolución individual de fecha no desactiva la validación de otra inscripción", () => {
  const f = intakeFixture(
    rosterRows.map((r, i) =>
      i !== 1 && i < 3 ? r.map((c, j) => (j === 4 ? "17/09/2026" : c)) : r,
    ),
  );
  const key = f.initial.package.enrollments[0]!.key;
  const result = buildAdministration(
    f.roster,
    f.catalog,
    {
      ...f.config,
      individualChoices: [
        {
          key,
          kind: "base",
          primary: true,
          originalDateApproved: true,
          groupApproved: false,
          reason: "Aprobación individual",
        },
      ],
    },
    "admin",
  );
  expect(result.resolved.observations.find((o) => o.id === key)!.state).toBe(
    "resuelto",
  );
  expect(
    result.resolved.observations.find((o) => o.identity === "000VIR")!.state,
  ).toBe("pendiente");
});

it("distingue correspondencias generales por plan de decisiones individuales y las conserva", () => {
  const f = intakeFixture(
    rosterRows.map((r) =>
      r.map((v, i) =>
        i === 2 && v === "Finanzas" ? "Programa original diferente" : v,
      ),
    ),
  );
  expect(f.initial.issues.map((i) => i.code)).toContain("program");
  const id = f.initial.package.catalog.find(
    (c) => c.abbreviation === "LAF",
  )!.id;
  const mapped = buildAdministration(
    f.roster,
    f.catalog,
    {
      ...f.config,
      programMappings: [
        {
          program: "Programa original diferente",
          abbreviation: "LAF",
          careerId: id,
          reason: "Correspondencia confirmada por institución",
        },
      ],
    },
    "admin",
  );
  expect(mapped.issues).toEqual([]);
  expect(mapped.package.decisions).toEqual([]);
  const again = buildAdministration(
    f.roster,
    f.catalog,
    f.config,
    "admin",
    mapped.package,
  );
  expect(again.package.catalogMappings).toEqual(mapped.package.catalogMappings);
});
it("no ejecuta fórmulas de hojas informativas y rechaza fórmulas en decisiones importadas", () => {
  const wb = XLSX.utils.book_new();
  for (const name of ["Resumen", "Inscripciones actuales"])
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Dato"], [1]]),
      name,
    );
  wb.Sheets.Resumen!.A2 = { t: "n", v: 1, f: "1+0" };
  const data = () =>
    Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  expect(
    workbookData(data(), "matriz.xlsx", decisionSheets).sheets.Resumen![1]![0],
  ).toBe(1);
  wb.Sheets["Inscripciones actuales"]!.A2 = { t: "n", v: 1, f: "1+0" };
  expect(() => workbookData(data(), "matriz.xlsx", decisionSheets)).toThrow(
    /decisiones/,
  );
});
it("un ciclo nuevo requiere clasificación institucional de fechas y no la deduce del avance", () => {
  const f = intakeFixture(
    rosterRows.map((r) =>
      r.map((v, i) => (i === 3 ? v.replace("27-1", "28-1") : v)),
    ),
  );
  const config = { ...f.config, cycle: "28-1" };
  expect(
    buildAdministration(f.roster, f.catalog, config, "admin").issues.map(
      (i) => i.code,
    ),
  ).toContain("calendar");
  const classified = buildAdministration(
    f.roster,
    f.catalog,
    {
      ...config,
      calendarChoices: [
        { date: "2026-08-31", kind: "base", reason: "Regla sintética" },
        { date: "2026-08-29", kind: "especial", reason: "Regla sintética" },
        { date: "2026-08-28", kind: "excluida", reason: "Regla sintética" },
      ],
    },
    "admin",
  );
  expect(classified.issues).toEqual([]);
  expect(
    classified.resolved.observations.filter((o) => o.state === "pendiente"),
  ).toEqual([]);
});
