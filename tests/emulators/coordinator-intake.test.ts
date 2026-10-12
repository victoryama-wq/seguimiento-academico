import { beforeAll, expect, it } from "vitest";
import {
  api,
  seedBase,
  source,
  stores,
  waitJob,
  people,
} from "../fixtures/synthetic/stage03";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";
import { book, csv } from "../fixtures/synthetic/intake";
import { originalViewSchema } from "../../src/domain/intake-contract";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import { rowViewSchema } from "../../src/domain/import-contract";
import { z } from "zod";

let sessions: Awaited<ReturnType<typeof seedBase>>;
const cutId = "coordinator-flow";
const headers = [
  "Dirección Email",
  "Tarea: Unidad 1",
  "Tarea: Unidad 3",
  "Tarea: Unidad 4",
  "Total del curso",
];
const rows = [
  headers,
  ["000ESC", 0, 7, 9, 999],
  ["000EJE", 5, 6, 9, 999],
  ["000VIR", 8, 9, 9, 999],
  ["000BAJA", 10, 10, 10, 999],
  ["000AJENO", 10, 10, 10, 999],
];
const previewSchema = z.object({
  rows: z.array(rowViewSchema),
  reviewToken: z.string(),
  blocking: z.boolean(),
  excluded: z.array(z.object({ identity: z.string() })),
  inclusion: z.object({ included: z.number(), excluded: z.number() }),
});
async function inspect(token: string, name: string, content: Buffer) {
  return originalViewSchema.parse(
    await api(
      "inspectOriginal",
      { kind: "report", cutId, name, base64: content.toString("base64") },
      token,
    ),
  );
}
async function prepare(
  token: string,
  view: z.infer<typeof originalViewSchema>,
) {
  const result = (await api(
    "prepareOperationalReport",
    {
      cutId,
      file: {
        id: view.id,
        columns: view.columns,
        options: view.options,
        policyVersion: view.policyVersion,
      },
      activities: view.activities.filter(
        (a) => a.column !== view.columns.identity,
      ),
    },
    token,
  )) as { jobId: string };
  await waitJob(
    result.jobId,
    (await stores().db.doc(`jobs/${result.jobId}`).get()).data()!.status ===
      "published"
      ? "published"
      : "ready",
  );
  return result.jobId;
}
async function review(id: string, token: string) {
  return previewSchema.parse(await api("preview", { jobId: id }, token));
}
async function publish(id: string, token: string) {
  const p = await review(id, token);
  return api(
    "publish",
    { jobId: id, replace: true, reviewToken: p.reviewToken },
    token,
  );
}
const panel = async (token: string, section = "details") =>
  dashboardSchema.parse(
    await api(
      "dashboard",
      { cutId, filters: {}, view: "institucion", section },
      token,
    ),
  );
let first: string, second: string;
beforeAll(async () => {
  sessions = await seedBase();
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(trackingPackage()),
    {},
    "scope-fixture.json",
  );
  await api(
    "createCut",
    {
      id: cutId,
      cycleId: "27-1",
      progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 3 },
    },
    sessions.admin,
  );
}, 60000);

it("primera carga registra curso sin Administración, filtra originales y publica solo el ámbito verificado", async () => {
  const view = await inspect(
    sessions.a,
    "801._Curso_Compartido_27-1.xlsx",
    book(rows),
  );
  expect(view.count).toBe(3);
  expect(JSON.stringify(view)).not.toContain("000VIR");
  expect(JSON.stringify(view)).not.toContain("000AJENO");
  first = await prepare(sessions.a, view);
  const j = (await stores().db.doc(`jobs/${first}`).get()).data()!;
  expect(j.scope).toEqual(["laf-plan-1"]);
  expect(j.guided).toBe(true);
  expect(
    (await stores().db.doc(`courses/${j.courseId}`).get()).data()!.careers,
  ).toEqual(expect.arrayContaining(["laf-plan-1", "arq-plan-1"]));
  const p = await review(first, sessions.a);
  expect(p.blocking).toBe(false);
  expect(p.rows.map((r) => r.identity).sort()).toEqual(["000EJE", "000ESC"]);
  expect(p.excluded.map((e) => e.identity)).toContain("000BAJA");
  expect(p.inclusion).toEqual({ included: 2, excluded: 1 });
  await expect(
    api("publish", { jobId: first, replace: true }, sessions.a),
  ).rejects.toThrow("ABORTED");
  await expect(
    api(
      "publish",
      { jobId: first, replace: true, reviewToken: p.reviewToken },
      sessions.b,
    ),
  ).rejects.toThrow("PERMISSION_DENIED");
  await publish(first, sessions.a);
  expect((await panel(sessions.b)).counts.D).toBe(0);
  const admin = JSON.stringify(
    await api("preview", { jobId: first }, sessions.admin),
  );
  expect(admin).toContain("000AJENO");
  expect(admin).toContain("Administración conserva");
  await expect(
    api("readOriginal", { id: view.id, options: {} }, sessions.b),
  ).rejects.toThrow("PERMISSION_DENIED");
});
it("conserva elecciones visuales por ciclo/curso/ámbito y deriva ambigüedades institucionales a Administración", async () => {
  const v = await inspect(
    sessions.a,
    "801._Curso_Compartido_27-1.csv",
    csv([
      ["Cuenta", headers[1]],
      ["000EJE", 5],
    ]),
  );
  expect(v.columns.identity).toBeUndefined();
  v.columns.identity = 0;
  const id = await prepare(sessions.a, v);
  await publish(id, sessions.a);
  const again = originalViewSchema.parse(
    await api("readOriginal", { id: v.id, options: v.options }, sessions.a),
  );
  expect(again.columns.identity).toBe(0);
  expect(again.count).toBe(1);
  const other = await inspect(
    sessions.b,
    "801._Curso_Compartido_27-1.csv",
    csv([
      ["Cuenta", headers[1]],
      ["000VIR", 5],
    ]),
  );
  expect(other.columns.identity).toBeUndefined();
  const ambiguous = await inspect(
    sessions.a,
    "99 805 Curso Pendiente 27-1.csv",
    csv(rows),
  );
  await expect(prepare(sessions.a, ambiguous)).rejects.toThrow(
    /INVALID_ARGUMENT/,
  );
  await api(
    "requestReportReview",
    { id: ambiguous.id, reason: "Identificación ambigua sintética" },
    sessions.a,
  );
  expect(
    JSON.stringify(await api("pendingReportReviews", {}, sessions.admin)),
  ).toContain(ambiguous.id);
  await expect(
    api(
      "prepareOperationalReport",
      {
        cutId,
        file: {
          id: ambiguous.id,
          columns: ambiguous.columns,
          options: ambiguous.options,
        },
        identification: {
          externalId: "805",
          name: "Curso Pendiente",
          cycle: "27-1",
          reason: "Sintético",
        },
      },
      sessions.a,
    ),
  ).rejects.toThrow("PERMISSION_DENIED");
  const fixed = (await api(
    "prepareOperationalReport",
    {
      cutId,
      file: {
        id: ambiguous.id,
        columns: ambiguous.columns,
        options: ambiguous.options,
      },
      identification: {
        externalId: "805",
        name: "Curso Pendiente",
        cycle: "27-1",
        reason: "Decisión administrativa sintética",
      },
    },
    sessions.admin,
  )) as { jobId: string };
  expect((await waitJob(fixed.jobId)).status).toBe("ready");
});
it("B publica su principal C.A. sin alterar A; no incluye unidad posterior ni totales", async () => {
  const view = await inspect(
    sessions.b,
    "801._Curso_Compartido_27-1.ods",
    book(rows, "ods"),
  );
  expect(view.count).toBe(1);
  expect(JSON.stringify(view)).not.toContain("000ESC");
  second = await prepare(sessions.b, view);
  const p = await review(second, sessions.b);
  expect(p.rows).toHaveLength(1);
  expect(p.rows[0]!.relationship?.trackingGroup).toContain("C.A");
  await publish(second, sessions.b);
  const a = await panel(sessions.a),
    b = await panel(sessions.b);
  expect(a.counts.D).toBe(3);
  expect(b.counts.D).toBe(2);
  expect(JSON.stringify(a)).not.toContain("000VIR");
  expect(JSON.stringify(b)).not.toContain("000ESC");
  const possible = await panel(sessions.a, "possibleWithdrawals");
  expect(JSON.stringify(possible)).toContain("000BAJA");
  expect(JSON.stringify(possible)).not.toContain("000AJENO");
  const exported = JSON.stringify(
    await api(
      "exportDashboard",
      { cutId, filters: {}, view: "institucion", section: "details" },
      sessions.b,
    ),
  );
  expect(exported).toContain("000VIR");
  expect(exported).not.toContain("000ESC");
});
it("actualizaciones parciales, reenvío, concurrencia y cierre conservan otros ámbitos e historia", async () => {
  const before = (await panel(sessions.b)).counts;
  const view = await inspect(
    sessions.a,
    "801._Curso_Compartido_27-1.csv",
    csv([
      [headers[0], headers[1]],
      ["000EJE", 0],
      ["000VIR", 0],
    ]),
  );
  const id = await prepare(sessions.a, view);
  await publish(id, sessions.a);
  expect(await prepare(sessions.a, view)).toBe(id);
  await publish(id, sessions.a);
  expect((await panel(sessions.b)).counts).toEqual(before);
  const course = (await stores().db.doc(`jobs/${id}`).get()).data()!.courseId;
  const result = (await api(
    "results",
    { cutId, courseId: course, careerId: "laf-plan-1" },
    sessions.a,
  )) as { rows: z.infer<typeof rowViewSchema>[] };
  expect(result.rows).toHaveLength(2);
  expect(result.rows.find((r) => r.identity === "000EJE")!.values).toHaveLength(
    3,
  );
  const concurrent = await Promise.all(
    [3, 4].map(async (v) =>
      prepare(
        sessions.a,
        await inspect(
          sessions.a,
          "801._Curso_Compartido_27-1.csv",
          csv([
            [headers[0], headers[1]],
            ["000EJE", v],
          ]),
        ),
      ),
    ),
  );
  const oldReview = await review(concurrent[0]!, sessions.a);
  await publish(concurrent[1]!, sessions.a);
  await expect(
    api(
      "publish",
      {
        jobId: concurrent[0],
        replace: true,
        reviewToken: oldReview.reviewToken,
      },
      sessions.a,
    ),
  ).rejects.toThrow("ABORTED");
  await api("retry", { jobId: id }, sessions.a);
  await publish(id, sessions.a);
  const final = (await api(
    "results",
    { cutId, courseId: course, careerId: "laf-plan-1" },
    sessions.a,
  )) as { rows: z.infer<typeof rowViewSchema>[] };
  expect(
    final.rows
      .find((r) => r.identity === "000EJE")!
      .values.find((v) => v.unit === 1)!.raw,
  ).toBe("4");
  await api("closeCut", { cutId }, sessions.admin);
  await expect(
    inspect(sessions.a, "802._Otro_27-1.csv", csv(rows)),
  ).rejects.toThrow("FAILED_PRECONDITION");
  expect((await panel(sessions.b)).counts).toEqual(before);
});
it("deniega configuración administrativa y rechaza confirmación con permisos revocados", async () => {
  for (const [op, input] of [
    [
      "prepareOperationalCut",
      {
        cycle: "27-1",
        requestId: "a".repeat(64),
        progress: { schoolCut: 1, executiveUnit: 1, virtualUnit: 1 },
      },
    ],
    [
      "inspectOriginal",
      {
        kind: "roster",
        name: "padron.csv",
        base64: csv(rows).toString("base64"),
      },
    ],
    ["pendingReportReviews", {}],
  ] as const)
    await expect(api(op, input, sessions.a)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  await stores().db.doc(`memberships/${people.a}`).update({ careers: [] });
  expect(
    ((await api("overview", {}, sessions.a)) as { cuts: unknown[] }).cuts,
  ).toHaveLength(0);
  await expect(review(first, sessions.a)).rejects.toThrow("PERMISSION_DENIED");
  await expect(panel(sessions.a)).rejects.toThrow("PERMISSION_DENIED");
});
