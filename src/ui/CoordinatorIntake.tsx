import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  originalViewSchema,
  type OriginalView,
} from "../domain/intake-contract";
import {
  jobViewSchema,
  rowViewSchema,
  reviewSummarySchema,
  type JobView,
  type Overview,
} from "../domain/import-contract";
import { observationSchema } from "../domain/decision-package";
import {
  callAcademic,
  fileBase64,
  okSchema,
} from "../infrastructure/academic-api";
import { OriginalColumns } from "./OriginalColumns";
import { Progress } from "./Progress";
import { cutLabel, rememberCut, selectedCut } from "./cut-selection";

const jobsSchema = z.object({
  jobs: z.array(jobViewSchema),
  cursor: z.string().nullable().optional(),
});
const previewSchema = z.object({
  job: jobViewSchema,
  reviewToken: z.string(),
  blocking: z.boolean(),
  rows: z.array(rowViewSchema),
  cursor: z.string().nullable(),
  observations: z.array(observationSchema),
  observationNext: z.number().nullable(),
  excluded: z.array(
    z.object({ identity: z.string(), row: z.number(), reason: z.string() }),
  ),
  inclusion: z.object({
    included: z.number().nullable(),
    excluded: z.number(),
  }),
  review: reviewSummarySchema.nullable(),
});
const preparedSchema = z.object({
  jobId: z.string(),
  course: z.string(),
  cycle: z.string(),
});
const status: Record<JobView["status"], string> = {
  awaiting_upload: "Pendiente de envío",
  queued: "En cola",
  processing: "Procesando",
  ready: "Listo para revisar",
  invalid: "Requiere revisión",
  failed: "No se pudo procesar",
  published: "Publicado",
};
const detail = (e: unknown) =>
  e instanceof Error ? e.message : "Operación no disponible";
function message(e: unknown) {
  const v = detail(e)
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\[\d{3}\]$/, "");
  if (/ZIP|corrupto|unsupported|invalid xml/i.test(v))
    return "No se pudo leer el archivo. Vuelve a exportarlo como CSV, XLSX u ODS y selecciona solo el archivo corregido; los demás se conservan.";
  if (/invalid_type|unrecognized_keys|^\s*\[/.test(v))
    return "Revisa la selección de columnas antes de validar de nuevo.";
  if (/internal|network|fetch|deadline/i.test(v))
    return "No se pudo completar la operación. Comprueba la conexión y recupera los trabajos guardados.";
  return v;
}
type Entry = {
  key: string;
  name: string;
  original?: File;
  view?: OriginalView;
  error?: string | undefined;
  diagnostic?: string | undefined;
  jobId?: string | undefined;
  pending?: boolean;
};

export default function CoordinatorIntake({
  overview,
  changed,
  onResults,
}: {
  overview: Overview;
  changed: () => Promise<void>;
  onResults: () => void;
}) {
  const [cutId, setCutId] = useState(() => selectedCut(overview));
  const [entries, setEntries] = useState<Entry[]>([]),
    [jobs, setJobs] = useState<JobView[]>([]);
  const [preview, setPreview] = useState<z.infer<typeof previewSchema> | null>(
    null,
  );
  const [confirmed, setConfirmed] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const revision = useRef(0);
  const cut = overview.cuts.find((c) => c.id === cutId);
  const invalidate = () => {
    revision.current++;
    setPreview(null);
    setConfirmed(null);
  };
  const update = (key: string, values: Partial<Entry>) =>
    setEntries((prev) =>
      prev.map((v) => (v.key === key ? { ...v, ...values } : v)),
    );
  const recover = useCallback(async () => {
    if (!cutId) return;
    const epoch = revision.current;
    let cursor: string | undefined;
    const all: JobView[] = [];
    do {
      const page = await callAcademic(
        "jobs",
        { cutId, ...(cursor ? { cursor } : {}) },
        jobsSchema,
      );
      all.push(...page.jobs);
      cursor = page.cursor ?? undefined;
    } while (cursor);
    if (epoch === revision.current) setJobs(all);
  }, [cutId]);
  const cancelRequests = useCallback(() => {
    revision.current++;
  }, []);
  useEffect(() => {
    rememberCut(cutId);
    void recover().catch((e: unknown) => setError(message(e)));
    return cancelRequests;
  }, [cutId, recover, cancelRequests]);
  useEffect(() => {
    if (!jobs.some((j) => ["queued", "processing"].includes(j.status))) return;
    const timer = setInterval(() => {
      void recover().catch((e: unknown) => setError(message(e)));
    }, 3000);
    return () => clearInterval(timer);
  }, [jobs, recover]);
  async function prepare(entry: Entry, view: OriginalView) {
    const activities = view.activities.filter(
      (a) => a.column !== view.columns.identity,
    );
    if (
      view.columns.identity === undefined ||
      activities.some((a) => a.kind === "review")
    )
      throw new Error(
        "Revisa la columna de matrícula. Las actividades ambiguas requieren decisión de Administración.",
      );
    const result = await callAcademic(
      "prepareOperationalReport",
      {
        cutId,
        file: {
          id: view.id,
          columns: view.columns,
          options: view.options,
          policyVersion: view.policyVersion,
        },
        activities,
      },
      preparedSchema,
    );
    update(entry.key, {
      jobId: result.jobId,
      error: undefined,
      diagnostic: undefined,
    });
  }
  async function inspect(entry: Entry) {
    if (!entry.original) return;
    const view = await callAcademic(
      "inspectOriginal",
      {
        kind: "report",
        cutId,
        name: entry.name,
        base64: await fileBase64(entry.original),
      },
      originalViewSchema,
    );
    update(entry.key, { view });
    await prepare(entry, view);
  }
  async function run(action: () => Promise<void>) {
    invalidate();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await recover();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function load(files: FileList | null) {
    if (!files?.length) return;
    if (
      files.length > 20 ||
      Array.from(files).reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024
    ) {
      setError(
        "Selecciona hasta 20 archivos y 40 MiB por lote. Divide la carga en varios lotes.",
      );
      return;
    }
    const added = Array.from(files).map((original): Entry => ({
      key: crypto.randomUUID(),
      original,
      name: original.name,
    }));
    setEntries((prev) => [...prev, ...added]);
    await run(async () => {
      for (const entry of added) {
        try {
          await inspect(entry);
        } catch (e) {
          update(entry.key, { error: message(e), diagnostic: detail(e) });
        }
      }
      await changed();
    });
  }
  async function read(entry: Entry, view: OriginalView, offset = 0) {
    await run(async () => {
      const next = await callAcademic(
        "readOriginal",
        { id: view.id, options: view.options, offset },
        originalViewSchema,
      );
      update(entry.key, { view: next, jobId: undefined, error: undefined });
    });
  }
  async function review(job: JobView, cursor?: string, observationOffset = 0) {
    invalidate();
    const epoch = revision.current;
    setBusy(true);
    setError("");
    try {
      const next = await callAcademic(
        "preview",
        { jobId: job.id, ...(cursor ? { cursor } : {}), observationOffset },
        previewSchema,
      );
      if (revision.current === epoch) setPreview(next);
    } catch (e) {
      if (revision.current === epoch) setError(message(e));
    } finally {
      if (revision.current === epoch) setBusy(false);
    }
  }
  async function publish() {
    if (!preview || confirmed !== preview.reviewToken) return;
    const reviewed = preview;
    await run(async () => {
      await callAcademic(
        "publish",
        {
          jobId: reviewed.job.id,
          replace: !!reviewed.job.replaces,
          reviewToken: reviewed.reviewToken,
        },
        okSchema,
      );
      setNotice(
        "Publicación confirmada. Puedes consultar los resultados de este corte.",
      );
    });
  }
  const courseName = (job: JobView) =>
    overview.courses.find((c) => c.id === job.courseId)?.name ??
    job.name ??
    "Reporte del corte";
  return (
    <section
      aria-label="Carga de reportes de coordinación"
      className="guided-intake"
    >
      <h3>
        Seleccionar corte → subir archivos → revisar → confirmar → consultar
        resultados
      </h3>
      <p>
        Solo se revisan y publican registros de tus carreras autorizadas. Los
        casos sin atribución quedan para Administración. El libro original se
        conserva privado.
      </p>
      {error && <p role="alert">{error}</p>}
      {!overview.cuts.length ? (
        <p>
          No hay cortes disponibles para tu ámbito. Solicita a Administración un
          corte con padrón confirmado.
        </p>
      ) : (
        <>
          <label>
            Corte para cargar y consultar
            <select
              disabled={busy}
              value={cutId}
              onChange={(e) => {
                invalidate();
                setEntries([]);
                setJobs([]);
                setNotice("");
                setError("");
                setCutId(e.target.value);
                rememberCut(e.target.value);
              }}
            >
              {overview.cuts.map((c) => (
                <option key={c.id} value={c.id}>
                  {cutLabel(c)}
                </option>
              ))}
            </select>
          </label>
          {cut?.progress && (
            <Progress
              cutId={cutId}
              progress={cut.progress}
              editable={false}
              done={changed}
            />
          )}
          {cut?.status === "closed" ? (
            <p>
              Este corte está cerrado. Sus datos se conservan; una corrección
              requiere revisión de Administración.
            </p>
          ) : (
            <label>
              Seleccionar reportes originales
              <input
                type="file"
                multiple
                accept=".csv,.xlsx,.ods"
                disabled={busy || !cut}
                onChange={(e) => {
                  const files = e.target.files;
                  void load(files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <p>
            Hasta 20 archivos, 8 MiB por archivo y 40 MiB por lote. Una carga
            parcial conserva las columnas y alumnos ausentes.
          </p>
          {busy && <p role="status">Procesando la solicitud…</p>}
          {entries.map((entry) => (
            <article key={entry.key} aria-label={`Archivo ${entry.name}`}>
              <h4>{entry.name}</h4>
              {entry.error && <p role="alert">{entry.error}</p>}
              {entry.pending && (
                <p>
                  Original conservado para revisión de Administración. Puedes
                  continuar con los otros archivos.
                </p>
              )}
              {entry.diagnostic && (
                <details>
                  <summary>Diagnóstico del archivo</summary>
                  <pre>{entry.diagnostic}</pre>
                </details>
              )}
              {entry.view && (
                <OriginalColumns
                  file={entry.view}
                  change={(view) => {
                    invalidate();
                    update(entry.key, { view, jobId: undefined });
                  }}
                  read={(view, offset) => read(entry, view, offset)}
                />
              )}
              {!entry.jobId && (
                <button
                  disabled={busy || cut?.status !== "open"}
                  onClick={() =>
                    void run(async () => {
                      try {
                        if (entry.view) await prepare(entry, entry.view);
                        else await inspect(entry);
                        await changed();
                      } catch (e) {
                        update(entry.key, {
                          error: message(e),
                          diagnostic: detail(e),
                        });
                      }
                    })
                  }
                >
                  {entry.view
                    ? "Validar este archivo"
                    : "Reintentar este archivo"}
                </button>
              )}
              {entry.view && entry.error && !entry.pending && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await callAcademic(
                        "requestReportReview",
                        { id: entry.view!.id, reason: entry.error },
                        okSchema,
                      );
                      update(entry.key, { pending: true });
                    })
                  }
                >
                  Dejar pendiente para Administración
                </button>
              )}
            </article>
          ))}
          <h4>Trabajos guardados de este corte</h4>
          <button disabled={busy} onClick={() => void run(recover)}>
            Recuperar trabajos
          </button>
          {!jobs.length && (
            <p>Todavía no hay trabajos visibles en este corte.</p>
          )}
          {jobs.map((job) => (
            <article
              key={job.id}
              data-testid={`job-${job.id}`}
              aria-label={`Trabajo ${courseName(job)}`}
            >
              <h4>{courseName(job)}</h4>
              <p>{status[job.status]}</p>
              {job.name && <p>{job.name}</p>}
              {["ready", "invalid", "published"].includes(job.status) && (
                <button disabled={busy} onClick={() => void review(job)}>
                  Revisar {courseName(job)}
                </button>
              )}
              {job.status === "failed" && (
                <button
                  disabled={busy || cut?.status !== "open"}
                  onClick={() =>
                    void run(async () => {
                      await callAcademic("retry", { jobId: job.id }, okSchema);
                    })
                  }
                >
                  Reintentar procesamiento
                </button>
              )}
              {["ready", "invalid", "published"].includes(job.status) &&
                cut?.status === "open" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await callAcademic(
                          "revalidate",
                          { jobId: job.id },
                          jobViewSchema,
                        );
                        setNotice(
                          "Se conservó el original. Recupera y revisa la nueva propuesta antes de confirmar.",
                        );
                      })
                    }
                  >
                    Revalidar con fuentes vigentes
                  </button>
                )}
              {job.error && (
                <details>
                  <summary>Diagnóstico del trabajo</summary>
                  <p>{job.error}</p>
                </details>
              )}
            </article>
          ))}
          {preview && (
            <section
              aria-label="Revisión antes de publicar"
              className="preview"
              data-testid={`preview-${preview.job.id}`}
            >
              <h4>
                {courseName(preview.job)} · {status[preview.job.status]}
              </h4>
              <p>
                Incluidos en tu ámbito: {preview.inclusion.included ?? 0}.
                Exclusiones visibles: {preview.inclusion.excluded}.
              </p>
              {preview.review && (
                <>
                  <p>
                    Actividades nuevas: {preview.review.newActivities.length}.
                    Calificaciones modificadas: {preview.review.changed}.
                    Valores sin cambios: {preview.review.unchanged}. Valores
                    conservados de cargas anteriores: {preview.review.preserved}
                    .
                  </p>
                  {preview.review.numericCleared > 0 && (
                    <p role="alert">
                      Atención: {preview.review.numericCleared} calificaciones
                      numéricas serán sustituidas por vacío o guion. Revisa cada
                      cambio antes de confirmar.
                    </p>
                  )}
                </>
              )}
              {preview.blocking && (
                <p role="alert">
                  Hay incidencias que requieren resolución antes de publicar.
                  Revisa las observaciones o solicita la revisión de
                  Administración.
                </p>
              )}
              <div
                className="table-scroll original-table"
                role="region"
                aria-label="Alumnos y principal de seguimiento"
                tabIndex={0}
              >
                <table style={{ minWidth: 850 }}>
                  <thead>
                    <tr>
                      <th>Matrícula</th>
                      <th>Principal de seguimiento</th>
                      <th>Calificaciones y cambios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ minWidth: 170 }}>
                          {row.identity}
                          <br />
                          Fila {row.row}
                        </td>
                        <td style={{ minWidth: 240 }}>
                          {row.relationship?.trackingGroup ?? "Por revisar"}
                          <br />
                          {row.relationship?.trackingModality}
                          <br />
                          Grupo de impartición: no determinado
                        </td>
                        <td style={{ minWidth: 350 }}>
                          {row.values.map((v) => (
                            <p key={v.activityId}>
                              {v.label ?? "Actividad"}:{" "}
                              {v.raw === "" || v.raw === null
                                ? "Vacío"
                                : String(v.raw)}{" "}
                              ({v.state})
                            </p>
                          ))}
                          {row.review
                            ?.filter((v) => v.kind === "changed")
                            .map((v) => (
                              <p key={v.activityId}>
                                Cambio en {v.label}:{" "}
                                {String(v.before?.raw ?? "Vacío")} →{" "}
                                {String(v.after.raw ?? "Vacío")}
                                {v.numericCleared
                                  ? " · Sustituye calificación numérica"
                                  : ""}
                              </p>
                            ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.cursor && (
                <button
                  disabled={busy}
                  onClick={() => void review(preview.job, preview.cursor!)}
                >
                  Siguientes alumnos
                </button>
              )}
              <h4>Incidencias y exclusiones de tu ámbito</h4>
              {preview.observations.map((o, i) => (
                <article key={`${o.id}-${i}`}>
                  <p>
                    {o.identity || "Identidad por revisar"} · fila {o.row} ·{" "}
                    {o.file}
                  </p>
                  <p>{o.reason}</p>
                  <p>Acción: {o.action}</p>
                  <details>
                    <summary>Diagnóstico</summary>
                    <p>
                      {o.rule} · {o.state} · {o.sourceVersion}
                    </p>
                    <p>Original: {JSON.stringify(o.original)}</p>
                    <p>Efectivo: {JSON.stringify(o.effective)}</p>
                  </details>
                </article>
              ))}
              {preview.excluded.map((e, i) => (
                <p key={i}>
                  {e.identity} · fila {e.row}: {e.reason}. Permanece fuera de
                  los indicadores.
                </p>
              ))}
              {preview.observationNext !== null && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void review(
                      preview.job,
                      undefined,
                      preview.observationNext!,
                    )
                  }
                >
                  Siguientes observaciones
                </button>
              )}
              {preview.job.status === "ready" &&
                !preview.blocking &&
                cut?.status === "open" && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={confirmed === preview.reviewToken}
                        onChange={(e) =>
                          setConfirmed(
                            e.target.checked ? preview.reviewToken : null,
                          )
                        }
                      />
                      He revisado esta propuesta y sus advertencias; confirmo la
                      publicación en mi ámbito.
                    </label>
                    <button
                      className="primary-button"
                      disabled={busy || confirmed !== preview.reviewToken}
                      onClick={() => void publish()}
                    >
                      Confirmar publicación
                    </button>
                  </>
                )}
            </section>
          )}
          {notice && <p role="status">{notice}</p>}
          <button
            onClick={() => {
              rememberCut(cutId);
              onResults();
            }}
          >
            Consultar resultados de este corte
          </button>
        </>
      )}
    </section>
  );
}
