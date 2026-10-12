import { api, project, sha } from "./cloud-test-session.mjs";
import { client, actor } from "./cloud-operator-session.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
const cutId = `cloud-recovery-${Date.now()}`;
const evidence = {
  cutId,
  project,
  sha,
  startedAt: new Date().toISOString(),
  method:
    "Inyección controlada de estado processing/lease vencido en un trabajo sintético no publicado; no equivale a matar un contenedor",
};
try {
  await api("createCut", {
    id: cutId,
    cycleId: "27-1",
    progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 },
  });
  const content =
    "Dirección Email,Tarea:Actividad | Unidad 1 (Real)\n000EJE@example.invalid,5";
  const bytes = Buffer.from(content),
    files = [
      { name: "777 Curso Multimodal 27-1.csv", bytes },
      {
        name: "777 Curso Multimodal 27-1.ods",
        bytes: Buffer.from("INVALIDO SINTETICO"),
      },
      {
        name: "777 Curso Multimodal 27-1.csv",
        bytes: Buffer.from(content + "\n000EJE@example.invalid,5"),
      },
    ];
  const descriptors = files.map((f) => ({
    name: f.name,
    bytes: f.bytes.length,
    sha256: createHash("sha256").update(f.bytes).digest("hex"),
    courseId: "cloud-mix",
    mapping: { profile: "moodle-institutional-v1" },
  }));
  const batch = await api("createBatch", { cutId, files: descriptors }, "a");
  const wait = async (id, status) => {
    const end = Date.now() + 180000;
    while (Date.now() < end) {
      const p = await api(
        "preview",
        { jobId: id, careerId: "laf-plan-1" },
        "a",
      );
      if (p.job.status === status) return p;
      if (["failed", "invalid"].includes(p.job.status) && status === "ready")
        throw new Error(p.job.status);
      await delay(1000);
    }
    throw new Error("Worker timeout");
  };
  await Promise.all(
    batch.jobs.map((j, i) =>
      api(
        "upload",
        { jobId: j.id, base64: files[i].bytes.toString("base64") },
        "a",
      ),
    ),
  );
  const first = await wait(batch.jobs[0].id, "ready");
  await wait(batch.jobs[1].id, "invalid");
  const dup = await wait(batch.jobs[2].id, "ready");
  assert(dup.blocking);
  for (const job of batch.jobs.slice(1))
    await assert.rejects(
      api("publish", { jobId: job.id, replace: false }, "a"),
      /FAILED_PRECONDITION/,
    );
  const rest = client("https://firestore.googleapis.com"),
    base = `projects/${project}/databases/(default)/documents`;
  const jobName = `${base}/jobs/${first.job.id}`;
  const stored = (await rest.get(`/v1/${jobName}`)).body;
  assert.equal(stored.fields.cutId.stringValue, cutId);
  assert.equal(stored.fields.status.stringValue, "ready");
  const cut = (await rest.get(`/v1/${base}/cuts/${cutId}`)).body;
  assert.equal(cut.fields.status.stringValue, "open");
  const token = "synthetic-interrupted";
  const str = (stringValue) => ({ stringValue });
  await rest.post(`/v1/${base}:commit`, {
    writes: [
      {
        update: {
          name: jobName,
          fields: {
            status: str("processing"),
            token: str(token),
            lease: { integerValue: "0" },
            artifact: { nullValue: null },
          },
        },
        updateMask: { fieldPaths: ["status", "token", "lease", "artifact"] },
        currentDocument: { updateTime: stored.updateTime },
      },
      {
        update: {
          name: `${jobName}/attempts/${token}/rows/000002`,
          fields: { identity: str("NO_PUBLICAR"), careerId: str("laf-plan-1") },
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${base}/cloudTestFaults/${first.job.id}`,
          fields: {
            project: str(project),
            cutId: str(cutId),
            sha: str(sha),
            actor: str(actor),
            reason: str(
              "Prueba sintética controlada: interrupción antes de publicar",
            ),
            originalToken: stored.fields.token,
          },
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
        ],
      },
    ],
  });
  assert(
    !JSON.stringify(
      await api(
        "preview",
        { jobId: first.job.id, careerId: "laf-plan-1" },
        "a",
      ),
    ).includes("NO_PUBLICAR"),
  );
  await api("retry", { jobId: first.job.id }, "a");
  const recovered = await wait(first.job.id, "ready");
  assert.equal(recovered.job.attempt, first.job.attempt + 1);
  assert(!JSON.stringify(recovered).includes("NO_PUBLICAR"));
  await api("publish", { jobId: first.job.id, replace: false }, "a");
  const query = { cutId, filters: {}, view: "institucion", section: "details" };
  const result = await api("dashboard", query);
  assert.equal(result.counts.N, 1);
  assert.equal(result.counts.D, 1);
  await api("retry", { jobId: first.job.id }, "a");
  await api("publish", { jobId: first.job.id, replace: true }, "a");
  assert.deepEqual((await api("dashboard", query)).counts, result.counts);
  evidence.status = "success";
  evidence.results = {
    jobs: batch.jobs.map((j) => j.id),
    invalidRejected: true,
    duplicateBlocked: true,
    attemptBefore: first.job.attempt,
    attemptAfter: recovered.job.attempt,
    counts: result.counts,
    partialRowsNotPublished: true,
  };
} catch (e) {
  evidence.status = "failure";
  evidence.error = e.message;
  process.exitCode = 1;
}
evidence.completedAt = new Date().toISOString();
writeFileSync(`private/${cutId}.json`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
