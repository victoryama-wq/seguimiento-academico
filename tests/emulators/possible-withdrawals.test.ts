import { beforeAll, expect, it } from "vitest";
import {
  api,
  batch,
  rosterCsv,
  rosterMap,
  catalogCsv,
  catalogMap,
  seedBase,
  source,
  stores,
  waitJob,
} from "../fixtures/synthetic/stage03";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import type { AcademicPackage } from "../../src/domain/decision-package";
let sessions: Awaited<ReturnType<typeof seedBase>>, packageId: string;
const query = (cutId = "bajas", filters = {}) => ({
  cutId,
  filters,
  view: "institucion",
  section: "possibleWithdrawals",
});
const panel = async (cutId = "bajas", token = sessions.admin, filters = {}) =>
  dashboardSchema.parse(await api("dashboard", query(cutId, filters), token));
async function send(rows: string[], course = "c1", cut = "bajas") {
  const content = ["Nombre,Dirección Email,Tarea:Unidad 1", ...rows].join("\n");
  const [j] = await batch(
    sessions.admin,
    [
      {
        name: `${course === "c1" ? 701 : 702}._Curso_Compartido_27-1.csv`,
        content,
        courseId: course,
        mapping: { profile: "moodle-institutional-v1" },
      },
    ],
    cut,
  );
  const job = await waitJob(
    j!.id,
    j!.status === "published" ? "published" : "ready",
  );
  return { id: j!.id, job };
}
const publish = (id: string) =>
  api("publish", { jobId: id, replace: true }, sessions.admin);
async function cut(id: string) {
  await api(
    "createCut",
    {
      id,
      cycleId: "27-1",
      date: "2026-09-20",
      progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 3 },
    },
    sessions.admin,
  );
}
beforeAll(async () => {
  sessions = await seedBase();
  const p = trackingPackage();
  p.cycleWithdrawals = [
    {
      identity: "000CONFIRMADA",
      reason: "Baja sintética autorizada",
      sourceReference: "Decisión sintética del propietario",
    },
  ];
  packageId = await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(p),
    {},
    "bajas-sinteticas.json",
  );
  for (const [id, externalId] of [
    ["c1", "701"],
    ["c2", "702"],
  ])
    await api(
      "createCourse",
      {
        id,
        externalId,
        cycleId: "27-1",
        name: "Curso Compartido",
        careers: ["laf-plan-1", "arq-plan-1"],
      },
      sessions.admin,
    );
  await cut("bajas");
}, 60000);
it("excluye ausentes y bajas sin bloquear válidos; conserva cero, nombres, procedencia y denominadores", async () => {
  const a = await send([
    "Escolarizado,000ESC,0",
    "Virtual,000VIR,8",
    "Ausente,000POSIBLE,10",
    "Confirmada,000CONFIRMADA,10",
    "Baja,000BAJA,10",
  ]);
  expect(a.job.blocking).toBe(false);
  const preview = (await api("preview", { jobId: a.id }, sessions.admin)) as {
    inclusion: { included: number; excluded: number };
  };
  expect(preview.inclusion).toEqual({ included: 2, excluded: 3 });
  await publish(a.id);
  const b = await send(
    [
      "Variante ausente,000posible@example.invalid,0",
      "Confirmada,000CONFIRMADA,0",
    ],
    "c2",
  );
  await publish(b.id);
  const data = await panel();
  expect(data.counts).toEqual({ D: 2, N: 2, G: 0, V: 0, E: 0, Z: 1 });
  expect(data.students).toBe(2);
  expect(data.possibleWithdrawalsCount).toBe(3);
  const possible = data.possibleWithdrawals.find(
    (p) => p.identity === "000posible",
  )!;
  expect(possible.courses).toHaveLength(2);
  expect(possible.names).toEqual(["Ausente", "Variante ausente"]);
  expect(possible.observations).toHaveLength(1);
  expect(
    data.possibleWithdrawals.find((p) => p.identity === "000confirmada")
      ?.status,
  ).toBe("baja confirmada");
  const csv = (await api(
    "exportDashboard",
    { ...query(), snapshotId: data.snapshotId },
    sessions.admin,
  )) as { csv: string };
  expect(csv.csv).toContain("No pertenece al padrón activo del ciclo");
  expect(csv.csv).toContain("Variante ausente");
  expect(csv.csv).toContain("baja confirmada");
});
it("curso compartido/uploader no atribuyen ausentes: filtra conteos, paginación, consulta directa y CSV en servidor", async () => {
  const a = await panel("bajas", sessions.a),
    b = await panel("bajas", sessions.b);
  expect(a.counts.D).toBe(1);
  expect(b.counts.D).toBe(1);
  expect(a.possibleWithdrawals.map((p) => p.identity)).toEqual(["000baja"]);
  expect(b.possibleWithdrawalsCount).toBe(0);
  for (const token of [sessions.a, sessions.b]) {
    const filtered = await panel("bajas", token, {
      student: "000POSIBLE",
      courseId: "c1",
    });
    expect(filtered.possibleWithdrawalsCount).toBe(0);
    const exported = JSON.stringify(
      await api("exportDashboard", { ...query(), offset: 0 }, token),
    );
    expect(exported).not.toContain("000POSIBLE");
    expect(exported).not.toContain("000CONFIRMADA");
    await expect(
      api(
        "dashboard",
        query("bajas", {
          careerId: token === sessions.a ? "arq-plan-1" : "laf-plan-1",
        }),
        token,
      ),
    ).rejects.toThrow("PERMISSION_DENIED");
  }
  expect(
    (await panel("bajas", sessions.admin, { careerId: "arq-plan-1" }))
      .possibleWithdrawalsCount,
  ).toBe(0);
});
it("cargas parciales y reintentos conservan casos sin duplicar ni recuperar calificaciones excluidas", async () => {
  const partial = await send(["Escolarizado,000ESC,7"]);
  await publish(partial.id);
  await publish(partial.id);
  const again = await send(["Escolarizado,000ESC,7"]);
  expect(again.id).toBe(partial.id);
  const data = await panel();
  expect(data.counts.D).toBe(2);
  expect(data.possibleWithdrawalsCount).toBe(3);
  expect(
    data.possibleWithdrawals.find((p) => p.identity === "000posible")?.courses,
  ).toHaveLength(2);
  const single = await panel("bajas", sessions.admin, {
    student: "000POSIBLE",
  });
  expect(single.counts.D).toBe(0);
  expect(single.coverage).toBeNull();
  expect(single.students).toBe(0);
  const renamed = await send([
    "Nombre actualizado en mismo curso,000POSIBLE,0",
  ]);
  await publish(renamed.id);
  const withNames = (await panel()).possibleWithdrawals.find(
    (p) => p.identity === "000posible",
  )!;
  expect(withNames.names).toEqual(
    expect.arrayContaining([
      "Ausente",
      "Variante ausente",
      "Nombre actualizado en mismo curso",
    ]),
  );
  expect(withNames.courses).toHaveLength(2);
  expect(withNames.observations).toHaveLength(1);
});
it("identidad vacía y presente con afiliación pendiente no son ausencias del padrón", async () => {
  const invalid = await send(["Sin identidad,,10"]);
  expect(invalid.job.blocking).toBe(true);
  await expect(publish(invalid.id)).rejects.toThrow();
  const pending = trackingPackage();
  pending.enrollments[0]!.original.date = "17/09/2026";
  const { enrollmentKey } = await import("../../src/importing/decisions");
  pending.enrollments[0]!.key = enrollmentKey(pending.enrollments[0]!.original);
  // Fuente fallida jamás publicable: no puede convertirse en exclusiones masivas.
  await expect(
    source(
      sessions.admin,
      "academicPackage",
      JSON.stringify(pending),
      {},
      "padron-pendiente.json",
    ),
  ).rejects.toThrow();
  expect(
    (await stores().db.doc("cycles/27-1").get()).data()!.sources
      .academicPackage,
  ).toBe(packageId);
});
it("decisión individual auditada, concurrencia obsoleta y cierre conservan la fotografía anterior", async () => {
  const before = await panel();
  await api("closeCut", { cutId: "bajas" }, sessions.admin);
  const input = {
    jobId: packageId,
    decision: {
      identity: "000POSIBLE",
      reason: "Confirmación individual sintética",
      sourceReference: "Propietario sintético",
    },
  };
  for (const token of [sessions.a, sessions.b])
    await expect(api("reviseCycleWithdrawal", input, token)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  const revised = (await api(
    "reviseCycleWithdrawal",
    input,
    sessions.admin,
  )) as { id: string };
  await waitJob(revised.id);
  await api(
    "publishSource",
    { jobId: revised.id, replace: true },
    sessions.admin,
  );
  expect(
    (
      (await api("reviseCycleWithdrawal", input, sessions.admin)) as {
        id: string;
      }
    ).id,
  ).toBe(revised.id);
  const audit = (
    await stores().db.doc(`decisionRevisionAudit/${revised.id}`).get()
  ).data()!;
  expect(audit.actor).toBe("admin-sintetico");
  expect(audit.previous).toBe(packageId);
  await expect(
    api(
      "reviseCycleWithdrawal",
      { ...input, decision: { ...input.decision, identity: "000OTRA" } },
      sessions.admin,
    ),
  ).rejects.toThrow();
  await cut("bajas-revision");
  const next = await send(["Ausente,000POSIBLE,10"], "c1", "bajas-revision");
  await publish(next.id);
  expect((await panel("bajas-revision")).possibleWithdrawals[0]?.status).toBe(
    "baja confirmada",
  );
  const closed = await panel();
  expect(closed.counts).toEqual(before.counts);
  expect(closed.possibleWithdrawals).toEqual(before.possibleWithdrawals);
  const closedJob = (
    await stores().db.doc("cuts/bajas/courses/c1").get()
  ).data()!.versionId;
  await expect(
    api("revalidate", { jobId: closedJob }, sessions.admin),
  ).rejects.toThrow();
});
it("página de 25 y CSV completo conservan conteo y alcance", async () => {
  await cut("bajas-paginas");
  const job = await send(
    Array.from(
      { length: 27 },
      (_, i) => `Persona sintética,TEST-AUSENTE-${i},0`,
    ),
    "c1",
    "bajas-paginas",
  );
  await publish(job.id);
  const first = await panel("bajas-paginas");
  expect(first.possibleWithdrawalsCount).toBe(27);
  expect(first.possibleWithdrawals).toHaveLength(25);
  const second = dashboardSchema.parse(
    await api(
      "dashboard",
      {
        ...query("bajas-paginas"),
        snapshotId: first.snapshotId,
        offset: first.next,
      },
      sessions.admin,
    ),
  );
  expect(second.possibleWithdrawals).toHaveLength(2);
  expect(second.next).toBeNull();
  const csv = (
    (await api(
      "exportDashboard",
      { ...query("bajas-paginas"), snapshotId: first.snapshotId },
      sessions.admin,
    )) as { csv: string }
  ).csv;
  for (let i = 0; i < 27; i++) expect(csv).toContain(`TEST-AUSENTE-${i}`);
  expect(
    (await panel("bajas-paginas", sessions.a)).possibleWithdrawalsCount,
  ).toBe(0);
  // El tipo del paquete sigue siendo compatible con las fuentes anteriores.
  const p: AcademicPackage = trackingPackage();
  expect(p.cycleWithdrawals).toBeUndefined();
});
it("padrón legado confirmado: afiliación ambigua sigue pendiente; sin fuente no hay exclusiones masivas", async () => {
  const cycleId = "27-2";
  await api(
    "createCycle",
    { id: cycleId, dates: { "2026-08-31": "base" } },
    sessions.admin,
  );
  await api(
    "createCourse",
    {
      id: "legacy-bajas",
      cycleId,
      externalId: "703",
      name: "Legado",
      careers: ["laf-plan-1"],
    },
    sessions.admin,
  );
  await expect(
    api(
      "createCut",
      { id: "sin-padron", cycleId, date: "2026-09-20" },
      sessions.admin,
    ),
  ).rejects.toThrow("Publica padrón y catálogo");
  const files = [
    {
      name: "703._Legado_27-2.csv",
      content: "Dirección Email,Tarea:Unidad 1\n000SINT01,0\n000SINPADRON,10",
      courseId: "legacy-bajas",
      mapping: { profile: "moodle-institutional-v1" },
    },
  ];
  await expect(batch(sessions.admin, files, "sin-padron")).rejects.toThrow();
  await source(
    sessions.admin,
    "catalog",
    catalogCsv,
    catalogMap,
    "catalogo.csv",
    cycleId,
  );
  await source(
    sessions.admin,
    "roster",
    rosterCsv.replaceAll("27-1", "27-2") +
      "\n000SINT01,Otra inscripción,laf-plan-1,27-2 LAF 24 02A,Ejecutivo,Vespertino,2026-08-31",
    rosterMap,
    "roster.csv",
    cycleId,
  );
  await api(
    "createCut",
    { id: "principal-pendiente", cycleId, date: "2026-09-20" },
    sessions.admin,
  );
  const [j] = await batch(sessions.admin, files, "principal-pendiente");
  expect((await waitJob(j!.id)).blocking).toBe(true);
  const preview = (await api("preview", { jobId: j!.id }, sessions.admin)) as {
    excluded: { identity: string }[];
    observations: { identity: string; state: string }[];
  };
  expect(preview.excluded.map((e) => e.identity)).toEqual(["000SINPADRON"]);
  expect(preview.observations).toContainEqual(
    expect.objectContaining({ identity: "000SINT01", state: "pendiente" }),
  );
  await expect(publish(j!.id)).rejects.toThrow();
});
