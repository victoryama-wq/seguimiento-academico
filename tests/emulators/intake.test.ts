import { beforeAll, it, expect } from "vitest";
import {
  api,
  seedBase,
  waitJob,
  stores,
  people,
} from "../fixtures/synthetic/stage03";
import {
  book,
  csv,
  rosterHeaders,
  rosterRows,
  catalogHeaders,
  catalogRows,
} from "../fixtures/synthetic/intake";
import {
  originalViewSchema,
  administrativeReviewSchema,
} from "../../src/domain/intake-contract";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import { z } from "zod";

let sessions: Awaited<ReturnType<typeof seedBase>>;
const inspect = async (kind: string, name: string, bytes: Buffer) =>
  originalViewSchema.parse(
    await api(
      "inspectOriginal",
      { kind, name, base64: bytes.toString("base64") },
      sessions.admin,
    ),
  );
const selected = (v: ReturnType<typeof originalViewSchema.parse>) => ({
  id: v.id,
  columns: v.columns,
  options: v.options,
});
let roster: Awaited<ReturnType<typeof inspect>>,
  catalog: Awaited<ReturnType<typeof inspect>>,
  proposal: z.infer<typeof administrativeReviewSchema>;
let cutId: string, reportJob: string;
beforeAll(async () => {
  sessions = await seedBase();
}, 60000);
it("selecciona originales privados y valida antes de confirmar; deniega coordinadores y conserva propuestas", async () => {
  roster = await inspect(
    "roster",
    "alumnos.csv",
    csv([rosterHeaders, ...rosterRows]),
  );
  catalog = await inspect(
    "catalog",
    "carreras.xlsx",
    book([catalogHeaders, ...catalogRows]),
  );
  expect(roster.columns.identity).toBe(0);
  expect(roster.cycles).toEqual(["27-1"]);
  expect(
    (await stores().db.doc("cycles/27-1").get()).data()!.sources
      .academicPackage,
  ).toBeUndefined();
  proposal = administrativeReviewSchema.parse(
    await api(
      "prepareAdministration",
      {
        roster: selected(roster),
        catalog: selected(catalog),
        cycle: "27-1",
        expected: null,
      },
      sessions.admin,
    ),
  );
  expect(proposal.blocking).toBe(false);
  expect(proposal.principals).toBe(3);
  expect(proposal.excluded).toBe(1);
  for (const token of [sessions.a, sessions.b])
    for (const [op, input] of [
      ["readOriginal", { id: roster.id, options: {} }],
      ["administrationReview", { id: proposal.id }],
      ["confirmAdministration", { id: proposal.id }],
      ["administrationDraft", { id: proposal.id }],
    ] as const)
      await expect(api(op, input, token)).rejects.toThrow(/PERMISSION_DENIED/);
  const restored = (await api(
    "administrationDraft",
    { id: proposal.id },
    sessions.admin,
  )) as { roster: { id: string } };
  expect(restored.roster.id).toBe(roster.id);
  await api("confirmAdministration", { id: proposal.id }, sessions.admin);
  await api("confirmAdministration", { id: proposal.id }, sessions.admin);
  expect(
    (await stores().db.doc(`sources/${proposal.id}`).get()).data()!
      .originalPaths,
  ).toHaveLength(2);
  expect(
    (await stores().db.doc(`jobs/${proposal.id}`).get()).data()!.status,
  ).toBe("published");
});
it("prepara avance sin fechas ni IDs y registra curso por nombre/ciclo/matrículas sin publicación automática", async () => {
  cutId = (
    (await api(
      "prepareOperationalCut",
      {
        cycle: "27-1",
        requestId: "d".repeat(64),
        progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 },
      },
      sessions.admin,
    )) as { id: string }
  ).id;
  const report = await inspect(
    "report",
    "910._Curso_Compartido_27-1 Calificaciones.ods",
    book(
      [
        [
          "Dirección Email",
          "Tarea: Unidad 1",
          "Tarea: Unidad 3",
          "Tarea: Unidad 4",
          "Total del curso",
        ],
        ["000ESC@example.invalid", 0, 9, 4, 999],
        ["000EJE@example.invalid", "-", 8, 5, 999],
        ["000VIR@example.invalid", 7, 9, 6, 999],
        ["000BAJA@example.invalid", 10, 10, 10, 999],
      ],
      "ods",
    ),
  );
  const sent = (await api(
    "prepareOperationalReport",
    { cutId, file: selected(report) },
    sessions.admin,
  )) as { jobId: string };
  reportJob = sent.jobId;
  const job = await waitJob(reportJob);
  expect(job.status).toBe("ready");
  expect(
    (await stores().db.doc(`cuts/${cutId}/courses/${job.courseId}`).get())
      .exists,
  ).toBe(false);
  const course = (
    await stores().db.doc(`courses/${job.courseId}`).get()
  ).data()!;
  expect(course.careers).toHaveLength(2);
  await api("publish", { jobId: reportJob, replace: false }, sessions.admin);
  const panel = dashboardSchema.parse(
    await api(
      "dashboard",
      { cutId, filters: {}, view: "institucion", section: "details" },
      sessions.admin,
    ),
  );
  expect(panel.counts.D).toBe(4);
  expect(panel.counts.N).toBe(3);
  const laf = proposal.catalog.find((c) => c.abbreviation === "LAF")!.id,
    arq = proposal.catalog.find((c) => c.abbreviation === "ARQ")!.id;
  await stores()
    .db.doc(`memberships/${people.a}`)
    .update({ careers: [laf] });
  await stores()
    .db.doc(`memberships/${people.b}`)
    .update({ careers: [arq] });
  for (const [token, forbidden] of [
    [sessions.a, arq],
    [sessions.b, laf],
  ])
    await expect(
      api(
        "dashboard",
        {
          cutId,
          filters: { careerId: forbidden },
          view: "institucion",
          section: "details",
        },
        token,
      ),
    ).rejects.toThrow();
});
it("conserva columnas parciales, muestra pérdida numérica y no revierte al reintentar una carga anterior", async () => {
  const report = await inspect(
    "report",
    "910._Curso_Compartido_27-1 Calificaciones.csv",
    csv([
      ["Dirección Email", "Tarea: Unidad 1"],
      ["000ESC@example.invalid", ""],
    ]),
  );
  const input = { cutId, file: selected(report) };
  const next = (await api(
    "prepareOperationalReport",
    input,
    sessions.admin,
  )) as { jobId: string };
  await waitJob(next.jobId);
  const preview = (await api(
    "preview",
    { jobId: next.jobId },
    sessions.admin,
  )) as {
    blocking: boolean;
    review: { numericCleared: number; preserved: number };
  };
  expect(preview.blocking).toBe(false);
  expect(preview.review.numericCleared).toBe(1);
  expect(preview.review.preserved).toBeGreaterThan(0);
  await api("publish", { jobId: next.jobId, replace: true }, sessions.admin);
  expect(
    (
      (await api("prepareOperationalReport", input, sessions.admin)) as {
        jobId: string;
      }
    ).jobId,
  ).toBe(next.jobId);
  await api("publish", { jobId: reportJob, replace: true }, sessions.admin);
  const job = (await stores().db.doc(`jobs/${next.jobId}`).get()).data()!;
  expect(
    (
      await stores().db.doc(`cuts/${cutId}/courses/${job.courseId}`).get()
    ).data()!.versionId,
  ).toBe(next.jobId);
});
it("detecta propuestas de fuentes simultáneas sin modificar fuentes fijadas en un corte", async () => {
  const altered = await inspect(
    "roster",
    "alumnos-revisados.csv",
    csv([
      rosterHeaders,
      ...rosterRows.map((r, i) =>
        i ? r : r.map((v, j) => (j === 1 ? "Nombre sintético corregido" : v)),
      ),
    ]),
  );
  const input = {
    roster: selected(altered),
    catalog: selected(catalog),
    cycle: "27-1",
    expected: proposal.id,
  };
  const a = administrativeReviewSchema.parse(
    await api("prepareAdministration", input, sessions.admin),
  );
  const b = administrativeReviewSchema.parse(
    await api(
      "prepareAdministration",
      {
        ...input,
        programMappings: [
          {
            program: "Finanzas",
            abbreviation: "LAF",
            careerId: proposal.catalog.find((c) => c.abbreviation === "LAF")!
              .id,
            reason: "Confirmación sintética",
          },
        ],
      },
      sessions.admin,
    ),
  );
  await api("confirmAdministration", { id: a.id }, sessions.admin);
  await expect(
    api("confirmAdministration", { id: b.id }, sessions.admin),
  ).rejects.toThrow(/ABORTED/);
  expect(
    (await stores().db.doc(`cuts/${cutId}`).get()).data()!.sources
      .academicPackage,
  ).toBe(proposal.id);
  const unknown = await inspect(
    "report",
    "910._Curso_Compartido_27-1 Calificaciones.csv",
    csv([
      ["Dirección Email", "Tarea: Unidad 1"],
      ["DESCONOCIDA@example.invalid", 10],
    ]),
  );
  const sent = (await api(
    "prepareOperationalReport",
    { cutId, file: selected(unknown) },
    sessions.admin,
  )) as { jobId: string };
  const job = await waitJob(sent.jobId);
  expect(job.blocking).toBe(true);
  await expect(
    api("publish", { jobId: sent.jobId, replace: false }, sessions.admin),
  ).rejects.toThrow();
});
