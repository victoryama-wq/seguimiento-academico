import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
const History = lazy(() => import("./History"));
const Dashboard = lazy(() => import("./Dashboard"));
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { z } from "zod";
import { firebaseServices } from "../infrastructure/firebase";
import {
  callAcademic,
  downloadText,
  fileBase64,
  fileDescriptor,
  okSchema,
} from "../infrastructure/academic-api";
import {
  jobViewSchema,
  overviewSchema,
  rowViewSchema,
  type JobView,
  type Overview,
} from "../domain/import-contract";

const jobsSchema = z.object({
  jobs: z.array(jobViewSchema),
  cursor: z.string().nullable().optional(),
});
const previewSchema = z.object({
  excluded: z.array(
    z.object({ identity: z.string(), row: z.number(), reason: z.string() }),
  ),
  job: jobViewSchema,
  rows: z.array(rowViewSchema),
  cursor: z.string().nullable(),
  blocking: z.boolean(),
  issues: z.array(z.object({ code: z.string(), refs: z.array(z.string()) })),
  sourceCount: z.number().nullable(),
  filename: z
    .object({
      original: z.string(),
      sha256: z.string(),
      resolution: z.unknown(),
    })
    .nullable(),
});
const states: Record<JobView["status"], string> = {
  awaiting_upload: "Pendiente de envío",
  queued: "En cola",
  processing: "Procesando",
  ready: "Validado para revisión",
  invalid: "Archivo inválido",
  failed: "Error de procesamiento",
  published: "Publicado",
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";

export function AccessWorkspace({ section }: { section: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setOverview(await callAcademic("overview", {}, overviewSchema));
      setError("");
    } catch (e) {
      setOverview(null);
      setError(errorText(e));
    }
  }, []);
  useEffect(
    () =>
      onAuthStateChanged(firebaseServices().auth, (current) => {
        setUser(current);
        if (current) void refresh();
        else setOverview(null);
      }),
    [refresh],
  );
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    try {
      await signInWithEmailAndPassword(
        firebaseServices().auth,
        String(fields.get("email")),
        String(fields.get("password")),
      );
      setError("");
    } catch {
      setError(
        "No se pudo iniciar sesión. Comprueba tus credenciales y conexión.",
      );
    }
  }
  if (!user)
    return (
      <section className="access-card">
        <h2>Acceso institucional</h2>
        <p>Inicia sesión con una cuenta habilitada por administración.</p>
        <form onSubmit={(e) => void login(e)}>
          <label>
            Correo
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary-button">Iniciar sesión</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return (
    <section className="access-card">
      <div className="section-heading">
        <h2>
          {overview?.member.role === "admin"
            ? "Administración institucional"
            : "Acceso de coordinación"}
        </h2>
        <button onClick={() => void signOut(firebaseServices().auth)}>
          Cerrar sesión
        </button>
      </div>
      <p>{user.email}</p>
      {error && <p role="alert">{error}</p>}
      {!overview ? (
        <button onClick={() => void refresh()}>Revisar acceso</button>
      ) : (
        <>
          {section === "Configuración" &&
            (overview.member.role === "admin" ? (
              <AdminForm
                op="assignMember"
                title="Asignar acceso"
                fields={[
                  { name: "uid", label: "Identificador de usuario" },
                  {
                    name: "role",
                    label: "Rol (admin o coordinator)",
                    value: "coordinator",
                  },
                  {
                    name: "careers",
                    label: "Carreras autorizadas, separadas por coma",
                  },
                  {
                    name: "active",
                    label: "Acceso activo (true o false)",
                    value: "true",
                  },
                ]}
                transform={(v) => ({
                  uid: v.uid,
                  member: {
                    role: v.role,
                    active:
                      z.enum(["true", "false"]).parse(v.active) === "true",
                    careers: v
                      .careers!.split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })}
                done={refresh}
              />
            ) : (
              <p>
                Carreras autorizadas: {overview.member.careers.join(", ")}.
                Solicita cambios a administración.
              </p>
            ))}
          {section === "Ciclos y cortes" && (
            <>
              <ul>
                {overview.cuts.map((c) => (
                  <li key={c.id}>
                    {c.id} · {c.date} ·{" "}
                    {c.status === "closed" ? "Cerrado" : "Abierto"}
                  </li>
                ))}
              </ul>
              {overview.member.role === "admin" && (
                <>
                  <AdminForm
                    title="Crear ciclo"
                    op="createCycle"
                    fields={[
                      { name: "id", label: "Ciclo", value: "27-1" },
                      {
                        name: "dates",
                        label:
                          "Calendario aprobado (JSON de fecha y clasificación)",
                        area: true,
                        value:
                          '{"2026-08-31":"base","2026-08-29":"especial","2026-08-30":"practica","2026-08-28":"excluida","2026-08-27":"excluida","2026-08-26":"excluida"}',
                      },
                    ]}
                    transform={(v) => ({
                      id: v.id,
                      dates: JSON.parse(v.dates!),
                    })}
                    done={refresh}
                  />
                  <AdminForm
                    title="Registrar curso esperado"
                    op="createCourse"
                    fields={[
                      { name: "cycleId", label: "Ciclo del curso" },
                      { name: "id", label: "Instancia de curso" },
                      { name: "externalId", label: "ID del nombre de archivo" },
                      { name: "name", label: "Nombre del curso" },
                      {
                        name: "careers",
                        label: "Carreras del curso, separadas por coma",
                      },
                    ]}
                    transform={(v) => ({
                      ...v,
                      careers: v.careers!.split(",").map((s) => s.trim()),
                    })}
                    done={refresh}
                  />
                  <AdminForm
                    title="Crear corte"
                    op="createCut"
                    fields={[
                      { name: "cycleId", label: "Ciclo del corte" },
                      { name: "id", label: "Identificador del corte" },
                      {
                        name: "date",
                        label: "Fecha civil del corte",
                        type: "date",
                      },
                      {
                        name: "parentId",
                        label: "Corte cerrado de origen (solo revisión)",
                        optional: true,
                      },
                      {
                        name: "reason",
                        label: "Motivo de la revisión",
                        optional: true,
                      },
                    ]}
                    transform={(v) =>
                      Object.fromEntries(Object.entries(v).filter(([, x]) => x))
                    }
                    done={refresh}
                  />
                  <AdminForm
                    title="Cerrar corte"
                    op="closeCut"
                    fields={[{ name: "cutId", label: "Corte a cerrar" }]}
                    done={refresh}
                  />
                </>
              )}
            </>
          )}
          {section === "Historial y seguimiento" && (
            <Suspense fallback={<p role="status">Cargando historial…</p>}>
              <History overview={overview} />
            </Suspense>
          )}
          {section === "Fuentes" && <Imports overview={overview} />}
          {section === "Panel" && (
            <Suspense fallback={<p role="status">Cargando panel…</p>}>
              <Dashboard overview={overview} />
            </Suspense>
          )}
        </>
      )}
    </section>
  );
}

type Field = {
  name: string;
  label: string;
  value?: string;
  area?: boolean;
  type?: string;
  optional?: boolean;
};
function AdminForm({
  title,
  op,
  fields,
  transform = (v) => v,
  done,
}: {
  title: string;
  op:
    "assignMember" | "createCycle" | "createCourse" | "createCut" | "closeCut";
  fields: Field[];
  transform?: (v: Record<string, string>) => unknown;
  done: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const values = Object.fromEntries(
        new FormData(event.currentTarget),
      ) as Record<string, string>;
      await callAcademic(op, transform(values), okSchema);
      setMessage("Operación confirmada.");
      await done();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="admin-form">
      <summary>{title}</summary>
      <form onSubmit={(e) => void submit(e)}>
        {fields.map((f) => (
          <label key={f.name}>
            {f.label}
            {f.area ? (
              <textarea
                name={f.name}
                defaultValue={f.value}
                required={!f.optional}
              />
            ) : (
              <input
                name={f.name}
                type={f.type ?? "text"}
                defaultValue={f.value}
                required={!f.optional}
              />
            )}
          </label>
        ))}
        <button disabled={busy}>{title}</button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}

function Imports({ overview }: { overview: Overview }) {
  const [cutId, setCutId] = useState(overview.cuts[0]?.id ?? "");
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [jobsCursor, setJobsCursor] = useState<string | null>(null);
  const [jobsNext, setJobsNext] = useState<string | null>(null);
  const [files, setFiles] = useState<
    {
      file: File;
      courseId: string;
      mapping: string;
      filenameResolution: string;
      progress: string;
    }[]
  >([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<z.infer<typeof previewSchema> | null>(
    null,
  );
  const [careerId, setCareerId] = useState(overview.member.careers[0] ?? "");
  const [confirmedProposal, setConfirmedProposal] = useState<string | null>(
    null,
  );
  const previewRequest = useRef(0);
  const proposalKey = (job: JobView) => `${job.id}:${job.replaces ?? ""}`;
  const replace =
    preview !== null && confirmedProposal === proposalKey(preview.job);
  function clearPreview() {
    previewRequest.current += 1;
    setPreview(null);
    setConfirmedProposal(null);
  }
  const refresh = useCallback(async () => {
    const response = await callAcademic(
      "jobs",
      {
        ...(cutId ? { cutId } : {}),
        ...(jobsCursor ? { cursor: jobsCursor } : {}),
      },
      jobsSchema,
    );
    setJobs(response.jobs);
    setJobsNext(response.cursor ?? null);
  }, [cutId, jobsCursor]);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await callAcademic(
          "jobs",
          {
            ...(cutId ? { cutId } : {}),
            ...(jobsCursor ? { cursor: jobsCursor } : {}),
          },
          jobsSchema,
        );
        if (active) {
          setJobs(response.jobs);
          setJobsNext(response.cursor ?? null);
        }
      } catch (e) {
        if (active) setMessage(errorText(e));
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [cutId, jobsCursor]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      setMessage("Operación confirmada.");
      await refresh();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function uploadReports() {
    const descriptors = await Promise.all(
      files.map(async (f) => ({
        ...(await fileDescriptor(f.file, JSON.parse(f.mapping))),
        courseId: f.courseId,
        ...(f.filenameResolution.trim()
          ? { filenameResolution: JSON.parse(f.filenameResolution) }
          : {}),
      })),
    );
    const batch = await callAcademic(
      "createBatch",
      { cutId, files: descriptors },
      jobsSchema,
    );
    for (const [i, job] of batch.jobs.entries()) {
      setFiles((current) =>
        current.map((f, n) => (n === i ? { ...f, progress: "Enviando…" } : f)),
      );
      try {
        const result = await callAcademic(
          "upload",
          { jobId: job.id, base64: await fileBase64(files[i]!.file) },
          jobViewSchema,
        );
        setFiles((current) =>
          current.map((f, n) =>
            n === i ? { ...f, progress: states[result.status] } : f,
          ),
        );
      } catch {
        setFiles((current) =>
          current.map((f, n) =>
            n === i
              ? {
                  ...f,
                  progress:
                    "Envío fallido; selecciona de nuevo el mismo archivo para reintentar.",
                }
              : f,
          ),
        );
      }
    }
  }
  async function view(job: JobView, cursor?: string) {
    clearPreview();
    const request = previewRequest.current;
    const response = await callAcademic(
      "preview",
      {
        jobId: job.id,
        ...(careerId ? { careerId } : {}),
        ...(cursor ? { cursor } : {}),
      },
      previewSchema,
    );
    if (request === previewRequest.current && response.job.id === job.id)
      setPreview(response);
  }
  async function downloadOriginal(job: JobView) {
    const value = await callAcademic(
      "original",
      { jobId: job.id },
      z.object({ base64: z.string(), name: z.string(), sha256: z.string() }),
    );
    const bytes = Uint8Array.from(atob(value.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes]));
    const link = document.createElement("a");
    link.href = url;
    link.download = value.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <h3>Fuentes e importaciones</h3>
      <p>
        Hasta 20 archivos por lote, 8 MiB por archivo y 40 MiB en total. Tras
        confirmar el envío, el servidor continúa aunque cierres esta página.
      </p>
      <label>
        Corte de seguimiento
        <select
          value={cutId}
          onChange={(e) => {
            setCutId(e.target.value);
            setJobsCursor(null);
            clearPreview();
          }}
        >
          {overview.member.role === "admin" && (
            <option value="">Fuentes administrativas</option>
          )}
          {overview.cuts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · {c.status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Carrera para revisión
        <input
          value={careerId}
          onChange={(e) => {
            setCareerId(e.target.value);
            clearPreview();
          }}
          placeholder={
            overview.member.role === "admin"
              ? "Vacío: todas las carreras"
              : "Carrera autorizada"
          }
        />
      </label>
      {!cutId && overview.member.role === "admin" ? (
        <SourceUpload cycles={overview.cycles} done={refresh} />
      ) : (
        <>
          <label>
            Reportes Moodle
            <input
              type="file"
              accept=".csv,.ods,.xlsx"
              multiple
              onChange={(e) =>
                setFiles(
                  Array.from(e.target.files ?? []).map((file) => ({
                    file,
                    courseId: "",
                    mapping:
                      '{"identity":{"header":"Correo"},"columns":[{"selector":{"header":"Nota"},"kind":"activity","activityId":"actividad-1"}]}',
                    progress: "Pendiente de envío",
                    filenameResolution: "",
                  })),
                )
              }
            />
          </label>
          {files.map((f, i) => (
            <div className="upload-item" key={`${i}-${f.file.name}`}>
              <strong>{f.file.name}</strong>
              <label>
                Instancia para {f.file.name}
                <select
                  value={f.courseId}
                  onChange={(e) =>
                    setFiles((v) =>
                      v.map((r, n) =>
                        n === i ? { ...r, courseId: e.target.value } : r,
                      ),
                    )
                  }
                >
                  <option value="">Seleccionar curso</option>
                  {overview.courses
                    .filter(
                      (c) =>
                        c.cycleId ===
                        overview.cuts.find((v) => v.id === cutId)?.cycleId,
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Mapeo aprobado para {f.file.name}
                <textarea
                  value={f.mapping}
                  onChange={(e) =>
                    setFiles((v) =>
                      v.map((r, n) =>
                        n === i ? { ...r, mapping: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              {overview.member.role === "admin" && (
                <label>
                  Resolución administrativa del nombre para {f.file.name}
                  <textarea
                    value={f.filenameResolution}
                    placeholder={
                      'Opcional: {"externalId":"1","name":"Curso","cycle":"27-1","reason":"Motivo de la decisión"}'
                    }
                    onChange={(e) =>
                      setFiles((v) =>
                        v.map((r, n) =>
                          n === i
                            ? { ...r, filenameResolution: e.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
              )}
              <p>{f.progress}</p>
            </div>
          ))}
          <button
            disabled={busy || !files.length || !cutId}
            onClick={() => void run(uploadReports)}
          >
            Enviar lote
          </button>
        </>
      )}
      <p role="status">{message}</p>
      <button onClick={() => void run(refresh)} disabled={busy}>
        Actualizar trabajos
      </button>
      <ul className="job-list">
        {jobs.map((job) => (
          <li key={job.id} data-testid={`job-${job.id}`}>
            <strong>{job.courseId ?? job.kind}</strong>
            <p>
              {states[job.status]} · Intento {job.attempt}
            </p>
            {job.error && <p>{job.error}</p>}
            <small>Trabajo {job.id}</small>
            <div className="actions">
              <button onClick={() => void run(() => view(job))}>
                Revisar {job.courseId ?? job.kind}
              </button>
              {["failed", "processing"].includes(job.status) && (
                <button
                  onClick={() =>
                    void run(() =>
                      callAcademic("retry", { jobId: job.id }, okSchema),
                    )
                  }
                >
                  Reintentar
                </button>
              )}
              {overview.member.role === "admin" &&
                job.status !== "awaiting_upload" && (
                  <button onClick={() => void run(() => downloadOriginal(job))}>
                    Descargar original
                  </button>
                )}
            </div>
          </li>
        ))}
      </ul>
      {jobsCursor && (
        <button onClick={() => setJobsCursor(null)}>Primeros trabajos</button>
      )}
      {jobsNext && (
        <button onClick={() => setJobsCursor(jobsNext)}>Más trabajos</button>
      )}
      {preview && (
        <section className="preview" data-testid={`preview-${preview.job.id}`}>
          <h3>Revisión de {preview.job.courseId ?? preview.job.kind}</h3>
          <p>
            {preview.blocking
              ? "Requiere resolución administrativa. El archivo no se puede publicar."
              : "Comprueba los datos antes de confirmar la publicación."}
          </p>
          {preview.sourceCount !== null && (
            <p>Registros procesados: {preview.sourceCount}</p>
          )}
          {preview.filename && (
            <details className="filename-audit">
              <summary>Procedencia y resolución del nombre</summary>
              <p>Original: {preview.filename.original}</p>
              <p>SHA-256: {preview.filename.sha256}</p>
              <pre>{JSON.stringify(preview.filename.resolution, null, 2)}</pre>
              {preview.job.status === "invalid" && (
                <p>
                  Para corregir el nombre, selecciona de nuevo el mismo original
                  y completa la resolución administrativa con ID, nombre, ciclo
                  y motivo. Se conserva este trabajo.
                </p>
              )}
            </details>
          )}
          <ul>
            {preview.issues.map((v, i) => (
              <li key={i}>
                {v.code} · {v.refs.join(", ")}
              </li>
            ))}
          </ul>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Carrera</th>
                  <th>Calificaciones originales</th>
                  <th>Incidencias</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.identity}</td>
                    <td>{r.careerId}</td>
                    <td>
                      {r.values
                        .map(
                          (v) =>
                            `${v.activityId}: ${String(v.raw ?? "")} (${v.state})`,
                        )
                        .join("; ")}
                    </td>
                    <td>{r.issues.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.excluded.length > 0 && (
            <details>
              <summary>Exclusiones de este alcance (hasta 100)</summary>
              <ul>
                {preview.excluded.map((r) => (
                  <li key={r.row}>
                    {r.identity} · fila {r.row} · {r.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {preview.cursor && (
            <button
              onClick={() => void run(() => view(preview.job, preview.cursor!))}
            >
              Siguiente página
            </button>
          )}
          {preview.job.replaces && (
            <label>
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) =>
                  setConfirmedProposal(
                    e.target.checked ? proposalKey(preview.job) : null,
                  )
                }
              />
              Confirmo sustituir la versión anterior, conservando su historial
            </label>
          )}
          <button
            disabled={
              busy ||
              preview.blocking ||
              preview.job.status !== "ready" ||
              (!!preview.job.replaces && !replace)
            }
            onClick={() =>
              void run(async () => {
                const request = previewRequest.current;
                await callAcademic(
                  preview.job.kind === "report" ? "publish" : "publishSource",
                  { jobId: preview.job.id, replace },
                  okSchema,
                );
                if (request === previewRequest.current)
                  await view({ ...preview.job, status: "published" });
              })
            }
          >
            Confirmar publicación
          </button>
          {preview.job.status === "published" &&
            preview.job.courseId &&
            careerId && (
              <button
                onClick={() =>
                  void run(async () => {
                    const pages: string[] = [];
                    let cursor: string | null = null;
                    do {
                      const result: { csv: string; cursor: string | null } =
                        await callAcademic(
                          "export",
                          {
                            cutId: preview.job.cutId,
                            courseId: preview.job.courseId,
                            careerId,
                            versionId: preview.job.id,
                            ...(cursor ? { cursor } : {}),
                          },
                          z.object({
                            csv: z.string(),
                            cursor: z.string().nullable(),
                          }),
                        );
                      const firstLineEnd = result.csv.indexOf("\r\n");
                      pages.push(
                        pages.length
                          ? firstLineEnd < 0
                            ? ""
                            : result.csv.slice(firstLineEnd + 2)
                          : result.csv,
                      );
                      cursor = result.cursor;
                    } while (cursor);
                    downloadText(
                      "resultados-carrera.csv",
                      pages.filter(Boolean).join("\r\n"),
                    );
                  })
                }
              >
                Exportar mi carrera
              </button>
            )}
        </section>
      )}
    </>
  );
}

function SourceUpload({
  cycles,
  done,
}: {
  cycles: { id: string }[];
  done: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const file = fields.get("file") as File;
    setBusy(true);
    setMessage("Enviando fuente…");
    try {
      const job = await callAcademic(
        "createSource",
        {
          cycleId: fields.get("cycleId"),
          kind: fields.get("kind"),
          file: await fileDescriptor(
            file,
            JSON.parse(String(fields.get("mapping"))),
          ),
        },
        jobViewSchema,
      );
      const result = await callAcademic(
        "upload",
        { jobId: job.id, base64: await fileBase64(file) },
        jobViewSchema,
      );
      setMessage(states[result.status]);
      await done();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)}>
      <h4>Incorporar fuente administrativa</h4>
      <label>
        Ciclo de la fuente
        <select name="cycleId" required>
          {cycles.map((c) => (
            <option key={c.id}>{c.id}</option>
          ))}
        </select>
      </label>
      <label>
        Tipo de fuente
        <select name="kind">
          <option value="roster">Padrón</option>
          <option value="catalog">Catálogo</option>
          <option value="supplement">Suplemento</option>
          <option value="withdrawals">Bajas (JSON)</option>
          <option value="exceptions">Excepciones (JSON)</option>
        </select>
      </label>
      <label>
        Archivo de fuente
        <input
          type="file"
          name="file"
          accept=".csv,.ods,.xlsx,.json"
          required
        />
      </label>
      <label>
        Mapeo aprobado de encabezados (JSON)
        <textarea name="mapping" defaultValue="{}" required />
      </label>
      <p>
        Bajas y excepciones usan un arreglo JSON. El servidor registra quién
        aprobó la fuente. Los formatos y ejemplos están documentados en el
        contrato de importación.
      </p>
      <button disabled={busy}>Enviar fuente</button>
      <p role="status">{message}</p>
    </form>
  );
}
