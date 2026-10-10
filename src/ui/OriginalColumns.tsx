import type { OriginalView } from "../domain/intake-contract";
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
export function OriginalColumns({
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
          <p>
            Desplaza la tabla horizontalmente para ver todas las columnas.
            También puedes enfocarla y usar las flechas del teclado.
          </p>
          <div
            className="table-scroll original-table"
            role="region"
            aria-label={`Filas originales de ${file.name}`}
            tabIndex={0}
          >
            <table
              style={{
                minWidth: `${Math.max(650, (file.headers.length + 1) * 170)}px`,
              }}
            >
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
