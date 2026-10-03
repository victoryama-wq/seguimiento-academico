import { beforeAll, describe, expect, it } from "vitest";
import {
  seedMetrics,
  metricCsv,
  metricMapping,
} from "../fixtures/synthetic/stage04";
import {
  api,
  stores,
  people,
  descriptor,
  waitJob,
} from "../fixtures/synthetic/stage03";
import {
  dashboardSchema,
  type Dashboard,
} from "../../src/domain/metrics-contract";

let sessions: Awaited<ReturnType<typeof seedMetrics>>;
const request = { cutId: "metricas", filters: {}, view: "institucion" };
const panel = async (
  input: object = {},
  session = sessions.admin,
): Promise<Dashboard> =>
  dashboardSchema.parse(
    await api("dashboard", { ...request, ...input }, session),
  );
beforeAll(async () => {
  sessions = await seedMetrics();
}, 60000);
describe.sequential(
  "panel publicado, denominadores, alcance y fotografía",
  () => {
    it("coincide con el cálculo manual, evita dobles personas y pondera denominadores", async () => {
      const p = await panel();
      expect(p.counts).toEqual({ N: 4, G: 1, V: 1, E: 1, Z: 1, D: 7 });
      expect(p.students).toBe(2);
      expect(p.coverage).toBeCloseTo(400 / 7);
      expect(p.dashes).toBeCloseTo(100 / 7);
      expect(p.expected).toBe(3);
      expect(p.published).toBe(2);
      expect(p.pending).toBe(1);
      const courses = await panel({
        section: "courses",
        snapshotId: p.snapshotId,
      });
      expect(courses.courses.find((c) => c.id === "sin-archivo")!.status).toBe(
        "sin_archivo_publicado",
      );
      expect(
        courses.courses.find((c) => c.id === "compartido")!.activities,
      ).toEqual(["A", "B", "C"]);
      const students = await panel({ view: "estudiante" });
      expect(students.groups.map((g) => g.counts.D).sort()).toEqual([3, 4]);
    });
    it("filtra todas las dimensiones y retiene originales/incidencias en el detalle", async () => {
      for (const filters of [
        { coordination: "coord-a" },
        { careerId: "laf-plan-1" },
        { group: "27-1 LAF 24 01A" },
        { modality: "Ejecutivo" },
        { shift: "Vespertino" },
        { student: "000sint01" },
        { special: "con_especial" },
      ]) {
        const p = await panel({ filters });
        expect(p.counts).toEqual({ N: 2, G: 1, V: 1, E: 0, Z: 1, D: 4 });
        expect(p.students).toBe(1);
      }
      expect((await panel({ filters: { plan: "plan-1" } })).counts.D).toBe(7);
      expect(
        (await panel({ filters: { teacher: "tup-d1@example.invalid" } })).counts
          .D,
      ).toBe(6);
      expect(
        (await panel({ filters: { teacher: "sin_docente" } })).counts.D,
      ).toBe(1);
      expect(
        (await panel({ filters: { registration: "completo" } })).counts.D,
      ).toBe(0);
      expect(
        (await panel({ filters: { registration: "parcial" } })).counts.D,
      ).toBe(7);
      const rows = await panel({
        section: "details",
        filters: { careerId: "arq-plan-1" },
      });
      expect(rows.details[0]!.values.map((v) => v.raw)).toEqual([
        "8",
        "texto",
        "4",
      ]);
      expect(rows.details[0]!.issues).toContain("calificacion_invalida");
    });
    it("coordinadores no obtienen otras carreras, originales, fotografías ni selecciones", async () => {
      const a = await panel({ section: "details" }, sessions.a);
      expect(a.counts.D).toBe(4);
      expect(JSON.stringify(a)).not.toContain("000SINT02");
      expect(JSON.stringify(a)).not.toContain("arq-plan-1");
      const b = await panel({ section: "details" }, sessions.b);
      expect(b.counts.D).toBe(3);
      expect(JSON.stringify(b)).not.toContain("000SINT01");
      for (const op of ["dashboard", "exportDashboard"])
        for (const invalid of [
          { filters: { careerId: "arq-plan-1" } },
          { filters: { coordination: "coord-b" } },
          { filters: { courseId: "sin-archivo" } },
          { snapshotId: b.snapshotId },
        ])
          await expect(
            api(op, { ...request, ...invalid }, sessions.a),
          ).rejects.toThrow("PERMISSION_DENIED");
      await expect(api("dashboard", request)).rejects.toThrow(
        "UNAUTHENTICATED",
      );
      await expect(
        api("dashboard", { ...request, role: "admin" }, sessions.a),
      ).rejects.toThrow("INVALID_ARGUMENT");
      await expect(
        api(
          "configureMetrics",
          {
            cutId: "metricas",
            courseId: "compartido",
            versionId: sessions.first,
            expected: null,
            activities: ["A"],
            teachers: null,
            reason: "no autorizado",
          },
          sessions.a,
        ),
      ).rejects.toThrow("PERMISSION_DENIED");
      const csv = (await api(
        "exportDashboard",
        { ...request, snapshotId: a.snapshotId },
        sessions.a,
      )) as { csv: string };
      expect(csv.csv).not.toContain("000SINT02");
      expect(csv.csv).toContain('"2","1","1","0","1","4","50","25","1"');
    });
    it("exclusiones y especiales tienen procedencia; docente y baja no entran a D", async () => {
      const p = await panel({ section: "exclusions" });
      expect(p.exclusions.some((e) => e.reason === "docente")).toBe(true);
      expect(p.exclusions.some((e) => e.reason.includes("baja"))).toBe(true);
      expect(
        p.exclusions.some(
          (e) =>
            e.reason.includes("especial") && e.provenance.includes(":fila:"),
        ),
      ).toBe(true);
      expect(
        (await panel({ filters: { student: "000BAJA" } })).coverage,
      ).toBeNull();
      expect(
        (await panel({ filters: { courseId: "sin-archivo" } })).coverage,
      ).toBeNull();
    });
    it("publicar selección es CAS, auditado e idempotente; exportar conserva la fotografía", async () => {
      const old = await panel();
      const config = (await panel({ section: "courses" })).courses.find(
        (c) => c.id === "compartido",
      )!;
      const input = {
        cutId: "metricas",
        courseId: "compartido",
        versionId: sessions.first,
        expected: config.selectionId,
        activities: ["A"],
        teachers: ["=Docente sintético"],
        reason: "Universo revisado",
      };
      await expect(
        api(
          "configureMetrics",
          { ...input, activities: ["Total"] },
          sessions.admin,
        ),
      ).rejects.toThrow("INVALID_ARGUMENT");
      const results = await Promise.allSettled([
        api("configureMetrics", input, sessions.admin),
        api(
          "configureMetrics",
          { ...input, activities: ["B"] },
          sessions.admin,
        ),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const current = (await panel({ section: "courses" })).courses.find(
        (c) => c.id === "compartido",
      )!;
      await api(
        "configureMetrics",
        { ...input, activities: current.activities },
        sessions.admin,
      );
      expect((await panel({ snapshotId: old.snapshotId })).counts).toEqual(
        old.counts,
      );
      const exported = (await api(
        "exportDashboard",
        { ...request, snapshotId: old.snapshotId },
        sessions.admin,
      )) as { csv: string };
      expect(exported.csv).toContain('"4","1","1","1","1","7"');
      expect(exported.csv).toContain(old.snapshotId);
      const now = (await api("exportDashboard", request, sessions.admin)) as {
        csv: string;
      };
      expect(now.csv).toContain("'=Docente sintético");
      const history = (
        await stores()
          .db.doc(`activitySelectionHistory/${current.selectionId}`)
          .get()
      ).data()!;
      expect(history.actor).toBe(people.admin);
      expect(history.previous).toBe(config.selectionId);
    });
    it("reemplazar reporte exige nueva selección y cerrar impide cambios sin alterar snapshots", async () => {
      const file = {
        ...descriptor(
          "1 Curso compartido 27-1.csv",
          metricCsv.replace(",0,", ",1,"),
          metricMapping,
        ),
        courseId: "compartido",
      };
      const created = (await api(
        "createBatch",
        { cutId: "metricas", files: [file] },
        sessions.admin,
      )) as { jobs: { id: string }[] };
      const id = created.jobs[0]!.id;
      await api(
        "upload",
        {
          jobId: id,
          base64: Buffer.from(metricCsv.replace(",0,", ",1,")).toString(
            "base64",
          ),
        },
        sessions.admin,
      );
      await waitJob(id);
      await api("publish", { jobId: id, replace: true }, sessions.admin);
      const p = await panel({
        filters: { courseId: "compartido" },
        section: "courses",
      });
      expect(p.state).toBe("sin_actividades_seleccionadas");
      expect(p.coverage).toBeNull();
      await api("closeCut", { cutId: "metricas" }, sessions.admin);
      await api(
        "createCourse",
        {
          cycleId: "27-1",
          id: "posterior-al-cierre",
          externalId: "4",
          name: "Curso sintético posterior",
          careers: ["laf-plan-1"],
        },
        sessions.admin,
      );
      expect((await panel()).expected).toBe(3);
      await expect(
        api(
          "configureMetrics",
          {
            cutId: "metricas",
            courseId: "compartido",
            versionId: id,
            expected: p.courses[0]!.selectionId,
            activities: ["A"],
            teachers: null,
            reason: "tardío",
          },
          sessions.admin,
        ),
      ).rejects.toThrow("FAILED_PRECONDITION");
      expect((await panel()).closed).toBe(true);
    });
  },
);
