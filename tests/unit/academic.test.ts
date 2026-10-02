import { describe, expect, it } from "vitest";
import {
  applySupplement,
  civilDate,
  courseCollisions,
  courseFilename,
  grade,
  group,
  identity,
  resolveAffiliations,
  resolveCourseFilename,
} from "../../src/domain/academic";
import { context, enrollment } from "../fixtures/synthetic/academic";

describe("identidad textual", () => {
  it.each([
    [" 000ABC@example.invalid ", "000abc", false],
    [" TUP-D12@EXAMPLE.INVALID", "tup-d12", true],
    ["tup-d12x", "tup-d12x", false],
    ["xtup-d12", "xtup-d12", false],
    ["0001", "0001", false],
  ])("normaliza %s sin perder prefijos", (raw, normalized, teacher) =>
    expect(identity(raw)).toEqual({ original: raw, normalized, teacher }),
  );
  it.each([12, null, "", "@example.invalid"])(
    "rechaza identidad %s sin unir por nombre",
    (raw) => expect(identity(raw).normalized).toBeNull(),
  );
});
describe("grupos", () => {
  it.each([
    ["11", "Escolarizado", "Matutino"],
    ["12", "Escolarizado", "Vespertino"],
    ["23", "Ejecutivo", "Matutino"],
    ["24", "Ejecutivo", "Vespertino"],
    ["53", "Virtual", "Sabatino Matutino"],
    ["48", "Escolarizado", "Nocturno"],
  ])("código %s", (code, modality, shift) =>
    expect(group(`27-1 ARQ ${code} 10B`, true)).toMatchObject({
      modality,
      shift,
      grade: "10",
      section: "B",
      cycle: "27-1",
      issues: [],
    }),
  );
  it("48 fuera de Arquitectura queda como incidencia", () =>
    expect(group("27-1 LAF 48 01A", false).issues).toContain(
      "48_fuera_arquitectura",
    ));
  it("COMPUB conserva original", () =>
    expect(group("27-1 COMPUB 24 01A", false)).toMatchObject({
      original: "27-1 COMPUB 24 01A",
      career: "CONPUB",
    }));
  it("especial mal formado conserva condición y atributos desconocidos", () =>
    expect(group("ilegible 05C.A", false)).toMatchObject({
      special: true,
      grade: null,
      issues: ["grupo_ilegible"],
    }));
  it("CA no equivale a C.A", () =>
    expect(group("27-1 LAF 24 05CA", false)).toMatchObject({
      special: false,
      issues: ["grupo_ilegible"],
    }));
  it("no repara códigos desconocidos", () =>
    expect(group("27-1 LAF 99 01A", false).issues).toContain(
      "codigo_desconocido",
    ));
});
describe("fechas civiles", () => {
  it.each(["America/Cancun", "Pacific/Kiritimati", "America/Los_Angeles"])(
    "no desplaza el día con TZ=%s",
    (tz) => {
      const before = process.env.TZ;
      try {
        process.env.TZ = tz;
        expect(civilDate(46265)).toBe("2026-08-31");
        expect(civilDate("31/08/2026")).toBe("2026-08-31");
        expect(civilDate(0, "1904")).toBe("1904-01-01");
      } finally {
        if (before === undefined) delete process.env.TZ;
        else process.env.TZ = before;
      }
    },
  );
  it.each([
    60,
    1.5,
    "2026-02-30",
    "08/31/2026",
    "2026-08-31T00:00:00Z",
    "",
    Infinity,
  ])("fecha inválida %s", (value) => expect(civilDate(value)).toBeNull());
});
describe("afiliación y exclusiones", () => {
  const special = enrollment({ id: "especial", group: "27-1 LAF 24 05C.A" });
  it("base más C.A del 31/08 conserva dos inscripciones y resuelve base", () => {
    const result = resolveAffiliations([enrollment(), special], context);
    expect(result.enrollments.map((r) => r.kind)).toEqual(["base", "especial"]);
    expect(result.persons[0]).toMatchObject({
      baseEnrollmentId: "inscripcion-base",
      enrollmentIds: ["inscripcion-base", "especial"],
    });
    expect(result.issues).toEqual([]);
  });
  it.each(["ingles", "clinicos", "deportes"])(
    "%s nuevo ingreso se excluye sin excluir a la persona",
    (careerId) => {
      const result = resolveAffiliations(
        [enrollment(), enrollment({ id: "excluida", careerId })],
        context,
      );
      expect(result.enrollments[1]!.kind).toBe("excluida");
      expect(result.persons[0]!.baseEnrollmentId).toBe("inscripcion-base");
    },
  );
  it("fecha excluida prevalece sobre C.A", () =>
    expect(
      resolveAffiliations(
        [enrollment({ group: special.group, date: "2026-08-28" })],
        context,
      ).enrollments[0]!.kind,
    ).toBe("excluida"));
  it("especial solo no se convierte en base", () => {
    const result = resolveAffiliations([special], context);
    expect(result.persons[0]!.baseEnrollmentId).toBeNull();
    expect(result.issues.map((i) => i.code)).toContain(
      "sin_grupo_base_confirmado",
    );
  });
  it("bases múltiples no se resuelven por orden", () => {
    const rows = [enrollment(), enrollment({ id: "otra" })];
    for (const ordered of [rows, [...rows].reverse()]) {
      const result = resolveAffiliations(ordered, context);
      expect(result.persons[0]!.baseEnrollmentId).toBeNull();
      expect(result.issues[0]!.code).toBe("varias_bases");
    }
  });
  it("resolución administrativa de base conserva candidatos y aprobación por corte", () => {
    const resolution = {
      identity: "000sint01",
      cutId: context.cutId,
      baseEnrollmentId: "otra",
      version: "resolucion-v1",
      approvedBy: "admin-sintetico",
      reason: "Afiliación confirmada sintéticamente",
    };
    const rows = [enrollment(), enrollment({ id: "otra" })];
    const result = resolveAffiliations(rows, {
      ...context,
      baseResolutions: [resolution],
    });
    expect(result.persons[0]).toMatchObject({
      baseEnrollmentId: "otra",
      resolution,
    });
    expect(result.enrollments).toHaveLength(2);
    expect(result.issues).toEqual([]);
    expect(
      resolveAffiliations(rows, {
        ...context,
        cutId: "otro-corte",
        baseResolutions: [resolution],
      }).persons[0]!.baseEnrollmentId,
    ).toBeNull();
    expect(
      resolveAffiliations(rows, {
        ...context,
        baseResolutions: [{ ...resolution, baseEnrollmentId: "inexistente" }],
      }).issues.map((i) => i.code),
    ).toContain("resolucion_base_invalida");
  });
  it("separa todos los docentes sin inventar responsables ausentes", () => {
    const result = resolveAffiliations(
      [
        enrollment({ identity: "tup-d1" }),
        enrollment({ id: "docente2", identity: "tup-d2" }),
      ],
      context,
    );
    expect(result.enrollments.every((r) => r.kind === "docente")).toBe(true);
    expect(result.persons.every((p) => p.baseEnrollmentId === null)).toBe(true);
  });
  it("baja versionada no modifica cortes anteriores y fecha desconocida solo aplica al corte confirmado", () => {
    const withdrawal = {
      identity: "000sint01",
      version: "bajas-v1",
      approvedBy: "admin-sintetico",
      reason: "Fixture",
      effectiveDate: "2026-09-01",
      confirmedCutId: context.cutId,
    };
    expect(
      resolveAffiliations([enrollment()], {
        ...context,
        withdrawals: [withdrawal],
      }).enrollments[0]!.kind,
    ).toBe("baja");
    expect(
      resolveAffiliations([enrollment()], {
        ...context,
        cutDate: "2026-08-31",
        withdrawals: [withdrawal],
      }).enrollments[0]!.kind,
    ).toBe("base");
    expect(
      resolveAffiliations([enrollment()], {
        ...context,
        cutId: "anterior",
        withdrawals: [{ ...withdrawal, effectiveDate: null }],
      }).enrollments[0]!.kind,
    ).toBe("base");
  });
  it("excepción de otro ciclo exige aprobación y conserva origen", () => {
    const older = enrollment({
      id: "especial-otro-ciclo",
      cycle: "26-3",
      group: "26-3 LAF 24 05C.A",
    });
    expect(
      resolveAffiliations([enrollment(), older], context).issues.map(
        (i) => i.code,
      ),
    ).toContain("ciclo_sin_excepcion");
    const exception = {
      version: "excepciones-v1",
      approvedBy: "admin-sintetico",
      reason: "Autorización sintética",
      enrollmentId: older.id,
      originalCycle: "26-3",
      targetCycle: "27-1",
      cutId: context.cutId,
      baseEnrollmentId: "inscripcion-base",
    };
    const result = resolveAffiliations([enrollment(), older], {
      ...context,
      exceptions: [exception],
    });
    expect(result.enrollments[1]).toMatchObject({
      cycle: "26-3",
      kind: "especial",
      exception,
    });
    expect(result.issues).toEqual([]);
  });
  it("campos desconocidos no atribuyen coordinación arbitraria", () => {
    const result = resolveAffiliations(
      [enrollment({ date: "", careerId: "sin-catalogo", group: "ilegible" })],
      context,
    );
    expect(result.persons[0]!.baseEnrollmentId).toBeNull();
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "fecha_desconocida",
        "carrera_sin_coordinacion",
        "grupo_ilegible",
      ]),
    );
  });
  it("modalidad/turno discrepantes bloquean base", () =>
    expect(
      resolveAffiliations(
        [enrollment({ modality: "Virtual", shift: "Matutino" })],
        context,
      ).persons[0]!.baseEnrollmentId,
    ).toBeNull());
  it("requiere calendario del ciclo y IDs únicos", () => {
    expect(() =>
      resolveAffiliations([enrollment()], { ...context, cycle: "28-1" }),
    ).toThrow("Calendario");
    expect(() =>
      resolveAffiliations([enrollment(), enrollment()], context),
    ).toThrow("repetido");
  });
  it("prácticas no son base", () =>
    expect(
      resolveAffiliations([enrollment({ date: "2026-08-30" })], context)
        .enrollments[0]!.kind,
    ).toBe("practica"));
});
describe("suplemento aprobado", () => {
  const correction = {
    id: "correccion-1",
    version: "suplemento-v1",
    approvedBy: "admin-sintetico",
    reason: "Corrección sintética",
    replacesId: "inscripcion-base",
    enrollment: enrollment({ group: "27-1 LAF 24 02B" }),
  };
  it("sustituye solo inscripción objetivo con historial y sin mutar fuente", () => {
    const rows = [
      enrollment(),
      enrollment({ id: "especial", group: "27-1 LAF 24 05C.A" }),
    ];
    const result = applySupplement(rows, [correction]);
    expect(result.active).toHaveLength(2);
    expect(result.active[1]).toEqual(rows[1]);
    expect(result.history[0]!.previous).toEqual(rows[0]);
    expect(rows[0]!.group).toBe("27-1 LAF 24 01A");
  });
  it("rechaza correcciones conflictivas sin elegir la primera", () => {
    const result = applySupplement(
      [enrollment()],
      [correction, { ...correction, id: "correccion-2" }],
    );
    expect(result.active).toEqual([enrollment()]);
    expect(result.issues).toHaveLength(2);
  });
  it("alta y reintento no multiplican inscripciones", () => {
    const change = {
      ...correction,
      replacesId: null,
      enrollment: enrollment({ id: "alta" }),
    };
    const first = applySupplement([enrollment()], [change]);
    const second = applySupplement(first.active, [change]);
    expect(second.active).toHaveLength(2);
    expect(second.issues[0]!.code).toBe("suplemento_conflictivo");
  });
  it("sin aprobación o con identidad cambiada no sustituye", () => {
    expect(() =>
      applySupplement([enrollment()], [{ ...correction, approvedBy: "" }]),
    ).toThrow();
    expect(
      applySupplement(
        [enrollment()],
        [{ ...correction, enrollment: enrollment({ identity: "otra" }) }],
      ).issues[0]!.code,
    ).toBe("cambio_identidad_requiere_resolucion");
  });
});
describe("calificación y nombres", () => {
  it.each([
    [0, "numerica"],
    ["0", "numerica"],
    ["-", "guion"],
    ["", "vacia"],
    [null, "vacia"],
    ["NP", "invalida"],
    ["#DIV/0!", "invalida"],
    [true, "invalida"],
    [Infinity, "invalida"],
    ["1e999", "invalida"],
    ["8,5", "invalida"],
    ["105.5", "numerica"],
  ])("%s mantiene estado %s sin inferir escala", (raw, state) =>
    expect(grade(raw).state).toBe(state),
  );
  it.each([
    "1 Interculturalidad 27-1.ods",
    "10 Autogestión del Aprendizaje y Competencias Digitales 27-1-calificaciones.xlsx",
    "600 Gestión del Estrés y Bienestar Integral 27-1.csv",
    "616 Derecho Fiscal 27-1-grades.xlsx",
  ])("extrae %s", (name) => expect(courseFilename(name).cycle).toBe("27-1"));
  it.each([
    "download-1 Interculturalidad 27-1.ods",
    "2 1 Interculturalidad 27-1.ods",
    "curso.csv",
    "1 Curso 26-3 27-1.xlsx",
  ])("no adivina %s", (name) =>
    expect(() => courseFilename(name)).toThrow("ambiguo"),
  );
  it("ID externo no es ID de instancia y detecta colisiones", () =>
    expect(
      courseCollisions([
        { externalId: "1", cycle: "27-1", instanceId: "a" },
        { externalId: "1", cycle: "27-1", instanceId: "b" },
      ])[0]!.code,
    ).toBe("colision_id_curso"));
  it("nombre ambiguo puede resolverse conservando original y auditoría", () =>
    expect(
      resolveCourseFilename("descarga 1 curso.ods", {
        version: "mapeo-v1",
        approvedBy: "admin-sintetico",
        reason: "Confirmación sintética",
        externalId: "1",
        name: "Curso sintético",
        cycle: "27-1",
      }),
    ).toMatchObject({
      original: "descarga 1 curso.ods",
      externalId: "1",
      approvedBy: "admin-sintetico",
    }));
});
