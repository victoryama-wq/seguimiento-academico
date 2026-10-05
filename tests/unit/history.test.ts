import { describe, expect, it } from "vitest";
import {
  calendarDates,
  compareHistory,
  validateCorrespondences,
} from "../../src/domain/history";
import { historyOperations } from "../../src/domain/history-contract";
import type { Dashboard } from "../../src/domain/metrics-contract";
import { emptyCounts } from "../../src/domain/metrics";

const data = (id: string, states: string[]): Dashboard => ({
  cutId: id,
  cycleId: "27-1",
  date: "2026-09-21",
  snapshotId: id,
  closed: true,
  counts: emptyCounts(),
  coverage: null,
  dashes: null,
  students: 1,
  expected: 1,
  published: 1,
  measured: 1,
  received: 1,
  validated: 1,
  pending: 0,
  state: "datos",
  exclusionsCount: 0,
  groups: [],
  exclusions: [],
  total: 1,
  next: null,
  facets: {
    coordination: [],
    careerId: [],
    plan: [],
    group: [],
    modality: [],
    shift: [],
    teacher: [],
  },
  courses: [
    {
      id: "curso",
      name: "Curso",
      versionId: id,
      selectionId: id,
      activities: states.map((_, i) => String(i)),
      available: [],
      teachers: [],
      teacherSource: "archivo",
      status: "medido",
      audit: null,
    },
  ],
  details: [
    {
      identity: "00001",
      courseId: "curso",
      versionId: id,
      careerId: "a",
      group: "grupo",
      modality: "Virtual",
      shift: "Sabatino",
      coordination: "a",
      plan: "1",
      special: false,
      attribution: "base",
      enrollmentIds: ["1"],
      sourceVersions: { roster: id },
      issues: [],
      counts: emptyCounts(),
      values: states.map((state, i) => ({
        activityId: String(i),
        state,
        raw:
          state === "numerica"
            ? 0
            : state === "guion"
              ? "-"
              : state === "vacia"
                ? ""
                : "texto",
      })),
    },
  ],
});
describe("historial sobre correspondencias explícitas", () => {
  it("distingue configuración vigente, ausencia fijada y versión explícita", () => {
    const request = { beforeCut: "a", afterCut: "b", filters: {} };
    for (const op of ["compareCuts", "exportComparison"] as const) {
      expect(historyOperations[op].parse(request).mappingId).toBeUndefined();
      expect(
        historyOperations[op].parse({ ...request, mappingId: null }).mappingId,
      ).toBeNull();
      expect(
        historyOperations[op].parse({ ...request, mappingId: "version" })
          .mappingId,
      ).toBe("version");
    }
  });
  it.each([null, "curso"])(
    "conserva baja autorizada y procedencia con curso %s sin fila posterior",
    (courseId) => {
      const a = data("a", ["guion"]),
        b = data("b", []);
      b.details = [];
      b.exclusions = [
        {
          identity: "00001",
          courseId,
          careerId: "a",
          reason: "baja",
          provenance: "padron-v2:fila:8",
        },
      ];
      const r = compareHistory(a, b, [
        { courseId: "curso", before: "0", after: "0" },
      ]);
      expect(r.changes.find((c) => c.kind === "baja")).toMatchObject({
        student: "00001",
        provenance: "padron-v2:fila:8",
      });
      expect(r.before.D).toBe(0);
      expect(r.after.D).toBe(0);
      expect(r.differencePoints).toBeNull();
    },
  );
  it.each([
    { identity: "otra", courseId: null, reason: "baja" },
    { identity: "00001", courseId: "otro", reason: "baja" },
    { identity: "00001", courseId: null, reason: "especial" },
  ])("no inventa baja sin evidencia coincidente: %j", (exclusion) => {
    const a = data("a", ["guion"]),
      b = data("b", []);
    b.details = [];
    b.exclusions = [{ ...exclusion, careerId: "a", provenance: "otra" }];
    const r = compareHistory(a, b, []);
    expect(r.changes.some((c) => c.kind === "baja")).toBe(false);
    expect(r.changes.some((c) => c.kind === "fuera_del_universo")).toBe(true);
  });
  it("propone fechas civiles cada 21 días, incluyendo cambio de año", () => {
    expect(calendarDates("2026-12-12", 3)).toEqual([
      "2026-12-12",
      "2027-01-02",
      "2027-01-23",
    ]);
    expect(() =>
      historyOperations.planCalendar.parse({
        cycleId: "27-1",
        firstDate: "2026-02-30",
        count: 3,
      }),
    ).toThrow();
  });
  it("no infiere correspondencias aunque nombres e índices sean iguales", () => {
    const r = compareHistory(
      data("a", ["numerica"]),
      data("b", ["numerica"]),
      [],
    );
    expect(r.comparable).toBe(false);
    expect(r.differencePoints).toBeNull();
    expect(r.before.D).toBe(0);
  });
  it("cuenta N/G/V/E/Z/D sin que nuevas actividades alteren el denominador", () => {
    const a = data("a", ["numerica", "guion", "vacia", "invalida"]),
      b = data("b", ["numerica", "numerica", "vacia", "invalida", "guion"]);
    const r = compareHistory(
      a,
      b,
      [0, 1, 2, 3].map((i) => ({
        courseId: "curso",
        before: String(i),
        after: String(i),
      })),
    );
    expect(r.before).toEqual({ N: 1, G: 1, V: 1, E: 1, Z: 1, D: 4 });
    expect(r.after).toEqual({ N: 2, G: 0, V: 1, E: 1, Z: 2, D: 4 });
    expect(r.differencePoints).toBe(25);
    expect(r.changes.some((c) => c.description.includes(": 4"))).toBe(true);
  });
  it("rechaza correspondencias múltiples en ambos sentidos", () => {
    for (const pairs of [
      [
        { courseId: "c", before: "a", after: "b" },
        { courseId: "c", before: "a", after: "c" },
      ],
      [
        { courseId: "c", before: "a", after: "c" },
        { courseId: "c", before: "b", after: "c" },
      ],
    ])
      expect(() => validateCorrespondences(pairs)).toThrow(/ambigua/);
  });
  it("no presenta una baja como recuperación ni como mejora comparable", () => {
    const a = data("a", ["guion"]),
      b = data("b", []);
    b.details = [];
    b.exclusions = [
      {
        identity: "00001",
        careerId: "a",
        courseId: "curso",
        reason: "baja",
        provenance: "retiro/1",
      },
    ];
    const r = compareHistory(a, b, [
      { courseId: "curso", before: "0", after: "0" },
    ]);
    expect(r.comparable).toBe(false);
    expect(r.before.D).toBe(0);
    expect(r.changes.find((c) => c.kind === "baja")?.provenance).toBe(
      "retiro/1",
    );
  });
  it("conserva originales y registra cambio de afiliación sin perder la identidad textual", () => {
    const a = data("a", ["guion"]),
      b = data("b", ["numerica"]);
    b.details[0]!.group = "nuevo";
    const r = compareHistory(a, b, [
      { courseId: "curso", before: "0", after: "0" },
    ]);
    expect(r.common[0]?.student).toBe("00001");
    expect(r.common[0]?.before.raw).toBe("-");
    expect(r.changes.some((c) => c.kind === "afiliacion")).toBe(true);
  });
});
