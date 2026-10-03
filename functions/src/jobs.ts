import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { FieldPath } from "firebase-admin/firestore";
import {
  applySupplement,
  catalogSchema,
  contextSchema,
  courseFilename,
  resolveCourseFilename,
  resolveAffiliations,
  supplementSchema,
} from "../../src/domain/academic";
import { readTable } from "../../src/importing/files";
import {
  mapRecords,
  parseMoodle,
  resolveDuplicateRows,
} from "../../src/importing/mapping";
import { prepareRoster } from "../../src/importing/roster";
import {
  type Member,
  type RowView,
  type jobStatus,
  type sourceKind,
  type descriptorSchema,
  type filenameResolutionSchema,
} from "../../src/domain/import-contract";
import {
  admin,
  bucket,
  canonical,
  courseAccess,
  db,
  hash,
  jsonFile,
  localOnly,
  saveImmutable,
} from "./store";

export type SourceKind = z.infer<typeof sourceKind>;
export type SourceRefs = Partial<Record<SourceKind, string>>;
export type Cycle = {
  id: string;
  dates: Record<string, "base" | "especial" | "practica" | "excluida">;
  sources: SourceRefs;
};
export type Cut = {
  id: string;
  cycleId: string;
  date: string;
  status: "open" | "closed";
  sources: SourceRefs;
  dates: Cycle["dates"];
  parentId: string | null;
  reason: string | null;
  frozenCourseIds?: string[];
  closurePath?: string;
};
export type Course = {
  id: string;
  cycleId: string;
  externalId: string;
  name: string;
  careers: string[];
};
export type Job = {
  id: string;
  kind: SourceKind | "report";
  cycleId: string;
  cutId: string | null;
  courseId: string | null;
  file: z.infer<typeof descriptorSchema>;
  filenameResolution?: z.infer<typeof filenameResolutionSchema>;
  uid: string;
  status: z.infer<typeof jobStatus>;
  attempt: number;
  lease: number;
  token: string | null;
  artifact: string | null;
  createdAt: number;
  expected: string | null;
  error: string | null;
  blocking: boolean;
};
export class InvalidSource extends Error {}
export const pointerRef = (cutId: string, courseId: string) =>
  db.doc(`cuts/${cutId}/courses/${courseId}`);
export async function getJob(id: string): Promise<Job> {
  const snap = await db.doc(`jobs/${id}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Trabajo no disponible.");
  return snap.data() as Job;
}
export async function authorizeJob(member: Member, job: Job) {
  if (job.kind !== "report") return admin(member);
  const course = (await db.doc(`courses/${job.courseId}`).get()).data() as
    Course | undefined;
  if (!course) throw new HttpsError("not-found", "Curso no disponible.");
  courseAccess(member, course);
}
export function jobView(job: Job) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    courseId: job.courseId,
    cutId: job.cutId,
    attempt: job.attempt,
    error: job.error,
    replaces: job.expected,
  };
}
type Artifact = {
  filename?:
    | ReturnType<typeof resolveCourseFilename>
    | ReturnType<typeof courseFilename>;
  data: unknown;
  source: unknown;
  issues: { code: string; refs: string[] }[];
  count: number;
  excluded?: {
    identity: string;
    careerId: string | null;
    row: number;
    reason: string;
  }[];
};
async function administrative(job: Job, bytes: Buffer): Promise<Artifact> {
  const version = job.id;
  if (["withdrawals", "exceptions"].includes(job.kind)) {
    if (!job.file.name.endsWith(".json")) throw new InvalidSource();
    const input: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    const stamp = (rows: unknown) =>
      z
        .array(z.record(z.string(), z.unknown()))
        .max(10000)
        .parse(rows)
        .map((v) => ({ ...v, version, approvedBy: job.uid }));
    const decisions =
      job.kind === "exceptions"
        ? z
            .strictObject({
              exceptions: z.array(z.unknown()).max(10000),
              baseResolutions: z.array(z.unknown()).max(10000).default([]),
            })
            .parse(Array.isArray(input) ? { exceptions: input } : input)
        : null;
    if (
      decisions &&
      decisions.exceptions.length + decisions.baseResolutions.length > 10000
    )
      throw new InvalidSource();
    const data = decisions
      ? {
          exceptions: contextSchema.shape.exceptions.parse(
            stamp(decisions.exceptions),
          ),
          baseResolutions: contextSchema.shape.baseResolutions.parse(
            stamp(decisions.baseResolutions),
          ),
        }
      : contextSchema.shape.withdrawals.parse(stamp(input));
    return {
      data,
      source: { sha256: hash(bytes), parserVersion: "etapa03-json/1" },
      issues: [],
      count: Array.isArray(data)
        ? data.length
        : data.exceptions.length + data.baseResolutions.length,
    };
  }
  const table = readTable(bytes, job.file.name);
  if (job.kind === "catalog") {
    const records = mapRecords(table, "catalog", job.file.mapping, version);
    if (records.some((r) => r.issues.length)) throw new InvalidSource();
    const data = catalogSchema.parse(
      records.map((r) => ({
        id: r.values.careerId?.raw,
        plan: r.values.plan?.raw,
        abbreviation: r.values.abbreviation?.raw,
        coordination: r.values.coordination?.raw,
        kind: r.values.kind?.raw,
        architecture: z
          .union([
            z.boolean(),
            z.enum(["true", "false"]).transform((v) => v === "true"),
          ])
          .parse(r.values.architecture?.raw),
      })),
    );
    if (new Set(data.map((v) => v.id)).size !== data.length)
      throw new InvalidSource();
    return { data, source: table.source, issues: [], count: data.length };
  }
  const roster = prepareRoster(table, job.file.mapping, version, job.cycleId);
  if (roster.issues.length) throw new InvalidSource();
  if (job.kind === "roster")
    return {
      data: roster.enrollments,
      source: table.source,
      issues: [],
      count: roster.enrollments.length,
    };
  const records = mapRecords(table, "supplement", job.file.mapping, version);
  if (records.some((r) => r.issues.length)) throw new InvalidSource();
  const data = supplementSchema.parse(
    records.map((r, i) => ({
      id: `${version}:fila:${r.original.row}`,
      version,
      approvedBy: job.uid,
      reason: r.values.reason?.raw,
      replacesId: r.values.replacesId?.raw || null,
      enrollment: roster.enrollments[i],
    })),
  );
  return { data, source: table.source, issues: [], count: data.length };
}

export async function academicSnapshot(
  cut: Cut,
): Promise<ReturnType<typeof resolveAffiliations>> {
  if (cut.closurePath)
    return (
      await jsonFile<{ academic: ReturnType<typeof resolveAffiliations> }>(
        cut.closurePath,
      )
    ).academic;
  if (cut.status === "closed")
    throw new HttpsError(
      "failed-precondition",
      "El corte cerrado carece de fotografía materializada; requiere conciliación explícita, no recálculo automático.",
    );
  const loaded: Partial<Record<SourceKind, Artifact>> = {};
  for (const [kind, id] of Object.entries(cut.sources)) {
    const source = (await db.doc(`sources/${id}`).get()).data();
    if (
      !source?.artifact ||
      source.cycleId !== cut.cycleId ||
      source.kind !== kind
    )
      throw new InvalidSource();
    loaded[kind as SourceKind] = await jsonFile<Artifact>(
      source.artifact as string,
    );
  }
  const supplemented = applySupplement(
    loaded.roster?.data,
    loaded.supplement?.data ?? [],
  );
  if (supplemented.issues.length) throw new InvalidSource();
  const decisions = contextSchema
    .pick({ exceptions: true, baseResolutions: true })
    .parse(loaded.exceptions?.data ?? { exceptions: [], baseResolutions: [] });
  return resolveAffiliations(supplemented.active, {
    cycle: cut.cycleId,
    cutId: cut.id,
    cutDate: cut.date,
    catalogVersion: cut.sources.catalog,
    catalog: loaded.catalog?.data,
    calendar: { cycle: cut.cycleId, dates: cut.dates },
    withdrawals: loaded.withdrawals?.data ?? [],
    ...decisions,
  });
}

async function report(
  job: Job,
  bytes: Buffer,
  token: string,
): Promise<Artifact> {
  const cut = (await db.doc(`cuts/${job.cutId}`).get()).data() as Cut;
  const course = (
    await db.doc(`courses/${job.courseId}`).get()
  ).data() as Course;
  const fileCourse = job.filenameResolution
    ? resolveCourseFilename(job.file.name, {
        ...job.filenameResolution,
        approvedBy: job.uid,
        version: job.id,
      })
    : courseFilename(job.file.name);
  if (
    fileCourse.cycle !== cut.cycleId ||
    fileCourse.externalId !== course.externalId
  )
    throw new InvalidSource();
  let table = readTable(bytes, job.file.name);
  const { resolutions, ...mapping } = job.file.mapping;
  const audits: unknown[] = [];
  if (resolutions)
    for (const decision of z
      .array(z.record(z.string(), z.unknown()))
      .max(100)
      .parse(resolutions)) {
      const resolved = resolveDuplicateRows(table, {
        ...decision,
        approvedBy: job.uid,
        version: job.id,
      });
      table = resolved.table;
      audits.push(resolved.audit);
    }
  const parsed = parseMoodle(table, {
    ...mapping,
    approvedBy: job.uid,
    version: job.id,
  });
  const academic = await academicSnapshot(cut);
  const persons = new Map(academic.persons.map((p) => [p.identity, p]));
  const enrollments = new Map(academic.enrollments.map((e) => [e.id, e]));
  const issues = [...parsed.issues];
  const issuesByRow = new Map<string, string[]>();
  for (const issue of parsed.issues)
    for (const ref of issue.refs) {
      const codes = issuesByRow.get(ref) ?? [];
      codes.push(issue.code);
      issuesByRow.set(ref, codes);
    }
  const excluded: NonNullable<Artifact["excluded"]> = parsed.teachers.map(
    (r) => ({
      identity: String(r.person.original),
      careerId: null,
      row: r.row,
      reason: "docente",
    }),
  );
  const rows: RowView[] = [];
  for (const row of [...parsed.accepted, ...parsed.unresolved]) {
    const person = row.person.normalized
      ? persons.get(row.person.normalized)
      : undefined;
    const base = person?.baseEnrollmentId
      ? enrollments.get(person.baseEnrollmentId)
      : undefined;
    const records =
      person?.enrollmentIds.map((id) => enrollments.get(id)!) ?? [];
    // Bajas y otras inscripciones excluidas se conservan en el original, sin publicar notas.
    if (
      records.length &&
      records.every((e) =>
        ["baja", "docente", "excluida", "practica"].includes(e.kind),
      )
    ) {
      const careers = [...new Set(records.map((e) => e.careerId))];
      excluded.push({
        identity: String(row.person.original),
        careerId: careers.length === 1 ? careers[0]! : null,
        row: row.row,
        reason: [...new Set(records.map((e) => e.kind))].join(", "),
      });
      continue;
    }
    if (!base || !course.careers.includes(base.careerId)) {
      issues.push({
        code: "afiliacion_requiere_revision_administrativa",
        refs: [String(row.row)],
      });
      continue;
    }
    const rowIssues = issuesByRow.get(String(row.row)) ?? [];
    const value: RowView = {
      id: String(row.row).padStart(6, "0"),
      identity: String(row.person.original),
      careerId: base.careerId,
      row: row.row,
      values: row.values.map((v) => ({
        activityId: v.activityId,
        state: v.grade.state,
        raw: v.grade.raw,
      })),
      issues: rowIssues,
    };
    if (Buffer.byteLength(JSON.stringify(value)) > 128 * 1024)
      throw new InvalidSource();
    rows.push(value);
  }
  for (let i = 0; i < rows.length; i += 200) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + 200))
      batch.create(
        db.doc(`jobs/${job.id}/attempts/${token}/rows/${row.id}`),
        row,
      );
    await batch.commit();
  }
  return {
    filename: fileCourse,
    data: {
      mapping: parsed.mapping,
      audits,
      sources: cut.sources,
      teachers: parsed.teachers,
      academicIssues: academic.issues,
    },
    source: table.source,
    issues,
    count: rows.length,
    excluded,
  };
}

// Los eventos pueden repetirse. El token de arrendamiento impide que un worker
// antiguo cambie el resultado; los intentos incompletos nunca son publicables.
export async function processJob(id: string) {
  localOnly();
  const ref = db.doc(`jobs/${id}`);
  const job = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const current = snap.data() as Job;
    if (!["queued", "processing"].includes(current.status)) return null;
    if (current.status === "processing" && current.lease > Date.now())
      throw new Error("Trabajo con arrendamiento activo");
    if (current.attempt >= 3) {
      tx.update(ref, { status: "failed", error: "reintentos_agotados" });
      return null;
    }
    const claimed: Job = {
      ...current,
      status: "processing",
      attempt: current.attempt + 1,
      lease: Date.now() + 150000,
      token: randomUUID(),
    };
    tx.set(ref, claimed);
    return claimed;
  });
  if (!job) return;
  try {
    const [bytes] = await bucket().file(`originals/${id}/source`).download();
    if (bytes.length !== job.file.bytes || hash(bytes) !== job.file.sha256)
      throw new InvalidSource();
    let artifact: Artifact;
    try {
      artifact =
        job.kind === "report"
          ? await report(job, bytes, job.token!)
          : await administrative(job, bytes);
    } catch (error) {
      // Errores del parser y del contrato son permanentes; fallos de infraestructura se reintentan.
      if (
        error instanceof z.ZodError ||
        error instanceof InvalidSource ||
        !(error as { code?: unknown }).code
      )
        throw new InvalidSource();
      throw error;
    }
    const path = `derived/${id}/${job.token}.json`;
    await saveImmutable(
      path,
      Buffer.from(JSON.stringify(artifact)),
      "application/json",
    );
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as Job;
      if (current.token !== job.token || current.status !== "processing")
        return;
      tx.update(ref, {
        status: "ready",
        artifact: path,
        // Una nota inválida es un estado publicable, no una identidad sin resolver.
        // Todo código nuevo/desconocido sigue bloqueando por defecto.
        blocking: artifact.issues.some(
          (issue) => issue.code !== "calificacion_invalida",
        ),
        error: null,
        lease: 0,
      });
    });
  } catch (error) {
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as Job;
      if (current.token !== job.token || current.status !== "processing")
        return;
      tx.update(ref, {
        status:
          error instanceof InvalidSource
            ? "invalid"
            : job.attempt >= 3
              ? "failed"
              : "queued",
        error:
          error instanceof InvalidSource
            ? "archivo_o_mapeo_invalido"
            : "fallo_temporal",
        lease: 0,
      });
    });
  }
}
export async function rowsPage(
  job: Job,
  member: Member,
  careerId?: string,
  cursor?: string,
) {
  if (
    member.role !== "admin" &&
    (!careerId || !member.careers.includes(careerId))
  )
    throw new HttpsError(
      "permission-denied",
      "Selecciona una carrera autorizada.",
    );
  if (!job.token || !["ready", "published"].includes(job.status))
    return { rows: [], cursor: null };
  let query = db
    .collection(`jobs/${job.id}/attempts/${job.token}/rows`)
    .orderBy(FieldPath.documentId())
    .limit(100);
  if (careerId) query = query.where("careerId", "==", careerId);
  if (cursor) query = query.startAfter(cursor);
  const snap = await query.get();
  return {
    rows: snap.docs.map((d) => d.data() as RowView),
    cursor: snap.size === 100 ? snap.docs.at(-1)!.id : null,
  };
}
export async function previewJob(
  job: Job,
  member: Member,
  careerId?: string,
  cursor?: string,
) {
  const page = await rowsPage(job, member, careerId, cursor);
  const artifact = job.artifact ? await jsonFile<Artifact>(job.artifact) : null;
  return {
    ...page,
    filename:
      member.role === "admin" && job.kind === "report"
        ? {
            original: job.file.name,
            sha256: job.file.sha256,
            resolution: artifact?.filename ?? null,
          }
        : null,
    job: jobView(job),
    blocking: job.blocking,
    issues:
      member.role === "admin" ? (artifact?.issues.slice(0, 100) ?? []) : [],
    sourceCount: member.role === "admin" ? (artifact?.count ?? null) : null,
    excluded: (artifact?.excluded ?? [])
      .filter(
        (r) =>
          member.role === "admin" ||
          (r.careerId === careerId && member.careers.includes(r.careerId)),
      )
      .slice(0, 100),
  };
}
export function sourceJobId(cycleId: string, kind: string, file: unknown) {
  return hash(canonical({ cycleId, kind, file }));
}
