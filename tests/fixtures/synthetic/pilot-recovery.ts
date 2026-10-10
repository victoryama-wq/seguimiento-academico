import { expect } from "vitest";
import { createHash } from "node:crypto";
import { api, stores, waitJob } from "./stage03";
import { pilotActivities, pilotCourses, pilotFile } from "./stage06";

/** Fault injection only through the privileged, demo-guarded test SDK. */
export async function pilotRecovery(
  admin: string,
  cutId: string,
  originalVersion: string,
) {
  const courses = pilotCourses(45);
  const replacementA = pilotFile(courses[0]!, 1);
  const replacementB = pilotFile(courses[0]!, 2);
  const invalid = pilotFile(courses[1]!);
  invalid.bytes = Buffer.from("No es un libro valido");
  invalid.descriptor.bytes = invalid.bytes.length;
  invalid.descriptor.sha256 = createHash("sha256")
    .update(invalid.bytes)
    .digest("hex");
  const duplicate = pilotFile(courses[2]!, 0, true);
  const files = [replacementA, replacementB, invalid, duplicate].map((f) => ({
    ...f,
    descriptor: {
      ...f.descriptor,
      name: f.descriptor.name.replace("27-1", "27-6"),
    },
  }));
  const input = { cutId, files: files.map((f) => f.descriptor) };
  const created = (await api("createBatch", input, admin)) as {
    jobs: { id: string }[];
  };
  const [a, b, bad, dup] = created.jobs.map((j) => j.id) as [
    string,
    string,
    string,
    string,
  ];
  const { bucket, db } = stores();
  const before = (
    await bucket.file(`originals/${originalVersion}/source`).download()
  )[0];
  // Simulates termination after receipt and one row, before publishing an attempt.
  // It does not claim an OS process kill or a cloud outage.
  await bucket
    .file(`originals/${a}/source`)
    .save(files[0]!.bytes, { resumable: false });
  await db
    .doc(`jobs/${a}/attempts/interrumpido/rows/000002`)
    .set({ identity: "NO_PUBLICAR", careerId: "laf-plan-1" });
  await db
    .doc(`jobs/${a}`)
    .update({
      status: "processing",
      token: "interrumpido",
      attempt: 1,
      lease: 0,
    });
  expect(
    JSON.stringify(await api("preview", { jobId: a }, admin)),
  ).not.toContain("NO_PUBLICAR");
  await Promise.all(
    created.jobs
      .slice(1)
      .map((job, i) =>
        api(
          "upload",
          { jobId: job.id, base64: files[i + 1]!.bytes.toString("base64") },
          admin,
        ),
      ),
  );
  await api("retry", { jobId: a }, admin);
  const recovered = await waitJob(a);
  expect(recovered.attempt).toBe(2);
  expect(recovered.token).not.toBe("interrumpido");
  await waitJob(b);
  await waitJob(bad, "invalid");
  const duplicateJob = await waitJob(dup);
  expect(duplicateJob.blocking).toBe(true);
  for (const jobId of [bad, dup])
    await expect(
      api("publish", { jobId, replace: true }, admin),
    ).rejects.toThrow(/FAILED_PRECONDITION/);
  const outcome = await Promise.allSettled(
    [a, b].map((jobId) => api("publish", { jobId, replace: true }, admin)),
  );
  expect(outcome.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    outcome.filter((r) => r.status === "rejected").map((r) => String(r.reason)),
  ).toEqual([expect.stringContaining("ABORTED")]);
  const pointer = (
    await db.doc(`cuts/${cutId}/courses/piloto-1`).get()
  ).data()!;
  const selection = (
    await db.doc(`cuts/${cutId}/activitySelections/piloto-1`).get()
  ).data()!;
  await api(
    "configureMetrics",
    {
      cutId,
      courseId: "piloto-1",
      versionId: pointer.versionId,
      expected: selection.id,
      activities: pilotActivities,
      teachers: null,
      reason: "Revisión sintética de sustitución concurrente",
    },
    admin,
  );
  await Promise.all([
    api("publish", { jobId: pointer.versionId, replace: true }, admin),
    api("retry", { jobId: pointer.versionId }, admin),
  ]);
  expect((await db.doc(`cuts/${cutId}/courses/piloto-1`).get()).data()).toEqual(
    pointer,
  );
  expect(pointer.revision).toBe(2);
  expect(
    (
      await bucket.file(`originals/${originalVersion}/source`).download()
    )[0].equals(before),
  ).toBe(true);
  expect((await db.doc(`jobs/${originalVersion}`).get()).data()!.status).toBe(
    "published",
  );
  const replay = (await api("createBatch", input, admin)) as {
    jobs: { id: string }[];
  };
  expect(replay.jobs.map((j) => j.id)).toEqual(created.jobs.map((j) => j.id));
  return {
    extraJobs: 4,
    recoveredAttempt: 2,
    conflictingPublications: "one winner, one ABORTED",
    invalid: 1,
    duplicateBlocked: 1,
    originalPreserved: true,
  };
}
