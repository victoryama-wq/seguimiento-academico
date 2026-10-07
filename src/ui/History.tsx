import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import type { Overview } from "../domain/import-contract";
import {
  calendarSchema,
  casePage,
  comparisonSchema,
} from "../domain/history-contract";
import {
  callAcademic,
  downloadText,
  okSchema,
} from "../infrastructure/academic-api";

const exported = z.object({ csv: z.string(), path: z.string() });
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la consulta.";
const fields = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<
    string,
    string
  >;
};
const percentage = (v: number | null) =>
  v === null
    ? "No comparable"
    : v.toLocaleString("es-MX", { maximumFractionDigits: 2 });
export default function History({ overview }: { overview: Overview }) {
  return (
    <div className="history-workspace">
      <p>
        El acceso histórico usa tus carreras autorizadas actualmente. Una
        fotografía no conserva permisos revocados. No se envían recordatorios ni
        mensajes.
      </p>
      <Calendar overview={overview} />
      <Comparison overview={overview} />
      <CaseLog overview={overview} />
    </div>
  );
}
function Calendar({ overview }: { overview: Overview }) {
  const [cycle, setCycle] = useState(overview.cycles[0]?.id ?? "");
  const [data, setData] = useState<z.infer<typeof calendarSchema> | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      setData(
        await callAcademic(
          "historyCalendar",
          { cycleId: cycle },
          calendarSchema,
        ),
      );
    } catch (e) {
      setData(null);
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function plan(e: FormEvent<HTMLFormElement>) {
    const v = fields(e);
    setBusy(true);
    try {
      await callAcademic(
        "planCalendar",
        {
          cycleId: cycle,
          firstDate: v.firstDate,
          count: Number(v.count),
          ...(v.modality ? { modality: v.modality } : {}),
          ...(v.schoolCut ? { schoolCut: Number(v.schoolCut) } : {}),
        },
        okSchema,
      );
      await load();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function edit(e: FormEvent<HTMLFormElement>) {
    const v = fields(e);
    setBusy(true);
    try {
      await callAcademic("editCutDate", v, okSchema);
      await load();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Calendario de seguimiento">
      <h2>Calendario cada tres semanas</h2>
      <label>
        Ciclo del historial
        <select
          disabled={busy}
          value={cycle}
          onChange={(e) => {
            setCycle(e.target.value);
            setData(null);
          }}
        >
          {overview.cycles.map((c) => (
            <option key={c.id}>{c.id}</option>
          ))}
        </select>
      </label>
      <button disabled={busy || !cycle} onClick={() => void load()}>
        Consultar calendario y pendientes
      </button>
      {busy && <p role="status">Cargando calendario…</p>}
      {message && <p role="alert">{message}</p>}
      {data &&
        (!data.cuts.length ? (
          <p>Sin cortes configurados.</p>
        ) : (
          <ul>
            {data.cuts.map((c) => (
              <li key={c.id}>
                <strong>{c.id}</strong> · {c.date} ·{" "}
                {c.status === "closed" ? "Cerrado" : "Abierto"} · Pendientes de
                carga: {c.pending}
                {c.schoolCut && <p>Corte Escolarizado: {c.schoolCut}</p>}
                {c.parentId && (
                  <p>
                    Revisión de {c.parentId}: {c.reason} · Autor: {c.author}
                  </p>
                )}
                {c.closure && <p>Fotografía: {c.closure}</p>}
                {overview.member.role === "admin" && c.status === "open" && (
                  <details>
                    <summary>Ajustar fecha de {c.id}</summary>
                    <form onSubmit={(e) => void edit(e)}>
                      <input type="hidden" name="cutId" value={c.id} />
                      <input type="hidden" name="expected" value={c.date} />
                      <label>
                        Nueva fecha civil
                        <input
                          name="date"
                          type="date"
                          defaultValue={c.date}
                          required
                        />
                      </label>
                      <label>
                        Motivo del ajuste
                        <input name="reason" required />
                      </label>
                      <button disabled={busy}>Guardar fecha</button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ))}
      {overview.member.role === "admin" && (
        <details>
          <summary>Proponer calendario de cortes</summary>
          <p>
            Escolarizado usa el número de corte; Ejecutivo y Virtual usan
            semanas vencidas. El perfil anterior conserva intervalos de 21 días.
            Virtual tiene calendario independiente en la nueva configuración del
            ciclo. Son fechas de referencia flexibles. La fecha académica puede
            ajustarse antes de aceptar archivos; después requiere una revisión.
          </p>
          <form onSubmit={(e) => void plan(e)}>
            <label>
              Bloque Escolarizado para cortes semanales (1–3)
              <input name="schoolCut" type="number" min="1" max="3" />
            </label>
            <p>
              En calendario Escolarizado se asignan cortes 1, 2 y 3. En un lote
              semanal, indica el bloque de seguimiento Escolarizado; si cambia,
              crea otro lote. Cambiar la fecha conserva ese bloque.
            </p>
            <label>
              Modalidad del calendario
              <select name="modality">
                <option value="">Perfil anterior (21 días)</option>
                <option value="escolarizado">Escolarizado</option>
                <option value="ejecutivo">Ejecutivo</option>
                <option value="virtual">Virtual</option>
              </select>
            </label>
            <label>
              Primer corte
              <input type="date" name="firstDate" required />
            </label>
            <label>
              Número de cortes
              <input
                type="number"
                name="count"
                min="1"
                max="20"
                defaultValue="5"
                required
              />
            </label>
            <button disabled={busy || !cycle}>Crear calendario</button>
          </form>
        </details>
      )}
    </section>
  );
}
function Comparison({ overview }: { overview: Overview }) {
  const cuts = overview.cuts.filter((c) => c.status === "closed");
  const [before, setBefore] = useState(cuts[0]?.id ?? ""),
    [after, setAfter] = useState(cuts[1]?.id ?? "");
  const [student, setStudent] = useState(""),
    [career, setCareer] = useState(""),
    [activity, setActivity] = useState("");
  const [data, setData] = useState<z.infer<typeof comparisonSchema> | null>(
    null,
  );
  const [section, setSection] = useState<"common" | "changes">("common");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const input = {
    beforeCut: before,
    afterCut: after,
    filters: {
      ...(student ? { student } : {}),
      ...(career ? { careerId: career } : {}),
      ...(activity ? { activity } : {}),
    },
  };
  function invalidate() {
    generation.current++;
    setData(null);
    setError("");
  }
  async function load(
    part: "common" | "changes" = "common",
    offset = 0,
    mappingId = data?.mappingId,
    refresh = false,
  ) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await callAcademic(
        "compareCuts",
        {
          ...input,
          section: part,
          offset,
          ...(!refresh && mappingId !== undefined ? { mappingId } : {}),
        },
        comparisonSchema,
      );
      if (current === generation.current) {
        setData(result);
        setSection(part);
      }
    } catch (e) {
      if (current === generation.current) {
        setData(null);
        setError(errorText(e));
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function configure(e: FormEvent<HTMLFormElement>) {
    const v = fields(e);
    setBusy(true);
    setError("");
    try {
      const saved = await callAcademic(
        "configureComparison",
        {
          beforeCut: before,
          afterCut: after,
          expected: data?.mappingId ?? null,
          reason: v.reason,
          pairs: JSON.parse(v.pairs!),
        },
        z.object({ ok: z.boolean(), id: z.string() }),
      );
      await load("common", 0, saved.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv() {
    setBusy(true);
    try {
      const result = await callAcademic(
        "exportComparison",
        { ...input, ...(data ? { mappingId: data.mappingId } : {}) },
        exported,
      );
      downloadText("comparacion-historica.csv", result.csv);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Comparación histórica">
      <h2>Comparación sobre universo común</h2>
      <p>
        Solo se comparan fotografías cerradas del mismo ciclo. El guion indica
        sin calificación registrada; no demuestra falta de entrega.
      </p>
      <div className="metric-filters">
        <label>
          Corte anterior
          <select
            value={before}
            disabled={busy}
            onChange={(e) => {
              setBefore(e.target.value);
              invalidate();
            }}
          >
            <option value="">Selecciona</option>
            {cuts.map((c) => (
              <option key={c.id}>{c.id}</option>
            ))}
          </select>
        </label>
        <label>
          Corte posterior
          <select
            value={after}
            disabled={busy}
            onChange={(e) => {
              setAfter(e.target.value);
              invalidate();
            }}
          >
            <option value="">Selecciona</option>
            {cuts.map((c) => (
              <option key={c.id}>{c.id}</option>
            ))}
          </select>
        </label>
        <label>
          Matrícula a comparar
          <input
            value={student}
            disabled={busy}
            onChange={(e) => {
              setStudent(e.target.value);
              invalidate();
            }}
          />
        </label>
        <label>
          Carrera histórica
          <input
            value={career}
            disabled={busy}
            onChange={(e) => {
              setCareer(e.target.value);
              invalidate();
            }}
          />
        </label>
        <label>
          Actividad del corte anterior
          <input
            value={activity}
            disabled={busy}
            onChange={(e) => {
              setActivity(e.target.value);
              invalidate();
            }}
          />
        </label>
      </div>
      <button
        disabled={busy || !before || !after || before === after}
        onClick={() => void load("common", 0)}
      >
        Comparar cortes
      </button>
      {!cuts.length && <p>Sin fotografías cerradas para comparar.</p>}
      {busy && <p role="status">Cargando comparación…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <button
            disabled={busy}
            onClick={() => void load("common", 0, undefined, true)}
          >
            Actualizar correspondencias
          </button>
          <p>{data.reason}</p>
          <div data-testid="history-totals">
            <p>
              Universo común: {data.universe} observaciones · {data.students}{" "}
              estudiantes únicos
            </p>
            <div className="history-table">
              <table>
                <caption>Conteos del mismo universo</caption>
                <thead>
                  <tr>
                    <th>Corte</th>
                    {["N", "G", "V", "E", "Z", "D", "Cobertura %"].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    [data.beforeCut, data.before, data.beforeCoverage],
                    [data.afterCut, data.after, data.afterCoverage],
                  ].map(([id, counts, coverage]) => (
                    <tr key={String(id)}>
                      <th>{String(id)}</th>
                      {Object.values(counts as object).map((v, i) => (
                        <td key={i}>{String(v)}</td>
                      ))}
                      <td>{percentage(coverage as number | null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Diferencia de cobertura: {percentage(data.differencePoints)}
              {data.differencePoints !== null && " puntos porcentuales"}
            </p>
          </div>
          <p>
            Correspondencia: {data.mappingId ?? "Sin configurar"} ·{" "}
            {data.mappingAudit}
          </p>
          <button disabled={busy} onClick={() => void load("common", 0)}>
            Observaciones comunes
          </button>
          <button disabled={busy} onClick={() => void load("changes", 0)}>
            Cambios y exclusiones
          </button>
          <button disabled={busy} onClick={() => void exportCsv()}>
            Exportar comparación completa
          </button>
          <p>{data.total} registros en esta sección.</p>
          <ul>
            {section === "common"
              ? data.common.map((r, i) => (
                  <li key={i}>
                    {r.student} · {r.courseId} · {r.beforeActivity} →{" "}
                    {r.afterActivity}: {String(r.before.raw)} ({r.before.state})
                    → {String(r.after.raw)} ({r.after.state})
                    <details>
                      <summary>Procedencia</summary>
                      {r.beforeVersion} → {r.afterVersion}
                    </details>
                  </li>
                ))
              : data.changes.map((r, i) => (
                  <li key={i}>
                    {r.kind} · {r.student} · {r.courseId}: {r.description}
                    <details>
                      <summary>Procedencia</summary>
                      {r.provenance}
                    </details>
                  </li>
                ))}
          </ul>
          {data.next !== null && (
            <button
              disabled={busy}
              onClick={() => void load(section, data.next!)}
            >
              Siguiente página de comparación
            </button>
          )}
        </>
      )}
      {overview.member.role === "admin" && (
        <details>
          <summary>Administrar correspondencias explícitas</summary>
          <p>
            Una fila por pareja validada, con courseId de la misma instancia y
            before/after de las actividades seleccionadas. No se infieren
            equivalencias por posición o nombre. Consulta primero la comparación
            vigente.
          </p>
          <form onSubmit={(e) => void configure(e)}>
            <label>
              Correspondencias revisadas (JSON)
              <textarea
                name="pairs"
                placeholder={
                  '[{"courseId":"instancia","before":"id-anterior","after":"id-posterior"}]'
                }
                required
              />
            </label>
            <label>
              Motivo de correspondencia
              <input name="reason" required />
            </label>
            <button disabled={busy || !data}>Guardar correspondencias</button>
          </form>
        </details>
      )}
    </section>
  );
}
function CaseLog({ overview }: { overview: Overview }) {
  const [cutId, setCut] = useState(""),
    [courseId, setCourse] = useState(""),
    [student, setStudent] = useState("");
  const [data, setData] = useState<z.infer<typeof casePage> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const retry = useRef<{ key: string; id: string } | null>(null);
  const target = { cutId, courseId, student };
  async function load(cursor?: string) {
    setBusy(true);
    setError("");
    try {
      setData(
        await callAcademic(
          "caseHistory",
          {
            ...target,
            ...(cursor ? { cursor, head: data?.head ?? undefined } : {}),
          },
          casePage,
        ),
      );
    } catch (e) {
      setData(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    const v = fields(e);
    setBusy(true);
    setError("");
    const value = {
      ...target,
      ...v,
      contactDate: v.contactDate || null,
      expected: data?.head ?? null,
    };
    const key = JSON.stringify(value);
    if (retry.current?.key !== key)
      retry.current = { key, id: crypto.randomUUID() };
    try {
      await callAcademic(
        "saveCase",
        { ...value, requestId: retry.current.id },
        okSchema,
      );
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv() {
    setBusy(true);
    try {
      const r = await callAcademic(
        "exportCase",
        { ...target, ...(data?.head ? { head: data.head } : {}) },
        exported,
      );
      downloadText("bitacora.csv", r.csv);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Bitácora de seguimiento">
      <h2>Bitácora por estudiante, curso y corte</h2>
      <p>
        No modifica calificaciones ni fotografías. Cada edición conserva la
        anterior. La fecha de contacto es distinta de la fecha de registro del
        sistema.
      </p>
      <label>
        Corte de seguimiento
        <select
          disabled={busy}
          value={cutId}
          onChange={(e) => {
            setCut(e.target.value);
            setData(null);
          }}
        >
          <option value="">Selecciona</option>
          {overview.cuts.map((c) => (
            <option key={c.id}>{c.id}</option>
          ))}
        </select>
      </label>
      <label>
        Curso de seguimiento
        <select
          disabled={busy}
          value={courseId}
          onChange={(e) => {
            setCourse(e.target.value);
            setData(null);
          }}
        >
          <option value="">Selecciona</option>
          {overview.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Matrícula de seguimiento
        <input
          disabled={busy}
          value={student}
          onChange={(e) => {
            setStudent(e.target.value);
            setData(null);
          }}
        />
      </label>
      <button
        disabled={busy || !cutId || !courseId || !student}
        onClick={() => void load()}
      >
        Consultar bitácora
      </button>
      {busy && <p role="status">Cargando bitácora…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>Expediente: {data.id}</p>
          {!data.rows.length && <p>Sin observaciones registradas.</p>}
          <ul>
            {data.rows.map((r) => (
              <li key={r.id}>
                <strong>{r.status}</strong>: {r.observation}
                <p>
                  Responsable: {r.responsible} · Contacto:{" "}
                  {r.contactDate ?? "Sin contacto registrado"} · Siguiente
                  acción: {r.nextAction}
                </p>
                <p>
                  Autor: {r.actor} · Registro del sistema:{" "}
                  {new Date(r.recordedAt).toISOString()}
                </p>
                <details>
                  <summary>Historial de versión</summary>
                  {r.id} · Anterior: {r.previous ?? "Primera observación"}
                  <p>Contexto académico: {r.snapshotId}</p>
                </details>
              </li>
            ))}
          </ul>
          {data.cursor && (
            <button disabled={busy} onClick={() => void load(data.cursor!)}>
              Siguiente página de bitácora
            </button>
          )}
          <button disabled={busy} onClick={() => void exportCsv()}>
            Exportar bitácora
          </button>
          <form onSubmit={(e) => void save(e)}>
            <h3>Registrar nueva revisión</h3>
            <label>
              Observación
              <textarea name="observation" required />
            </label>
            <label>
              Responsable
              <input name="responsible" required />
            </label>
            <label>
              Fecha de contacto
              <input name="contactDate" type="date" />
            </label>
            <label>
              Siguiente acción
              <input name="nextAction" required />
            </label>
            <label>
              Estado del caso
              <select name="status">
                <option value="abierto">Abierto</option>
                <option value="en_seguimiento">En seguimiento</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </label>
            <button disabled={busy}>Guardar seguimiento</button>
          </form>
        </>
      )}
    </section>
  );
}
