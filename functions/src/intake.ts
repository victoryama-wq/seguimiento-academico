import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  intakeOperations,
  type OriginalView,
} from "../../src/domain/intake-contract";
import type { Operation } from "../../src/domain/import-contract";
import {
  courseFilename,
  courseNameKey,
  group,
  identity,
} from "../../src/domain/academic";
import { readTable, workbookData, type Table } from "../../src/importing/files";
import { institutionalMapping } from "../../src/importing/report-layout";
import { parseMoodle, suggestColumn } from "../../src/importing/mapping";
import {
  prepareApprovedPackage,
  decisionSheets,
} from "../../src/importing/approved-matrix";
import {
  approvedCalendar,
  standardSchedule,
  buildAdministration,
  sourceFor,
  suggestFields,
  tableMatrix,
} from "../../src/importing/intake";
import { validateAcademicPackage } from "../../src/importing/decisions";
import type { AcademicPackage } from "../../src/domain/decision-package";
import {
  admin,
  bucket,
  canonical,
  db,
  hash,
  jsonFile,
  membership,
  saveImmutable,
} from "./store";
import {
  academicSnapshot,
  type Artifact,
  type Course,
  type Cut,
  type Cycle,
  type Job,
} from "./jobs";

type Original = {
  id: string;
  kind: z.infer<typeof intakeOperations.inspectOriginal>["kind"];
  name: string;
  sha256: string;
  bytes: number;
  sheets: string[];
  options: OriginalView["options"];
  actor: string;
};
type Proposal = ReturnType<typeof buildAdministration> & {
  id: string;
  expected: string | null;
  actor: string;
  files: string[];
  mappings: unknown;
  createdAt: number;
};
type Dispatch = (
  op: Operation,
  input: unknown,
  uid: string,
) => Promise<unknown>;
const stale = () =>
  new HttpsError(
    "aborted",
    "Las fuentes cambiaron mientras revisabas. Actualiza la revisión antes de confirmar; se conservó tu propuesta.",
  );
async function original(id: string) {
  const doc = await db.doc(`intakeFiles/${id}`).get();
  if (!doc.exists)
    throw new HttpsError(
      "not-found",
      "No se encontró el archivo seleccionado. Selecciónalo de nuevo.",
    );
  const file = doc.data() as Original;
  const [bytes] = await bucket()
    .file(`intakeOriginals/${file.id}/source`)
    .download();
  if (hash(bytes) !== file.sha256 || bytes.length !== file.bytes)
    throw new HttpsError(
      "data-loss",
      "El original no coincide con su registro. Conserva el archivo y solicita revisión técnica.",
    );
  return { file, bytes };
}
async function context(cycleId: string) {
  const cycle = (await db.doc(`cycles/${cycleId}`).get()).data() as
    Cycle | undefined;
  const expected = cycle?.sources.academicPackage ?? null;
  const source = expected
    ? (await db.doc(`sources/${expected}`).get()).data()
    : undefined;
  const p = source
    ? validateAcademicPackage(
        (await jsonFile<Artifact>(String(source.artifact))).data,
        cycleId,
      )
    : undefined;
  return { expected, package: p, cycle };
}
async function fileView(
  file: Original,
  options: OriginalView["options"],
  offset = 0,
): Promise<OriginalView> {
  const result: OriginalView = {
    ...file,
    options,
    headers: [],
    columns: {},
    samples: [],
    count: 0,
    next: null,
    cycles: [],
    messages: [],
    activities: [],
    policyVersion: null,
  };
  if (file.kind === "matrix") {
    result.messages.push(
      "Matriz institucional conservada. Se validarán sus originales, firmas de archivo y decisiones al revisar el conjunto.",
    );
    return result;
  }
  if (file.sheets.length > 1 && !options.sheet) {
    result.messages.push(
      "El libro tiene varias hojas. Selecciona la hoja que contiene los datos.",
    );
    return result;
  }
  const { bytes } = await original(file.id);
  try {
    const table = readTable(bytes, file.name, options);
    result.headers = table.headers;
    result.columns = suggestFields(table.headers, file.kind);
    result.count = table.rows.length;
    result.samples = table.rows
      .slice(offset, offset + 25)
      .map((r) => ({ row: r.row, values: r.cells.map((c) => c.raw) }));
    result.next = offset + 25 < table.rows.length ? offset + 25 : null;
    if (file.kind === "report")
      result.activities = table.headers.flatMap<
        OriginalView["activities"][number]
      >((header, column) => {
        if (column === result.columns.identity) return [];
        // Reutiliza la misma política del trabajador, columna por columna. Las ambiguas quedan abiertas.
        try {
          const mapped = institutionalMapping({
            ...table,
            headers: ["Dirección Email", header],
          }).columns[0]!;
          return [
            {
              column,
              kind: mapped.kind as
                "activity" | "total" | "category" | "metadata",
              ...("unit" in mapped && mapped.unit ? { unit: mapped.unit } : {}),
              ...("additional" in mapped
                ? { additional: mapped.additional }
                : {}),
            },
          ];
        } catch {
          return [{ column, kind: "review" as const }];
        }
      });
    const col = result.columns.group;
    if (file.kind === "report") {
      let detected: ReturnType<typeof courseFilename> | undefined;
      try {
        detected = courseFilename(file.name);
      } catch {
        /* Identificación explícita en revisión. */
      }
      if (detected) {
        const external = (
          await db
            .doc(
              `courseExternalIds/${hash(`${detected.cycle}:${detected.externalId}`)}`,
            )
            .get()
        ).data();
        const course = external
          ? ((
              await db.doc(`courses/${external.courseId}`).get()
            ).data() as Course)
          : undefined;
        if (
          course &&
          courseNameKey(course.name) === courseNameKey(detected.name) &&
          course.columnPolicy
        ) {
          result.policyVersion = course.columnPolicy.version;
          result.activities = result.activities.map((c) => {
            const header = table.headers[c.column]!;
            const approved = course.columnPolicy!.fields[header];
            return approved &&
              table.headers.filter((h) => h === header).length === 1
              ? { column: c.column, ...approved }
              : c;
          });
          result.messages.push(
            "Se reutilizaron las columnas confirmadas de esta asignatura y ciclo. Las columnas nuevas se revisan por separado.",
          );
        }
      }
    }
    result.cycles =
      col === undefined
        ? []
        : [
            ...new Set(
              table.rows.flatMap((r) => {
                const cycle = group(
                  String(r.cells[col]?.raw ?? ""),
                  false,
                  true,
                ).cycle;
                return cycle ? [cycle] : [];
              }),
            ),
          ].sort();
  } catch (e) {
    result.messages.push(
      e instanceof Error
        ? e.message
        : "No se pudo leer el archivo. Revisa hoja, encabezado y formato.",
    );
  }
  return result;
}
async function proposalView(id: string, offset = 0) {
  const doc = await db.doc(`intakeProposals/${id}`).get();
  if (!doc.exists)
    throw new HttpsError("not-found", "La propuesta no está disponible.");
  const p = await jsonFile<Proposal>(String(doc.data()!.path));
  const byKey = new Map(p.package.enrollments.map((e) => [e.key, e]));
  const excludedKeys = new Set(
    p.resolved.observations
      .filter((o) => o.state === "excluido")
      .map((o) => o.id),
  );
  return {
    id,
    cycle: p.package.cycle,
    expected: p.expected,
    published: !!doc.data()!.published,
    blocking:
      p.issues.length > 0 ||
      p.resolved.observations.some((o) => o.state === "pendiente"),
    count: p.package.enrollments.length,
    persons: p.resolved.academic.persons.length,
    principals: p.resolved.academic.persons.filter((v) => v.baseEnrollmentId)
      .length,
    excluded: p.resolved.academic.persons.filter(
      (v) =>
        !v.baseEnrollmentId &&
        v.enrollmentIds.every((id) => excludedKeys.has(id)),
    ).length,
    excludedEnrollments: excludedKeys.size,
    preservedDecisions: p.preservedDecisions,
    catalog: p.package.catalog,
    issues: p.issues,
    rows: p.resolved.observations.slice(offset, offset + 50).map((o) => {
      const e = byKey.get(o.id);
      return {
        key: o.id,
        identity: o.identity,
        name: e?.original.name ?? "",
        group: o.group,
        career: e?.original.career ?? "",
        originalDate: e?.original.date ?? "",
        state: o.state,
        reason: o.reason,
        file: o.file,
        row: o.row,
      };
    }),
    next: offset + 50 < p.resolved.observations.length ? offset + 50 : null,
  };
}
export async function intakeOperation(
  op: keyof typeof intakeOperations,
  raw: unknown,
  actor: string,
  dispatch: Dispatch,
): Promise<unknown> {
  admin(await membership(actor));
  if (op === "inspectOriginal") {
    const v = intakeOperations.inspectOriginal.parse(raw),
      bytes = Buffer.from(v.base64, "base64");
    if (!bytes.length || bytes.length > 8 * 1024 * 1024)
      throw new HttpsError(
        "invalid-argument",
        "Selecciona un archivo de hasta 8 MiB.",
      );
    const sha256 = hash(bytes),
      id = hash(canonical([actor, v.kind, v.name, sha256]));
    let sheets: string[],
      options: OriginalView["options"] = {};
    try {
      if (/\.csv$/i.test(v.name)) {
        if (v.kind === "matrix")
          throw new Error(
            "La matriz de decisiones debe ser un libro XLSX u ODS.",
          );
        sheets = ["CSV"];
        const candidates = ([",", ";", "\t"] as const).flatMap((delimiter) => {
          try {
            const t = readTable(bytes, v.name, { delimiter });
            return [{ delimiter, columns: t.headers.length }];
          } catch {
            return [];
          }
        });
        const best = candidates.sort((a, b) => b.columns - a.columns)[0];
        if (!best)
          throw new Error(
            "No se pudo leer el CSV. Exporta UTF-8 y conserva filas del mismo ancho.",
          );
        options = { delimiter: best.delimiter };
      } else sheets = Object.keys(workbookData(bytes, v.name).sheets);
    } catch (e) {
      throw new HttpsError(
        "invalid-argument",
        e instanceof Error ? e.message : "Formato de archivo no reconocido.",
      );
    }
    const file: Original = {
      id,
      kind: v.kind,
      name: v.name,
      sha256,
      bytes: bytes.length,
      sheets,
      options,
      actor,
    };
    await saveImmutable(
      `intakeOriginals/${id}/source`,
      bytes,
      "application/octet-stream",
    );
    await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const ref = db.doc(`intakeFiles/${id}`);
      if (!(await tx.get(ref)).exists) tx.create(ref, file);
    });
    return fileView(file, options);
  }
  if (op === "readOriginal") {
    const v = intakeOperations.readOriginal.parse(raw);
    return fileView((await original(v.id)).file, v.options, v.offset);
  }
  if (op === "administrationContext") {
    const v = intakeOperations.administrationContext.parse(raw),
      state = await context(v.cycle);
    return {
      expected: state.expected,
      hasDecisions: (state.package?.decisions.length ?? 0) > 0,
      decisions: state.package?.decisions.length ?? 0,
    };
  }
  if (op === "administrationDrafts") {
    intakeOperations.administrationDrafts.parse(raw);
    const docs = await db
      .collection("intakeProposals")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    return {
      drafts: docs.docs.map((d) => ({
        id: d.id,
        cycle: String(d.data().cycle),
        published: !!d.data().published,
        createdAt: Number(d.data().createdAt),
      })),
    };
  }
  if (op === "administrationDraft") {
    const v = intakeOperations.administrationDraft.parse(raw);
    const meta = (await db.doc(`intakeProposals/${v.id}`).get()).data();
    if (!meta)
      throw new HttpsError("not-found", "No se encontró la revisión guardada.");
    const proposal = await jsonFile<Proposal>(String(meta.path));
    const configuration = intakeOperations.prepareAdministration.parse(
      proposal.mappings,
    );
    const restore = async (selected: typeof configuration.roster) => ({
      ...(await fileView((await original(selected.id)).file, selected.options)),
      columns: selected.columns,
    });
    return {
      configuration,
      roster: await restore(configuration.roster),
      catalog: await restore(configuration.catalog),
      matrix: configuration.matrix
        ? await fileView((await original(configuration.matrix)).file, {})
        : null,
      review: await proposalView(v.id),
    };
  }
  if (op === "prepareAdministration") {
    const v = intakeOperations.prepareAdministration.parse(raw);
    const state = await context(v.cycle);
    if (state.expected !== v.expected) throw stale();
    const id = hash(canonical({ v, actor })),
      path = `intakeProposals/${id}/proposal.json`;
    if ((await db.doc(`intakeProposals/${id}`).get()).exists)
      return proposalView(id);
    const [r, c] = await Promise.all([
      original(v.roster.id),
      original(v.catalog.id),
    ]);
    if (r.file.kind !== "roster" || c.file.kind !== "catalog")
      throw new HttpsError(
        "invalid-argument",
        "Selecciona padrón y catálogo en sus pasos correspondientes.",
      );
    let built: ReturnType<typeof buildAdministration>;
    try {
      const roster = readTable(r.bytes, r.file.name, v.roster.options),
        catalog = readTable(c.bytes, c.file.name, v.catalog.options);
      let initial: AcademicPackage | undefined;
      if (v.matrix) {
        const matrix = await original(v.matrix);
        if (matrix.file.kind !== "matrix")
          throw new Error("Selecciona la matriz institucional aprobada.");
        const book = workbookData(
          matrix.bytes,
          matrix.file.name,
          decisionSheets,
        );
        if (book.epoch !== "1900")
          throw new Error(
            "La matriz institucional requiere revisión de época; no se convertirán fechas por suposición.",
          );
        const prepared = prepareApprovedPackage({
          sheets: book.sheets,
          roster: tableMatrix(roster),
          catalog: tableMatrix(catalog),
          cycle: v.cycle,
          calendar: state.package?.calendar ?? approvedCalendar,
          schedule: state.package?.schedule ?? standardSchedule,
          sources: [
            sourceFor(roster, "P02"),
            sourceFor(catalog, "C02"),
            {
              id: "MATRIZ",
              name: matrix.file.name,
              sha256: matrix.file.sha256,
              bytes: matrix.file.bytes,
              sheet: "Inscripciones actuales",
            },
          ],
        });
        if (prepared.controls.discrepancies)
          throw new Error(
            "La matriz no coincide con los originales. Selecciona las versiones que fueron aprobadas o revisa las discrepancias.",
          );
        initial = prepared.package;
      }
      built = buildAdministration(
        roster,
        catalog,
        v,
        actor,
        state.package,
        initial,
      );
    } catch (e) {
      throw new HttpsError(
        "invalid-argument",
        e instanceof Error
          ? e.message
          : "Revisa columnas, fuentes y observaciones antes de continuar.",
      );
    }
    const proposal: Proposal = {
      ...built,
      id,
      expected: v.expected,
      actor,
      files: [v.roster.id, v.catalog.id, ...(v.matrix ? [v.matrix] : [])],
      mappings: v,
      createdAt: 0,
    };
    await saveImmutable(
      path,
      Buffer.from(JSON.stringify(proposal)),
      "application/json",
    );
    await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const current = (await tx.get(db.doc(`cycles/${v.cycle}`))).data() as
        Cycle | undefined;
      if ((current?.sources.academicPackage ?? null) !== v.expected)
        throw stale();
      const ref = db.doc(`intakeProposals/${id}`);
      if (!(await tx.get(ref)).exists)
        tx.create(ref, {
          path,
          cycle: v.cycle,
          actor,
          createdAt: Date.now(),
          published: false,
        });
    });
    return proposalView(id);
  }
  if (op === "administrationReview") {
    const v = intakeOperations.administrationReview.parse(raw);
    return proposalView(v.id, v.offset);
  }
  if (op === "confirmAdministration") {
    const v = intakeOperations.confirmAdministration.parse(raw);
    const view = await proposalView(v.id);
    if (view.blocking)
      throw new HttpsError(
        "failed-precondition",
        "Resuelve las observaciones pendientes antes de confirmar.",
      );
    const meta = (await db.doc(`intakeProposals/${v.id}`).get()).data()!;
    const proposal = await jsonFile<Proposal>(String(meta.path));
    const p = validateAcademicPackage(proposal.package, proposal.package.cycle);
    const artifact: Artifact = {
      data: p,
      source: {
        originals: proposal.files,
        mappings: proposal.mappings,
        previous: proposal.expected,
      },
      issues: [],
      count: p.enrollments.length,
      observations: proposal.resolved.observations,
    };
    const path = `derived/${v.id}/administration.json`;
    await saveImmutable(
      path,
      Buffer.from(JSON.stringify(artifact)),
      "application/json",
    );
    const normalized = Buffer.from(JSON.stringify(p));
    await saveImmutable(
      `originals/${v.id}/source`,
      normalized,
      "application/json",
    );
    await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const ref = db.doc(`cycles/${p.cycle}`),
        cycle = (await tx.get(ref)).data() as Cycle | undefined;
      const proposalRef = db.doc(`intakeProposals/${v.id}`),
        stored = (await tx.get(proposalRef)).data()!;
      if (stored.published) return;
      if ((cycle?.sources.academicPackage ?? null) !== proposal.expected)
        throw stale();
      const job: Job = {
        id: v.id,
        kind: "academicPackage",
        cycleId: p.cycle,
        cutId: null,
        courseId: null,
        file: {
          name: "decisiones-confirmadas.json",
          bytes: normalized.length,
          sha256: hash(normalized),
          mapping: {},
        },
        uid: actor,
        status: "published",
        attempt: 1,
        lease: 0,
        token: null,
        artifact: path,
        createdAt: Number(meta.createdAt),
        expected: proposal.expected,
        error: null,
        blocking: false,
      };
      tx.create(db.doc(`jobs/${v.id}`), job);
      tx.create(db.doc(`sources/${v.id}`), {
        kind: "academicPackage",
        cycleId: p.cycle,
        artifact: path,
        originalPaths: proposal.files.map(
          (id) => `intakeOriginals/${id}/source`,
        ),
        submittedBy: proposal.actor,
        approvedBy: actor,
        publishedAt: Date.now(),
        previous: proposal.expected,
      });
      tx.set(ref, {
        ...(cycle ?? { id: p.cycle, dates: p.calendar, createdBy: actor }),
        sources: { ...cycle?.sources, academicPackage: v.id },
        dates: p.calendar,
      });
      tx.update(proposalRef, {
        published: true,
        approvedBy: actor,
        publishedAt: Date.now(),
      });
    });
    return { ok: true };
  }
  if (op === "prepareOperationalCut") {
    const v = intakeOperations.prepareOperationalCut.parse(raw),
      id = `corte-${v.cycle}-${v.requestId.slice(0, 20)}`;
    const previous = (await db.doc(`cuts/${id}`).get()).data() as
      Cut | undefined;
    if (!previous)
      await dispatch(
        "createCut",
        { cycleId: v.cycle, id, progress: v.progress },
        actor,
      );
    await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const ref = db.doc(`cuts/${id}`),
        current = (await tx.get(ref)).data() as Cut;
      if (!current.label)
        tx.update(ref, {
          label: `Ciclo ${v.cycle} · preparado ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
        });
    });
    return { id };
  }
  if (op === "prepareOperationalReport") {
    const v = intakeOperations.prepareOperationalReport.parse(raw),
      selected = await original(v.file.id);
    if (selected.file.kind !== "report")
      throw new HttpsError("invalid-argument", "Selecciona un reporte Moodle.");
    const cut = (await db.doc(`cuts/${v.cutId}`).get()).data() as
      Cut | undefined;
    if (!cut || cut.status !== "open")
      throw new HttpsError(
        "failed-precondition",
        "Selecciona un corte abierto.",
      );
    let detected: ReturnType<typeof courseFilename> | undefined;
    try {
      detected = courseFilename(selected.file.name);
    } catch {
      /* La corrección explícita se valida abajo. */
    }
    const identification = v.identification ?? detected;
    if (
      !identification?.externalId ||
      !identification.cycle ||
      !identification.name
    )
      throw new HttpsError(
        "invalid-argument",
        "No se puede identificar el curso con certeza. Revisa número, asignatura y ciclo del archivo.",
      );
    if (identification.cycle !== cut.cycleId)
      throw new HttpsError(
        "invalid-argument",
        "El ciclo del reporte no coincide con el corte. Selecciona el corte correcto.",
      );
    let table: Table, mapping: ReturnType<typeof institutionalMapping>;
    try {
      table = readTable(selected.bytes, selected.file.name, v.file.options);
      if (v.activities) {
        const identityColumn = v.file.columns.identity;
        if (identityColumn === undefined)
          throw new Error(
            "Selecciona la columna de matrícula o correo; nunca se enlaza por nombre.",
          );
        mapping = {
          identity: { header: table.headers[identityColumn]! },
          columns: v.activities.map((c) => ({
            selector: { header: table.headers[c.column]!, column: c.column },
            kind: c.kind,
            ...(c.kind === "activity"
              ? {
                  activityId: `moodle-${hash(table.headers[c.column]!)}`,
                  ...(c.unit ? { unit: c.unit } : {}),
                  additional: c.additional ?? !c.unit,
                }
              : {}),
          })),
        };
      } else mapping = institutionalMapping(table);
      // También valida las selecciones manipuladas en servidor.
      parseMoodle(table, {
        ...mapping,
        identity: {
          ...mapping.identity,
          ...(v.file.columns.identity !== undefined
            ? { column: v.file.columns.identity }
            : {}),
        },
        sourceSha256: table.source.sha256,
        version: "preview",
        approvedBy: actor,
      });
      if (
        mapping.columns.some(
          (c) =>
            c.kind === "activity" &&
            ["total", "category"].includes(suggestColumn(c.selector.header)),
        )
      )
        throw new Error("Los totales y subtotales no son actividades.");
    } catch (e) {
      throw new HttpsError(
        "invalid-argument",
        e instanceof Error ? e.message : "Revisa las columnas del reporte.",
      );
    }
    const academic = await academicSnapshot(cut);
    const identityIndex =
      v.file.columns.identity ?? table.headers.indexOf(mapping.identity.header);
    const ids = new Set(
      table.rows
        .map((r) => identity(r.cells[identityIndex]?.raw).normalized)
        .filter(Boolean),
    );
    const careers = [
      ...new Set(
        academic.enrollments
          .filter((e) => ids.has(identity(e.identity).normalized))
          .map((e) => e.catalog?.id)
          .filter((id): id is string => !!id),
      ),
    ].sort();
    const externalRef = db.doc(
      `courseExternalIds/${hash(`${cut.cycleId}:${identification.externalId}`)}`,
    );
    const courseId = await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const current = (await tx.get(db.doc(`cuts/${cut.id}`))).data() as Cut;
      if (
        current.status !== "open" ||
        canonical(current.sources) !== canonical(cut.sources)
      )
        throw stale();
      const external = await tx.get(externalRef);
      if (external.exists) {
        const id = String(external.data()!.courseId),
          ref = db.doc(`courses/${id}`),
          course = (await tx.get(ref)).data() as Course;
        if (courseNameKey(course.name) !== courseNameKey(identification.name))
          throw new HttpsError(
            "failed-precondition",
            "El número de curso ya está registrado con otro nombre. Revisa la identificación; no se sustituirá por semejanza.",
          );
        // No elimina ámbitos previos de un curso compartido al recibir una carga parcial.
        if (
          v.file.policyVersion !== undefined &&
          v.file.policyVersion !== (course.columnPolicy?.version ?? null)
        )
          throw new HttpsError(
            "aborted",
            "Cambió la revisión de columnas de esta asignatura. Vuelve a leer el archivo antes de validarlo.",
          );
        tx.update(ref, {
          careers: [...new Set([...course.careers, ...careers])].sort(),
        });
        return id;
      }
      if (!careers.length)
        throw new HttpsError(
          "failed-precondition",
          "No se encontró ninguna matrícula con carrera resuelta. Revisa el padrón y las matrículas antes de crear el curso.",
        );
      const id = `curso-${hash(`${cut.cycleId}:${identification.externalId}`).slice(0, 30)}`;
      tx.create(externalRef, { courseId: id });
      tx.create(db.doc(`courses/${id}`), {
        id,
        cycleId: cut.cycleId,
        externalId: identification.externalId,
        name: identification.name,
        careers,
      });
      tx.create(db.collection("courseRegistrationAudit").doc(), {
        courseId: id,
        original: selected.file.id,
        actor,
        createdAt: Date.now(),
      });
      return id;
    });
    const batch = (await dispatch(
      "createBatch",
      {
        cutId: cut.id,
        files: [
          {
            name: selected.file.name,
            sha256: selected.file.sha256,
            bytes: selected.file.bytes,
            mapping: {
              ...mapping,
              identity: { ...mapping.identity, column: identityIndex },
              sourceSha256: selected.file.sha256,
              readOptions: v.file.options,
            },
            courseId,
            ...(v.identification
              ? { filenameResolution: v.identification }
              : {}),
          },
        ],
      },
      actor,
    )) as { jobs: { id: string }[] };
    const job = batch.jobs[0]!;
    await db.runTransaction(async (tx) => {
      admin(await membership(actor, tx));
      const ref = db.doc(`jobs/${job.id}`),
        stored = (await tx.get(ref)).data() as Job;
      const currentCourse = (
        await tx.get(db.doc(`courses/${courseId}`))
      ).data() as Course;
      if (
        stored.status === "awaiting_upload" &&
        stored.columnPolicyVersion === undefined
      )
        tx.update(ref, {
          columnPolicyVersion: currentCourse.columnPolicy?.version ?? null,
        });
    });
    await dispatch(
      "upload",
      { jobId: job.id, base64: selected.bytes.toString("base64") },
      actor,
    );
    return { jobId: job.id, course: identification.name, cycle: cut.cycleId };
  }
  throw new HttpsError("invalid-argument", "Operación desconocida.");
}
