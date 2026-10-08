import { HttpsError } from "firebase-functions/v2/https";
import { operationSchemas } from "../../src/domain/import-contract";
import { validateAcademicPackage } from "../../src/importing/decisions";
import {
  admin,
  bucket,
  canonical,
  courseAccess,
  db,
  hash,
  jsonFile,
  membership,
  saveImmutable,
} from "./store";
import {
  authorizeJob,
  getJob,
  jobView,
  pointerRef,
  sourceJobId,
  type Artifact,
  type Course,
  type Cut,
  type Cycle,
  type Job,
} from "./jobs";

const conflict = () =>
  new HttpsError(
    "failed-precondition",
    "Actualiza y revisa la propuesta; las fuentes o el corte cambiaron.",
  );

export async function correctionOperation(
  op: "reviseAcademicDecision" | "refreshCutSources" | "revalidate",
  raw: unknown,
  actor: string,
) {
  const member = await membership(actor);
  if (op === "refreshCutSources") {
    admin(member);
    const input = operationSchemas.refreshCutSources.parse(raw);
    await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const ref = db.doc(`cuts/${input.cutId}`);
      const cut = (await tx.get(ref)).data() as Cut | undefined;
      if (
        !cut ||
        cut.status !== "open" ||
        canonical(cut.sources) !== canonical(input.expectedSources)
      )
        throw conflict();
      const cycle = (
        await tx.get(db.doc(`cycles/${cut.cycleId}`))
      ).data() as Cycle;
      const published = await tx.get(ref.collection("courses").limit(1));
      // Un corte con resultados requiere una revisión histórica; no mezclar fuentes.
      if (!published.empty)
        throw new HttpsError(
          "failed-precondition",
          "El corte ya tiene resultados. Crea una revisión atribuible del corte.",
        );
      if (canonical(cycle.sources) === canonical(cut.sources)) return;
      tx.create(db.collection("sourceRefreshAudit").doc(), {
        cutId: cut.id,
        previous: cut.sources,
        sources: cycle.sources,
        actor,
        reason: input.reason,
        createdAt: Date.now(),
      });
      tx.update(ref, { sources: cycle.sources, dates: cycle.dates });
    });
    return { ok: true };
  }
  if (op === "reviseAcademicDecision") {
    admin(member);
    const input = operationSchemas.reviseAcademicDecision.parse(raw);
    const old = await getJob(input.jobId);
    if (old.kind !== "academicPackage" || !old.artifact) throw conflict();
    const artifact = await jsonFile<Artifact>(old.artifact);
    const p = validateAcademicPackage(artifact.data, old.cycleId);
    const revised = validateAcademicPackage(
      {
        ...p,
        revisionOf: old.id,
        reason: input.decision.reason,
        decisions: [
          ...p.decisions.filter(
            (d) => d.enrollmentId !== input.decision.enrollmentId,
          ),
          input.decision,
        ],
      },
      old.cycleId,
    );
    const bytes = Buffer.from(canonical(revised));
    const file = {
      name: "decisiones-revisadas.json",
      bytes: bytes.length,
      sha256: hash(bytes),
      mapping: {},
    };
    if (file.bytes > 8 * 1024 * 1024) throw conflict();
    const id = sourceJobId(old.cycleId, old.kind, file);
    await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const cycle = (
        await tx.get(db.doc(`cycles/${old.cycleId}`))
      ).data() as Cycle;
      const ref = db.doc(`jobs/${id}`);
      if ((await tx.get(ref)).exists) return;
      const parent = (await tx.get(db.doc(`jobs/${old.id}`))).data() as Job;
      const current = cycle.sources.academicPackage ?? null;
      // Una revisión hereda la base que realmente leyó. No hacer pasar una
      // fotografía antigua por una revisión de la fuente vigente.
      if (
        parent.artifact !== old.artifact ||
        (parent.status === "published"
          ? current !== parent.id
          : current !== parent.expected)
      )
        throw conflict();
      await saveImmutable(`originals/${id}/source`, bytes, "application/json");
      const job: Job = {
        ...old,
        id,
        file,
        uid: actor,
        status: "queued",
        attempt: 0,
        lease: 0,
        token: null,
        artifact: null,
        error: null,
        blocking: false,
        createdAt: Date.now(),
        expected: current,
      };
      tx.create(ref, job);
      tx.create(db.doc(`decisionRevisionAudit/${id}`), {
        previous: old.id,
        version: id,
        actor,
        decision: input.decision,
        createdAt: Date.now(),
      });
    });
    return jobView(await getJob(id));
  }
  const input = operationSchemas.revalidate.parse(raw);
  const old = await getJob(input.jobId);
  await authorizeJob(member, old);
  if (old.kind !== "report") throw conflict();
  const [bytes] = await bucket().file(`originals/${old.id}/source`).download();
  // El original y las resoluciones mantienen su autor. Revalidar no concede facultades administrativas.
  const id = await db.runTransaction(async (tx) => {
    const current = await membership(actor, tx);
    const cut = (await tx.get(db.doc(`cuts/${old.cutId}`))).data() as Cut;
    const course = (
      await tx.get(db.doc(`courses/${old.courseId}`))
    ).data() as Course;
    courseAccess(current, course);
    if (cut.status !== "open") throw conflict();
    const expected = (await tx.get(pointerRef(cut.id, course.id))).data()
      ?.versionId as string | undefined;
    const freshJob = (await tx.get(db.doc(`jobs/${old.id}`))).data() as Job;
    if (freshJob.status === "published" && expected !== old.id)
      throw conflict();
    const id = hash(
      canonical({
        progressId: cut.progress?.id ?? null,
        revalidationOf: old.id,
        sources: cut.sources,
        expected: expected ?? null,
      }),
    );
    const ref = db.doc(`jobs/${id}`);
    if ((await tx.get(ref)).exists) return id;
    const carry = cut.carryCutId
      ? ((await tx.get(pointerRef(cut.carryCutId, course.id))).data()
          ?.versionId as string | undefined)
      : undefined;
    await saveImmutable(
      `originals/${id}/source`,
      bytes,
      "application/octet-stream",
    );
    tx.create(ref, {
      ...old,
      id,
      sources: cut.sources,
      cumulative: !!cut.sources.academicPackage,
      progressId: cut.progress?.id ?? null,
      carryVersion: expected ?? carry ?? null,
      revalidationOf: old.id,
      revalidatedBy: actor,
      status: "queued",
      attempt: 0,
      lease: 0,
      token: null,
      artifact: null,
      error: null,
      blocking: false,
      createdAt: Date.now(),
      expected: expected ?? null,
    });
    return id;
  });
  return jobView(await getJob(id));
}
