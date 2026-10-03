import { it, expect } from "vitest";
import {
  assertFails,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  seedBase,
  source,
  rosterCsv,
  rosterMap,
  api,
  batch,
  waitJob,
  stores,
  people,
} from "../fixtures/synthetic/stage03";
import { dashboardSchema } from "../../src/domain/metrics-contract";

it("pagina 26 personas sobre versión fija, exporta todas, rechaza duplicados y revocación", async () => {
  const s = await seedBase();
  const roster = [
    rosterCsv.split("\n")[0],
    ...Array.from(
      { length: 26 },
      (_, i) =>
        `PAG${i},Persona sintética ${i},laf-plan-1,27-1 LAF 24 01A,Ejecutivo,Vespertino,2026-08-31`,
    ),
  ].join("\n");
  await source(s.admin, "roster", roster, rosterMap);
  await api(
    "createCut",
    { cycleId: "27-1", id: "paginas", date: "2026-09-21" },
    s.admin,
  );
  const content = [
    "Correo,Nota",
    ...Array.from({ length: 26 }, (_, i) => `PAG${i}@example.invalid,${i}`),
  ].join("\n");
  const [job] = await batch(
    s.admin,
    [
      {
        name: "2 Curso A 27-1.csv",
        content,
        courseId: "solo-a",
        mapping: {
          identity: { header: "Correo" },
          columns: [
            { selector: { header: "Nota" }, kind: "activity", activityId: "A" },
          ],
        },
      },
    ],
    "paginas",
  );
  const staged = await waitJob(job!.id);
  await api("publish", { jobId: job!.id, replace: false }, s.admin);
  await api(
    "configureMetrics",
    {
      cutId: "paginas",
      courseId: "solo-a",
      versionId: job!.id,
      expected: null,
      activities: ["A"],
      teachers: null,
      reason: "Paginación sintética",
    },
    s.admin,
  );
  const request = {
    cutId: "paginas",
    filters: { courseId: "solo-a" },
    view: "estudiante",
    section: "details",
  };
  const first = dashboardSchema.parse(await api("dashboard", request, s.a));
  const manifestIndex = (
    await stores().db.doc(`metricSnapshots/${first.snapshotId}`).get()
  ).data()!;
  expect(manifestIndex).not.toHaveProperty("entries");
  expect(manifestIndex.path).toBe(`metricSnapshots/${first.snapshotId}.json`);
  expect(first.details).toHaveLength(25);
  expect(first.total).toBe(26);
  expect(first.counts).toEqual({ N: 26, G: 0, V: 0, E: 0, Z: 1, D: 26 });
  const second = dashboardSchema.parse(
    await api(
      "dashboard",
      { ...request, snapshotId: first.snapshotId, offset: first.next },
      s.a,
    ),
  );
  expect(second.details).toHaveLength(1);
  expect(second.next).toBeNull();
  expect(
    new Set([...first.details, ...second.details].map((d) => d.identity)).size,
  ).toBe(26);
  expect(second.counts).toEqual(first.counts);
  const output = (await api(
    "exportDashboard",
    { ...request, snapshotId: first.snapshotId },
    s.a,
  )) as { csv: string };
  expect(
    output.csv.split("\r\n").filter((r) => r.startsWith('"observacion"')),
  ).toHaveLength(26);
  const env = await initializeTestEnvironment({
    projectId: "demo-seguimiento-ci",
    firestore: { host: "127.0.0.1", port: 8080 },
    storage: { host: "127.0.0.1", port: 9199 },
  });
  try {
    for (const uid of [people.a, people.b, people.admin])
      await assertFails(
        env
          .authenticatedContext(uid)
          .storage("gs://demo-seguimiento-ci.appspot.com")
          .ref(manifestIndex.path)
          .getMetadata(),
      );
    for (const collection of [
      "metricSnapshots",
      "activitySelectionHistory",
      "cuts/paginas/activitySelections",
    ]) {
      await assertFails(
        env
          .authenticatedContext(people.a)
          .firestore()
          .collection(collection)
          .get(),
      );
      await assertFails(
        env
          .authenticatedContext(people.admin)
          .firestore()
          .collection(collection)
          .doc("inyectado")
          .set({ role: "admin" }),
      );
    }
  } finally {
    await env.cleanup();
  }
  const rows = stores().db.collection(
    `jobs/${job!.id}/attempts/${staged.token}/rows`,
  );
  const original = (await rows.limit(1).get()).docs[0]!.data();
  await rows.doc("duplicado-sintetico").set(original);
  await expect(api("dashboard", request, s.a)).rejects.toThrow(
    "FAILED_PRECONDITION",
  );
  await rows.doc("duplicado-sintetico").delete();
  await api(
    "assignMember",
    {
      uid: people.a,
      member: { role: "coordinator", active: true, careers: ["arq-plan-1"] },
    },
    s.admin,
  );
  await expect(
    api("exportDashboard", { ...request, snapshotId: first.snapshotId }, s.a),
  ).rejects.toThrow("PERMISSION_DENIED");
}, 60000);
