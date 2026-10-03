import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  dashboardSchema,
  metricView,
  type Dashboard as Data,
  type MetricRequest,
} from "../domain/metrics-contract";
import { type Overview } from "../domain/import-contract";
import {
  callAcademic,
  downloadText,
  okSchema,
} from "../infrastructure/academic-api";

const labels = {
  institucion: "Institución / alcance autorizado",
  coordinacion: "Coordinación",
  carrera: "Carrera y plan",
  grupo: "Grupo base",
  modalidad: "Modalidad",
  turno: "Turno",
  asignatura: "Asignatura",
  estudiante: "Estudiante",
  docente: "Docente: registro de calificaciones",
  actividad: "Actividad",
};
const dimensions = {
  coordination: "Coordinación",
  careerId: "Carrera",
  plan: "Plan",
  group: "Grupo base",
  modality: "Modalidad",
  shift: "Turno",
  teacher: "Docente conocido",
} as const;
const percent = (v: number | null) =>
  v === null
    ? "Sin datos"
    : `${v.toLocaleString("es-MX", { maximumFractionDigits: 2 })} %`;

export default function Dashboard({ overview }: { overview: Overview }) {
  const [cutId, setCutId] = useState(overview.cuts[0]?.id ?? "");
  const [filters, setFilters] = useState<MetricRequest["filters"]>({});
  const [view, setView] = useState<MetricRequest["view"]>("institucion");
  const [section, setSection] = useState<MetricRequest["section"]>("groups");
  const [offset, setOffset] = useState(0);
  const [snapshotId, setSnapshotId] = useState<string | undefined>();
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [settledKey, setSettledKey] = useState("");
  const queryKey = JSON.stringify({
    cutId,
    filters,
    view,
    section,
    offset,
    snapshotId,
    refresh,
  });
  const loading = !!cutId && settledKey !== queryKey;
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => {
    if (!cutId) return;
    let active = true;
    void callAcademic(
      "dashboard",
      {
        cutId,
        filters,
        view,
        section,
        offset,
        ...(snapshotId ? { snapshotId } : {}),
      },
      dashboardSchema,
    )
      .then(
        (value) => {
          if (active) {
            setData(value);
            setError("");
          }
        },
        (e) => {
          if (active) {
            setData(null);
            setError(
              e instanceof Error ? e.message : "No se pudo consultar el panel.",
            );
          }
        },
      )
      .finally(() => {
        if (active) setSettledKey(queryKey);
      });
    return () => {
      active = false;
    };
  }, [cutId, filters, view, section, offset, snapshotId, refresh, queryKey]);
  function keepSnapshot() {
    if (data) setSnapshotId(data.snapshotId);
    setOffset(0);
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    keepSnapshot();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setFilters(
      Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v),
      ) as MetricRequest["filters"],
    );
  }
  function reload() {
    setSnapshotId(undefined);
    setOffset(0);
    setRefresh((n) => n + 1);
  }
  async function exportData() {
    if (!data) return;
    setExporting(true);
    setExportError("");
    try {
      const result = await callAcademic(
        "exportDashboard",
        {
          cutId,
          filters,
          view,
          section,
          offset: 0,
          snapshotId: data.snapshotId,
        },
        z.object({ csv: z.string(), snapshotId: z.string() }),
      );
      downloadText("seguimiento-filtrado.csv", result.csv);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "No se pudo exportar.");
    } finally {
      setExporting(false);
    }
  }
  const drill = (id: string) => {
    if (view === "actividad") {
      keepSnapshot();
      const split = id.indexOf(": ");
      setFilters((v) => ({
        ...v,
        courseId: id.slice(0, split),
        activity: id.slice(split + 2),
      }));
      setSection("details");
      return;
    }
    const keys: Partial<
      Record<MetricRequest["view"], keyof MetricRequest["filters"]>
    > = {
      coordinacion: "coordination",
      carrera: "careerId",
      grupo: "group",
      modalidad: "modality",
      turno: "shift",
      asignatura: "courseId",
      estudiante: "student",
      docente: "teacher",
    };
    keepSnapshot();
    const key = keys[view];
    if (key) setFilters((v) => ({ ...v, [key]: id }));
    setSection("details");
  };
  return (
    <section className="metrics" aria-label="Indicadores de seguimiento">
      <h2>
        Cobertura de calificaciones registradas en actividades seleccionadas
      </h2>
      <p>
        «-» significa sin calificación registrada; no demuestra falta de entrega
        ni retraso docente. Cero es una calificación numérica. No se calculan
        aprobación ni promedios normalizados.
      </p>
      {!overview.cuts.length ? (
        <p>No hay cortes configurados.</p>
      ) : (
        <>
          <label>
            Ciclo y corte
            <select
              value={cutId}
              onChange={(e) => {
                setCutId(e.target.value);
                setFilters({});
                setSnapshotId(undefined);
                setData(null);
                setOffset(0);
              }}
            >
              {overview.cuts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cycleId} / {c.id} · {c.date}
                </option>
              ))}
            </select>
          </label>
          <form
            className="metric-filters"
            key={JSON.stringify(filters)}
            onSubmit={apply}
          >
            {Object.entries(dimensions).map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  name={key}
                  defaultValue={filters[key as keyof typeof dimensions] ?? ""}
                >
                  <option value="">Todas las opciones autorizadas</option>
                  {(data?.facets[key as keyof typeof dimensions] ?? []).map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                  {key === "teacher" && (
                    <option value="sin_docente">
                      Sin docente identificado
                    </option>
                  )}
                </select>
              </label>
            ))}
            <label>
              Asignatura
              <select name="courseId" defaultValue={filters.courseId ?? ""}>
                <option value="">Todas las asignaturas autorizadas</option>
                {overview.courses
                  .filter(
                    (c) =>
                      c.cycleId ===
                      overview.cuts.find((c) => c.id === cutId)?.cycleId,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Matrícula del estudiante
              <input name="student" defaultValue={filters.student ?? ""} />
            </label>
            <label>
              Actividad dentro de la selección
              <input name="activity" defaultValue={filters.activity ?? ""} />
            </label>
            <label>
              Caso especial
              <select name="special" defaultValue={filters.special ?? ""}>
                <option value="">Base y especiales resueltos</option>
                <option value="con_especial">Con inscripción especial</option>
                <option value="solo_base">Sin inscripción especial</option>
              </select>
            </label>
            <label>
              Estado de registro del estudiante en el alcance
              <select
                name="registration"
                defaultValue={filters.registration ?? ""}
              >
                <option value="">Todos</option>
                <option value="completo">Todas numéricas</option>
                <option value="parcial">Registro parcial</option>
                <option value="ninguna_numerica">Ninguna numérica</option>
                <option value="sin_datos">Sin datos</option>
              </select>
            </label>
            <button disabled={loading}>Aplicar filtros</button>
            <button
              type="button"
              onClick={() => {
                keepSnapshot();
                setFilters({});
              }}
            >
              Limpiar filtros
            </button>
          </form>
          <label>
            Vista
            <select
              value={view}
              onChange={(e) => {
                keepSnapshot();
                setView(metricView.parse(e.target.value));
                setSection("groups");
              }}
            >
              {metricView.options.map((v) => (
                <option key={v} value={v}>
                  {labels[v]}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            {(
              [
                ["groups", "Resumen"],
                ["details", "Detalle de estudiantes"],
                ["courses", "Cursos y actividades"],
                ["exclusions", "Exclusiones e incidencias"],
              ] as const
            ).map(([s, label]) => (
              <button
                key={s}
                aria-pressed={section === s}
                onClick={() => {
                  keepSnapshot();
                  setSection(s);
                }}
              >
                {label}
              </button>
            ))}
            <button onClick={reload}>Actualizar versiones</button>
            <button
              disabled={!data || loading || exporting}
              onClick={() => void exportData()}
            >
              Exportar alcance filtrado
            </button>
          </div>
          {loading && <p role="status">Calculando el alcance autorizado…</p>}
          {error && !loading && (
            <p role="alert">
              {error} <button onClick={reload}>Reintentar panel</button>
            </p>
          )}
          {exportError && <p role="alert">{exportError}</p>}
          {data && !loading && (
            <>
              <p>
                Fecha del corte: {data.date}.{" "}
                {data.closed
                  ? "Corte cerrado: selección inmutable."
                  : "Corte abierto."}{" "}
                Fuente: versiones publicadas. Las páginas y exportación
                conservan la fotografía consultada hasta actualizar versiones.
              </p>
              <p className="metric-context">
                Filtros aplicados: {JSON.stringify(filters)} · Fotografía{" "}
                {data.snapshotId}
              </p>
              {data.state !== "datos" && (
                <p role="status">
                  {data.state === "sin_archivos_publicados"
                    ? "Sin archivos publicados"
                    : data.state === "sin_actividades_seleccionadas"
                      ? "Sin actividades seleccionadas"
                      : "Sin datos para este filtro"}
                </p>
              )}
              <dl className="metric-cards" data-testid="metric-totals">
                <div>
                  <dt>Estudiantes institucionales únicos medidos</dt>
                  <dd>{data.students}</dd>
                </div>
                <div>
                  <dt>Cobertura N/D</dt>
                  <dd>{percent(data.coverage)}</dd>
                </div>
                <div>
                  <dt>Guiones G/D</dt>
                  <dd>{percent(data.dashes)}</dd>
                </div>
                {(["N", "G", "V", "E", "Z", "D"] as const).map((k) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd data-testid={`count-${k}`}>{data.counts[k]}</dd>
                  </div>
                ))}
              </dl>
              <p>
                N numéricos · G guiones · V vacíos · E inválidos · Z ceros
                (dentro de N). D = N + G + V + E. Los porcentajes se agregan por
                denominadores.
              </p>
              <p>
                Catálogo esperado en alcance: {data.expected}; recibidos:{" "}
                {data.received}; validados: {data.validated}; publicados:{" "}
                {data.published}; con selección: {data.measured}; pendientes de
                publicación: {data.pending}. Con filtros de estudiante/grupo
                solo se incluyen cursos con filas atribuibles, sin inferir
                grupos de archivos ausentes.
              </p>
              <p>
                Exclusiones, especiales e incidencias trazables:{" "}
                {data.exclusionsCount}. No añaden observaciones. No se presume
                atribución provisional.
              </p>
              {view === "docente" && (
                <p>
                  Un curso puede tener varios docentes conocidos; sus filas se
                  superponen y no deben sumarse. El total institucional cuenta
                  cada observación una vez.
                </p>
              )}
              <div className="table-scroll">
                {section === "groups" && (
                  <table>
                    <caption>{labels[view]}</caption>
                    <thead>
                      <tr>
                        <th>Ámbito</th>
                        <th>Personas</th>
                        <th>N</th>
                        <th>G</th>
                        <th>V</th>
                        <th>E</th>
                        <th>Z</th>
                        <th>D</th>
                        <th>Cobertura</th>
                        <th>Registro</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.groups.map((g) => (
                        <tr key={g.id}>
                          <td>
                            {g.id === "sin_docente"
                              ? "Sin docente identificado"
                              : g.id}
                          </td>
                          <td>{g.students}</td>
                          {(["N", "G", "V", "E", "Z", "D"] as const).map(
                            (k) => (
                              <td key={k}>{g.counts[k]}</td>
                            ),
                          )}
                          <td>{percent(g.coverage)}</td>
                          <td>{g.registration}</td>
                          <td>
                            <button onClick={() => drill(g.id)}>
                              Ver detalle de {g.id}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {section === "details" && (
                  <table>
                    <caption>
                      Observaciones seleccionadas y afiliación base
                    </caption>
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        <th>Curso / versión</th>
                        <th>Grupo / modalidad / turno</th>
                        <th>Actividades y estados</th>
                        <th>Procedencia e incidencias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.details.map((r) => (
                        <tr key={`${r.courseId}:${r.identity}`}>
                          <td>{r.identity}</td>
                          <td>
                            {r.courseId}
                            <small>{r.versionId}</small>
                          </td>
                          <td>
                            {r.group} · {r.modality} · {r.shift}{" "}
                            {r.special && "· Con especial separado"}
                          </td>
                          <td>
                            {r.values
                              .map(
                                (v) =>
                                  `${v.activityId}: ${String(v.raw ?? "")} (${v.state})`,
                              )
                              .join("; ")}
                          </td>
                          <td>
                            {r.attribution}; {r.enrollmentIds.join("; ")};{" "}
                            {r.issues.join("; ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {section === "exclusions" && (
                  <table>
                    <caption>
                      Registros fuera del denominador y casos especiales
                    </caption>
                    <thead>
                      <tr>
                        <th>Identidad</th>
                        <th>Carrera / curso</th>
                        <th>Motivo</th>
                        <th>Procedencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exclusions.map((r, i) => (
                        <tr key={i}>
                          <td>{r.identity}</td>
                          <td>
                            {r.careerId} / {r.courseId ?? "Padrón"}
                          </td>
                          <td>{r.reason}</td>
                          <td>{r.provenance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {section === "courses" &&
                data.courses.map((c) => (
                  <article className="metric-course" key={c.id}>
                    <h3>{c.name}</h3>
                    {c.audit && (
                      <p className="metric-context">
                        Decisión: {c.audit.reason}. Actor: {c.audit.actor}.
                        Revisión anterior: {c.audit.previous ?? "Inicial"}.
                      </p>
                    )}
                    <p>
                      {c.status} ·{" "}
                      {c.teachers.join(", ") || "Sin docente identificado"} (
                      {c.teacherSource})
                    </p>
                    <p className="metric-context">
                      Versión: {c.versionId ?? "Sin archivo"}; selección:{" "}
                      {c.selectionId ?? "Sin selección"}. Actividades:{" "}
                      {c.activities.join(", ") || "Ninguna"}.
                    </p>
                    {overview.member.role === "admin" &&
                      c.versionId &&
                      !data.closed && (
                        <Selection
                          key={`${c.id}:${c.selectionId}`}
                          cutId={cutId}
                          course={c}
                          done={reload}
                        />
                      )}
                  </article>
                ))}
              {!data.total && <p>No hay filas para esta vista.</p>}
              <p>
                Mostrando desde {data.total ? offset + 1 : 0} de {data.total}{" "}
                resultados; hasta 25 por página.
              </p>
              <div className="actions">
                <button
                  disabled={!offset}
                  onClick={() => {
                    setSnapshotId(data.snapshotId);
                    setOffset(Math.max(0, offset - 25));
                  }}
                >
                  Página anterior
                </button>
                <button
                  disabled={data.next === null}
                  onClick={() => {
                    setSnapshotId(data.snapshotId);
                    setOffset(data.next!);
                  }}
                >
                  Página siguiente
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Selection({
  cutId,
  course,
  done,
}: {
  cutId: string;
  course: Data["courses"][number];
  done: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await callAcademic(
        "configureMetrics",
        {
          cutId,
          courseId: course.id,
          versionId: course.versionId,
          expected: course.selectionId,
          activities: fields.getAll("activity"),
          teachers: fields.get("assign")
            ? String(fields.get("teachers"))
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean)
            : null,
          reason: fields.get("reason"),
        },
        okSchema,
      );
      done();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)}>
      <fieldset>
        <legend>Actividades medidas de {course.name}</legend>
        {course.available.map((a) => (
          <label key={a}>
            <input
              type="checkbox"
              name="activity"
              value={a}
              defaultChecked={course.activities.includes(a)}
            />
            {a}
          </label>
        ))}
      </fieldset>
      <label>
        <input
          type="checkbox"
          name="assign"
          defaultChecked={course.teacherSource === "asignacion_administrativa"}
        />
        Asignación administrativa de docentes (sustituye evidencia del archivo)
      </label>
      <label>
        Docentes confirmados, separados por punto y coma
        <input name="teachers" defaultValue={course.teachers.join("; ")} />
      </label>
      <label>
        Motivo de la selección o asignación
        <input name="reason" required maxLength={250} />
      </label>
      <button disabled={busy}>Guardar universo de {course.name}</button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
