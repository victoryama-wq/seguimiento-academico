import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { identity } from "../../src/domain/academic";
import {
  historyOperations,
  casePage,
  caseRevision,
  type Correspondence,
} from "../../src/domain/history-contract";
import {
  calendarDates,
  compareHistory,
  validateCorrespondences,
} from "../../src/domain/history";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import { csvCell } from "../../src/domain/metrics";
import { academicSnapshot, type Cut, type Cycle } from "./jobs";
import { captureMetrics, dashboard } from "./metrics";
import {
  db,
  admin,
  membership,
  denied,
  canonical,
  hash,
  saveImmutable,
} from "./store";

const conflict = () =>
  new HttpsError(
    "aborted",
    "Otra operación cambió la versión. Actualiza y revisa de nuevo.",
  );
const missing = () =>
  new HttpsError(
    "not-found",
    "Registro no disponible en el alcance autorizado.",
  );
const precondition = (message: string) =>
  new HttpsError("failed-precondition", message);
async function cutById(id: string) {
  const cut = (await db.doc(`cuts/${id}`).get()).data() as Cut | undefined;
  if (!cut) throw missing();
  return cut;
}
async function full(
  cutId: string,
  uid: string,
  filters = {},
  activityByCourse?: ReadonlyMap<string, string>,
) {
  return dashboardSchema.parse(
    await dashboard(
      { cutId, filters, view: "institucion" },
      uid,
      false,
      true,
      activityByCourse,
    ),
  );
}
async function closedPair(before: string, after: string) {
  const cuts = await Promise.all([cutById(before), cutById(after)]);
  if (
    before === after ||
    cuts.some((c) => c.status !== "closed" || !c.closurePath) ||
    cuts[0]!.cycleId !== cuts[1]!.cycleId
  )
    throw precondition(
      "Selecciona dos fotografías cerradas distintas del mismo ciclo con instancias estables.",
    );
  return cuts;
}
export async function closeHistoricalCut(cutId: string, uid: string) {
  const member = await membership(uid);
  admin(member);
  const captured = await db.runTransaction((tx) =>
    captureMetrics(tx, cutId, uid, member),
  );
  if (captured.data.cut.status === "closed") return { ok: true };
  const academic = await academicSnapshot(captured.data.cut);
  const payload = {
    schema: "closure/1",
    academicRules: "etapa02-04/1",
    snapshot: captured.data,
    academic,
    actor: uid,
  };
  const encoded = JSON.stringify(payload);
  const path = `closures/${hash(encoded)}.json`;
  await saveImmutable(path, Buffer.from(encoded), "application/json");
  await db.runTransaction(async (tx) => {
    admin(await membership(uid, tx));
    const current = await captureMetrics(tx, cutId, uid, member);
    if (current.data.cut.status === "closed") return;
    if (current.id !== captured.id) throw conflict();
    tx.update(db.doc(`cuts/${cutId}`), {
      status: "closed",
      closurePath: path,
      closedBy: uid,
      closedAt: Date.now(),
      frozenCourseIds: captured.data.entries.map((e) => e.course.id),
    });
  });
  return { ok: true };
}

type HistoryOperation = keyof typeof historyOperations;
export async function historyOperation(
  op: HistoryOperation,
  raw: unknown,
  uid: string,
): Promise<unknown> {
  const member = await membership(uid);
  switch (op) {
    case "planCalendar": {
      admin(member);
      const input = historyOperations.planCalendar.parse(raw);
      const dates = calendarDates(input.firstDate, input.count);
      await db.runTransaction(async (tx) => {
        admin(await membership(uid, tx));
        const cycle = (
          await tx.get(db.doc(`cycles/${input.cycleId}`))
        ).data() as Cycle | undefined;
        if (!cycle?.sources.roster || !cycle.sources.catalog)
          throw precondition("Publica padrón y catálogo antes de planificar.");
        const refs = dates.map((date) =>
          db.doc(`cuts/${input.cycleId}-${date}`),
        );
        const previous = await tx.getAll(...refs);
        for (let i = 0; i < refs.length; i++) {
          if (previous[i]!.exists) continue; // Reenvío conserva fechas editadas y cortes cerrados.
          tx.create(refs[i]!, {
            id: refs[i]!.id,
            cycleId: cycle.id,
            date: dates[i],
            sources: cycle.sources,
            dates: cycle.dates,
            status: "open",
            parentId: null,
            reason: null,
            createdBy: uid,
            createdAt: Date.now(),
          });
        }
      });
      return { ok: true };
    }
    case "editCutDate": {
      admin(member);
      const input = historyOperations.editCutDate.parse(raw);
      await db.runTransaction(async (tx) => {
        admin(await membership(uid, tx));
        const ref = db.doc(`cuts/${input.cutId}`),
          cut = (await tx.get(ref)).data() as Cut | undefined;
        if (!cut) throw missing();
        const jobs = await tx.get(
          db.collection("jobs").where("cutId", "==", cut.id).limit(1),
        );
        if (cut.status !== "open" || !jobs.empty)
          throw precondition(
            "La fecha académica solo se edita antes de aceptar archivos; después crea una revisión atribuible.",
          );
        if (cut.date !== input.expected) throw conflict();
        tx.create(db.collection("calendarAudit").doc(), {
          ...input,
          actor: uid,
          recordedAt: Date.now(),
        });
        tx.update(ref, { date: input.date });
      });
      return { ok: true };
    }
    case "historyCalendar": {
      const input = historyOperations.historyCalendar.parse(raw);
      const docs = await db
        .collection("cuts")
        .where("cycleId", "==", input.cycleId)
        .limit(101)
        .get();
      if (docs.size > 100)
        throw precondition(
          "Calendario excede 100 cortes; no se muestran resultados parciales.",
        );
      const cuts = [];
      for (const doc of docs.docs) {
        const c = doc.data() as Cut & { createdBy: string };
        const p = await db.runTransaction((tx) =>
          captureMetrics(tx, c.id, uid, member),
        );
        cuts.push({
          id: c.id,
          date: c.date,
          status: c.status,
          parentId: c.parentId,
          reason: c.reason,
          author: c.createdBy,
          pending: p.data.entries.filter((e) => !e.job).length,
          closure: c.closurePath ? hash(c.closurePath) : null,
        });
      }
      if (canonical(await membership(uid)) !== canonical(member)) denied();
      return {
        cuts: cuts.sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        ),
      };
    }
    case "configureComparison": {
      admin(member);
      const input = historyOperations.configureComparison.parse(raw);
      await closedPair(input.beforeCut, input.afterCut);
      try {
        validateCorrespondences(input.pairs);
      } catch {
        throw precondition(
          "Correspondencia ambigua: cada actividad requiere una sola pareja.",
        );
      }
      const [left, right] = await Promise.all([
        full(input.beforeCut, uid),
        full(input.afterCut, uid),
      ]);
      for (const pair of input.pairs) {
        if (
          !left.courses
            .find((c) => c.id === pair.courseId)
            ?.activities.includes(pair.before) ||
          !right.courses
            .find((c) => c.id === pair.courseId)
            ?.activities.includes(pair.after)
        )
          throw precondition(
            "La correspondencia debe referir actividades seleccionadas de ambas fotografías.",
          );
      }
      const { expected, ...values } = input;
      const value = { ...values, actor: uid, previous: expected };
      const id = hash(canonical(value));
      await db.runTransaction(async (tx) => {
        admin(await membership(uid, tx));
        const ref = db.doc(
          `comparisonPointers/${hash(canonical([input.beforeCut, input.afterCut]))}`,
        );
        const previous = (await tx.get(ref)).data();
        const existing = await tx.get(db.doc(`comparisonMappings/${id}`));
        if (existing.exists) return;
        if ((previous?.id ?? null) !== expected) throw conflict();
        tx.create(db.doc(`comparisonMappings/${id}`), {
          ...value,
          id,
          recordedAt: Date.now(),
        });
        tx.set(ref, { id });
      });
      return { ok: true, id };
    }
    case "compareCuts":
    case "exportComparison": {
      const input = historyOperations[op].parse(raw);
      await closedPair(input.beforeCut, input.afterCut);
      const mappingId =
        input.mappingId !== undefined
          ? input.mappingId
          : ((
              await db
                .doc(
                  `comparisonPointers/${hash(canonical([input.beforeCut, input.afterCut]))}`,
                )
                .get()
            ).data()?.id as string | undefined);
      const map = mappingId
        ? (await db.doc(`comparisonMappings/${mappingId}`).get()).data()
        : undefined;
      if (
        mappingId &&
        (!map ||
          map.beforeCut !== input.beforeCut ||
          map.afterCut !== input.afterCut)
      )
        throw missing();
      // Activity identifies the BEFORE endpoint, scoped to each course instance.
      // Resolve before aggregating, including any registration-state filter.
      const pairs = ((map?.pairs ?? []) as Correspondence[]).filter(
        (p) => !input.filters.activity || p.before === input.filters.activity,
      );
      const activities = (side: "before" | "after") =>
        input.filters.activity
          ? new Map(pairs.map((p) => [p.courseId, p[side]]))
          : undefined;
      const [left, right] = await Promise.all([
        full(input.beforeCut, uid, input.filters, activities("before")),
        full(input.afterCut, uid, input.filters, activities("after")),
      ]);
      const result = compareHistory(left, right, pairs);
      result.mappingId = mappingId ?? null;
      result.mappingAudit = map
        ? `${map.actor}: ${map.reason} (${map.recordedAt})`
        : "Sin correspondencia aprobada";
      if (canonical(await membership(uid)) !== canonical(member)) denied();
      if (op === "exportComparison") {
        const rows: unknown[][] = [
          ["Cortes", input.beforeCut, input.afterCut],
          ["Filtros", canonical(input.filters)],
          ["Correspondencia", result.mappingId, result.mappingAudit],
          ["Fotografías", ...result.snapshots],
          ["Motivo", result.reason],
          ["Universo común", result.universe],
          ["Corte", "N", "G", "V", "E", "Z", "D", "Cobertura"],
          ...[
            [input.beforeCut, result.before, result.beforeCoverage],
            [input.afterCut, result.after, result.afterCoverage],
          ].map(([id, c, coverage]) => [
            id,
            ...Object.values(c as object),
            coverage,
          ]),
          ["Diferencia en puntos porcentuales", result.differencePoints],
          [
            "Estudiante",
            "Curso",
            "Actividad anterior",
            "Actividad posterior",
            "Estado anterior",
            "Original anterior",
            "Estado posterior",
            "Original posterior",
            "Versión anterior",
            "Versión posterior",
          ],
          ...result.common.map((r) => [
            r.student,
            r.courseId,
            r.beforeActivity,
            r.afterActivity,
            r.before.state,
            r.before.raw,
            r.after.state,
            r.after.raw,
            r.beforeVersion,
            r.afterVersion,
          ]),
          [
            "Cambios separados",
            "Estudiante",
            "Curso",
            "Descripción",
            "Procedencia",
          ],
          ...result.changes.map((r) => [
            r.kind,
            r.student,
            r.courseId,
            r.description,
            r.provenance,
          ]),
        ];
        return exportRows(rows, uid);
      }
      const rows = result[input.section];
      result.total = rows.length;
      result.next = input.offset + 25 < rows.length ? input.offset + 25 : null;
      result.common =
        input.section === "common"
          ? result.common.slice(input.offset, input.offset + 25)
          : [];
      result.changes =
        input.section === "changes"
          ? result.changes.slice(input.offset, input.offset + 25)
          : [];
      return result;
    }
    case "saveCase": {
      const input = historyOperations.saveCase.parse(raw);
      const student = identity(input.student).normalized;
      if (!student) throw missing();
      const target = { cutId: input.cutId, courseId: input.courseId, student };
      const anchor = await authorizeCase(target, uid);
      const id = hash(canonical(target)),
        revisionId = hash(canonical([uid, input.requestId]));
      const value = {
        ...input,
        student,
        actor: uid,
        caseId: id,
        id: revisionId,
        previous: input.expected,
        snapshotId: anchor.snapshotId,
      };
      await db.runTransaction(async (tx) => {
        if (canonical(await membership(uid, tx)) !== canonical(member))
          denied();
        const ref = db.doc(`followUps/${id}`),
          previous = (await tx.get(ref)).data();
        const revision = db.doc(`followUpRevisions/${revisionId}`),
          old = (await tx.get(revision)).data();
        if (old) {
          if (old.payloadHash !== hash(canonical(value))) throw conflict();
          return;
        }
        if ((previous?.head ?? null) !== input.expected) throw conflict();
        if (!previous) {
          const captured = await captureMetrics(tx, input.cutId, uid, member);
          if (captured.id !== anchor.snapshotId) throw conflict();
        }
        tx.create(revision, {
          ...value,
          recordedAt: Date.now(),
          payloadHash: hash(canonical(value)),
        });
        tx.set(ref, { ...target, ...anchor, head: revisionId });
      });
      return { ok: true, id, head: revisionId };
    }
    case "caseById":
    case "caseHistory":
    case "exportCase": {
      const input = historyOperations[op].parse(raw);
      let target: { cutId: string; courseId: string; student: string };
      if ("id" in input) {
        const row = (await db.doc(`followUps/${input.id}`).get()).data();
        if (!row) throw missing();
        target = {
          cutId: row.cutId,
          courseId: row.courseId,
          student: row.student,
        };
      } else {
        const student = identity(input.student).normalized;
        if (!student) throw missing();
        target = { cutId: input.cutId, courseId: input.courseId, student };
      }
      await authorizeCase(target, uid);
      const id = hash(canonical(target)),
        stored = (await db.doc(`followUps/${id}`).get()).data();
      const head =
        ("head" in input ? input.head : undefined) ?? stored?.head ?? null;
      if (
        head &&
        (await db.doc(`followUpRevisions/${head}`).get()).data()?.caseId !== id
      )
        throw missing();
      let next: string | null =
        ("cursor" in input ? input.cursor : undefined) ?? head;
      const rows: z.infer<typeof caseRevision>[] = [];
      const seen = new Set<string>();
      const limit = op === "exportCase" ? 10000 : 25;
      while (next && rows.length < limit) {
        if (seen.has(next)) throw precondition("Historial inconsistente.");
        seen.add(next);
        const rawRevision = (
          await db.doc(`followUpRevisions/${next}`).get()
        ).data();
        if (!rawRevision || rawRevision.caseId !== id) throw missing();
        const revision = caseRevision.parse(rawRevision);
        rows.push(revision);
        next = revision.previous;
      }
      if (op === "exportCase" && next)
        throw precondition("Bitácora excede el límite de exportación íntegra.");
      if (canonical(await membership(uid)) !== canonical(member)) denied();
      if (op === "exportCase")
        return exportRows(
          [
            ["Corte", "Curso", "Estudiante"],
            [target.cutId, target.courseId, target.student],
            [
              "Revisión",
              "Anterior",
              "Autor",
              "Registro del sistema",
              "Contacto civil",
              "Observación",
              "Responsable",
              "Siguiente acción",
              "Estado",
              "Contexto académico",
            ],
            ...rows.map((r) => [
              r.id,
              r.previous,
              r.actor,
              r.recordedAt,
              r.contactDate,
              r.observation,
              r.responsible,
              r.nextAction,
              r.status,
              r.snapshotId,
            ]),
          ],
          uid,
        );
      return casePage.parse({
        id,
        head,
        rows,
        cursor: next,
      });
    }
  }
}
async function authorizeCase(
  target: { cutId: string; courseId: string; student: string },
  uid: string,
) {
  const member = await membership(uid);
  const existing = (
    await db.doc(`followUps/${hash(canonical(target))}`).get()
  ).data();
  if (existing) {
    const anchor = z
      .object({ careerIds: z.array(z.string()), snapshotId: z.string() })
      .parse(existing);
    if (
      member.role !== "admin" &&
      !anchor.careerIds.some((id) => member.careers.includes(id))
    )
      denied();
    return anchor;
  }
  const data = await full(target.cutId, uid, {
    courseId: target.courseId,
    student: target.student,
  });
  if (
    !data.details.length &&
    !data.exclusions.some(
      (e) =>
        e.courseId === target.courseId &&
        identity(e.identity).normalized === target.student,
    )
  )
    throw missing();
  return {
    careerIds: [
      ...new Set([
        ...data.details.map((r) => r.careerId),
        ...data.exclusions.flatMap((e) =>
          e.courseId === target.courseId && e.careerId ? [e.careerId] : [],
        ),
      ]),
    ].sort(),
    snapshotId: data.snapshotId,
  };
}
async function exportRows(rows: unknown[][], uid: string) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  if (Buffer.byteLength(csv) > 8 * 1024 * 1024)
    throw precondition("Exportación excede 8 MiB; aplica filtros.");
  const path = `exports/${uid}/${hash(csv)}.csv`;
  await saveImmutable(path, Buffer.from(csv), "text/csv; charset=utf-8");
  return z.object({ csv: z.string(), path: z.string() }).parse({ csv, path });
}
