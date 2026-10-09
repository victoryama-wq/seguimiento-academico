import { api, project, sha } from "./cloud-test-session.mjs";
import { client } from "./cloud-operator-session.mjs";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
const cutId = `cloud-close-race-${Date.now()}`,
  out = { project, sha, cutId, startedAt: new Date().toISOString() };
try {
  await api("createCut", {
    id: cutId,
    cycleId: "27-1",
    progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 },
  });
  async function report(value) {
    const bytes = Buffer.from(
      `Dirección Email,Tarea:Actividad | Unidad 1 (Real)\n000EJE@example.invalid,${value}`,
    );
    const batch = await api(
      "createBatch",
      {
        cutId,
        files: [
          {
            name: "777 Curso Multimodal 27-1.csv",
            courseId: "cloud-mix",
            bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            mapping: { profile: "moodle-institutional-v1" },
          },
        ],
      },
      "a",
    );
    const id = batch.jobs[0].id;
    await api("upload", { jobId: id, base64: bytes.toString("base64") }, "a");
    for (let n = 0; n < 180; n++) {
      const p = await api(
        "preview",
        { jobId: id, careerId: "laf-plan-1" },
        "a",
      );
      if (p.job.status === "ready") return id;
      if (["failed", "invalid"].includes(p.job.status))
        throw new Error(p.job.status);
      await delay(1000);
    }
    throw new Error("Timeout worker");
  }
  const first = await report("5");
  await api("publish", { jobId: first, replace: false }, "a");
  const second = await report("0");
  const cut = (await api("overview", {})).cuts.find((c) => c.id === cutId);
  const results = await Promise.allSettled([
    api("closeCut", { cutId }),
    api("publish", { jobId: second, replace: true }, "a"),
    api("configureProgress", {
      cutId,
      expected: cut.progress.id,
      progress: { schoolCut: 1, executiveUnit: 4, virtualUnit: 2 },
      reason: "Carrera sintética con cierre",
    }),
  ]);
  for (const r of results)
    if (r.status === "rejected")
      assert.match(String(r.reason), /ABORTED|FAILED_PRECONDITION/);
  await api("closeCut", { cutId });
  const query = { cutId, filters: {}, view: "institucion", section: "details" };
  const frozen = await api("dashboard", query);
  assert.equal(frozen.counts.D, 1);
  assert.equal(frozen.counts.N, 1);
  assert.equal(frozen.closed, true);
  const rest = client("https://firestore.googleapis.com"),
    base = `/v1/projects/${project}/databases/(default)/documents`;
  const stored = (await rest.get(`${base}/cuts/${cutId}`)).body;
  const pointer = (await rest.get(`${base}/cuts/${cutId}/courses/cloud-mix`))
    .body;
  const closure = stored.fields.closurePath.stringValue;
  const data = (
    await client("https://storage.googleapis.com").get(
      `/storage/v1/b/${project}.firebasestorage.app/o/${encodeURIComponent(closure)}?alt=media`,
    )
  ).body;
  const payload = typeof data === "string" ? JSON.parse(data) : data;
  assert.equal(
    payload.snapshot.entries.find((e) => e.course.id === "cloud-mix").job.id,
    pointer.fields.versionId.stringValue,
  );
  assert.equal(
    payload.snapshot.cut.progress.id,
    stored.fields.progress.mapValue.fields.id.stringValue,
  );
  await assert.rejects(
    api("publish", { jobId: second, replace: true }, "a"),
    /FAILED_PRECONDITION/,
  );
  assert.deepEqual((await api("dashboard", query)).counts, frozen.counts);
  out.status = "success";
  out.counts = frozen.counts;
  out.results = results.map((r) => ({
    status: r.status,
    ...(r.status === "rejected" ? { error: String(r.reason) } : {}),
  }));
  out.closureAndPointersConsistent = true;
} catch (e) {
  out.status = "failure";
  out.error = e.message;
  process.exitCode = 1;
}
out.completedAt = new Date().toISOString();
writeFileSync(
  "private/cloud-close-race-evidence.json",
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify(out));
