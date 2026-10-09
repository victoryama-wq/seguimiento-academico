import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  intakeOperations,
  originalViewSchema,
  administrativeReviewSchema,
  type OriginalView,
  type AdministrativeReview,
} from "../domain/intake-contract";
import {
  jobViewSchema,
  rowViewSchema,
  reviewSummarySchema,
  type Overview,
} from "../domain/import-contract";
import { courseFilename } from "../domain/academic";
import {
  callAcademic,
  fileBase64,
  okSchema,
} from "../infrastructure/academic-api";
import { Progress } from "./Progress";

const labels: Record<string, string> = {
  identity: "Matrícula o correo",
  name: "Nombre del alumno",
  career: "Programa del alumno",
  group: "Grupo",
  date: "Fecha de inscripción",
  modality: "Modalidad",
  shift: "Turno",
  program: "Nombre del programa",
  abbreviation: "Abreviatura",
  plan: "Plan",
  responsible: "Responsable",
  coordination: "Coordinación",
  campus: "Campus",
  kind: "Tipo administrativo",
};
const previewSchema = z.object({
  job: jobViewSchema,
  blocking: z.boolean(),
  rows: z.array(rowViewSchema),
  cursor: z.string().nullable(),
  issues: z.array(z.object({ code: z.string(), refs: z.array(z.string()) })),
  excluded: z.array(z.object({ identity: z.string(), reason: z.string() })),
  review: reviewSummarySchema.nullable().optional(),
});
const diagnostic = (error: unknown) =>
  error instanceof Error
    ? error.message.replace(/^Firebase:\s*/i, "")
    : "No se pudo completar el paso. Conserva los archivos y vuelve a intentarlo.";
const friendly = (error: unknown) => {
  const detail = diagnostic(error);
  if (/ZIP|archivo corrupto|unsupported|invalid xml/i.test(detail))
    return "No se pudo leer el archivo. Vuelve a exportarlo como CSV, XLSX u ODS y selecciónalo de nuevo. Los demás archivos se conservan.";
  if (/^\s*\[|invalid_type|unrecognized_keys/.test(detail))
    return "Hay datos incompletos o un formato no reconocido. Revisa las columnas y selecciones antes de volver a validar.";
  if (/internal|fetch|network|deadline-exceeded/i.test(detail))
    return "No se pudo completar la operación. Comprueba la conexión y recupera los trabajos guardados antes de reintentar.";
  return detail.replace(/\s*\[\d{3}\]$/, "");
};
type Choices = z.infer<
  typeof intakeOperations.prepareAdministration
>["catalogChoices"];
type Continuity = {
  previousKey: string;
  nextKey: string | null;
  reason: string;
}[];
type ProgramMaps = {
  program: string;
  abbreviation: string;
  careerId: string;
  reason: string;
}[];

function Columns({
  file,
  change,
  read,
}: {
  file: OriginalView;
  change: (v: OriginalView) => void;
  read: (v: OriginalView, offset?: number) => Promise<void>;
}) {
  const fields =
    file.kind === "roster"
      ? ["identity", "name", "career", "group", "date", "modality", "shift"]
      : file.kind === "catalog"
        ? [
            "program",
            "abbreviation",
            "plan",
            "responsible",
            "coordination",
            "campus",
            "kind",
          ]
        : ["identity"];
  return (
    <section aria-label={`Revisión de ${file.name}`}>
      <h4>{file.name}</h4>
      {file.sheets.length > 1 && (
        <label>
          Hoja de datos
          <select
            value={file.options.sheet ?? ""}
            onChange={(e) =>
              void read({
                ...file,
                options: { ...file.options, sheet: e.target.value },
              })
            }
          >
            <option value="">Selecciona una hoja</option>
            {file.sheets.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      {file.messages.map((m) => (
        <p role="status" key={m}>
          {m}
        </p>
      ))}
      {file.kind !== "matrix" && (
        <>
          <details>
            <summary>Revisar columnas reconocidas y formato</summary>
            <label>
              Fila de encabezados
              <input
                type="number"
                min="1"
                max="100"
                value={file.options.headerRow ?? 1}
                onChange={(e) =>
                  change({
                    ...file,
                    options: {
                      ...file.options,
                      headerRow: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            {file.sheets[0] === "CSV" && (
              <label>
                Separador
                <select
                  value={file.options.delimiter ?? ","}
                  onChange={(e) =>
                    change({
                      ...file,
                      options: {
                        ...file.options,
                        delimiter: e.target.value as "," | ";" | "\t",
                      },
                    })
                  }
                >
                  <option value=",">Coma</option>
                  <option value=";">Punto y coma</option>
                  <option value={"\t"}>Tabulador</option>
                </select>
              </label>
            )}
            <button type="button" onClick={() => void read(file)}>
              Volver a leer encabezados
            </button>
            {fields.map((field) => (
              <label key={field}>
                {labels[field]}
                <select
                  value={file.columns[field] ?? ""}
                  onChange={(e) => {
                    const columns = { ...file.columns };
                    if (e.target.value === "") delete columns[field];
                    else columns[field] = Number(e.target.value);
                    change({ ...file, columns });
                  }}
                >
                  <option value="">Sin columna / por revisar</option>
                  {file.headers.map((h, i) => (
                    <option value={i} key={i}>
                      {i + 1}. {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </details>
          <p>
            {file.count} filas leídas. Se muestran hasta 25 originales; no están
            publicados.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  {file.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {file.samples.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    {r.values.map((v, i) => (
                      <td key={i}>{String(v ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {file.next !== null && (
            <button type="button" onClick={() => void read(file, file.next!)}>
              Ver siguientes filas originales
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default function AdministrativeIntake({
  overview,
  changed,
}: {
  overview: Overview;
  changed: () => Promise<void>;
}) {
  const [roster, setRoster] = useState<OriginalView | null>(null),
    [catalog, setCatalog] = useState<OriginalView | null>(null),
    [matrix, setMatrix] = useState<OriginalView | null>(null);
  const [cycle, setCycle] = useState(""),
    [expected, setExpected] = useState<string | null>(null),
    [contextLoaded, setContextLoaded] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [review, setReview] = useState<AdministrativeReview | null>(null),
    [confirmed, setConfirmed] = useState<string | null>(null);
  const [catalogChoices, setCatalogChoices] = useState<Choices>([]),
    [continuity, setContinuity] = useState<Continuity>([]),
    [programMappings, setProgramMappings] = useState<ProgramMaps>([]);
  const [calendarChoices, setCalendarChoices] = useState<
    z.infer<typeof intakeOperations.prepareAdministration>["calendarChoices"]
  >([]);
  const [matrixChoices, setMatrixChoices] = useState<
    z.infer<typeof intakeOperations.prepareAdministration>["matrixChoices"]
  >([]);
  const [individualChoices, setIndividualChoices] = useState<
    z.infer<typeof intakeOperations.prepareAdministration>["individualChoices"]
  >([]);
  const [drafts, setDrafts] = useState<
    { id: string; cycle: string; published: boolean; createdAt: number }[]
  >([]);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");
  const [reportErrors, setReportErrors] = useState<
    { name: string; message: string; detail: string }[]
  >([]);
  const [cutId, setCutId] = useState(""),
    [progress, setProgress] = useState({
      schoolCut: 1,
      executiveUnit: 1,
      virtualUnit: 1,
    });
  const [reports, setReports] = useState<OriginalView[]>([]),
    [reportJobs, setReportJobs] = useState<
      { id: string; name: string; status: string }[]
    >([]),
    [reportPreview, setReportPreview] = useState<z.infer<
      typeof previewSchema
    > | null>(null),
    [reportConfirm, setReportConfirm] = useState<string | null>(null);
  const [identifications, setIdentifications] = useState<
    Record<
      string,
      { externalId: string; name: string; cycle: string; reason: string }
    >
  >({});
  const [activityChoices, setActivityChoices] = useState<
    Record<
      string,
      Record<
        number,
        {
          kind: "activity" | "total" | "category" | "metadata";
          unit?: number | undefined;
          additional?: boolean;
        }
      >
    >
  >({});
  const revision = useRef(0),
    cutRequest = useRef(
      crypto.randomUUID().replaceAll("-", "") +
        crypto.randomUUID().replaceAll("-", ""),
    );
  useEffect(() => {
    if (
      !cutId ||
      !reportJobs.some((j) =>
        ["queued", "processing", "awaiting_upload"].includes(j.status),
      )
    )
      return;
    let active = true;
    const timer = setInterval(() => {
      void callAcademic(
        "jobs",
        { cutId },
        z.object({ jobs: z.array(jobViewSchema) }),
      )
        .then((result) => {
          if (active)
            setReportJobs((prev) =>
              prev.map((j) => ({
                ...j,
                status:
                  result.jobs.find((v) => v.id === j.id)?.status ?? j.status,
              })),
            );
        })
        .catch(() => {
          if (active)
            setMessage(
              "No se pudo actualizar el progreso. Los trabajos siguen guardados; recupera el corte al volver a conectar.",
            );
        });
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [cutId, reportJobs]);
  const dirty = () => {
    setReviewDirty(true);
    setConfirmed(null);
  };
  const invalidate = () => {
    revision.current++;
    setReview(null);
    setConfirmed(null);
    setReviewDirty(false);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    setErrorDetail("");
    try {
      await fn();
    } catch (e) {
      setMessage(friendly(e));
      setErrorDetail(diagnostic(e));
    } finally {
      setBusy(false);
    }
  };
  async function loadContext(value: string) {
    if (value !== cycle) {
      setCatalogChoices([]);
      setContinuity([]);
      setIndividualChoices([]);
      setMatrixChoices([]);
      setProgramMappings([]);
      setCalendarChoices([]);
    }
    setContextLoaded(false);
    setCycle(value);
    invalidate();
    if (!value) return;
    const c = await callAcademic(
      "administrationContext",
      { cycle: value },
      z.object({ expected: z.string().nullable(), decisions: z.number() }),
    );
    setExpected(c.expected);
    setContextLoaded(true);
    setMessage(
      c.decisions
        ? `Se conservarán las decisiones vigentes del ciclo (${c.decisions}).`
        : "Si hay decisiones institucionales previas, adjunta su matriz aprobada antes de confirmar. No es necesario recapturarlas.",
    );
  }
  const setters = { roster: setRoster, catalog: setCatalog, matrix: setMatrix };
  async function upload(kind: "roster" | "catalog" | "matrix", file: File) {
    invalidate();
    if (kind === "roster") {
      setContinuity([]);
      setIndividualChoices([]);
    }
    if (kind === "catalog") setCatalogChoices([]);
    if (kind === "matrix") setMatrixChoices([]);
    const view = await callAcademic(
      "inspectOriginal",
      { kind, name: file.name, base64: await fileBase64(file) },
      originalViewSchema,
    );
    setters[kind](view);
    if (kind === "roster" && view.cycles.length === 1)
      await loadContext(view.cycles[0]!);
  }
  async function reread(file: OriginalView, offset = 0) {
    invalidate();
    const value = await callAcademic(
      "readOriginal",
      { id: file.id, options: file.options, offset },
      originalViewSchema,
    );
    if (file.kind === "report")
      setReports((rows) => rows.map((r) => (r.id === file.id ? value : r)));
    else setters[file.kind](value);
  }
  async function prepare() {
    if (!roster || !catalog || !contextLoaded) return;
    setConfirmed(null);
    const request = ++revision.current;
    const selected = (f: OriginalView) => ({
      id: f.id,
      columns: f.columns,
      options: f.options,
    });
    const value = await callAcademic(
      "prepareAdministration",
      {
        roster: selected(roster),
        catalog: selected(catalog),
        ...(matrix ? { matrix: matrix.id } : {}),
        cycle,
        expected,
        catalogChoices,
        continuity,
        programMappings,
        matrixChoices,
        individualChoices,
        calendarChoices,
      },
      administrativeReviewSchema,
    );
    if (revision.current === request) {
      setReview(value);
      setReviewDirty(false);
    }
  }
  async function validateReport(file: OriginalView, useEdits = true) {
    const choices = file.activities
      .filter((c) => c.column !== file.columns.identity)
      .map((c) => {
        const { column, ...value } = c;
        return {
          column,
          ...value,
          ...(useEdits ? activityChoices[file.id]?.[column] : {}),
        };
      });
    if (
      file.headers.some(
        (_, column) =>
          column !== file.columns.identity &&
          !choices.some((c) => c.column === column && c.kind !== "review"),
      )
    )
      throw new Error(
        "Clasifica las columnas marcadas «Por revisar». Las columnas reconocidas se conservan sin recapturarlas.",
      );
    const result = await callAcademic(
      "prepareOperationalReport",
      {
        file: {
          id: file.id,
          columns: file.columns,
          options: file.options,
          policyVersion: file.policyVersion,
        },
        cutId,
        ...(useEdits && identifications[file.id]
          ? { identification: identifications[file.id] }
          : {}),
        activities: choices,
      },
      z.object({ jobId: z.string(), course: z.string(), cycle: z.string() }),
    );
    setReportJobs((prev) => [
      ...prev.filter((j) => j.id !== result.jobId),
      { id: result.jobId, name: result.course, status: "queued" },
    ]);
    setMessage(
      `Reporte de ${result.course} recibido para validar. Revisa el resultado antes de confirmar; puedes cerrar y volver a abrir.`,
    );
  }
  async function viewReport(id: string, cursor?: string) {
    setReportConfirm(null);
    setReportPreview(null);
    const request = ++revision.current;
    const value = await callAcademic(
      "preview",
      { jobId: id, ...(cursor ? { cursor } : {}) },
      previewSchema,
    );
    if (request === revision.current) setReportPreview(value);
  }
  function choice(row: number, update: Partial<Choices[number]>) {
    dirty();
    setCatalogChoices((prev) => [
      ...prev.filter((c) => c.row !== row),
      {
        row,
        reason: "Clasificación confirmada en revisión administrativa",
        ...prev.find((c) => c.row === row),
        ...update,
      },
    ]);
  }
  async function restore(id: string) {
    invalidate();
    const saved = await callAcademic(
      "administrationDraft",
      { id },
      z.object({
        configuration: intakeOperations.prepareAdministration,
        roster: originalViewSchema,
        catalog: originalViewSchema,
        matrix: originalViewSchema.nullable(),
        review: administrativeReviewSchema,
      }),
    );
    setRoster(saved.roster);
    setCatalog(saved.catalog);
    setMatrix(saved.review.published ? null : saved.matrix);
    setCycle(saved.configuration.cycle);
    setExpected(
      saved.review.published ? saved.review.id : saved.configuration.expected,
    );
    setContextLoaded(true);
    setReview(saved.review);
    setCatalogChoices(
      saved.review.published ? [] : saved.configuration.catalogChoices,
    );
    setContinuity(saved.review.published ? [] : saved.configuration.continuity);
    setProgramMappings(
      saved.review.published ? [] : saved.configuration.programMappings,
    );
    setMatrixChoices(
      saved.review.published ? [] : saved.configuration.matrixChoices,
    );
    setIndividualChoices(
      saved.review.published ? [] : saved.configuration.individualChoices,
    );
    setCalendarChoices(
      saved.review.published ? [] : saved.configuration.calendarChoices,
    );
    setMessage(
      "Revisión recuperada. Puedes conservar un original y seleccionar únicamente el archivo que cambió.",
    );
  }
  const selectedCut = overview.cuts.find((c) => c.id === cutId);
  return (
    <section aria-label="Carga guiada institucional" className="guided-intake">
      <h3>Cargar archivos y preparar el seguimiento</h3>
      <p>
        Selecciona archivos → revisa resultados y observaciones → confirma. Los
        originales permanecen privados. Ningún archivo se publica al
        seleccionarlo.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () =>
            setDrafts(
              (
                await callAcademic(
                  "administrationDrafts",
                  {},
                  z.object({
                    drafts: z.array(
                      z.object({
                        id: z.string(),
                        cycle: z.string(),
                        published: z.boolean(),
                        createdAt: z.number(),
                      }),
                    ),
                  }),
                )
              ).drafts,
            ),
          )
        }
      >
        Recuperar revisiones guardadas
      </button>
      {drafts.map((d) => (
        <p key={d.id}>
          Ciclo {d.cycle} ·{" "}
          {d.published ? "Fuentes confirmadas" : "Propuesta pendiente"} ·{" "}
          {new Date(d.createdAt).toLocaleString("es-MX")}{" "}
          <button disabled={busy} onClick={() => void run(() => restore(d.id))}>
            Abrir revisión
          </button>
        </p>
      ))}
      <fieldset disabled={busy}>
        <legend>1. Padrón de alumnos</legend>
        <label>
          Seleccionar padrón original
          <input
            type="file"
            accept=".csv,.xlsx,.ods"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void run(() => upload("roster", f));
            }}
          />
        </label>
        {roster && (
          <Columns
            file={roster}
            change={(v) => {
              invalidate();
              setContinuity([]);
              setIndividualChoices([]);
              setRoster(v);
            }}
            read={(v, offset) => run(() => reread(v, offset))}
          />
        )}
        {roster && (
          <label>
            Ciclo de seguimiento
            <select
              value={cycle}
              onChange={(e) => void run(() => loadContext(e.target.value))}
            >
              <option value="">Selecciona el ciclo detectado</option>
              {[
                ...new Set([
                  ...roster.cycles,
                  ...overview.cycles.map((c) => c.id),
                ]),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      <fieldset disabled={busy || !roster}>
        <legend>2. Coordinadoras y carreras</legend>
        <label>
          Seleccionar catálogo original
          <input
            type="file"
            accept=".csv,.xlsx,.ods"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void run(() => upload("catalog", f));
            }}
          />
        </label>
        {catalog && (
          <Columns
            file={catalog}
            change={(v) => {
              invalidate();
              setCatalogChoices([]);
              setCatalog(v);
            }}
            read={(v, offset) => run(() => reread(v, offset))}
          />
        )}
        <details>
          <summary>Incorporar la matriz de decisiones ya aprobadas</summary>
          <p>
            Solo al incorporar decisiones que todavía están fuera del sistema.
            Selecciona la matriz institucional junto con los originales que
            fueron aprobados. En las cargas siguientes se conservan
            automáticamente.
          </p>
          <label>
            Matriz institucional aprobada
            <input
              type="file"
              accept=".xlsx,.ods"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(() => upload("matrix", f));
              }}
            />
          </label>
          {matrix && (
            <p>{matrix.name}: pendiente de validar contra ambos originales.</p>
          )}
        </details>
        <button
          disabled={!roster || !catalog || !contextLoaded}
          onClick={() => void run(prepare)}
        >
          Revisar alumnos, carreras y decisiones
        </button>
      </fieldset>
      {review && (
        <fieldset disabled={busy}>
          <legend>Revisión antes de confirmar las fuentes</legend>
          <p>
            {review.count} inscripciones; {review.persons} personas;{" "}
            {review.principals} principales; {review.excluded} personas
            excluidas;
            {review.excludedEnrollments} inscripciones excluidas.{" "}
            {review.preservedDecisions} decisiones conservadas.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Plan</th>
                  <th>Abreviatura</th>
                  <th>Responsable</th>
                  <th>Coordinación</th>
                  <th>Tipo</th>
                  <th>Campus</th>
                </tr>
              </thead>
              <tbody>
                {review.catalog.map((c) => (
                  <tr key={c.id}>
                    <td>{c.program}</td>
                    <td>{c.plan}</td>
                    <td>{c.abbreviation}</td>
                    <td>{c.responsible}</td>
                    <td>{c.coordination ?? "Por confirmar"}</td>
                    <td>{c.kind}</td>
                    <td>{c.campus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {review.issues.map((issue, i) => (
            <section key={`${issue.code}-${i}`} className="review-issue">
              <p role="alert">{issue.message}</p>
              {issue.code === "calendar" &&
                issue.candidates?.map((d) => (
                  <div key={d.key}>
                    <label>
                      Clasificación institucional de la fecha {d.label}
                      <select
                        value={
                          calendarChoices.find((c) => c.date === d.key)?.kind ??
                          ""
                        }
                        onChange={(e) => {
                          dirty();
                          setCalendarChoices((prev) => [
                            ...prev.filter((c) => c.date !== d.key),
                            {
                              date: d.key,
                              kind: e.target.value as
                                "base" | "especial" | "practica" | "excluida",
                              reason:
                                prev.find((c) => c.date === d.key)?.reason ??
                                "",
                            },
                          ]);
                        }}
                      >
                        <option value="">Pendiente</option>
                        <option value="base">Base</option>
                        <option value="especial">C.A. / especial</option>
                        <option value="practica">Práctica</option>
                        <option value="excluida">Excluida</option>
                      </select>
                    </label>
                    <label>
                      Motivo de clasificación de {d.label}
                      <input
                        value={
                          calendarChoices.find((c) => c.date === d.key)
                            ?.reason ?? ""
                        }
                        onChange={(e) => {
                          dirty();
                          setCalendarChoices((prev) =>
                            prev.map((c) =>
                              c.date === d.key
                                ? { ...c, reason: e.target.value }
                                : c,
                            ),
                          );
                        }}
                      />
                    </label>
                  </div>
                ))}
              {issue.code === "matrix_conflict" && issue.previousKey && (
                <>
                  <label>
                    Decisión ante el conflicto con la matriz
                    <select
                      value={
                        matrixChoices.find((c) => c.key === issue.previousKey)
                          ?.useMatrix === true
                          ? "matrix"
                          : matrixChoices.some(
                                (c) => c.key === issue.previousKey,
                              )
                            ? "current"
                            : ""
                      }
                      onChange={(e) => {
                        dirty();
                        setMatrixChoices((prev) => [
                          ...prev.filter((c) => c.key !== issue.previousKey),
                          {
                            key: issue.previousKey!,
                            useMatrix: e.target.value === "matrix",
                            reason:
                              prev.find((c) => c.key === issue.previousKey)
                                ?.reason ?? "",
                          },
                        ]);
                      }}
                    >
                      <option value="">Selecciona después de revisar</option>
                      <option value="current">
                        Conservar decisión vigente
                      </option>
                      <option value="matrix">
                        Incorporar decisión de la matriz
                      </option>
                    </select>
                  </label>
                  <label>
                    Motivo de resolución del conflicto
                    <input
                      value={
                        matrixChoices.find((c) => c.key === issue.previousKey)
                          ?.reason ?? ""
                      }
                      onChange={(e) => {
                        dirty();
                        setMatrixChoices((prev) =>
                          prev.map((c) =>
                            c.key === issue.previousKey
                              ? { ...c, reason: e.target.value }
                              : c,
                          ),
                        );
                      }}
                    />
                  </label>
                </>
              )}
              {issue.row &&
                ["kind", "coordination", "catalog_changed"].includes(
                  issue.code,
                ) && (
                  <>
                    {issue.code === "kind" && (
                      <label>
                        Tipo administrativo de la fila {issue.row}
                        <select
                          value={
                            catalogChoices.find((c) => c.row === issue.row)
                              ?.kind ?? ""
                          }
                          onChange={(e) =>
                            choice(issue.row!, {
                              kind: e.target.value as NonNullable<
                                Choices[number]["kind"]
                              >,
                            })
                          }
                        >
                          <option value="">Selecciona</option>
                          {[
                            "carrera",
                            "ingles",
                            "clinicos",
                            "deportes",
                            "practica",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {issue.code === "coordination" && (
                      <label>
                        Coordinación confirmada de la fila {issue.row}
                        <input
                          list="coordinaciones-detectadas"
                          value={
                            catalogChoices.find((c) => c.row === issue.row)
                              ?.coordination ?? ""
                          }
                          onChange={(e) =>
                            choice(issue.row!, { coordination: e.target.value })
                          }
                        />
                      </label>
                    )}
                    {issue.code === "catalog_changed" && (
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            catalogChoices.find((c) => c.row === issue.row)
                              ?.acceptChange ?? false
                          }
                          onChange={(e) =>
                            choice(issue.row!, {
                              acceptChange: e.target.checked,
                            })
                          }
                        />
                        Confirmo el cambio del catálogo de la fila {issue.row}
                      </label>
                    )}
                    <label>
                      Motivo de la decisión de la fila {issue.row}
                      <input
                        value={
                          catalogChoices.find((c) => c.row === issue.row)
                            ?.reason ?? ""
                        }
                        onChange={(e) =>
                          choice(issue.row!, { reason: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
              {issue.code === "decision_changed" && issue.previousKey && (
                <>
                  <label>
                    Destino de la decisión
                    <select
                      value={
                        continuity.find(
                          (c) => c.previousKey === issue.previousKey,
                        )?.nextKey ??
                        (continuity.some(
                          (c) => c.previousKey === issue.previousKey,
                        )
                          ? "history"
                          : "")
                      }
                      onChange={(e) => {
                        dirty();
                        setContinuity((prev) => [
                          ...prev.filter(
                            (c) => c.previousKey !== issue.previousKey,
                          ),
                          {
                            previousKey: issue.previousKey!,
                            nextKey:
                              e.target.value === "history"
                                ? null
                                : e.target.value,
                            reason:
                              prev.find(
                                (c) => c.previousKey === issue.previousKey,
                              )?.reason ?? "",
                          },
                        ]);
                      }}
                    >
                      <option value="">Selecciona después de revisar</option>
                      <option value="history">
                        Conservar únicamente en el historial anterior
                      </option>
                      {issue.candidates?.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Motivo de revisión de la decisión
                    <input
                      value={
                        continuity.find(
                          (c) => c.previousKey === issue.previousKey,
                        )?.reason ?? ""
                      }
                      onChange={(e) => {
                        dirty();
                        setContinuity((prev) =>
                          prev.map((c) =>
                            c.previousKey === issue.previousKey
                              ? { ...c, reason: e.target.value }
                              : c,
                          ),
                        );
                      }}
                    />
                  </label>
                </>
              )}
              {issue.code === "program" && issue.previousKey && (
                <label>
                  Programa y plan confirmados
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const [program, abbreviation] = JSON.parse(
                        issue.previousKey!,
                      ) as [string, string];
                      dirty();
                      setProgramMappings((prev) => [
                        ...prev.filter(
                          (m) =>
                            m.program !== program ||
                            m.abbreviation !== abbreviation,
                        ),
                        {
                          program,
                          abbreviation,
                          careerId: e.target.value,
                          reason:
                            "Correspondencia general confirmada al revisar programa, plan y abreviatura",
                        },
                      ]);
                    }}
                  >
                    <option value="">
                      Selecciona una correspondencia general
                    </option>
                    {issue.candidates?.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          ))}
          <datalist id="coordinaciones-detectadas">
            {[
              ...new Set(
                review.catalog
                  .flatMap((c) => [c.coordination, c.responsible])
                  .filter(Boolean),
              ),
            ].map((v) => (
              <option key={v} value={v!} />
            ))}
          </datalist>
          {(review.issues.length > 0 || reviewDirty) && (
            <button onClick={() => void run(prepare)}>
              Volver a validar las decisiones
            </button>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Programa y grupo originales</th>
                  <th>Fecha original</th>
                  <th>Estado y observación</th>
                  <th>Procedencia</th>
                </tr>
              </thead>
              <tbody>
                {review.rows.map((r, i) => (
                  <tr key={`${r.key}-${i}`}>
                    <td>
                      {r.identity} · {r.name}
                    </td>
                    <td>
                      {r.career} · {r.group}
                    </td>
                    <td>{r.originalDate}</td>
                    <td>
                      {r.state}: {r.reason}
                      {r.state === "pendiente" && (
                        <IndividualDecision
                          identity={r.identity}
                          value={individualChoices.find((c) => c.key === r.key)}
                          onChange={(v) => {
                            dirty();
                            setIndividualChoices((prev) => [
                              ...prev.filter((c) => c.key !== r.key),
                              { ...v, key: r.key },
                            ]);
                          }}
                        />
                      )}
                    </td>
                    <td>
                      {r.file}, fila {r.row}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {review.next !== null && (
            <button
              onClick={() =>
                void run(async () =>
                  setReview(
                    await callAcademic(
                      "administrationReview",
                      { id: review.id, offset: review.next },
                      administrativeReviewSchema,
                    ),
                  ),
                )
              }
            >
              Más alumnos y observaciones
            </button>
          )}
          {review.blocking && (
            <p>
              Hay observaciones pendientes. Revisa las decisiones indicadas o
              corrige el archivo original y vuelve a seleccionarlo; no se
              publicará información sin resolver.
            </p>
          )}
          {!review.published && (
            <>
              <label>
                <input
                  type="checkbox"
                  disabled={review.blocking || reviewDirty}
                  checked={confirmed === review.id}
                  onChange={(e) =>
                    setConfirmed(e.target.checked ? review.id : null)
                  }
                />
                Revisé esta propuesta y confirmo las fuentes y decisiones
                mostradas
              </label>
              <button
                disabled={
                  review.blocking || reviewDirty || confirmed !== review.id
                }
                onClick={() =>
                  void run(async () => {
                    await callAcademic(
                      "confirmAdministration",
                      { id: review.id },
                      okSchema,
                    );
                    setExpected(review.id);
                    setReview({ ...review, published: true });
                    setMessage(
                      "Fuentes confirmadas. Puedes preparar el corte y cargar los reportes.",
                    );
                    await changed();
                  })
                }
              >
                Confirmar padrón y catálogo
              </button>
            </>
          )}
          {review.published && (
            <p>Fuentes publicadas y originales conservados.</p>
          )}
        </fieldset>
      )}
      <fieldset disabled={busy}>
        <legend>3. Corte y avance por modalidad</legend>
        <label>
          Corte de trabajo
          <select
            value={cutId}
            onChange={(e) => {
              setCutId(e.target.value);
              setReportPreview(null);
              setReportConfirm(null);
              revision.current++;
            }}
          >
            <option value="">Preparar un nuevo corte</option>
            {overview.cuts
              .filter((c) => c.status === "open")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ?? `${c.cycleId} · ${c.date || "Corte anterior"}`}
                </option>
              ))}
          </select>
        </label>
        {selectedCut?.progress ? (
          <Progress
            cutId={selectedCut.id}
            displayLabel="este corte"
            progress={selectedCut.progress}
            editable={true}
            done={changed}
          />
        ) : (
          !cutId && (
            <>
              <p>
                El avance se solicita una sola vez por corte y se conserva entre
                cargas. No exige fechas operativas.
              </p>
              {(["schoolCut", "executiveUnit", "virtualUnit"] as const).map(
                (field, i) => (
                  <label key={field}>
                    {
                      [
                        "Corte Escolarizado",
                        "Unidad de avance Ejecutivo",
                        "Unidad de avance Virtual",
                      ][i]
                    }
                    <select
                      value={progress[field]}
                      onChange={(e) => {
                        setProgress({
                          ...progress,
                          [field]: Number(e.target.value),
                        });
                        cutRequest.current =
                          crypto.randomUUID().replaceAll("-", "") +
                          crypto.randomUUID().replaceAll("-", "");
                      }}
                    >
                      {Array.from(
                        { length: field === "schoolCut" ? 3 : 7 },
                        (_, n) => (
                          <option value={n + 1} key={n}>
                            {field === "schoolCut"
                              ? `${n + 1}: unidades 1–${[2, 5, 7][n]}`
                              : `Hasta unidad ${n + 1}`}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ),
              )}
              <button
                disabled={!cycle || !expected}
                onClick={() =>
                  void run(async () => {
                    const result = await callAcademic(
                      "prepareOperationalCut",
                      { cycle, progress, requestId: cutRequest.current },
                      z.object({ id: z.string() }),
                    );
                    setCutId(result.id);
                    await changed();
                    setMessage(
                      "Corte preparado. El avance permanecerá entre las cargas.",
                    );
                  })
                }
              >
                Preparar corte con este avance
              </button>
            </>
          )
        )}
      </fieldset>
      <fieldset disabled={busy || !cutId}>
        <legend>4. Reportes de calificaciones Moodle</legend>
        <label>
          Seleccionar reportes originales
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.ods"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              void run(async () => {
                if (
                  files.length > 20 ||
                  files.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024
                )
                  throw new Error(
                    "Selecciona hasta 20 archivos y 40 MiB por lote.",
                  );
                setReportConfirm(null);
                setReportPreview(null);
                const views: OriginalView[] = [];
                revision.current++;
                setReportErrors([]);
                setReports([]);
                setActivityChoices({});
                setIdentifications({});
                for (const [index, file] of files.entries()) {
                  setMessage(
                    `Leyendo archivo ${index + 1} de ${files.length}…`,
                  );
                  try {
                    const view = await callAcademic(
                      "inspectOriginal",
                      {
                        kind: "report",
                        name: file.name,
                        base64: await fileBase64(file),
                      },
                      originalViewSchema,
                    );
                    views.push(view);
                    setReports([...views]);
                    if (
                      view.columns.identity !== undefined &&
                      view.activities.length &&
                      view.activities.every((c) => c.kind !== "review")
                    ) {
                      try {
                        courseFilename(view.name);
                        await validateReport(view, false);
                      } catch (e) {
                        setReportErrors((prev) => [
                          ...prev,
                          {
                            name: file.name,
                            message: friendly(e),
                            detail: diagnostic(e),
                          },
                        ]);
                      }
                    }
                  } catch (e) {
                    setReportErrors((prev) => [
                      ...prev,
                      {
                        name: file.name,
                        message: friendly(e),
                        detail: diagnostic(e),
                      },
                    ]);
                  }
                }
                setMessage(
                  `${views.length} de ${files.length} archivos leídos. Revisa los resultados; las incidencias de un archivo no detienen los demás.`,
                );
              });
            }}
          />
        </label>
        {reportErrors.map((error, i) => (
          <div key={i}>
            <p role="alert">
              {error.name}: {error.message}
            </p>
            <details>
              <summary>Diagnóstico del archivo {error.name}</summary>
              <p>{error.detail}</p>
            </details>
          </div>
        ))}
        {reports.map((file) => {
          let identified: ReturnType<typeof courseFilename> | null = null;
          try {
            identified = courseFilename(file.name);
          } catch {
            /* Mostrar campos de resolución indispensables. */
          }
          const change = (v: OriginalView) => {
            setReportConfirm(null);
            setReportPreview(null);
            setReports((prev) => prev.map((r) => (r.id === v.id ? v : r)));
          };
          return (
            <section key={file.id}>
              <Columns
                file={file}
                change={change}
                read={(v, offset) => run(() => reread(v, offset))}
              />
              {identified ? (
                <p>
                  Curso detectado: {identified.externalId} · {identified.name}.
                  Ciclo {identified.cycle}. El cruce se realiza por matrícula y
                  principal de seguimiento.
                </p>
              ) : (
                <>
                  <p>
                    El nombre del archivo es ambiguo. Confirma únicamente estos
                    datos:
                  </p>
                  {(["externalId", "name", "cycle", "reason"] as const).map(
                    (field, i) => (
                      <label key={field}>
                        {
                          [
                            "Número del curso",
                            "Nombre de la asignatura",
                            "Ciclo del reporte",
                            "Motivo de identificación",
                          ][i]
                        }
                        <input
                          value={identifications[file.id]?.[field] ?? ""}
                          onChange={(e) =>
                            setIdentifications((prev) => ({
                              ...prev,
                              [file.id]: {
                                externalId: "",
                                name: "",
                                cycle: "",
                                reason: "",
                                ...prev[file.id],
                                [field]: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    ),
                  )}
                </>
              )}
              <details>
                <summary>
                  Revisar actividades cuando los encabezados sean ambiguos
                </summary>
                {file.headers.map((header, column) =>
                  column === file.columns.identity ? null : (
                    <div key={column}>
                      <label>
                        {header}
                        <select
                          value={
                            activityChoices[file.id]?.[column]?.kind ??
                            file.activities.find((c) => c.column === column)
                              ?.kind ??
                            "review"
                          }
                          onChange={(e) =>
                            setActivityChoices((prev) => ({
                              ...prev,
                              [file.id]: {
                                ...prev[file.id],
                                [column]: {
                                  ...prev[file.id]?.[column],
                                  kind: e.target.value as
                                    | "activity"
                                    | "total"
                                    | "category"
                                    | "metadata",
                                },
                              },
                            }))
                          }
                        >
                          <option value="review">Por revisar</option>
                          <option value="activity">Actividad</option>
                          <option value="total">Total (excluido)</option>
                          <option value="category">Categoría (excluida)</option>
                          <option value="metadata">Dato informativo</option>
                        </select>
                      </label>
                      <label>
                        Unidad de {header}
                        <select
                          value={
                            Object.hasOwn(
                              activityChoices[file.id]?.[column] ?? {},
                              "unit",
                            )
                              ? (activityChoices[file.id]?.[column]?.unit ?? "")
                              : (file.activities.find(
                                  (c) => c.column === column,
                                )?.unit ?? "")
                          }
                          onChange={(e) =>
                            setActivityChoices((prev) => ({
                              ...prev,
                              [file.id]: {
                                ...prev[file.id],
                                [column]: {
                                  kind:
                                    prev[file.id]?.[column]?.kind ?? "activity",
                                  ...(e.target.value
                                    ? {
                                        unit: Number(e.target.value),
                                        additional: false,
                                      }
                                    : { unit: undefined, additional: true }),
                                },
                              },
                            }))
                          }
                        >
                          <option value="">Adicional con nota numérica</option>
                          {[1, 2, 3, 4, 5, 6, 7].map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ),
                )}
              </details>
              <button onClick={() => void run(() => validateReport(file))}>
                Validar reporte {file.name}
              </button>
            </section>
          );
        })}
        <button
          onClick={() =>
            void run(async () => {
              const result = await callAcademic(
                "jobs",
                { cutId },
                z.object({ jobs: z.array(jobViewSchema) }),
              );
              setReportJobs(
                result.jobs
                  .filter((j) => j.kind === "report")
                  .map((j) => ({
                    id: j.id,
                    status: j.status,
                    name:
                      overview.courses.find((c) => c.id === j.courseId)?.name ??
                      "Reporte recibido",
                  })),
              );
            })
          }
        >
          Recuperar trabajos del corte
        </button>
        {reportJobs.map((job) => (
          <p key={job.id}>
            {job.name} ·{" "}
            {{
              queued: "En cola",
              processing: "Validando",
              awaiting_upload: "Recibiendo",
              ready: "Listo para revisar",
              invalid: "Requiere corrección",
              failed: "Se puede reintentar",
              published: "Publicado",
            }[job.status] ?? "Pendiente"}{" "}
            <button onClick={() => void run(() => viewReport(job.id))}>
              Revisar resultado de {job.name}
            </button>
          </p>
        ))}
        {reportPreview && (
          <section aria-label="Revisión de reporte">
            <h4>Resultado de validación</h4>
            <p>
              {reportPreview.job.status === "ready"
                ? "Listo para revisar"
                : reportPreview.job.status === "published"
                  ? "Publicado"
                  : "En procesamiento o requiere revisión. Actualiza el resultado."}
            </p>
            {reportPreview.job.error && (
              <p role="alert">
                El reporte requiere corrección. Revisa sus encabezados,
                identificación y matrículas, y vuelve a validarlo.
              </p>
            )}
            {reportPreview.job.status === "failed" && (
              <button
                onClick={() =>
                  void run(async () => {
                    await callAcademic(
                      "retry",
                      { jobId: reportPreview.job.id },
                      okSchema,
                    );
                    setReportConfirm(null);
                    setReportJobs((prev) =>
                      prev.map((j) =>
                        j.id === reportPreview.job.id
                          ? { ...j, status: "queued" }
                          : j,
                      ),
                    );
                    setReportPreview(null);
                  })
                }
              >
                Reintentar trabajo guardado
              </button>
            )}
            {["ready", "invalid"].includes(reportPreview.job.status) && (
              <button
                onClick={() =>
                  void run(async () => {
                    const job = await callAcademic(
                      "revalidate",
                      { jobId: reportPreview.job.id },
                      jobViewSchema,
                    );
                    setReportConfirm(null);
                    setReportPreview(null);
                    setReportJobs((prev) => [
                      ...prev.filter((j) => j.id !== job.id),
                      {
                        id: job.id,
                        name: "Reporte revalidado",
                        status: job.status,
                      },
                    ]);
                  })
                }
              >
                Revalidar con versiones vigentes
              </button>
            )}
            {reportPreview.job.error && (
              <details>
                <summary>Diagnóstico del trabajo</summary>
                <p>{reportPreview.job.error}</p>
              </details>
            )}
            {reportPreview.review && (
              <p>
                Actividades nuevas: {reportPreview.review.newActivities.length}.
                Valores nuevos: {reportPreview.review.added}; modificados:{" "}
                {reportPreview.review.changed}; sin cambios:{" "}
                {reportPreview.review.unchanged}; ausentes conservados:{" "}
                {reportPreview.review.preserved}. Atención:{" "}
                {reportPreview.review.numericCleared} notas numéricas se
                sustituirán por vacío o guion.
              </p>
            )}
            {reportPreview.issues.map((issue, i) => (
              <div role="alert" key={i}>
                {issue.code === "calificacion_invalida"
                  ? "Hay calificaciones no interpretables: se conservarán con su original y estado."
                  : "Hay una incidencia que requiere revisar identidad, afiliación o encabezados antes de publicar."}{" "}
                <details>
                  <summary>Diagnóstico de la incidencia</summary>
                  {issue.code}: {issue.refs.join(", ")}
                </details>
              </div>
            ))}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Principal de seguimiento</th>
                    <th>Calificaciones y estados</th>
                  </tr>
                </thead>
                <tbody>
                  {reportPreview.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.identity}</td>
                      <td>
                        {row.relationship?.trackingGroup} ·{" "}
                        {row.relationship?.trackingModality}. Impartición no
                        determinada.
                      </td>
                      <td>
                        {row.values
                          .map(
                            (v) =>
                              `${v.label ?? "Actividad"}: ${String(v.raw ?? "vacío")} (${v.state})`,
                          )
                          .join("; ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reportPreview.excluded.map((e, i) => (
              <p key={i}>
                Exclusión: {e.identity} · {e.reason}
              </p>
            ))}
            {reportPreview.cursor && (
              <button
                onClick={() =>
                  void run(() =>
                    viewReport(reportPreview.job.id, reportPreview.cursor!),
                  )
                }
              >
                Más alumnos del reporte
              </button>
            )}
            {reportPreview.job.status === "ready" && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={reportConfirm === reportPreview.job.id}
                    onChange={(e) =>
                      setReportConfirm(
                        e.target.checked ? reportPreview.job.id : null,
                      )
                    }
                  />
                  Revisé este reporte, sus observaciones y sustituciones
                </label>
                <button
                  disabled={
                    reportPreview.blocking ||
                    reportConfirm !== reportPreview.job.id
                  }
                  onClick={() =>
                    void run(async () => {
                      await callAcademic(
                        "publish",
                        {
                          jobId: reportPreview.job.id,
                          replace: !!reportPreview.job.replaces,
                        },
                        okSchema,
                      );
                      setReportConfirm(null);
                      await viewReport(reportPreview.job.id);
                      await changed();
                      setMessage(
                        "Reporte publicado. Las versiones anteriores y el avance se conservaron.",
                      );
                    })
                  }
                >
                  Confirmar publicación del reporte
                </button>
              </>
            )}
          </section>
        )}
      </fieldset>
      {busy && <p role="status">Procesando el paso seleccionado…</p>}
      {message && <p role="status">{message}</p>}
      {errorDetail && (
        <details>
          <summary>Diagnóstico del paso</summary>
          <p>{errorDetail}</p>
        </details>
      )}
    </section>
  );
}

type Individual = z.infer<
  typeof intakeOperations.prepareAdministration
>["individualChoices"][number];
function IndividualDecision({
  identity,
  value,
  onChange,
}: {
  identity: string;
  value: Individual | undefined;
  onChange: (v: Omit<Individual, "key">) => void;
}) {
  const [kind, setKind] = useState<Individual["kind"] | "">(value?.kind ?? "");
  const [reason, setReason] = useState(value?.reason ?? "");
  const [primary, setPrimary] = useState(value?.primary ?? false);
  const [originalDateApproved, setDate] = useState(
    value?.originalDateApproved ?? false,
  );
  const [groupApproved, setGroup] = useState(value?.groupApproved ?? false);
  return (
    <details>
      <summary>Resolver esta inscripción de {identity}</summary>
      <p>
        Excepción individual: no cambia las reglas generales ni los valores
        originales.
      </p>
      <label>
        Clasificación aprobada
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Individual["kind"])}
        >
          <option value="">Selecciona</option>
          <option value="base">Base</option>
          <option value="especial">C.A. / especial</option>
          <option value="excluida">Excluida del ciclo</option>
          <option value="baja">Baja aprobada</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={primary}
          onChange={(e) => setPrimary(e.target.checked)}
        />
        Afiliación principal para seguimiento
      </label>
      <label>
        <input
          type="checkbox"
          checked={originalDateApproved}
          onChange={(e) => setDate(e.target.checked)}
        />
        Aprobar expresamente la fecha original como excepción individual
      </label>
      <label>
        <input
          type="checkbox"
          checked={groupApproved}
          onChange={(e) => setGroup(e.target.checked)}
        />
        Aprobar expresamente la interpretación del grupo
      </label>
      <label>
        Motivo institucional
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <button
        disabled={!kind || !reason.trim()}
        onClick={() => {
          if (kind)
            onChange({
              kind,
              primary,
              originalDateApproved,
              groupApproved,
              reason,
            });
        }}
      >
        Incorporar resolución para volver a validar
      </button>
    </details>
  );
}
