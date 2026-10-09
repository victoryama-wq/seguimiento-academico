import { beforeAll, describe, it, expect } from "vitest";
import {
  api,
  batch,
  descriptor,
  people,
  seedBase,
  source,
  stores,
  waitJob,
} from "../fixtures/synthetic/stage03";
import {
  approvedPackage,
  decision,
  enrollment,
} from "../fixtures/synthetic/approved-package";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import type { RowView } from "../../src/domain/import-contract";
import type { Observation } from "../../src/domain/decision-package";

let sessions: Awaited<ReturnType<typeof seedBase>>;
let originalSource: string;
const p = approvedPackage();
const map = (ids: string[], additional: string[] = []) => ({
  identity: { header: "Correo" },
  columns: ids.map((activityId) => ({
    selector: { header: activityId },
    kind: "activity",
    activityId,
    additional: additional.includes(activityId),
  })),
});
async function upload(
  content: string,
  ids: string[],
  cut = "aprobadas",
  additional: string[] = [],
) {
  const jobs = await batch(
    sessions.admin,
    [
      {
        name: "1 Curso compartido 27-1.csv",
        content,
        courseId: "compartido",
        mapping: map(ids, additional),
      },
    ],
    cut,
  );
  if (jobs[0]!.status !== "published") await waitJob(jobs[0]!.id);
  return jobs[0]!.id;
}
beforeAll(async () => {
  sessions = await seedBase();
  const baja = enrollment("000BAJA", "27-1 LAF 11 01A", "31/08/2026", 4);
  p.enrollments.push(
    baja,
    enrollment("000baja", "27-1 ARQ 11 01A", "29/08/2026", 5),
  );
  p.decisions.push(
    decision(baja.key, { kind: "baja", exclusionReason: "baja" }),
  );
  originalSource = await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(p),
    {},
    "aprobadas.json",
  );
  await api(
    "createCut",
    { cycleId: "27-1", id: "aprobadas", date: "2026-10-10" },
    sessions.admin,
  );
}, 60000);

describe.sequential(
  "paquete académico, revisión y acumulación con permisos reales",
  () => {
    it("calendario aprobado exige modalidad y no inventa el de Virtual", async () => {
      await expect(
        api(
          "planCalendar",
          { cycleId: "27-1", firstDate: "2026-09-07", count: 3 },
          sessions.admin,
        ),
      ).rejects.toThrow("FAILED_PRECONDITION");
      await expect(
        api(
          "planCalendar",
          {
            cycleId: "27-1",
            firstDate: "2026-09-07",
            count: 1,
            modality: "virtual",
          },
          sessions.admin,
        ),
      ).rejects.toThrow("FAILED_PRECONDITION");
      await api(
        "planCalendar",
        {
          cycleId: "27-1",
          firstDate: "2026-09-07",
          count: 3,
          modality: "ejecutivo",
        },
        sessions.admin,
      );
      expect(
        (await stores().db.doc("cuts/27-1-2026-09-14-ejecutivo").get()).data(),
      ).toMatchObject({
        date: "2026-09-14",
        carryCutId: "27-1-2026-09-07-ejecutivo",
      });
    });
    it("muestra resoluciones y procedencia por carrera, sin filtrar por mayúsculas ni conceder administración", async () => {
      const id = await upload(
        "Correo,U1\n000sint01@example.invalid,0\n000SINT02@example.invalid,-\n000BAJA@example.invalid,10\n",
        ["U1"],
      );
      const a = (await api(
        "preview",
        { jobId: id, careerId: "laf-plan-1" },
        sessions.a,
      )) as { rows: RowView[]; observations: Observation[] };
      const b = (await api(
        "preview",
        { jobId: id, careerId: "arq-plan-1" },
        sessions.b,
      )) as typeof a;
      expect(a.rows.map((r) => r.identity)).toEqual([
        "000sint01@example.invalid",
      ]);
      expect(b.rows.map((r) => r.identity)).toEqual([
        "000SINT02@example.invalid",
      ]);
      expect(JSON.stringify(a)).not.toContain("000SINT02");
      expect(JSON.stringify(b)).not.toContain("000SINT01");
      expect(
        a.observations.find((o) => o.identity === "000SINT01"),
      ).toMatchObject({
        file: "padron-sintetico.csv",
        row: 2,
        state: "resuelto",
      });
      await expect(
        api("preview", { jobId: id, careerId: "arq-plan-1" }, sessions.a),
      ).rejects.toThrow("PERMISSION_DENIED");
      await expect(
        api(
          "reviseAcademicDecision",
          {
            jobId: originalSource,
            decision: decision(p.enrollments[0]!.key, { primary: true }),
          },
          sessions.a,
        ),
      ).rejects.toThrow("PERMISSION_DENIED");
      await expect(
        api(
          "createSource",
          {
            cycleId: "27-1",
            kind: "academicPackage",
            file: descriptor("x.json", JSON.stringify(p), {}),
          },
          sessions.a,
        ),
      ).rejects.toThrow("PERMISSION_DENIED");
      await api("publish", { jobId: id, replace: false }, sessions.a);
      const csv = await api(
        "export",
        { cutId: "aprobadas", courseId: "compartido", careerId: "laf-plan-1" },
        sessions.a,
      );
      expect(JSON.stringify(csv)).toContain("000sint01");
      expect(JSON.stringify(csv)).not.toContain("000SINT02");
      expect(JSON.stringify(csv)).not.toContain("000BAJA");
    });
    it("una nueva contradicción bloquea; revisión atribuible, actualización y revalidación reutilizan el original sin duplicar", async () => {
      await api(
        "createCut",
        { cycleId: "27-1", id: "correccion", date: "2026-10-11" },
        sessions.admin,
      );
      const pendingReport = await upload(
        "Correo,U1\n000NUEVA@example.invalid,5\n",
        ["U1"],
        "correccion",
      );
      expect(
        (await stores().db.doc(`jobs/${pendingReport}`).get()).data()?.blocking,
      ).toBe(false);
      expect(
        (
          (await api("preview", { jobId: pendingReport }, sessions.admin)) as {
            excluded: { reason: string }[];
          }
        ).excluded[0]?.reason,
      ).toBe("No pertenece al padrón activo del ciclo");
      const revised = structuredClone(p);
      const added = enrollment("000NUEVA", "27-1 LAF 11 01A", "17/09/2026", 6);
      revised.enrollments.push(added);
      const raw = JSON.stringify(revised);
      const pending = (await api(
        "createSource",
        {
          cycleId: "27-1",
          kind: "academicPackage",
          file: descriptor("pendiente.json", raw, {}),
        },
        sessions.admin,
      )) as { id: string };
      await api(
        "upload",
        { jobId: pending.id, base64: Buffer.from(raw).toString("base64") },
        sessions.admin,
      );
      await waitJob(pending.id);
      await expect(
        api(
          "publishSource",
          { jobId: pending.id, replace: true },
          sessions.admin,
        ),
      ).rejects.toThrow("FAILED_PRECONDITION");
      const input = {
        jobId: pending.id,
        decision: decision(added.key, { date: "2026-08-31", primary: true }),
      };
      const corrected = (await api(
        "reviseAcademicDecision",
        input,
        sessions.admin,
      )) as { id: string };
      expect(
        await api("reviseAcademicDecision", input, sessions.admin),
      ).toMatchObject({ id: corrected.id });
      await waitJob(corrected.id);
      await api(
        "publishSource",
        { jobId: corrected.id, replace: true },
        sessions.admin,
      );
      const audit = (
        await stores().db.doc(`decisionRevisionAudit/${corrected.id}`).get()
      ).data();
      expect(audit).toMatchObject({
        actor: people.admin,
        previous: pending.id,
        decision: { date: "2026-08-31" },
      });
      const expectedSources = (
        await stores().db.doc("cuts/correccion").get()
      ).data()!.sources;
      await expect(
        api(
          "refreshCutSources",
          { cutId: "correccion", expectedSources, reason: "Revisión" },
          sessions.a,
        ),
      ).rejects.toThrow("PERMISSION_DENIED");
      await api(
        "refreshCutSources",
        {
          cutId: "correccion",
          expectedSources,
          reason: "Fecha aprobada en prueba",
        },
        sessions.admin,
      );
      await expect(
        api(
          "publish",
          { jobId: pendingReport, replace: false },
          sessions.admin,
        ),
      ).rejects.toThrow("FAILED_PRECONDITION");
      const validated = (await api(
        "revalidate",
        { jobId: pendingReport },
        sessions.a,
      )) as { id: string };
      expect(
        await api("revalidate", { jobId: pendingReport }, sessions.a),
      ).toMatchObject({ id: validated.id });
      await waitJob(validated.id);
      await api("publish", { jobId: validated.id, replace: false }, sessions.a);
      const result = (await api(
        "results",
        { cutId: "correccion", courseId: "compartido", careerId: "laf-plan-1" },
        sessions.a,
      )) as { rows: RowView[] };
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.values[0]?.raw).toBe("5");
      expect(
        (await stores().db.doc(`jobs/${pendingReport}`).get()).data()?.blocking,
      ).toBe(false);
      const oldBytes = (
        await stores()
          .bucket.file(`originals/${pendingReport}/source`)
          .download()
      )[0];
      expect(
        (
          await stores()
            .bucket.file(`originals/${validated.id}/source`)
            .download()
        )[0],
      ).toEqual(oldBytes);
    });
    it("acumula parciales, numéricos adicionales, filas ausentes y correcciones; denominadores y exportaciones autorizadas", async () => {
      const id = await upload(
        "Correo,U2,Extra\n000SINT01@example.invalid,7,0\n",
        ["U2", "Extra"],
        "aprobadas",
        ["Extra"],
      );
      await api("publish", { jobId: id, replace: true }, sessions.a);
      await api(
        "configureMetrics",
        {
          cutId: "aprobadas",
          courseId: "compartido",
          versionId: id,
          expected: null,
          activities: ["U1", "U2", "Extra"],
          teachers: null,
          reason: "Unidades presentes y adicional con evidencia",
        },
        sessions.admin,
      );
      const request = { cutId: "aprobadas", filters: {}, view: "institucion" };
      const d = dashboardSchema.parse(
        await api("dashboard", request, sessions.admin),
      );
      expect(d.counts).toMatchObject({ N: 3, G: 1, D: 4, Z: 2 });
      expect(d.students).toBe(2);
      const a = dashboardSchema.parse(
        await api("dashboard", request, sessions.a),
      );
      expect(a.counts.D).toBe(3);
      expect(a.students).toBe(1);
      const b = dashboardSchema.parse(
        await api("dashboard", request, sessions.b),
      );
      expect(b.counts).toMatchObject({ N: 0, G: 1, D: 1 });
      const exported = await api(
        "exportDashboard",
        { ...request, snapshotId: a.snapshotId },
        sessions.a,
      );
      expect(JSON.stringify(exported)).not.toContain("000SINT02");
      const previous = (await api(
        "results",
        { cutId: "aprobadas", courseId: "compartido", careerId: "laf-plan-1" },
        sessions.a,
      )) as { rows: RowView[] };
      expect(previous.rows[0]?.values.map((v) => v.activityId).sort()).toEqual([
        "Extra",
        "U1",
        "U2",
      ]);
      expect(
        new Set(previous.rows[0]?.values.map((v) => v.sourceVersion)).size,
      ).toBe(2);
      await api("closeCut", { cutId: "aprobadas" }, sessions.admin);
      const closurePath = (
        await stores().db.doc("cuts/aprobadas").get()
      ).data()!.closurePath as string;
      const closure = JSON.parse(
        (await stores().bucket.file(closurePath).download())[0].toString(
          "utf8",
        ),
      ) as { academicRules: string };
      expect(closure.academicRules).toBe("approved-2026-10");
      await expect(
        api("revalidate", { jobId: id }, sessions.admin),
      ).rejects.toThrow("FAILED_PRECONDITION");
      await api(
        "createCut",
        {
          cycleId: "27-1",
          id: "acumulado-2",
          date: "2026-10-17",
          carryCutId: "aprobadas",
        },
        sessions.admin,
      );
      const next = await upload(
        "Correo,U1,Extra\n000SINT01@example.invalid,9,-\n",
        ["U1", "Extra"],
        "acumulado-2",
        ["Extra"],
      );
      await api("publish", { jobId: next, replace: false }, sessions.a);
      await api(
        "configureMetrics",
        {
          cutId: "acumulado-2",
          courseId: "compartido",
          versionId: next,
          expected: null,
          activities: ["U1", "U2", "Extra"],
          teachers: null,
          reason: "Acumulado explícito",
        },
        sessions.admin,
      );
      expect(
        dashboardSchema.parse(
          await api(
            "dashboard",
            { ...request, cutId: "acumulado-2" },
            sessions.admin,
          ),
        ).counts,
      ).toMatchObject({ D: 3, N: 2, G: 1, Z: 0 });
      expect(
        dashboardSchema.parse(await api("dashboard", request, sessions.admin))
          .counts,
      ).toEqual(d.counts);
      await expect(
        api(
          "refreshCutSources",
          { cutId: "aprobadas", expectedSources: p, reason: "No" },
          sessions.admin,
        ),
      ).rejects.toThrow();
      const identical = await upload(
        "Correo,U1,Extra\n000SINT01@example.invalid,9,-\n",
        ["U1", "Extra"],
        "acumulado-2",
        ["Extra"],
      );
      expect(identical).toBe(next);
    });
    it("pagina observaciones y exportaciones sin exponer la otra carrera, incluido un principal especial", async () => {
      const large = approvedPackage();
      large.enrollments = [];
      const identities: string[] = [];
      for (const side of ["A", "B"])
        for (let i = 0; i < 105; i++) {
          const id = `000PAG${side}${String(i).padStart(3, "0")}`;
          identities.push(id);
          large.enrollments.push(
            enrollment(
              id,
              `27-1 ${side === "A" ? "LAF" : "ARQ"} 11 01${i === 0 ? "CA" : "A"}`,
              "31/08/2026",
              large.enrollments.length + 2,
            ),
          );
        }
      await source(
        sessions.admin,
        "academicPackage",
        JSON.stringify(large),
        {},
        "paginacion.json",
      );
      await api(
        "createCut",
        { cycleId: "27-1", id: "obs-paginadas", date: "2026-10-19" },
        sessions.admin,
      );
      const id = await upload(
        "Correo,U1\n" +
          identities
            .map((id) => `${id.toLowerCase()}@example.invalid,0`)
            .join("\n"),
        ["U1"],
        "obs-paginadas",
      );
      for (const [side, career, session] of [
        ["a", "laf-plan-1", sessions.a],
        ["b", "arq-plan-1", sessions.b],
      ]) {
        const one = (await api(
          "preview",
          { jobId: id, careerId: career },
          session,
        )) as {
          observations: Observation[];
          observationsCount: number;
          observationNext: number;
        };
        expect(one.observationsCount).toBe(105);
        expect(one.observations).toHaveLength(100);
        const two = (await api(
          "preview",
          {
            jobId: id,
            careerId: career,
            observationOffset: one.observationNext,
          },
          session,
        )) as typeof one;
        expect(two.observations).toHaveLength(5);
        expect(
          [...one.observations, ...two.observations].every((o) =>
            o.identity.toLowerCase().startsWith(`000pag${side}`),
          ),
        ).toBe(true);
      }
      await api("publish", { jobId: id, replace: false }, sessions.admin);
      await api(
        "configureMetrics",
        {
          cutId: "obs-paginadas",
          courseId: "compartido",
          versionId: id,
          expected: null,
          activities: ["U1"],
          teachers: null,
          reason: "Ceros sintéticos y principal especial",
        },
        sessions.admin,
      );
      const panel = dashboardSchema.parse(
        await api(
          "dashboard",
          { cutId: "obs-paginadas", filters: {}, view: "institucion" },
          sessions.a,
        ),
      );
      expect(panel.counts).toMatchObject({ D: 105, N: 105, Z: 105 });
      expect(panel.students).toBe(105);
      expect(panel.facets.group).toContain("27-1 LAF 11 01C.A");
      const parts: string[] = [];
      let cursor: string | null = null;
      do {
        const page = (await api(
          "export",
          {
            cutId: "obs-paginadas",
            courseId: "compartido",
            careerId: "laf-plan-1",
            ...(cursor ? { cursor } : {}),
          },
          sessions.a,
        )) as { csv: string; cursor: string | null };
        parts.push(page.csv);
        cursor = page.cursor;
      } while (cursor);
      expect(parts).toHaveLength(2);
      expect(parts.join("").toLowerCase()).not.toContain("000pagb");
      expect(parts.reduce((n, s) => n + s.split("\r\n").length - 1, 0)).toBe(
        105,
      );
    });
    it("publica clasificaciones individuales base/especial con fechas originales y aislamiento", async () => {
      const packageData = approvedPackage();
      packageData.reason = "Clasificaciones individuales nuevas, sintéticas";
      const rows = [
        enrollment("000SINT01", "27-1 LAF 53 03A", "17/09/2026", 2),
        enrollment("000SINT01", "27-1 LAF 24 04A", "31/08/2026", 3),
        enrollment("000SINT02", "27-1 ARQ 53 08A", "12/09/2026", 4),
        enrollment("000SINT02", "27-1 ARQ 24 07A", "29/08/2026", 5),
      ];
      packageData.enrollments = rows;
      packageData.decisions = rows.map((e, i) =>
        decision(e.key, {
          kind: i === 1 || i === 2 ? "base" : "especial",
          primary: i === 1 || i === 2,
          originalDateApproved: true,
        }),
      );
      await source(
        sessions.admin,
        "academicPackage",
        JSON.stringify(packageData),
        {},
        "individuales.json",
      );
      await api(
        "createCut",
        { cycleId: "27-1", id: "individuales", date: "2026-10-20" },
        sessions.admin,
      );
      const id = await upload(
        "Correo,U1\n000SINT01@example.invalid,0\n000SINT02@example.invalid,7\n",
        ["U1"],
        "individuales",
      );
      const preview = (await api("preview", { jobId: id }, sessions.admin)) as {
        observations: Observation[];
      };
      for (const row of rows) {
        const observation = preview.observations.find((o) => o.id === row.key);
        expect(observation).toMatchObject({
          state: "resuelto",
          original: { date: row.original.date, group: row.original.group },
        });
      }
      await api("publish", { jobId: id, replace: false }, sessions.admin);
      for (const [token, career, own, foreign] of [
        [sessions.a, "laf-plan-1", "000SINT01", "000SINT02"],
        [sessions.b, "arq-plan-1", "000SINT02", "000SINT01"],
      ]) {
        const input = {
          cutId: "individuales",
          courseId: "compartido",
          careerId: career,
        };
        const result = (await api("results", input, token!)) as {
          rows: RowView[];
        };
        expect(result.rows).toHaveLength(1);
        expect(JSON.stringify(result)).toContain(own);
        expect(JSON.stringify(result)).not.toContain(foreign);
        const exported = JSON.stringify(await api("export", input, token!));
        expect(exported).toContain(own);
        expect(exported).not.toContain(foreign);
      }
    });
    it("rechaza revisar fuentes antiguas y borradores obsoletos; conserva decisiones, reintentos y CAS concurrente", async () => {
      const data = approvedPackage();
      data.reason = "Control de revisiones concurrentes";
      const base = await source(
        sessions.admin,
        "academicPackage",
        JSON.stringify(data),
        {},
        "concurrencia.json",
      );
      const requests = data.enrollments.map((e) => ({
        jobId: base,
        decision: decision(e.key, { kind: "base", primary: true }),
      }));
      const drafts = (await Promise.all(
        requests.map((input) =>
          api("reviseAcademicDecision", input, sessions.admin),
        ),
      )) as { id: string }[];
      await Promise.all(drafts.map((d) => waitJob(d.id)));
      const publications = await Promise.allSettled(
        drafts.map((d) =>
          api("publishSource", { jobId: d.id, replace: true }, sessions.admin),
        ),
      );
      expect(publications.filter((r) => r.status === "fulfilled")).toHaveLength(
        1,
      );
      const win = publications.findIndex((r) => r.status === "fulfilled");
      const lose = 1 - win;
      expect(
        String((publications[lose] as PromiseRejectedResult).reason),
      ).toContain("ABORTED");
      const winner = drafts[win]!.id;
      const loser = drafts[lose]!.id;
      // Mismo reintento es recuperable aun después de publicar la revisión.
      expect(
        await api("reviseAcademicDecision", requests[win], sessions.admin),
      ).toMatchObject({ id: winner });
      const beforeJobs = (await stores().db.collection("jobs").get()).size;
      for (const stale of [base, loser]) {
        await expect(
          api(
            "reviseAcademicDecision",
            {
              jobId: stale,
              decision: decision(data.enrollments[lose]!.key, {
                kind: "base",
                primary: true,
                reason: "Nueva revisión desde versión obsoleta",
              }),
            },
            sessions.admin,
          ),
        ).rejects.toThrow("FAILED_PRECONDITION");
      }
      expect((await stores().db.collection("jobs").get()).size).toBe(
        beforeJobs,
      );
      expect(
        (await stores().db.doc("cycles/27-1").get()).data()!.sources
          .academicPackage,
      ).toBe(winner);
      const next = (await api(
        "reviseAcademicDecision",
        { ...requests[lose], jobId: winner },
        sessions.admin,
      )) as { id: string };
      await waitJob(next.id);
      await api(
        "publishSource",
        { jobId: next.id, replace: true },
        sessions.admin,
      );
      const job = (await stores().db.doc(`jobs/${next.id}`).get()).data()!;
      const [bytes] = await stores()
        .bucket.file(job.artifact as string)
        .download();
      const artifact = JSON.parse(bytes.toString()) as {
        data: { decisions: unknown[]; revisionOf: string };
      };
      expect(artifact.data.decisions).toHaveLength(2);
      expect(artifact.data.decisions).toEqual(
        expect.arrayContaining(requests.map((r) => r.decision)),
      );
      expect(artifact.data.revisionOf).toBe(winner);
      expect(
        (await stores().db.doc(`sources/${next.id}`).get()).data()?.previous,
      ).toBe(winner);
      expect(
        (
          await stores().db.doc(`decisionRevisionAudit/${next.id}`).get()
        ).data(),
      ).toMatchObject({ previous: winner, actor: people.admin });
      await expect(
        api(
          "reviseAcademicDecision",
          {
            ...requests[lose],
            jobId: winner,
            decision: {
              ...requests[lose]!.decision,
              reason: "Otro intento antiguo",
            },
          },
          sessions.admin,
        ),
      ).rejects.toThrow("FAILED_PRECONDITION");
    });
  },
);
