import { identity } from "../../src/domain/academic";
import { beforeAll, it, expect } from "vitest";
import {
  api,
  batch,
  source,
  seedBase,
  waitJob,
  stores,
} from "../fixtures/synthetic/stage03";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import {
  overviewSchema,
  reviewSummarySchema,
  rowViewSchema,
} from "../../src/domain/import-contract";
import { z } from "zod";

let sessions: Awaited<ReturnType<typeof seedBase>>;
const progress = { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 };
const query = (cutId: string) => ({
  cutId,
  filters: {},
  view: "institucion",
  section: "details",
});
const panel = async (cutId = "explicit", token = sessions.admin) =>
  dashboardSchema.parse(await api("dashboard", query(cutId), token));
const csv = (units: number[], grades: string[][]) =>
  [
    [
      "Dirección Email",
      ...units.map((u) => `Tarea:Actividad | Unidad ${u} (Real)`),
    ].join(","),
    ...grades.map(([id, ...values]) =>
      [`${id}@example.invalid`, ...values].join(","),
    ),
  ].join("\n");
async function send(content: string, cutId = "explicit") {
  const [job] = await batch(
    sessions.a,
    [
      {
        name: "777._Curso_Multimodal_27-1 Calificaciones.csv",
        content,
        courseId: "mix",
        mapping: { profile: "moodle-institutional-v1" },
      },
    ],
    cutId,
  );
  if (job!.status !== "published") await waitJob(job!.id);
  return job!.id;
}
const publish = (jobId: string) =>
  api("publish", { jobId, replace: true }, sessions.a);
const current = async () =>
  overviewSchema
    .parse(await api("overview", {}, sessions.admin))
    .cuts.find((c) => c.id === "explicit")!;
beforeAll(async () => {
  sessions = await seedBase();
  const p = trackingPackage();
  // No primera semana vencida: la política nueva funciona sin tracking por fecha.
  delete p.schedule.tracking;
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(p),
    {},
    "explicit.json",
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
  for (const id of ["explicit", "together", "separate"])
    await api("createCut", { cycleId: "27-1", id, progress }, sessions.admin);
}, 60000);

it("selección sin fechas, modalidad principal incluida C.A., unidades futuras guardadas y acceso aislado", async () => {
  const id = await send(
    csv(
      [1, 2, 3, 4],
      [
        ["000ESC", "1", "2", "3", "4"],
        ["000EJE", "0", "2", "3", "4"],
        ["000VIR", "1", "2", "3", "4"],
        ["000BAJA", "9", "9", "9", "9"],
      ],
    ),
  );
  await publish(id);
  const data = await panel();
  expect(data.counts).toEqual({ N: 7, G: 0, V: 0, E: 0, Z: 1, D: 7 });
  expect(data.students).toBe(3);
  expect(
    data.details.find((r) => identity(r.identity).normalized === "000vir"),
  ).toMatchObject({
    attribution: "principal_especial_confirmada",
    expectedUnits: [1, 2],
    deferredUnits: [3, 4],
  });
  expect(
    data.details.find((r) => identity(r.identity).normalized === "000eje")
      ?.deferredUnits,
  ).toEqual([4]);
  const a = await panel("explicit", sessions.a),
    b = await panel("explicit", sessions.b);
  expect(a.counts.D).toBe(5);
  expect(b.counts.D).toBe(2);
  expect(JSON.stringify(a).toLowerCase()).not.toContain("000vir");
  expect(JSON.stringify(b).toLowerCase()).not.toContain("000esc");
  const rows = z
    .object({ rows: z.array(rowViewSchema) })
    .parse(
      await api(
        "results",
        { cutId: "explicit", courseId: "mix", careerId: "arq-plan-1" },
        sessions.b,
      ),
    ).rows;
  expect(rows[0]!.values).toHaveLength(4);
  await expect(
    api(
      "results",
      { cutId: "explicit", courseId: "mix", careerId: "arq-plan-1" },
      sessions.a,
    ),
  ).rejects.toThrow("PERMISSION_DENIED");
  const cut = await current();
  await api(
    "editCutDate",
    {
      cutId: cut.id,
      expected: cut.date,
      date: "2025-01-01",
      reason: "Solo agenda operativa",
    },
    sessions.admin,
  );
  expect((await panel()).counts).toEqual(data.counts);
  expect((await panel()).students).toBe(3);
  const exported = (await api(
    "exportDashboard",
    query("explicit"),
    sessions.a,
  )) as { csv: string };
  expect(exported.csv).toContain("explicit-progress-v1");
  expect(exported.csv.toLowerCase()).not.toContain("000vir");
  expect(exported.csv).toContain("Unidades conservadas para despues");
});

it("actualiza U1/U2 e incorpora U3 juntas o separadas; ausencias y reintentos conservan valores recientes", async () => {
  const initial = csv(
    [1, 2],
    [
      ["000EJE", "1", "2"],
      ["000VIR", "5", "6"],
    ],
  );
  const ids = new Map<string, string>();
  for (const cut of ["together", "separate"]) {
    const id = await send(initial, cut);
    ids.set(cut, id);
    await publish(id);
  }
  await publish(
    await send(csv([1, 2, 3], [["000EJE", "7", "8", "0"]]), "together"),
  );
  for (const [u, grade] of [
    [1, "7"],
    [2, "8"],
    [3, "0"],
  ] as const)
    await publish(await send(csv([u], [["000EJE", grade]]), "separate"));
  const values = (d: Awaited<ReturnType<typeof panel>>) =>
    d.details.map((r) => [
      r.identity,
      r.values.map((v) => [v.activityId, v.state, v.raw]),
    ]);
  expect(values(await panel("separate"))).toEqual(
    values(await panel("together")),
  );
  expect((await panel("separate")).counts).toEqual({
    N: 5,
    G: 0,
    V: 0,
    E: 0,
    Z: 1,
    D: 5,
  });
  for (const cut of ["together", "separate"]) {
    expect(await send(initial, cut)).toBe(ids.get(cut));
    await api("retry", { jobId: ids.get(cut) }, sessions.a);
    await publish(ids.get(cut)!);
    expect((await panel(cut)).counts.N).toBe(5);
    await expect(
      api("revalidate", { jobId: ids.get(cut) }, sessions.a),
    ).rejects.toThrow("FAILED_PRECONDITION");
  }
});

it("revisión advierte numérico a vacío/guion y no revela otra carrera; una publicación posterior invalida la propuesta", async () => {
  const previous = await panel();
  const id = await send(
    csv(
      [1, 2, 3],
      [
        ["000EJE", "", "-", "3"],
        ["000VIR", "", "-", "3"],
      ],
    ),
  );
  const preview = z
    .object({ review: reviewSummarySchema, rows: z.array(rowViewSchema) })
    .parse(
      await api("preview", { jobId: id, careerId: "laf-plan-1" }, sessions.a),
    );
  expect(preview.review).toMatchObject({
    added: 0,
    changed: 2,
    unchanged: 1,
    numericCleared: 2,
    preserved: 5,
  });
  expect(
    preview.rows
      .find((r) => identity(r.identity).normalized === "000eje")!
      .review!.filter((v) => v.numericCleared),
  ).toHaveLength(2);
  expect(JSON.stringify(preview).toLowerCase()).not.toContain("000vir");
  await expect(
    api("preview", { jobId: id, careerId: "arq-plan-1" }, sessions.a),
  ).rejects.toThrow("PERMISSION_DENIED");
  const competing = await send(csv([1], [["000EJE", "9"]]));
  await publish(competing);
  await expect(publish(id)).rejects.toThrow("ABORTED");
  expect((await panel()).counts).toEqual({ ...previous.counts, Z: 0 });
  const refreshed = (await api("revalidate", { jobId: id }, sessions.a)) as {
    id: string;
  };
  await waitJob(refreshed.id);
  await publish(refreshed.id);
  expect((await panel()).counts).toEqual({
    N: 3,
    V: 2,
    G: 2,
    E: 0,
    Z: 0,
    D: 7,
  });
});

it("avance versionado con CAS, permisos, propuesta obsoleta y cierre inmutable", async () => {
  const cut = await current();
  const pinned = await panel();
  const pending = await send(csv([1], [["000EJE", "6"]]));
  const config = {
    cutId: cut.id,
    expected: cut.progress!.id,
    progress: { ...progress, virtualUnit: 4 },
    reason: "Avance Virtual confirmado",
  };
  await expect(api("configureProgress", config, sessions.a)).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  await api("configureProgress", config, sessions.admin);
  const pinnedAgain = dashboardSchema.parse(
    await api(
      "dashboard",
      { ...query(cut.id), snapshotId: pinned.snapshotId },
      sessions.admin,
    ),
  );
  expect(pinnedAgain.counts).toEqual(pinned.counts);
  const pinnedExport = (await api(
    "exportDashboard",
    { ...query(cut.id), snapshotId: pinned.snapshotId },
    sessions.admin,
  )) as { csv: string };
  expect(pinnedExport.csv).toContain(cut.progress!.id);
  await expect(
    api(
      "configureProgress",
      { ...config, progress: { ...progress, executiveUnit: 4 } },
      sessions.admin,
    ),
  ).rejects.toThrow("ABORTED");
  await expect(publish(pending)).rejects.toThrow("ABORTED");
  const newer = await current();
  expect(newer.progress).toMatchObject({
    previous: cut.progress!.id,
    virtualUnit: 4,
    executiveUnit: 3,
  });
  expect(newer.progress!.recordedAt).toBeGreaterThan(0);
  expect(
    (await stores().db.doc(`progressHistory/${newer.progress!.id}`).get())
      .exists,
  ).toBe(true);
  const before = await panel();
  expect(before.counts.D).toBe(9);
  await api("closeCut", { cutId: cut.id }, sessions.admin);
  await expect(
    api(
      "configureProgress",
      { ...config, expected: newer.progress!.id },
      sessions.admin,
    ),
  ).rejects.toThrow("FAILED_PRECONDITION");
  await expect(
    api(
      "editCutDate",
      {
        cutId: cut.id,
        expected: newer.date,
        date: "2027-01-01",
        reason: "Cerrado",
      },
      sessions.admin,
    ),
  ).rejects.toThrow("FAILED_PRECONDITION");
  await expect(publish(pending)).rejects.toThrow("FAILED_PRECONDITION");
  expect((await panel()).counts).toEqual(before.counts);
  expect((await panel()).details).toEqual(before.details);
});
