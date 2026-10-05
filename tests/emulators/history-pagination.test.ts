import { it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  seedBase,
  api,
  batch,
  waitJob,
  stores,
  people,
} from "../fixtures/synthetic/stage03";
import { comparisonSchema } from "../../src/domain/history-contract";

it("pagina el universo común de curso compartido, exporta completo y protege manifiestos", async () => {
  const s = await seedBase();
  const activities = Array.from({ length: 26 }, (_, i) => `Actividad-${i}`);
  const mapping = {
    identity: { header: "Correo" },
    columns: activities.map((activityId) => ({
      selector: { header: activityId },
      kind: "activity",
      activityId,
    })),
  };
  for (const id of ["hist-a", "hist-b"]) {
    await api(
      "createCut",
      {
        cycleId: "27-1",
        id,
        date: id === "hist-a" ? "2026-09-21" : "2026-10-12",
      },
      s.admin,
    );
    const content = [
      "Correo," + activities.join(","),
      "000SINT01@example.invalid," +
        activities.map(() => (id === "hist-a" ? "-" : "0")).join(","),
      "000SINT02@example.invalid," + activities.map(() => "8").join(","),
    ].join("\n");
    const [job] = await batch(
      s.admin,
      [
        {
          name: "1 Curso compartido 27-1.csv",
          courseId: "compartido",
          mapping,
          content,
        },
      ],
      id,
    );
    await waitJob(job!.id);
    await api("publish", { jobId: job!.id, replace: false }, s.admin);
    await api(
      "configureMetrics",
      {
        cutId: id,
        courseId: "compartido",
        versionId: job!.id,
        activities,
        expected: null,
        teachers: null,
        reason: "26 actividades sintéticas",
      },
      s.admin,
    );
    await api("closeCut", { cutId: id }, s.admin);
  }
  const pair = { beforeCut: "hist-a", afterCut: "hist-b" };
  const request = { ...pair, filters: {} };
  const unmapped = comparisonSchema.parse(
    await api("compareCuts", { ...request, section: "changes" }, s.a),
  );
  expect(unmapped.mappingId).toBeNull();
  expect(unmapped.next).toBe(25);
  const configured = (await api(
    "configureComparison",
    {
      ...pair,
      expected: null,
      reason: "Equivalencia revisada individualmente",
      pairs: activities.map((activity) => ({
        courseId: "compartido",
        before: activity,
        after: activity,
      })),
    },
    s.admin,
  )) as { id: string };
  // A second (administrative) session created a mapping after the first query.
  const pinned = { ...request, mappingId: unmapped.mappingId };
  const oldPage = comparisonSchema.parse(
    await api(
      "compareCuts",
      { ...pinned, section: "changes", offset: unmapped.next },
      s.a,
    ),
  );
  expect(oldPage.mappingId).toBeNull();
  expect(oldPage.before.D).toBe(0);
  expect(oldPage.total).toBe(unmapped.total);
  expect(oldPage.changes).toHaveLength(25);
  const oldExport = (await api("exportComparison", pinned, s.a)) as {
    csv: string;
  };
  expect(oldExport.csv).toContain('"Universo común","0"');
  expect(oldExport.csv).toContain("Sin correspondencia aprobada");
  expect(oldExport.csv).not.toContain(configured.id);
  expect(oldExport.csv.toLowerCase()).not.toContain('"000sint01","compartido"');
  for (const session of [s.a, s.b]) {
    const first = comparisonSchema.parse(
      await api("compareCuts", request, session),
    );
    expect(first.common).toHaveLength(25);
    expect(first.before.D).toBe(26);
    expect(first.next).toBe(25);
    const second = comparisonSchema.parse(
      await api(
        "compareCuts",
        { ...request, mappingId: first.mappingId, offset: first.next },
        session,
      ),
    );
    expect(second.common).toHaveLength(1);
    expect(second.next).toBeNull();
    expect(second.before).toEqual(first.before);
    expect(
      new Set([...first.common, ...second.common].map((r) => r.beforeActivity))
        .size,
    ).toBe(26);
    const exported = (await api(
      "exportComparison",
      { ...request, mappingId: first.mappingId },
      session,
    )) as { csv: string };
    const own = session === s.a ? "000SINT01" : "000SINT02",
      other = session === s.a ? "000SINT02" : "000SINT01";
    expect(
      exported.csv
        .split("\r\n")
        .filter((row) =>
          row.toLowerCase().startsWith(`"${own.toLowerCase()}","compartido"`),
        ),
    ).toHaveLength(26);
    expect(exported.csv.toLowerCase()).not.toContain(other.toLowerCase());
  }
  // A revised mapping cannot change a page/export pinned to the reviewed version.
  await api(
    "configureComparison",
    {
      ...pair,
      expected: configured.id,
      reason: "Revisión explícita de correspondencia",
      pairs: [
        { courseId: "compartido", before: activities[0], after: activities[0] },
      ],
    },
    s.admin,
  );
  expect(
    comparisonSchema.parse(
      await api("compareCuts", { ...request, mappingId: configured.id }, s.a),
    ).universe,
  ).toBe(26);
  expect(
    comparisonSchema.parse(await api("compareCuts", request, s.a)).universe,
  ).toBe(1);
  const previousExport = (await api(
    "exportComparison",
    { ...request, mappingId: configured.id },
    s.a,
  )) as { csv: string };
  expect(
    previousExport.csv
      .toLowerCase()
      .split("\r\n")
      .filter((row) => row.startsWith('"000sint01","compartido"')),
  ).toHaveLength(26);
  const cut = (await stores().db.doc("cuts/hist-a").get()).data()!;
  const env = await initializeTestEnvironment({
    projectId: "demo-seguimiento-ci",
    firestore: { host: "127.0.0.1", port: 8080 },
    storage: { host: "127.0.0.1", port: 9199 },
  });
  try {
    for (const uid of [people.admin, people.a, people.b]) {
      await assertFails(
        env
          .authenticatedContext(uid)
          .storage("gs://demo-seguimiento-ci.appspot.com")
          .ref(cut.closurePath)
          .getMetadata(),
      );
      for (const collection of [
        "comparisonMappings",
        "comparisonPointers",
        "followUps",
        "followUpRevisions",
        "calendarAudit",
      ]) {
        await assertFails(
          env
            .authenticatedContext(uid)
            .firestore()
            .collection(collection)
            .get(),
        );
        await assertFails(
          env
            .authenticatedContext(uid)
            .firestore()
            .collection(collection)
            .doc("inyectado")
            .set({ role: "admin" }),
        );
      }
    }
  } finally {
    await env.cleanup();
  }
}, 60000);
