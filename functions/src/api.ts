import { progressSchema } from "../../src/domain/report-policy";
import { FieldPath } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { correctionOperation } from "./corrections";
import { closeHistoricalCut, historyOperation } from "./history";
import { historyOperations } from "../../src/domain/history-contract";
import { dashboard, configureMetrics } from "./metrics";
import { academicPackageSchema } from "../../src/domain/decision-package";
import {
  operationSchemas,
  type Operation,
} from "../../src/domain/import-contract";
import {
  admin,
  auth,
  bucket,
  canonical,
  career,
  courseAccess,
  db,
  denied,
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
  previewJob,
  rowsPage,
  sourceJobId,
  type Course,
  type Cut,
  type Cycle,
  type Job,
  type Artifact,
} from "./jobs";

const missing = () => new HttpsError("not-found", "Recurso no disponible.");
const closed = () =>
  new HttpsError("failed-precondition", "El corte está cerrado.");
export async function academicOperation(
  op: Operation,
  raw: unknown,
  uid: string | undefined,
): Promise<unknown> {
  const member = await membership(uid);
  const actor = uid!;
  if (op in historyOperations)
    return historyOperation(op as keyof typeof historyOperations, raw, actor);
  switch (op) {
    case "reviseAcademicDecision":
    case "refreshCutSources":
    case "revalidate":
      return correctionOperation(op, raw, actor);
    case "dashboard":
      return dashboard(raw, actor, false);
    case "exportDashboard":
      return dashboard(raw, actor, true);
    case "configureMetrics":
      return configureMetrics(raw, actor);
    case "overview": {
      operationSchemas.overview.parse(raw);
      const [cycles, cuts, courses] = await Promise.all([
        db.collection("cycles").limit(100).get(),
        db.collection("cuts").limit(100).get(),
        db.collection("courses").limit(500).get(),
      ]);
      return {
        member,
        cycles: cycles.docs.map((d) => ({ id: d.id })),
        cuts: cuts.docs.map((d) => {
          const v = d.data() as Cut;
          return {
            id: d.id,
            cycleId: v.cycleId,
            date: v.date,
            status: v.status,
            sources: v.sources,
            ...(v.progress ? { progress: v.progress } : {}),
          };
        }),
        courses: courses.docs
          .map((d) => d.data() as Course)
          .filter(
            (v) =>
              member.role === "admin" ||
              v.careers.some((id) => member.careers.includes(id)),
          )
          .map((v) => ({
            ...v,
            careers:
              member.role === "admin"
                ? v.careers
                : v.careers.filter((id) => member.careers.includes(id)),
          })),
      };
    }
    case "assignMember": {
      admin(member);
      const input = operationSchemas.assignMember.parse(raw);
      if (input.uid === actor)
        throw new HttpsError(
          "failed-precondition",
          "No modifiques tu propia membresía.",
        );
      await auth.getUser(input.uid);
      await db.runTransaction(async (tx) => {
        admin(await membership(actor, tx));
        tx.set(db.doc(`memberships/${input.uid}`), input.member);
        tx.create(db.collection("accessAudit").doc(), {
          uid: input.uid,
          member: input.member,
          approvedBy: actor,
          createdAt: Date.now(),
        });
      });
      return { ok: true };
    }
    case "createCycle": {
      admin(member);
      const input = operationSchemas.createCycle.parse(raw);
      if (!/^\d{2}-\d+$/.test(input.id) || !Object.keys(input.dates).length)
        throw new HttpsError(
          "invalid-argument",
          "Ciclo o calendario inválido.",
        );
      await db.runTransaction(async (tx) => {
        admin(await membership(actor, tx));
        tx.create(db.doc(`cycles/${input.id}`), {
          ...input,
          sources: {},
          createdBy: actor,
        });
      });
      return { ok: true };
    }
    case "createCourse": {
      admin(member);
      const input = operationSchemas.createCourse.parse(raw);
      await db.runTransaction(async (tx) => {
        admin(await membership(actor, tx));
        if (!(await tx.get(db.doc(`cycles/${input.cycleId}`))).exists)
          throw missing();
        tx.create(
          db.doc(
            `courseExternalIds/${hash(`${input.cycleId}:${input.externalId}`)}`,
          ),
          { courseId: input.id },
        );
        tx.create(db.doc(`courses/${input.id}`), input);
      });
      return { ok: true };
    }
    case "configureProgress": {
      admin(member);
      const input = operationSchemas.configureProgress.parse(raw);
      await db.runTransaction(async (tx) => {
        admin(await membership(actor, tx));
        const ref = db.doc(`cuts/${input.cutId}`);
        const cut = (await tx.get(ref)).data() as Cut | undefined;
        if (!cut || cut.status !== "open" || !cut.progress)
          throw new HttpsError(
            "failed-precondition",
            "Requiere un corte abierto con política explícita; conserva la política de los cortes históricos.",
          );
        if (cut.progress.id !== input.expected)
          throw new HttpsError(
            "aborted",
            "El avance cambió. Actualiza y revisa la configuración.",
          );
        const id = hash(canonical(input));
        const progress = progressSchema.parse({
          ...input.progress,
          id,
          policy: "explicit-progress-v1",
          actor,
          recordedAt: Date.now(),
          previous: input.expected,
          reason: input.reason,
        });
        tx.create(db.doc(`progressHistory/${id}`), {
          ...progress,
          cutId: cut.id,
        });
        tx.update(ref, { progress });
      });
      return { ok: true };
    }
    case "createCut": {
      admin(member);
      const input = operationSchemas.createCut.parse(raw);
      await db.runTransaction(async (tx) => {
        admin(await membership(actor, tx));
        const cycle = (
          await tx.get(db.doc(`cycles/${input.cycleId}`))
        ).data() as Cycle | undefined;
        if (
          !cycle ||
          (!cycle.sources.academicPackage &&
            (!cycle.sources.roster || !cycle.sources.catalog))
        )
          throw new HttpsError(
            "failed-precondition",
            "Publica padrón y catálogo antes del corte.",
          );
        if (cycle.sources.academicPackage) {
          const source = (
            await tx.get(db.doc(`sources/${cycle.sources.academicPackage}`))
          ).data()!;
          const artifact = await jsonFile<Artifact>(String(source.artifact));
          if (
            academicPackageSchema.parse(artifact.data).schedule.tracking &&
            input.schoolCut === undefined &&
            !input.progress
          )
            throw new HttpsError(
              "failed-precondition",
              "Indica el número de corte escolarizado (1, 2 o 3) para el seguimiento por modalidad.",
            );
        }
        if (input.carryCutId) {
          const carry = (
            await tx.get(db.doc(`cuts/${input.carryCutId}`))
          ).data() as Cut | undefined;
          if (
            !carry ||
            carry.status !== "closed" ||
            carry.cycleId !== input.cycleId ||
            !cycle.sources.academicPackage
          )
            throw new HttpsError(
              "failed-precondition",
              "La acumulación requiere un corte cerrado del mismo ciclo y el perfil aprobado.",
            );
        }
        if (input.parentId) {
          const parent = (
            await tx.get(db.doc(`cuts/${input.parentId}`))
          ).data() as Cut | undefined;
          if (
            !parent ||
            parent.status !== "closed" ||
            parent.cycleId !== input.cycleId ||
            !input.reason
          )
            throw new HttpsError(
              "failed-precondition",
              "La revisión requiere corte cerrado del mismo ciclo y motivo.",
            );
        } else if (input.reason)
          throw new HttpsError(
            "invalid-argument",
            "El motivo requiere corte de origen.",
          );
        const date =
          input.date ??
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Cancun",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date());
        const progress = input.progress
          ? progressSchema.parse({
              ...input.progress,
              id: hash(
                canonical({ cutId: input.id, progress: input.progress }),
              ),
              policy: "explicit-progress-v1",
              actor,
              recordedAt: Date.now(),
              previous: null,
              reason: "Selección inicial explícita",
            })
          : undefined;
        if (progress)
          tx.create(db.doc(`progressHistory/${progress.id}`), {
            ...progress,
            cutId: input.id,
          });
        tx.create(db.doc(`cuts/${input.id}`), {
          ...input,
          date,
          ...(progress ? { progress, academicDate: date } : {}),
          sources: cycle.sources,
          dates: cycle.dates,
          status: "open",
          parentId: input.parentId ?? null,
          reason: input.reason ?? null,
          createdBy: actor,
          createdAt: Date.now(),
        });
      });
      return { ok: true };
    }
    case "closeCut": {
      const input = operationSchemas.closeCut.parse(raw);
      return closeHistoricalCut(input.cutId, actor);
    }
    case "createSource": {
      admin(member);
      const input = operationSchemas.createSource.parse(raw);
      const id = sourceJobId(input.cycleId, input.kind, input.file);
      await db.runTransaction(async (tx) => {
        admin(await membership(actor, tx));
        const cycle = (
          await tx.get(db.doc(`cycles/${input.cycleId}`))
        ).data() as Cycle | undefined;
        if (!cycle) throw missing();
        const ref = db.doc(`jobs/${id}`);
        if ((await tx.get(ref)).exists) return;
        const job: Job = {
          id,
          kind: input.kind,
          cycleId: input.cycleId,
          cutId: null,
          courseId: null,
          file: input.file,
          uid: actor,
          status: "awaiting_upload",
          attempt: 0,
          lease: 0,
          token: null,
          artifact: null,
          createdAt: Date.now(),
          expected: cycle.sources[input.kind] ?? null,
          error: null,
          blocking: false,
        };
        tx.create(ref, job);
      });
      return jobView(await getJob(id));
    }
    case "createBatch": {
      const input = operationSchemas.createBatch.parse(raw);
      if (
        member.role !== "admin" &&
        input.files.some((f) => f.mapping.resolutions || f.filenameResolution)
      )
        denied();
      const ids = await db.runTransaction(async (tx) => {
        const currentMember = await membership(actor, tx);
        if (
          currentMember.role !== "admin" &&
          input.files.some((f) => f.mapping.resolutions || f.filenameResolution)
        )
          denied();
        const cut = (await tx.get(db.doc(`cuts/${input.cutId}`))).data() as
          Cut | undefined;
        if (!cut) throw missing();
        if (cut.status !== "open") throw closed();
        if (
          cut.carryCutId &&
          (await tx.get(db.doc(`cuts/${cut.carryCutId}`))).data()?.status !==
            "closed"
        )
          throw new HttpsError(
            "failed-precondition",
            "Cierra el corte de origen para fijar el acumulado antes de cargar.",
          );
        const jobs: Job[] = [];
        const found = new Set<string>();
        for (const file of input.files) {
          const course = (
            await tx.get(db.doc(`courses/${file.courseId}`))
          ).data() as Course | undefined;
          if (!course || course.cycleId !== cut.cycleId) throw missing();
          courseAccess(currentMember, course);
          if (
            file.filenameResolution &&
            (file.filenameResolution.externalId !== course.externalId ||
              file.filenameResolution.cycle !== cut.cycleId)
          )
            throw new HttpsError(
              "invalid-argument",
              "La resolución debe coincidir con ID y ciclo de la instancia seleccionada.",
            );
          const id = hash(
            canonical({
              cut: cut.id,
              course: course.id,
              sources: cut.sources,
              hash: file.sha256,
              mapping: file.mapping,
              ...(file.filenameResolution
                ? {
                    filename: {
                      original: file.name,
                      decision: file.filenameResolution,
                    },
                  }
                : {}),
            }),
          );
          if (found.has(id)) continue;
          found.add(id);
          const previous = await tx.get(db.doc(`jobs/${id}`));
          const pointer = await tx.get(pointerRef(cut.id, course.id));
          const carry = cut.carryCutId
            ? await tx.get(pointerRef(cut.carryCutId, course.id))
            : null;
          if (previous.exists) continue;
          const { courseId, filenameResolution, ...descriptor } = file;
          jobs.push({
            id,
            kind: "report",
            sources: cut.sources,
            cumulative: !!cut.sources.academicPackage,
            progressId: cut.progress?.id ?? null,
            carryVersion:
              (pointer.data()?.versionId as string | undefined) ??
              (carry?.data()?.versionId as string | undefined) ??
              null,
            cycleId: cut.cycleId,
            cutId: cut.id,
            courseId,
            file: descriptor,
            ...(filenameResolution ? { filenameResolution } : {}),
            uid: actor,
            status: "awaiting_upload",
            attempt: 0,
            lease: 0,
            token: null,
            artifact: null,
            createdAt: Date.now(),
            expected: (pointer.data()?.versionId as string | undefined) ?? null,
            error: null,
            blocking: false,
          });
        }
        for (const job of jobs) tx.create(db.doc(`jobs/${job.id}`), job);
        return input.files.map((file) =>
          hash(
            canonical({
              cut: cut.id,
              course: file.courseId,
              sources: cut.sources,
              hash: file.sha256,
              mapping: file.mapping,
              ...(file.filenameResolution
                ? {
                    filename: {
                      original: file.name,
                      decision: file.filenameResolution,
                    },
                  }
                : {}),
            }),
          ),
        );
      });
      return {
        jobs: await Promise.all(
          ids.map(async (id) => jobView(await getJob(id))),
        ),
      };
    }
    case "upload": {
      const input = operationSchemas.upload.parse(raw);
      const job = await getJob(input.jobId);
      await authorizeJob(member, job);
      const bytes = Buffer.from(input.base64, "base64");
      if (
        bytes.toString("base64") !== input.base64 ||
        bytes.length !== job.file.bytes ||
        hash(bytes) !== job.file.sha256
      )
        throw new HttpsError(
          "invalid-argument",
          "Contenido, tamaño o hash no coincide.",
        );
      if (job.status !== "awaiting_upload") return jobView(job);
      await saveImmutable(
        `originals/${job.id}/source`,
        bytes,
        "application/octet-stream",
      );
      await db.runTransaction(async (tx) => {
        const freshMember = await membership(actor, tx);
        if (job.kind !== "report") admin(freshMember);
        else {
          const course = (
            await tx.get(db.doc(`courses/${job.courseId}`))
          ).data() as Course;
          courseAccess(freshMember, course);
          if (
            (await tx.get(db.doc(`cuts/${job.cutId}`))).data()?.status !==
            "open"
          )
            throw closed();
        }
        const current = (await tx.get(db.doc(`jobs/${job.id}`))).data() as Job;
        if (current.status === "awaiting_upload")
          tx.update(db.doc(`jobs/${job.id}`), {
            status: "queued",
            acceptedAt: Date.now(),
          });
      });
      return jobView(await getJob(job.id));
    }
    case "jobs": {
      const input = operationSchemas.jobs.parse(raw);
      if (!input.cutId) admin(member);
      let query = db
        .collection("jobs")
        .where("cutId", "==", input.cutId ?? null)
        .orderBy(FieldPath.documentId())
        .limit(100);
      if (input.cursor) query = query.startAfter(input.cursor);
      const snap = await query.get();
      const jobs = [];
      for (const doc of snap.docs) {
        const job = doc.data() as Job;
        try {
          await authorizeJob(member, job);
          jobs.push(jobView(job));
        } catch (e) {
          if (!(e instanceof HttpsError) || e.code !== "permission-denied")
            throw e;
        }
      }
      return { jobs, cursor: snap.size === 100 ? snap.docs.at(-1)!.id : null };
    }
    case "preview": {
      const input = operationSchemas.preview.parse(raw);
      const job = await getJob(input.jobId);
      await authorizeJob(member, job);
      return previewJob(
        job,
        member,
        input.careerId,
        input.cursor,
        input.observationOffset,
      );
    }
    case "publishSource": {
      admin(member);
      const input = operationSchemas.publishSource.parse(raw);
      await db.runTransaction(async (tx) => {
        admin(await membership(actor, tx));
        const job = (await tx.get(db.doc(`jobs/${input.jobId}`))).data() as
          Job | undefined;
        if (!job || job.kind === "report") throw missing();
        if (job.status === "published") return;
        if (job.status !== "ready" || job.blocking)
          throw new HttpsError("failed-precondition", "Fuente no validada.");
        if (job.expected && !input.replace)
          throw new HttpsError(
            "failed-precondition",
            "Confirma la sustitución de la fuente anterior.",
          );
        const ref = db.doc(`cycles/${job.cycleId}`);
        const cycle = (await tx.get(ref)).data() as Cycle;
        if ((cycle.sources[job.kind] ?? null) !== job.expected)
          throw new HttpsError(
            "aborted",
            "Otra fuente se publicó primero; revisar sustitución.",
          );
        tx.create(db.doc(`sources/${job.id}`), {
          kind: job.kind,
          cycleId: job.cycleId,
          artifact: job.artifact,
          file: job.file,
          originalPath: `originals/${job.id}/source`,
          submittedBy: job.uid,
          approvedBy: actor,
          publishedAt: Date.now(),
          previous: job.expected,
        });
        tx.update(ref, { sources: { ...cycle.sources, [job.kind]: job.id } });
        tx.update(db.doc(`jobs/${job.id}`), { status: "published" });
      });
      return { ok: true };
    }
    case "publish": {
      const input = operationSchemas.publish.parse(raw);
      await db.runTransaction(async (tx) => {
        const freshMember = await membership(actor, tx);
        const job = (await tx.get(db.doc(`jobs/${input.jobId}`))).data() as
          Job | undefined;
        if (!job || job.kind !== "report") throw missing();
        const course = (
          await tx.get(db.doc(`courses/${job.courseId}`))
        ).data() as Course;
        courseAccess(freshMember, course);
        if (job.status === "published") return;
        const cut = (await tx.get(db.doc(`cuts/${job.cutId}`))).data() as Cut;
        if (cut.status !== "open") throw closed();
        if ((job.progressId ?? null) !== (cut.progress?.id ?? null))
          throw new HttpsError(
            "aborted",
            "El avance cambió; vuelve a revisar el original.",
          );
        if (job.sources && canonical(job.sources) !== canonical(cut.sources))
          throw new HttpsError(
            "failed-precondition",
            "Las fuentes cambiaron. Vuelve a validar el original.",
          );
        if (
          job.status !== "ready" ||
          job.blocking ||
          !job.artifact ||
          !job.token
        )
          throw new HttpsError(
            "failed-precondition",
            "El archivo requiere validación o resolución administrativa.",
          );
        const pointer = pointerRef(cut.id, course.id);
        const current = (await tx.get(pointer)).data();
        if ((current?.versionId ?? null) !== job.expected)
          throw new HttpsError(
            "aborted",
            "Otra versión se publicó primero. Conservada para revisión.",
          );
        if (job.expected && !input.replace)
          throw new HttpsError(
            "failed-precondition",
            "Confirma explícitamente la sustitución.",
          );
        const revision = Number(current?.revision ?? 0) + 1;
        const selectedRef = db.doc(
          `cuts/${cut.id}/activitySelections/${course.id}`,
        );
        const previousSelection = job.automaticActivities
          ? (await tx.get(selectedRef)).data()
          : undefined;
        if (job.automaticActivities) {
          const selection = {
            id: hash(canonical(["principal-modality-v1", job.id])),
            versionId: job.id,
            activities: [...(job.activityIds ?? [])].sort(),
            teachers: previousSelection?.teachers ?? null,
            reason:
              "Política institucional versionada: actividades por modalidad principal y semana vencida",
            actor,
            previous: previousSelection?.id ?? null,
          };
          tx.create(db.doc(`activitySelectionHistory/${selection.id}`), {
            ...selection,
            cutId: cut.id,
            courseId: course.id,
            createdAt: Date.now(),
          });
          tx.set(selectedRef, selection);
        }
        tx.create(db.doc(`publications/${job.id}`), {
          versionId: job.id,
          cutId: cut.id,
          courseId: course.id,
          cycleId: cut.cycleId,
          token: job.token,
          revision,
          previous: job.expected,
          sources: cut.sources,
          artifact: job.artifact,
          originalPath: `originals/${job.id}/source`,
          approvedBy: actor,
          publishedAt: Date.now(),
        });
        tx.set(pointer, { versionId: job.id, revision });
        tx.update(db.doc(`jobs/${job.id}`), { status: "published" });
      });
      return { ok: true };
    }
    case "retry": {
      const input = operationSchemas.retry.parse(raw);
      const job = await getJob(input.jobId);
      await authorizeJob(member, job);
      await db.runTransaction(async (tx) => {
        const freshMember = await membership(actor, tx);
        if (job.kind !== "report") admin(freshMember);
        else {
          courseAccess(
            freshMember,
            (await tx.get(db.doc(`courses/${job.courseId}`))).data() as Course,
          );
          if (
            (await tx.get(db.doc(`cuts/${job.cutId}`))).data()?.status !==
            "open"
          )
            throw closed();
        }
        const ref = db.doc(`jobs/${job.id}`);
        const current = (await tx.get(ref)).data() as Job;
        if (
          current.status === "ready" ||
          current.status === "published" ||
          current.status === "queued"
        )
          return;
        if (
          current.attempt >= 3 ||
          current.status === "invalid" ||
          current.status === "awaiting_upload" ||
          current.lease > Date.now()
        )
          throw new HttpsError(
            "failed-precondition",
            "Trabajo no reintentable; conserva el original y revisa la incidencia.",
          );
        tx.update(ref, { status: "queued", lease: 0, error: null });
      });
      return { ok: true };
    }
    case "original": {
      admin(member);
      const input = operationSchemas.original.parse(raw);
      const job = await getJob(input.jobId);
      const [bytes] = await bucket()
        .file(`originals/${job.id}/source`)
        .download();
      return {
        name: job.file.name,
        base64: bytes.toString("base64"),
        sha256: hash(bytes),
      };
    }
    case "results":
    case "export": {
      const input = operationSchemas[op].parse(raw);
      career(member, input.careerId);
      const course = (
        await db.doc(`courses/${input.courseId}`).get()
      ).data() as Course | undefined;
      if (!course || !course.careers.includes(input.careerId)) throw missing();
      const pointer = await pointerRef(input.cutId, input.courseId).get();
      const id =
        input.versionId ?? (pointer.data()?.versionId as string | undefined);
      if (!id)
        return {
          rows: [],
          cursor: null,
          versionId: null,
          ...(op === "export" ? { csv: "", path: null } : {}),
        };
      const published = (await db.doc(`publications/${id}`).get()).data();
      if (
        !published ||
        published.cutId !== input.cutId ||
        published.courseId !== input.courseId
      )
        throw missing();
      const job = await getJob(id);
      const page = await rowsPage(job, member, input.careerId, input.cursor);
      if (op === "results") return { ...page, versionId: id };
      const escape = (raw: unknown) => {
        const value = String(raw ?? "");
        return `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
      };
      const csv = [
        "matricula,actividad,estado,original,version,version_celda,relacion_curso_ciclo,grupo_principal_seguimiento,modalidad_principal,grupo_imparticion,correspondencia_inscripcion,encabezado_actividad",
        ...page.rows.flatMap((r) =>
          r.values.map((v) =>
            [
              r.identity,
              v.activityId,
              v.state,
              v.raw,
              id,
              v.sourceVersion ?? id,
              r.relationship?.id ?? "",
              r.relationship?.trackingGroup ?? "",
              r.relationship?.trackingModality ?? "",
              "no determinado",
              "no determinada",
              v.label ?? v.activityId,
            ]
              .map(escape)
              .join(","),
          ),
        ),
      ].join("\r\n");
      const path = `exports/${actor}/${hash(canonical({ id, careerId: input.careerId, cursor: input.cursor ?? null }))}.csv`;
      await saveImmutable(path, Buffer.from(csv), "text/csv; charset=utf-8");
      return { csv, cursor: page.cursor, versionId: id, path };
    }
  }
}

export const requestSchema = z.strictObject({
  op: z.enum(Object.keys(operationSchemas) as [Operation, ...Operation[]]),
  input: z.unknown(),
});
