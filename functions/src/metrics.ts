import {
  FieldPath,
  type Query,
  type Transaction,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { identity } from "../../src/domain/academic";
import {
  emptyCounts,
  addValue,
  percentages,
  registration,
  csvCell,
} from "../../src/domain/metrics";
import {
  metricOperations,
  type MetricRequest,
  type Dashboard,
  metricDetail,
  metricExclusion,
  metricCourse,
} from "../../src/domain/metrics-contract";
import { rowViewSchema, type Member } from "../../src/domain/import-contract";
import { academicSnapshot, type Cut, type Course, type Job } from "./jobs";
import {
  db,
  admin,
  membership,
  denied,
  canonical,
  hash,
  jsonFile,
  saveImmutable,
} from "./store";

type Selection = {
  id: string;
  versionId: string;
  activities: string[];
  teachers: string[] | null;
  reason: string;
  actor: string;
  previous: string | null;
};
type Entry = {
  course: Course;
  job: Job | null;
  selection: Selection | null;
  received: boolean;
  validated: boolean;
};
export type Snapshot = {
  uid: string;
  scope: string;
  cut: Cut;
  entries: Entry[];
};
const missing = () => new HttpsError("not-found", "Datos no disponibles.");
const conflict = () =>
  new HttpsError("aborted", "La versión cambió. Actualiza y revisa de nuevo.");
const available = (job: Job) =>
  z
    .array(z.object({ kind: z.string(), activityId: z.string().optional() }))
    .parse(job.file.mapping.columns)
    .filter((c) => c.kind === "activity" && c.activityId)
    .map((c) => c.activityId!);
const allowed = (m: Member, c: string) =>
  m.role === "admin" || m.careers.includes(c);
const selectionRef = (cut: string, course: string) =>
  db.doc(`cuts/${cut}/activitySelections/${course}`);

export async function configureMetrics(raw: unknown, uid: string) {
  const input = metricOperations.configureMetrics.parse(raw);
  await db.runTransaction(async (tx) => {
    admin(await membership(uid, tx));
    const cut = (await tx.get(db.doc(`cuts/${input.cutId}`))).data() as
      Cut | undefined;
    if (!cut) throw missing();
    if (cut.status !== "open")
      throw new HttpsError("failed-precondition", "El corte está cerrado.");
    const pointer = (
      await tx.get(db.doc(`cuts/${cut.id}/courses/${input.courseId}`))
    ).data();
    const job = (await tx.get(db.doc(`jobs/${input.versionId}`))).data() as
      Job | undefined;
    if (
      !job ||
      job.status !== "published" ||
      job.cutId !== cut.id ||
      job.courseId !== input.courseId ||
      pointer?.versionId !== job.id
    )
      throw conflict();
    if (input.activities.some((id) => !available(job).includes(id)))
      throw new HttpsError(
        "invalid-argument",
        "Actividad ausente, categoría o total: revisa el reporte publicado.",
      );
    const ref = selectionRef(cut.id, input.courseId);
    const previous = (await tx.get(ref)).data() as Selection | undefined;
    const values = {
      versionId: job.id,
      activities: [...input.activities].sort(),
      teachers: input.teachers ? [...new Set(input.teachers)].sort() : null,
      reason: input.reason,
      actor: uid,
    };
    // Reenvío idéntico no agrega una revisión. Comparación con actor real.
    if (
      previous &&
      canonical({
        versionId: previous.versionId,
        activities: previous.activities,
        teachers: previous.teachers,
        reason: previous.reason,
        actor: previous.actor,
      }) === canonical(values)
    )
      return;
    if ((previous?.id ?? null) !== input.expected) throw conflict();
    const selection = {
      ...values,
      previous: input.expected,
      id: hash(canonical({ ...values, previous: input.expected })),
    };
    tx.create(db.doc(`activitySelectionHistory/${selection.id}`), {
      ...selection,
      cutId: cut.id,
      courseId: input.courseId,
      createdAt: Date.now(),
    });
    tx.set(ref, selection);
  });
  return { ok: true };
}

export async function captureMetrics(
  tx: Transaction,
  cutId: string,
  uid: string,
  member: Member,
) {
  const scope = hash(canonical(member));
  const current = await membership(uid, tx);
  if (canonical(current) !== canonical(member)) denied();
  const cut = (await tx.get(db.doc(`cuts/${cutId}`))).data() as Cut | undefined;
  if (!cut) throw missing();
  if (cut.closurePath) {
    const frozen = await jsonFile<{ snapshot: Snapshot }>(cut.closurePath);
    const data: Snapshot = {
      uid,
      scope,
      cut,
      entries: frozen.snapshot.entries
        .filter((e) => e.course.careers.some((c) => allowed(member, c)))
        .map((e) => ({
          ...e,
          course: {
            ...e.course,
            careers: e.course.careers.filter((c) => allowed(member, c)),
          },
        })),
    };
    return { id: hash(canonical(data)), data };
  }
  const courses = await tx.get(
    db.collection("courses").where("cycleId", "==", cut.cycleId).limit(501),
  );
  const jobs = await tx.get(
    db.collection("jobs").where("cutId", "==", cut.id).limit(10001),
  );
  if (courses.size > 500 || jobs.size > 10000)
    throw new HttpsError(
      "resource-exhausted",
      "El corte excede el límite de consulta medido; no se muestran totales parciales.",
    );
  const entries: Entry[] = [];
  for (const doc of courses.docs) {
    const course = doc.data() as Course;
    if (cut.frozenCourseIds && !cut.frozenCourseIds.includes(course.id))
      continue;
    if (!course.careers.some((c) => allowed(member, c))) continue;
    const ptr = (
      await tx.get(db.doc(`cuts/${cut.id}/courses/${course.id}`))
    ).data();
    const selected = (await tx.get(selectionRef(cut.id, course.id))).data() as
      Selection | undefined;
    const job = ptr
      ? ((await tx.get(db.doc(`jobs/${ptr.versionId}`))).data() as
          Job | undefined)
      : undefined;
    if (
      ptr &&
      (!job ||
        job.status !== "published" ||
        job.courseId !== course.id ||
        job.cutId !== cut.id)
    )
      throw missing();
    const courseJobs = jobs.docs.filter((j) => j.data().courseId === course.id);
    entries.push({
      course: {
        ...course,
        careers: course.careers.filter((c) => allowed(member, c)),
      },
      job: job ?? null,
      selection: selected ?? null,
      received: courseJobs.some((j) => j.data().status !== "awaiting_upload"),
      validated: courseJobs.some(
        (j) =>
          ["ready", "published"].includes(j.data().status) &&
          !j.data().blocking,
      ),
    });
  }
  entries.sort((a, b) => a.course.id.localeCompare(b.course.id));
  const data: Snapshot = { uid, scope, cut, entries };
  const id = hash(canonical(data));
  return { id, data };
}

async function snapshot(
  input: MetricRequest,
  uid: string,
  member: Member,
): Promise<{ id: string; data: Snapshot }> {
  const scope = hash(canonical(member));
  if (input.snapshotId) {
    const stored = (
      await db.doc(`metricSnapshots/${input.snapshotId}`).get()
    ).data();
    if (
      !stored ||
      stored.uid !== uid ||
      stored.scope !== scope ||
      stored.cutId !== input.cutId
    )
      denied();
    const data = await jsonFile<Snapshot>(stored.path);
    return { id: input.snapshotId, data };
  }

  const captured = await db.runTransaction((tx) =>
    captureMetrics(tx, input.cutId, uid, member),
  );
  // El manifiesto puede superar 1 MiB en muchos cursos: Firestore solo guarda
  // su índice de autorización. No se expone el índice antes del objeto íntegro.
  const path = `metricSnapshots/${captured.id}.json`;
  await saveImmutable(
    path,
    Buffer.from(canonical(captured.data)),
    "application/json",
  );
  await db
    .doc(`metricSnapshots/${captured.id}`)
    .set({ uid, scope, cutId: input.cutId, path });
  return captured;
}

async function* pages(query: Query) {
  let cursor: string | undefined;
  while (true) {
    const ordered = query.orderBy(FieldPath.documentId()).limit(200);
    const snap = await (cursor ? ordered.startAfter(cursor) : ordered).get();
    for (const doc of snap.docs) yield doc;
    if (snap.size < 200) return;
    cursor = snap.docs.at(-1)!.id;
  }
}

export async function dashboard(
  raw: unknown,
  uid: string,
  exporting: boolean,
  full = false,
  // Internal historical comparison only; never accepted from the API client.
  activityByCourse?: ReadonlyMap<string, string>,
) {
  const input = metricOperations.dashboard.parse(raw);
  const member = await membership(uid);
  const snap = await snapshot(input, uid, member);
  const { cut, entries } = snap.data;
  const f = input.filters;
  if (f.careerId && !allowed(member, f.careerId)) denied();
  if (f.courseId && !entries.some((e) => e.course.id === f.courseId)) denied();
  const academic = await academicSnapshot(cut);
  const enrollments = new Map(academic.enrollments.map((e) => [e.id, e]));
  const persons = new Map(academic.persons.map((p) => [p.identity, p]));
  const catalog = academic.context.catalog.filter((c) => allowed(member, c.id));
  const careerMatches = (id: string) => {
    const c = catalog.find((c) => c.id === id);
    return (
      allowed(member, id) &&
      (!f.careerId || id === f.careerId) &&
      (!f.coordination || c?.coordination === f.coordination) &&
      (!f.plan || c?.plan === f.plan)
    );
  };
  if (f.coordination && !catalog.some((c) => c.coordination === f.coordination))
    denied();
  const facets: Dashboard["facets"] = {
    coordination: [],
    careerId: [],
    plan: [],
    group: [],
    modality: [],
    shift: [],
    teacher: [],
  };
  for (const c of catalog) {
    facets.careerId.push(c.id);
    facets.plan.push(c.plan);
    if (c.coordination) facets.coordination.push(c.coordination);
  }
  for (const e of academic.enrollments.filter(
    (e) =>
      allowed(member, e.careerId) && e.kind === "base" && !e.problems.length,
  )) {
    facets.group.push(e.parsed.normalized);
    if (e.parsed.modality) facets.modality.push(e.parsed.modality);
    if (e.parsed.shift) facets.shift.push(e.parsed.shift);
  }
  const details: z.infer<typeof metricDetail>[] = [];
  const exclusions: z.infer<typeof metricExclusion>[] = [];
  const courses: z.infer<typeof metricCourse>[] = [];
  let received = 0,
    validated = 0;
  const studentMatch = (id: string) =>
    !f.student || identity(id).normalized === identity(f.student).normalized;
  const dimMatch = (group: string, modality: string, shift: string) =>
    (!f.group || f.group === group) &&
    (!f.modality || f.modality === modality) &&
    (!f.shift || f.shift === shift);
  // Una condición por persona, calculada solo con sus inscripciones autorizadas.
  // No depende de la fila examinada ni de que conserve observaciones elegibles.
  const personScope = new Map(
    academic.persons.map((person) => {
      const owned = person.enrollmentIds
        .map((id) => enrollments.get(id)!)
        .filter((e) => allowed(member, e.careerId));
      const base = owned.find((e) => e.id === person.baseEnrollmentId);
      return [
        person.identity,
        { owned, base, special: owned.some((e) => e.kind === "especial") },
      ] as const;
    }),
  );
  const scopedPerson = (id: string) => {
    const normalized = identity(id).normalized;
    return normalized ? personScope.get(normalized) : undefined;
  };
  const specialMatch = (id: string) => {
    if (!f.special) return true;
    const person = scopedPerson(id);
    return (
      !!person?.owned.length &&
      (f.special === "con_especial") === person.special
    );
  };
  const exclusionDimensionsMatch = (id: string, careerId: string | null) => {
    if (!f.group && !f.modality && !f.shift) return true;
    const person = scopedPerson(id);
    const candidates = person?.base
      ? [person.base]
      : (person?.owned ?? []).filter(
          (e) => !careerId || e.careerId === careerId,
        );
    return candidates.some((e) =>
      dimMatch(
        e.parsed.normalized,
        e.parsed.modality ?? "",
        e.parsed.shift ?? "",
      ),
    );
  };
  const sourceCareers = new Set<string>();
  for (const entry of entries) {
    const { course, job } = entry;
    if (
      (f.courseId && course.id !== f.courseId) ||
      !course.careers.some(careerMatches)
    )
      continue;
    const selection =
      entry.selection?.versionId === job?.id ? entry.selection : null;
    const artifact = job?.artifact
      ? await jsonFile<{
          data: { teachers: { person: { original: unknown } }[] };
          excluded?: {
            identity: string;
            careerId: string | null;
            row: number;
            reason: string;
          }[];
        }>(job.artifact)
      : null;
    const teachers = selection?.teachers ?? [
      ...new Set(
        (artifact?.data.teachers ?? []).map((t) => String(t.person.original)),
      ),
    ];
    facets.teacher.push(...teachers);
    if (
      f.teacher &&
      (f.teacher === "sin_docente"
        ? teachers.length > 0
        : !teachers.includes(f.teacher))
    )
      continue;
    for (const careerId of course.careers.filter(careerMatches))
      sourceCareers.add(careerId);
    const activities = selection?.activities ?? [];
    const courseDetails: typeof details = [];
    if (job?.token) {
      // Consultas de filas restringidas por carrera incluso usando SDK Admin.
      for (const careerId of course.careers.filter(careerMatches)) {
        for await (const doc of pages(
          db
            .collection(`jobs/${job.id}/attempts/${job.token}/rows`)
            .where("careerId", "==", careerId),
        )) {
          const row = rowViewSchema.parse(doc.data());
          const normalized = identity(row.identity).normalized;
          const person = normalized ? persons.get(normalized) : undefined;
          const base = person?.baseEnrollmentId
            ? enrollments.get(person.baseEnrollmentId)
            : undefined;
          if (
            !base ||
            base.careerId !== careerId ||
            !studentMatch(row.identity) ||
            !dimMatch(
              base.parsed.normalized,
              base.parsed.modality ?? "",
              base.parsed.shift ?? "",
            )
          )
            continue;
          const { owned, special } = scopedPerson(row.identity)!;
          if (!specialMatch(row.identity)) continue;
          let values = row.values.filter((v) =>
            activities.includes(v.activityId),
          );
          // El worker ya resuelve duplicados; fallar ante un derivado incoherente.
          if (
            new Set(values.map((v) => v.activityId)).size !==
              activities.length ||
            values.length !== activities.length
          )
            throw new HttpsError(
              "failed-precondition",
              "Observaciones incompletas o duplicadas: revisar versión publicada.",
            );
          if (f.activity || activityByCourse)
            values = values.filter(
              (v) =>
                v.activityId ===
                (activityByCourse
                  ? activityByCourse.get(course.id)
                  : f.activity),
            );
          const counts = emptyCounts();
          values.forEach((v) => addValue(counts, v));
          courseDetails.push({
            courseId: course.id,
            versionId: job.id,
            identity: row.identity,
            careerId,
            group: base.parsed.normalized,
            modality: base.parsed.modality ?? "",
            shift: base.parsed.shift ?? "",
            coordination: base.catalog?.coordination ?? "sin_coordinacion",
            plan: base.catalog?.plan ?? "sin_plan",
            special,
            attribution: "grupo_base_confirmado",
            enrollmentIds: owned.map((e) => e.id),
            sourceVersions: cut.sources,
            issues: [
              ...new Set([...row.issues, ...owned.flatMap((e) => e.problems)]),
            ],
            values,
            counts,
          });
        }
      }
    }
    const courseExclusions: typeof exclusions = [];
    for (const excluded of artifact?.excluded ?? []) {
      if (
        (excluded.careerId
          ? !careerMatches(excluded.careerId)
          : member.role !== "admin") ||
        !studentMatch(excluded.identity) ||
        !specialMatch(excluded.identity) ||
        !exclusionDimensionsMatch(excluded.identity, excluded.careerId) ||
        f.registration
      )
        continue;
      courseExclusions.push({
        ...excluded,
        courseId: course.id,
        provenance: `${job!.id}:fila:${excluded.row}`,
      });
    }
    const rowFilter =
      f.student || f.group || f.modality || f.shift || f.special;
    if (rowFilter && !courseDetails.length && !courseExclusions.length)
      continue;
    details.push(...courseDetails);
    exclusions.push(...courseExclusions);
    if (entry.received) received++;
    if (entry.validated) validated++;
    courses.push({
      audit:
        selection && member.role === "admin"
          ? {
              actor: selection.actor,
              reason: selection.reason,
              previous: selection.previous,
            }
          : null,
      id: course.id,
      name: course.name,
      versionId: job?.id ?? null,
      selectionId: entry.selection?.id ?? null,
      available: job ? available(job) : [],
      activities: activityByCourse
        ? activities.filter((a) => a === activityByCourse.get(course.id))
        : activities,
      teachers,
      teacherSource: selection?.teachers
        ? "asignacion_administrativa"
        : teachers.length
          ? "fila_docente_del_archivo"
          : "sin_docente_identificado",
      status: !job
        ? "sin_archivo_publicado"
        : !activities.length
          ? "sin_actividades_seleccionadas"
          : "medido",
    });
  }
  // Inscripciones especiales/excluidas e incidencias del padrón: no añaden observaciones.
  for (const e of academic.enrollments) {
    if (
      !careerMatches(e.careerId) ||
      !studentMatch(e.identity) ||
      !specialMatch(e.identity) ||
      !sourceCareers.has(e.careerId)
    )
      continue;
    if (e.kind === "base" && !e.problems.length) continue;
    const base = scopedPerson(e.identity)?.base;
    if (
      !dimMatch(
        base?.parsed.normalized ?? e.parsed.normalized,
        base?.parsed.modality ?? e.parsed.modality ?? "",
        base?.parsed.shift ?? e.parsed.shift ?? "",
      )
    )
      continue;
    if (f.registration) continue;
    exclusions.push({
      identity: e.identity,
      careerId: e.careerId,
      courseId: null,
      reason: [
        e.kind,
        ...e.problems,
        ...(!base && e.kind === "especial"
          ? ["sin_grupo_base_confirmado; sin atribucion provisional"]
          : []),
      ].join("; "),
      provenance: `${e.provenance.sourceVersion}:fila:${e.provenance.row}`,
    });
  }
  if (f.registration) {
    const perStudent = new Map<string, ReturnType<typeof emptyCounts>>();
    for (const row of details) {
      const id = identity(row.identity).normalized!;
      const total = perStudent.get(id) ?? emptyCounts();
      row.values.forEach((v) => addValue(total, v));
      perStudent.set(id, total);
    }
    const selected = details.filter(
      (r) =>
        registration(perStudent.get(identity(r.identity).normalized!)!) ===
        f.registration,
    );
    details.splice(0, details.length, ...selected);
    const courseIds = new Set(selected.map((r) => r.courseId));
    courses.splice(
      0,
      courses.length,
      ...courses.filter((c) => courseIds.has(c.id)),
    );
    received = entries.filter(
      (e) => courseIds.has(e.course.id) && e.received,
    ).length;
    validated = entries.filter(
      (e) => courseIds.has(e.course.id) && e.validated,
    ).length;
  }
  const counts = emptyCounts(),
    students = new Set<string>();
  const groups = new Map<
    string,
    { counts: ReturnType<typeof emptyCounts>; students: Set<string> }
  >();
  // Los cursos/carreras sin observaciones siguen visibles, con porcentajes null.
  for (const c of courses) {
    const related = entries
      .find((e) => e.course.id === c.id)!
      .course.careers.filter(careerMatches);
    const ids =
      input.view === "institucion"
        ? ["Alcance autorizado"]
        : input.view === "asignatura"
          ? [c.id]
          : input.view === "carrera"
            ? related
            : input.view === "coordinacion"
              ? related.map(
                  (id) =>
                    catalog.find((v) => v.id === id)?.coordination ??
                    "sin_coordinacion",
                )
              : input.view === "docente"
                ? c.teachers.length
                  ? c.teachers
                  : ["sin_docente"]
                : [];
    for (const id of ids)
      if (!groups.has(id))
        groups.set(id, { counts: emptyCounts(), students: new Set() });
  }
  const seen = new Set<string>();
  for (const row of details) {
    const person = identity(row.identity).normalized!;
    if (row.counts.D) students.add(person);
    const ids =
      input.view === "institucion"
        ? ["Alcance autorizado"]
        : input.view === "coordinacion"
          ? [row.coordination]
          : input.view === "carrera"
            ? [row.careerId]
            : input.view === "grupo"
              ? [row.group]
              : input.view === "modalidad"
                ? [row.modality]
                : input.view === "turno"
                  ? [row.shift]
                  : input.view === "asignatura"
                    ? [row.courseId]
                    : input.view === "estudiante"
                      ? [person]
                      : input.view === "docente"
                        ? courses.find((c) => c.id === row.courseId)!.teachers
                            .length
                          ? courses.find((c) => c.id === row.courseId)!.teachers
                          : ["sin_docente"]
                        : [];
    for (const value of row.values) {
      const observation = canonical([row.courseId, person, value.activityId]);
      if (seen.has(observation))
        throw new HttpsError(
          "failed-precondition",
          "Observación duplicada en versión publicada.",
        );
      seen.add(observation);
      addValue(counts, value);
      for (const id of input.view === "actividad"
        ? [`${row.courseId}: ${value.activityId}`]
        : ids) {
        const g = groups.get(id) ?? {
          counts: emptyCounts(),
          students: new Set<string>(),
        };
        addValue(g.counts, value);
        g.students.add(person);
        groups.set(id, g);
      }
    }
  }
  for (const k of Object.keys(facets) as (keyof typeof facets)[])
    facets[k] = [...new Set(facets[k])].sort();
  const grouped = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, g]) => ({
      id,
      counts: g.counts,
      students: g.students.size,
      ...percentages(g.counts),
      registration: registration(g.counts),
    }));
  const measured = courses.filter((c) => c.status === "medido").length,
    published = courses.filter((c) => c.versionId).length;
  const items = { groups: grouped, details, courses, exclusions }[
    input.section
  ];
  const result: Dashboard = {
    snapshotId: snap.id,
    cutId: cut.id,
    cycleId: cut.cycleId,
    date: cut.date,
    closed: cut.status === "closed",
    counts,
    ...percentages(counts),
    students: students.size,
    expected: courses.length,
    published,
    measured,
    received,
    validated,
    pending: courses.length - published,
    state: !published
      ? "sin_archivos_publicados"
      : !measured
        ? "sin_actividades_seleccionadas"
        : counts.D
          ? "datos"
          : "sin_datos",
    exclusionsCount: exclusions.length,
    groups: [],
    details: [],
    courses: [],
    exclusions: [],
    total: items.length,
    next: input.offset + 25 < items.length ? input.offset + 25 : null,
    facets,
  };
  Object.assign(result, {
    [input.section]: items.slice(input.offset, input.offset + 25),
  });
  if (full)
    Object.assign(result, {
      groups: grouped,
      details,
      courses,
      exclusions,
      next: null,
    });
  // Revalidar la membresía al entregar/exportar una consulta larga.
  if (canonical(await membership(uid)) !== canonical(member)) denied();
  if (!exporting) return result;
  const rows: unknown[][] = [
    [
      "Definicion",
      "N=numericos; G=guiones; V=vacios; E=invalidos; Z=ceros incluidos en N; D=N+G+V+E; cobertura=N/D. Guion no demuestra falta de entrega.",
    ],
    [
      "Corte",
      cut.id,
      "Ciclo",
      cut.cycleId,
      "Fecha civil",
      cut.date,
      "Snapshot",
      snap.id,
    ],
    ["Filtros", canonical(f), "Vista", input.view],
    [
      "N",
      "G",
      "V",
      "E",
      "Z",
      "D",
      "Cobertura",
      "Guiones",
      "Estudiantes unicos",
    ],
    [
      counts.N,
      counts.G,
      counts.V,
      counts.E,
      counts.Z,
      counts.D,
      result.coverage ?? "sin datos",
      result.dashes ?? "sin datos",
      result.students,
    ],
    [
      "Cursos esperados",
      result.expected,
      "recibidos",
      received,
      "validados",
      validated,
      "publicados",
      published,
      "pendientes",
      result.pending,
    ],
    [
      "Curso",
      "Nombre",
      "Version",
      "Seleccion",
      "Actividades",
      "Docentes",
      "Procedencia docente",
      "Estado",
    ],
    ...courses.map((c) => [
      c.id,
      c.name,
      c.versionId,
      c.selectionId,
      c.activities.join(" | "),
      c.teachers.join(" | "),
      c.teacherSource,
      c.status,
    ]),
    [
      "Agrupacion",
      "Estudiantes",
      "N",
      "G",
      "V",
      "E",
      "Z",
      "D",
      "Cobertura",
      "Guiones",
    ],
    ...grouped.map((g) => [
      g.id,
      g.students,
      g.counts.N,
      g.counts.G,
      g.counts.V,
      g.counts.E,
      g.counts.Z,
      g.counts.D,
      g.coverage,
      g.dashes,
    ]),
    [
      "Detalle",
      "Curso",
      "Version",
      "Matricula",
      "Carrera",
      "Grupo base",
      "Modalidad",
      "Turno",
      "Especial",
      "Actividad",
      "Estado",
      "Original",
      "Inscripciones",
      "Fuentes",
      "Incidencias",
    ],
    ...details.flatMap((r) =>
      r.values.map((v) => [
        "observacion",
        r.courseId,
        r.versionId,
        r.identity,
        r.careerId,
        r.group,
        r.modality,
        r.shift,
        r.special,
        v.activityId,
        v.state,
        v.raw,
        r.enrollmentIds.join(" | "),
        canonical(r.sourceVersions),
        r.issues.join(" | "),
      ]),
    ),
    [
      "Exclusion/incidencia",
      "Matricula",
      "Carrera",
      "Curso",
      "Motivo",
      "Procedencia",
    ],
    ...exclusions.map((e) => [
      "trazabilidad",
      e.identity,
      e.careerId,
      e.courseId,
      e.reason,
      e.provenance,
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  if (Buffer.byteLength(csv) > 8 * 1024 * 1024)
    throw new HttpsError(
      "resource-exhausted",
      "Exportación mayor de 8 MiB: acota los filtros.",
    );
  // Una corrección de consulta puede cambiar el CSV del mismo manifiesto.
  // Conservar el anterior y reutilizar solo una exportación de contenido idéntico.
  const path = `exports/${uid}/${hash(canonical({ snapshot: snap.id, filters: f, view: input.view, content: hash(csv) }))}.csv`;
  await saveImmutable(path, Buffer.from(csv), "text/csv; charset=utf-8");
  return { csv, snapshotId: snap.id, path };
}
