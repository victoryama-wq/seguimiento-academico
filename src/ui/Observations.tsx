import { useState, type FormEvent } from "react";
import type { Observation } from "../domain/decision-package";
import { callAcademic } from "../infrastructure/academic-api";
import { jobViewSchema, type JobView } from "../domain/import-contract";

export function Observations({
  rows,
  admin,
  done,
}: {
  rows: Observation[];
  admin: boolean;
  done: (job: JobView) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Observation | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function revise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const decision = {
        enrollmentId: selected.id,
        kind: f.get("kind"),
        primary: f.get("primary") === "on",
        groupApproved: f.get("groupApproved") === "on",
        ...(f.get("date") ? { date: f.get("date") } : {}),
        ...(f.get("exclusionReason")
          ? { exclusionReason: f.get("exclusionReason") }
          : {}),
        reason: f.get("reason"),
        rule: f.get("rule"),
        decisionDate: f.get("decisionDate"),
        sourceReference: f.get("sourceReference"),
      };
      const job = await callAcademic(
        "reviseAcademicDecision",
        { jobId: selected.sourceVersion, decision },
        jobViewSchema,
      );
      setSelected(null);
      setMessage(
        "Revisión guardada. Revisa y publica la nueva fuente; después actualiza el corte abierto y vuelve a validar.",
      );
      await done(job);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudo guardar la revisión.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Observaciones académicas">
      <h4>Observaciones y decisiones aplicadas</h4>
      {!rows.length && <p>No hay observaciones disponibles en este alcance.</p>}
      {rows.map((o, i) => (
        <details key={`${o.id}-${i}`}>
          <summary>
            {o.identity} · {o.group} · {o.state}
          </summary>
          <p>
            {o.file} · {o.sheet} · fila {o.row} · versión {o.sourceVersion}
          </p>
          <p>
            Motivo: {o.reason}. Regla: {o.rule}.
          </p>
          <p>Original: {JSON.stringify(o.original)}</p>
          <p>Efectivo: {JSON.stringify(o.effective)}</p>
          <p>{o.action}</p>
          {admin && /^[a-f0-9]{64}$/.test(o.id) && (
            <button
              onClick={() => {
                setSelected(o);
                setMessage("");
              }}
            >
              Registrar revisión de {o.identity}
            </button>
          )}
        </details>
      ))}
      {selected && (
        <form
          key={`${selected.id}-${selected.sourceVersion}`}
          onSubmit={(e) => void revise(e)}
        >
          <h4>Revisión administrativa: {selected.identity}</h4>
          <p>
            Se crea otra versión; el original y la resolución anterior se
            conservan.
          </p>
          <label>
            Clasificación efectiva
            <select name="kind">
              <option value="base">Base</option>
              <option value="especial">Especial</option>
              <option value="excluida">Excluida</option>
              <option value="baja">Baja</option>
            </select>
          </label>
          <label>
            Fecha efectiva (opcional)
            <input type="date" name="date" />
          </label>
          <label>
            <input type="checkbox" name="primary" />
            Principal aprobada
          </label>
          <label>
            <input type="checkbox" name="groupApproved" />
            Interpretación del grupo parcial confirmada sin inventar campos
          </label>
          <label>
            Motivo de exclusión
            <select name="exclusionReason">
              <option value="">No aplica</option>
              {["baja", "ciclo", "antecedente_sustituido", "error_captura"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Regla o decisión
            <input name="rule" required />
          </label>
          <label>
            Motivo de la corrección
            <textarea name="reason" required />
          </label>
          <label>
            Fecha de la decisión
            <input type="date" name="decisionDate" required />
          </label>
          <label>
            Referencia de autorización
            <input name="sourceReference" required />
          </label>
          <button disabled={busy}>Guardar nueva propuesta</button>
          <button type="button" onClick={() => setSelected(null)}>
            Cancelar revisión
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
