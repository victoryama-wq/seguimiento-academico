import { useState, type FormEvent } from "react";
import {
  type AcademicProgress,
  unitsForProgress,
} from "../domain/report-policy";
import { callAcademic, okSchema } from "../infrastructure/academic-api";

export function ProgressFields({ progress }: { progress?: AcademicProgress }) {
  return (
    <>
      {(
        [
          ["schoolCut", "Corte Escolarizado (1: U1–2; 2: U1–5; 3: U1–7)", 3],
          ["executiveUnit", "Unidad de avance Ejecutivo", 7],
          ["virtualUnit", "Unidad de avance Virtual", 7],
        ] as const
      ).map(([key, label, max]) => (
        <label key={key}>
          {label}
          <select name={key} defaultValue={progress?.[key] ?? ""} required>
            <option value="">Selecciona</option>
            {Array.from({ length: max }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      ))}
    </>
  );
}
export function Progress({
  cutId,
  progress,
  editable,
  done,
}: {
  cutId: string;
  progress: AcademicProgress;
  editable: boolean;
  done: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const v = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await callAcademic(
        "configureProgress",
        {
          cutId,
          expected: progress.id,
          reason: v.reason,
          progress: {
            schoolCut: Number(v.schoolCut),
            executiveUnit: Number(v.executiveUnit),
            virtualUnit: Number(v.virtualUnit),
          },
        },
        okSchema,
      );
      await done();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el avance.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="academic-progress" aria-label={`Avance de ${cutId}`}>
      <p>Avance explícito. Las fechas operativas no determinan las unidades.</p>
      {(["Escolarizado", "Ejecutivo", "Virtual"] as const).map((m) => (
        <p key={m}>
          {m}: unidades incluidas {unitsForProgress(progress, m).join(", ")}.
          Unidades posteriores conservadas para después.
        </p>
      ))}
      <small>
        Versión {progress.id} · registrada{" "}
        {new Date(progress.recordedAt).toLocaleString("es-MX", {
          timeZone: "America/Cancun",
        })}
      </small>
      {editable && (
        <details>
          <summary>Configurar avance de {cutId}</summary>
          <form key={progress.id} onSubmit={(e) => void submit(e)}>
            <ProgressFields progress={progress} />
            <label>
              Motivo del cambio de avance
              <input name="reason" required maxLength={180} />
            </label>
            <button disabled={busy}>Guardar avance</button>
            {error && <p role="alert">{error}</p>}
          </form>
        </details>
      )}
    </section>
  );
}
