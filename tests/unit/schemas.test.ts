import { describe, expect, it } from "vitest";
import {
  civilDateSchema,
  courseVersionSchema,
  cutSchema,
  enrollmentSchema,
  gradeValueSchema,
  personSchema,
  sourceVersionSchema,
} from "../../src/domain/schemas";
import {
  syntheticCut,
  syntheticEnrollment,
  syntheticPerson,
} from "../fixtures/synthetic/initial";

describe("contratos iniciales de dominio", () => {
  it("preserva matrícula original, prefijo y ceros", () => {
    expect(personSchema.parse(syntheticPerson)).toEqual(syntheticPerson);
    expect(
      personSchema.parse({ ...syntheticPerson, matriculaOriginal: "TUP-0007" })
        .matriculaOriginal,
    ).toBe("TUP-0007");
  });
  it.each([7, "", "   ", null])(
    "rechaza identidad inválida sin convertirla: %s",
    (value) => {
      expect(
        personSchema.safeParse({ ...syntheticPerson, matriculaOriginal: value })
          .success,
      ).toBe(false);
    },
  );
  it("rechaza campos de rol introducidos en una persona", () => {
    expect(
      personSchema.safeParse({ ...syntheticPerson, role: "admin" }).success,
    ).toBe(false);
  });
  it("conserva dos inscripciones de la misma persona y un especial sin base", () => {
    const records = [
      syntheticEnrollment,
      {
        ...syntheticEnrollment,
        id: "especial-02",
        classification: "especial",
        groupOriginal: "grupo ilegible C.A",
        groupDate: null,
      },
    ].map((value) => enrollmentSchema.parse(value));
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({
      personId: records[0]?.personId,
      classification: "especial",
      baseEnrollmentId: null,
      groupDate: null,
    });
  });
  it.each([
    "2026-02-29",
    "2026-13-01",
    "2026-04-31",
    "31/08/2026",
    "2026-08-31T00:00:00Z",
  ])("rechaza fecha civil inválida %s", (value) => {
    expect(civilDateSchema.safeParse(value).success).toBe(false);
  });
  it("preserva el día civil y admite años bisiestos", () => {
    expect(civilDateSchema.parse("2026-08-31")).toBe("2026-08-31");
    expect(civilDateSchema.parse("2028-02-29")).toBe("2028-02-29");
  });
  it("mantiene cero, guion, vacío e incidencia como estados distintos", () => {
    const values = [
      { state: "numerica", raw: "0", value: 0 },
      { state: "guion", raw: "-" },
      { state: "vacia", raw: "" },
      { state: "invalida", raw: "#ERROR!", issueId: "inc-1" },
    ].map((value) => gradeValueSchema.parse(value));
    expect(values.map((value) => value.state)).toEqual([
      "numerica",
      "guion",
      "vacia",
      "invalida",
    ]);
    expect(
      gradeValueSchema.safeParse({ state: "guion", raw: "-", value: 0 })
        .success,
    ).toBe(false);
    expect(
      gradeValueSchema.safeParse({ state: "numerica", raw: "NaN", value: NaN })
        .success,
    ).toBe(false);
    expect(
      gradeValueSchema.safeParse({ state: "numerica", raw: "-", value: 0 })
        .success,
    ).toBe(false);
    expect(
      gradeValueSchema.safeParse({ state: "numerica", raw: "", value: 0 })
        .success,
    ).toBe(false);
  });
  it("exige referencias de fuentes y evidencia de cierre", () => {
    expect(cutSchema.parse(syntheticCut).status).toBe("abierto");
    expect(
      cutSchema.safeParse({ ...syntheticCut, status: "cerrado" }).success,
    ).toBe(false);
    expect(
      cutSchema.safeParse({ ...syntheticCut, catalogVersionId: undefined })
        .success,
    ).toBe(false);
    expect(
      cutSchema.parse({
        ...syntheticCut,
        status: "cerrado",
        publicationId: "pub-1",
        closedAt: "2026-09-21T17:00:00Z",
      }).status,
    ).toBe("cerrado");
  });
  it("exige instancia de curso, revisión y actividades únicas sin forzar selección", () => {
    const version = {
      cycleId: "27-1",
      cutId: "c1",
      courseInstanceId: "inst-600-a",
      revision: 1,
      sourceImportId: "imp-1",
      selectedActivityIds: [],
    };
    expect(courseVersionSchema.parse(version).selectedActivityIds).toEqual([]);
    expect(
      courseVersionSchema.safeParse({ ...version, courseInstanceId: undefined })
        .success,
    ).toBe(false);
    expect(
      courseVersionSchema.safeParse({
        ...version,
        selectedActivityIds: ["a", "a"],
      }).success,
    ).toBe(false);
  });
  it("exige procedencia del original sin reinterpretar su nombre", () => {
    const source = {
      id: "imp-1",
      sha256: "a".repeat(64),
      originalName: "=contenido.xlsx",
      bytes: 12,
      storagePath: "originals/imp-1/source",
      actorUid: "test-admin",
      createdAt: "2026-09-21T17:00:00Z",
      parserVersion: "synthetic-1",
    };
    expect(sourceVersionSchema.parse(source).originalName).toBe(
      "=contenido.xlsx",
    );
    expect(
      sourceVersionSchema.safeParse({ ...source, sha256: "malformado" })
        .success,
    ).toBe(false);
    expect(
      sourceVersionSchema.safeParse({ ...source, bytes: -1 }).success,
    ).toBe(false);
  });
});
