import { describe, it, expect } from "vitest";
import { group } from "../../src/domain/academic";
import { approvedCalendarDates } from "../../src/domain/decision-package";
import { accumulateRows } from "../../src/domain/accumulation";
import {
  enrollmentKey,
  resolveAcademicPackage,
  validateAcademicPackage,
} from "../../src/importing/decisions";
import {
  approvedPackage,
  decision,
  enrollment,
} from "../fixtures/synthetic/approved-package";
import type { RowView } from "../../src/domain/import-contract";
const resolve = (p = approvedPackage()) =>
  resolveAcademicPackage(
    p,
    p.cycle,
    "corte",
    "2026-10-10",
    "version-sintetica",
    "actor-servidor",
  );

describe("decisiones versionadas aprobadas", () => {
  it("acepta la fecha original solo para la inscripción autorizada; fechas inválidas y casos nuevos siguen pendientes", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A", "27-1 LAF 11 01A", "12/09/2026"),
      enrollment("000B", "27-1 LAF 11 01A", "12/09/2026", 3),
      enrollment("000C", "27-1 LAF 11 01A", "fecha inválida", 4),
    ];
    p.decisions = [
      decision(p.enrollments[0]!.key, {
        kind: "base",
        primary: true,
        originalDateApproved: true,
      }),
      decision(p.enrollments[2]!.key, {
        kind: "base",
        primary: true,
        originalDateApproved: true,
      }),
    ];
    const r = resolve(p);
    expect(r.observations.map((o) => o.state)).toEqual([
      "resuelto",
      "pendiente",
      "pendiente",
    ]);
    expect(r.academic.enrollments[0]).toMatchObject({
      date: "2026-09-12",
      originalDate: "2026-09-12",
      kind: "base",
      problems: [],
    });
    expect(r.academic.enrollments[1]?.problems).toContain("fecha_desconocida");
    expect(r.academic.enrollments[2]?.problems).toContain("fecha_desconocida");
    const changed = structuredClone(p);
    changed.enrollments[0]!.original.date = "13/09/2026";
    expect(() => resolve(changed)).toThrow("Original");
    expect(() =>
      resolveAcademicPackage(p, "28-1", "otro", "2027-10-10", "v", "admin"),
    ).toThrow("otro ciclo");
    p.decisions[0]!.date = "2026-08-31";
    expect(() => resolve(p)).toThrow("contradictorios");
  });
  it("calendarios flexibles por modalidad; Virtual no hereda frecuencia", () => {
    const p = approvedPackage();
    expect(approvedCalendarDates(p, "escolarizado", "2026-09-14", 3)).toEqual([
      "2026-09-14",
      "2026-10-05",
      "2026-10-19",
    ]);
    expect(approvedCalendarDates(p, "ejecutivo", "2026-09-07", 3)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
    expect(() => approvedCalendarDates(p, "virtual", "2026-09-07", 1)).toThrow(
      "pendiente",
    );
    p.schedule.virtual = [[1], [2, 3]];
    expect(approvedCalendarDates(p, "virtual", "2026-09-07", 2)).toEqual([
      "2026-09-07",
      "2026-09-21",
    ]);
  });
  it("normaliza solo el perfil aprobado y conserva el original y los campos ausentes", () => {
    const raw = " 27- 1  digraf 11 01ca ";
    expect(group(raw, false, true)).toMatchObject({
      original: raw,
      normalized: "27-1 DIGRAFT 11 01C.A",
      cycle: "27-1",
      special: true,
    });
    expect(group("27-1 COMPUB 11 01A", false, true).career).toBe("CONPUB");
    expect(group("27-1 ARQ EJEC. ESP.", true, true)).toMatchObject({
      special: true,
      grade: null,
    });
    expect(group(raw, false).issues).toContain("grupo_ilegible");
    expect(group("LAF 11 01A", false, true).cycle).toBeNull();
  });
  it("fechas configuradas por periodo; no aplica agosto automáticamente", () => {
    const p = approvedPackage();
    p.cycle = "28-1";
    p.calendar = { "2027-01-11": "base" };
    p.enrollments = [enrollment("000A", "28-1 LAF 11 01A", "11/01/2027")];
    expect(resolve(p).academic.persons[0]?.baseEnrollmentId).toBe(
      p.enrollments[0]!.key,
    );
    expect(() => validateAcademicPackage(p, "27-1")).toThrow("otro ciclo");
  });
  it("solo las excepciones explícitas cambian la prioridad CA/fecha", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A", "27-1 LAF 11 01CA"),
      enrollment("000B", "27-1 LAF 11 01CA"),
    ];
    p.decisions = [
      decision(p.enrollments[0]!.key, { kind: "base", primary: true }),
    ];
    const { academic } = resolve(p);
    expect(academic.enrollments.map((e) => e.kind)).toEqual([
      "base",
      "especial",
    ]);
    expect(academic.persons.every((p) => p.baseEnrollmentId)).toBe(true);
  });
  it("conserva el par base/especial aun con misma persona y grupo", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A"),
      enrollment("000A", "27-1 LAF 11 01A", "29/08/2026", 3),
    ];
    const result = resolve(p);
    expect(result.academic.enrollments.map((e) => e.kind)).toEqual([
      "base",
      "especial",
    ]);
    expect(result.academic.persons[0]?.enrollmentIds).toHaveLength(2);
    expect(result.academic.persons[0]?.baseEnrollmentId).toBe(
      p.enrollments[0]!.key,
    );
  });
  it("corrige fecha y modalidad mediante una revisión, preserva los antecedentes", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A"),
      enrollment("000A", "27-1 LAF 24 01A", "17/09/2026", 3, "Ejecutivo"),
    ];
    p.decisions = [
      decision(p.enrollments[0]!.key, {
        kind: "excluida",
        exclusionReason: "antecedente_sustituido",
      }),
      decision(p.enrollments[1]!.key, {
        date: "2026-08-31",
        kind: "base",
        primary: true,
      }),
    ];
    const { academic, observations } = resolve(p);
    expect(academic.enrollments[1]).toMatchObject({
      date: "2026-08-31",
      originalDate: "2026-09-17",
      decision: { approvedBy: "actor-servidor" },
    });
    expect(observations[0]?.state).toBe("excluido");
    expect(observations[1]?.original).toMatchObject({
      date: "17/09/2026",
      modality: "Ejecutivo",
    });
  });
  it("una baja excluye todas sus inscripciones incluso con mayúsculas diferentes", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A"),
      enrollment("000a", "27-1 ARQ 11 01A", "29/08/2026", 3),
    ];
    p.decisions = [
      decision(p.enrollments[0]!.key, {
        kind: "baja",
        exclusionReason: "baja",
      }),
    ];
    const r = resolve(p);
    expect(r.academic.enrollments.every((e) => e.kind === "baja")).toBe(true);
    expect(r.academic.persons[0]?.baseEnrollmentId).toBeNull();
  });
  it("descartar un error de otro ciclo conserva la inscripción vigente", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A"),
      enrollment("000A", "26-3 LAF 11 01A", "31/08/2026", 3),
    ];
    p.decisions = [
      decision(p.enrollments[1]!.key, {
        kind: "excluida",
        exclusionReason: "error_captura",
      }),
    ];
    expect(resolve(p).academic.persons[0]?.baseEnrollmentId).toBe(
      p.enrollments[0]!.key,
    );
    expect(resolve(p).observations[1]?.reason).toBe("error_captura");
  });
  it("reutiliza por contenido, no por fila; cambios contradictorios no heredan decisiones", () => {
    const p = approvedPackage();
    p.decisions = [decision(p.enrollments[0]!.key, { primary: true })];
    p.enrollments[0]!.row = 900;
    expect(resolve(p).observations[0]?.state).toBe("resuelto");
    p.enrollments[0]!.original.group = "27-1 ARQ 11 01A";
    expect(() => resolve(p)).toThrow("Original");
    p.enrollments[0]!.key = enrollmentKey(p.enrollments[0]!.original);
    expect(() => resolve(p)).toThrow("huérfana");
  });
  it("Virtual conserva modalidad original y horario confirmado; calendario no asignado", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A", "27-1 LAF 53 01A", "31/08/2026", 2, "Ejecutivo"),
      enrollment("000B", "27-1 LAF 53 01A", "31/08/2026", 3, "Virtual"),
    ];
    expect(
      resolve(p).academic.enrollments.map((e) => [
        e.parsed.modality,
        e.parsed.shift,
      ]),
    ).toEqual([
      ["Ejecutivo", "Matutino"],
      ["Virtual", "Sabatino Matutino"],
    ]);
    expect(p.schedule.virtual).toBeNull();
  });
  it("identidad, catálogo, grupo parcial, fecha y selección ambigua bloquean hasta resolución", () => {
    const p = approvedPackage();
    p.enrollments = [
      enrollment("000A"),
      enrollment("000A", "27-1 LAF 12 01B"),
      enrollment("000B", "27-1 LAF 01", "31/08/2026", 4),
      enrollment("000C", "27-1 LAF 11 01A", "17/09/2026", 5),
    ];
    expect(resolve(p).observations.every((o) => o.state === "pendiente")).toBe(
      true,
    );
    p.decisions = [
      decision(p.enrollments[0]!.key, { primary: true }),
      decision(p.enrollments[2]!.key, { groupApproved: true }),
      decision(p.enrollments[3]!.key, { date: "2026-08-31" }),
    ];
    expect(resolve(p).observations.every((o) => o.state === "resuelto")).toBe(
      true,
    );
  });
});

const row = (
  identity: string,
  activityId: string,
  raw: string,
  version = "v1",
): RowView => ({
  id: identity,
  identity,
  careerId: "a",
  row: 2,
  issues: [],
  values: [
    {
      activityId,
      raw,
      state: raw === "-" ? "guion" : "numerica",
      sourceVersion: version,
    },
  ],
});
describe("acumulación por identidad y actividad explícitas", () => {
  it("conserva filas y columnas ausentes, incluye cero, corrige sin duplicar y mantiene procedencia", () => {
    const before = [row("000A", "U1", "0"), row("000B", "U1", "-")];
    const current = [row("000a", "U2", "7", "v2")];
    const r = accumulateRows(before, current);
    expect(r).toHaveLength(2);
    expect(r[0]?.values.map((v) => v.raw)).toEqual(["0", "7"]);
    expect(r[0]?.values.map((v) => v.sourceVersion)).toEqual(["v1", "v2"]);
    expect(accumulateRows(r, current)).toEqual(r);
    expect(
      accumulateRows(r, [row("000A", "U1", "5", "v3")])[0]?.values[0]?.raw,
    ).toBe("5");
    expect(before[0]?.values[0]?.raw).toBe("0");
  });
  it("rechaza identidad duplicada y cambio de significado del ID estable", () => {
    expect(() =>
      accumulateRows([row("000A", "U1", "1"), row("000a", "U1", "1")], []),
    ).toThrow("ambigua");
    const later = row("000A", "U1", "2");
    later.values[0]!.additional = true;
    expect(() => accumulateRows([row("000A", "U1", "1")], [later])).toThrow(
      "correspondencia",
    );
  });
});
