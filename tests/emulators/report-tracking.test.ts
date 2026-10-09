import { beforeAll, it, expect } from "vitest";
import {
  api,
  batch,
  source,
  seedBase,
  waitJob,
  stores,
} from "../fixtures/synthetic/stage03";
import {
  trackingPackage,
  fullTrackingCsv,
} from "../fixtures/synthetic/report-tracking";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import type { RowView } from "../../src/domain/import-contract";
let sessions: Awaited<ReturnType<typeof seedBase>>;
const profile = { profile: "moodle-institutional-v1" };
beforeAll(async () => {
  sessions = await seedBase();
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(trackingPackage()),
    {},
    "tracking.json",
  );
  await api(
    "createCourse",
    {
      cycleId: "27-1",
      id: "mix",
      externalId: "777",
      name: "Curso Multimodal",
      careers: ["laf-plan-1", "arq-plan-1"],
    },
    sessions.admin,
  );
  await api(
    "createCut",
    { cycleId: "27-1", id: "semana3", date: "2026-09-20", schoolCut: 1 },
    sessions.admin,
  );
}, 60000);
async function send(
  content: string,
  cut = "semana3",
  name = "777._Curso_Multimodal_27-1 Calificaciones.csv",
) {
  const jobs = await batch(
    sessions.a,
    [{ name, content, courseId: "mix", mapping: profile }],
    cut,
  );
  if (jobs[0]!.status !== "published") await waitJob(jobs[0]!.id);
  return jobs[0]!.id;
}
const query = (cutId: string) => ({
  cutId,
  filters: {},
  view: "institucion",
  section: "details",
});
const panel = async (cut = "semana3", token = sessions.admin) =>
  dashboardSchema.parse(await api("dashboard", query(cut), token));
it("Escolarizado conserva el ordinal con fechas flexibles; el calendario y las otras modalidades no lo deducen", async () => {
  await expect(
    api(
      "createCut",
      { cycleId: "27-1", id: "sin-ordinal", date: "2026-09-20" },
      sessions.admin,
    ),
  ).rejects.toThrow("FAILED_PRECONDITION");
  await api(
    "createCut",
    { cycleId: "27-1", id: "flexible", date: "2026-09-04", schoolCut: 2 },
    sessions.admin,
  );
  await api(
    "editCutDate",
    {
      cutId: "flexible",
      expected: "2026-09-04",
      date: "2026-09-05",
      reason: "Fecha flexible sintética",
    },
    sessions.admin,
  );
  const id = await send(fullTrackingCsv, "flexible");
  await api("publish", { jobId: id, replace: false }, sessions.a);
  const data = await panel("flexible");
  expect(data.counts).toEqual({ N: 2, G: 1, V: 0, E: 0, Z: 2, D: 3 });
  expect(
    data.details.find((d) => d.modality === "Escolarizado")?.expectedUnits,
  ).toEqual([1, 2, 3, 4, 5]);
  await api(
    "planCalendar",
    {
      cycleId: "27-1",
      firstDate: "2026-10-10",
      count: 3,
      modality: "escolarizado",
    },
    sessions.admin,
  );
  const calendar = (await api(
    "historyCalendar",
    { cycleId: "27-1" },
    sessions.admin,
  )) as { cuts: { id: string; schoolCut?: number }[] };
  expect(
    calendar.cuts
      .filter((c) => c.id.endsWith("escolarizado"))
      .map((c) => c.schoolCut),
  ).toEqual([1, 2, 3]);
  expect(calendar.cuts.find((c) => c.id === "flexible")?.schoolCut).toBe(2);
});
it("curso compartido: afiliación principal, C.A., unidades por modalidad, acumulación y cierre sin pérdida", async () => {
  const id = await send(fullTrackingCsv);
  await api("publish", { jobId: id, replace: false }, sessions.a);
  expect(await send(fullTrackingCsv)).toBe(id);
  const initial = await panel();
  expect(initial.counts).toEqual({ N: 3, G: 1, V: 1, E: 1, Z: 2, D: 6 });
  expect(initial.students).toBe(3);
  expect(initial.coverage).toBe(50);
  const virtual = initial.details.find((d) => d.modality === "Virtual")!;
  expect(virtual).toMatchObject({
    group: "27-1 ARQ 53 03C.A",
    attribution: "principal_especial_confirmada",
    teachingAssignment: "no_determinada",
    expectedUnits: [1, 2, 3],
  });
  expect(
    initial.details.find((d) => d.modality === "Escolarizado")?.expectedUnits,
  ).toEqual([1, 2]);
  const originalRelations = initial.details.map((d) => d.relationshipId).sort();
  expect(new Set(originalRelations).size).toBe(3);
  const a = await panel("semana3", sessions.a),
    b = await panel("semana3", sessions.b);
  expect(a.students).toBe(2);
  expect(b.students).toBe(1);
  expect(JSON.stringify(a)).not.toContain("000VIR");
  expect(JSON.stringify(b)).not.toContain("000ESC");
  await expect(
    api(
      "results",
      { cutId: "semana3", courseId: "mix", careerId: "arq-plan-1" },
      sessions.a,
    ),
  ).rejects.toThrow("PERMISSION_DENIED");
  const partial =
    "Dirección Email,Tarea:Actividad | Unidad 2 (Real),Tarea:Actividad | Unidad 1 (Real),Tarea:Sesión virtual (Real)\n000ESC@example.invalid,8,,0\n";
  const replacement = await send(partial);
  await api("publish", { jobId: replacement, replace: true }, sessions.a);
  expect(await send(partial)).toBe(replacement);
  const updated = await panel();
  expect(updated.counts).toEqual({ N: 4, G: 1, V: 2, E: 1, Z: 2, D: 8 });
  expect(updated.details.map((d) => d.relationshipId).sort()).toEqual(
    originalRelations,
  );
  const raw = (await api(
    "results",
    { cutId: "semana3", courseId: "mix", careerId: "laf-plan-1" },
    sessions.a,
  )) as { rows: RowView[] };
  const esc = raw.rows.find((r) => r.identity.startsWith("000ESC"))!;
  expect(esc.values.find((v) => v.unit === 1)?.state).toBe("vacia");
  expect(esc.values.find((v) => v.unit === 3)).toMatchObject({
    state: "guion",
    sourceVersion: id,
  });
  expect(esc.values.find((v) => v.unit === 2)).toMatchObject({
    raw: "8",
    sourceVersion: replacement,
  });
  expect(esc.relationship).toMatchObject({
    teachingEnrollmentId: null,
    teachingGroup: null,
    teachingAssignment: "no_determinada",
  });
  const csv = JSON.stringify(
    await api(
      "export",
      { cutId: "semana3", courseId: "mix", careerId: "laf-plan-1" },
      sessions.a,
    ),
  );
  expect(csv).toContain("no determinada");
  expect(csv).not.toContain("000VIR");
  expect(csv).not.toContain("999");
  await api("closeCut", { cutId: "semana3" }, sessions.admin);
  await api(
    "createCut",
    {
      cycleId: "27-1",
      id: "semana5",
      date: "2026-10-04",
      schoolCut: 2,
      carryCutId: "semana3",
    },
    sessions.admin,
  );
  const next = await send(
    "Dirección Email,Tarea:Actividad | Unidad 3 (Real)\n000ESC@example.invalid,9\n",
    "semana5",
  );
  await api("publish", { jobId: next, replace: false }, sessions.a);
  const later = await panel("semana5");
  expect(later.counts).toEqual({ N: 5, G: 1, V: 2, E: 1, Z: 2, D: 9 });
  expect(later.details.map((d) => d.relationshipId).sort()).toEqual(
    originalRelations,
  );
  expect((await panel()).counts).toEqual(updated.counts);
  expect((await panel()).closed).toBe(true);
  await expect(
    api(
      "configureMetrics",
      {
        cutId: "semana3",
        courseId: "mix",
        versionId: replacement,
        expected: dashboardSchema
          .parse(
            await api(
              "dashboard",
              { ...query("semana3"), section: "courses" },
              sessions.admin,
            ),
          )
          .courses.find((c) => c.id === "mix")!.selectionId,
        activities: [],
        teachers: null,
        reason: "Intento cerrado",
      },
      sessions.admin,
    ),
  ).rejects.toThrow("FAILED_PRECONDITION");
  const exported = (await api(
    "exportDashboard",
    { ...query("semana5"), snapshotId: later.snapshotId },
    sessions.admin,
  )) as { csv: string };
  expect(exported.csv).toContain("Grupo principal de seguimiento");
  expect(exported.csv).toContain("no determinada");
}, 60000);
it("excluye matrículas ausentes sin unir por nombre; conserva bloqueos de curso/ciclo", async () => {
  const unknown = await send(
    "Nombre,Dirección Email,Tarea:Unidad 1\nPersona sintética,000DESCONOCIDA@example.invalid,0\n",
    "semana5",
  );
  expect(
    (await stores().db.doc(`jobs/${unknown}`).get()).data()?.blocking,
  ).toBe(false);
  await api("publish", { jobId: unknown, replace: true }, sessions.a);
  expect(
    JSON.stringify(
      (
        (await api(
          "preview",
          { jobId: unknown, careerId: "laf-plan-1" },
          sessions.a,
        )) as { excluded: unknown[] }
      ).excluded,
    ),
  ).not.toContain("000DESCONOCIDA");
  for (const name of [
    "777._Otro_Curso_27-1.csv",
    "777._Curso_Multimodal_26-3.csv",
    "1 777 Curso Multimodal 27-1.csv",
  ]) {
    const jobs = await batch(
      sessions.a,
      [{ name, content: fullTrackingCsv, courseId: "mix", mapping: profile }],
      "semana5",
    );
    await waitJob(jobs[0]!.id, "invalid");
  }
});

it("no duplica una actividad al cambiar de mapeo manual a automático", async () => {
  await api(
    "createCut",
    { cycleId: "27-1", id: "migracion", date: "2026-09-20", schoolCut: 1 },
    sessions.admin,
  );
  const content = "Dirección Email,Tarea:Unidad 1\n000ESC@example.invalid,0\n";
  const name = "777._Curso_Multimodal_27-1.csv";
  const old = await batch(
    sessions.a,
    [
      {
        name,
        content,
        courseId: "mix",
        mapping: {
          identity: { header: "Dirección Email" },
          columns: [
            {
              selector: { header: "Tarea:Unidad 1" },
              kind: "activity",
              activityId: "unidad-1-previa",
              unit: 1,
            },
          ],
        },
      },
    ],
    "migracion",
  );
  await waitJob(old[0]!.id);
  await api("publish", { jobId: old[0]!.id, replace: false }, sessions.a);
  const changed = await batch(
    sessions.a,
    [{ name, content, courseId: "mix", mapping: profile }],
    "migracion",
  );
  await waitJob(changed[0]!.id, "invalid");
  expect((await panel("migracion")).counts).toEqual({
    N: 1,
    G: 0,
    V: 0,
    E: 0,
    Z: 1,
    D: 1,
  });
});
