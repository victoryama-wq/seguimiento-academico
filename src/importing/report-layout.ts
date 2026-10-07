import { createHash } from "node:crypto";
import type { Table } from "./files";
import { suggestColumn } from "./mapping";

export const reportProfile = "moodle-institutional-v1";
/** Encabezado exacto, no posición ni semejanza. El ID se usa dentro de cada curso. */
export function institutionalMapping(table: Table) {
  const identities = table.headers.filter((h) =>
    /^(Dirección Email|Correo|Email)$/i.test(h),
  );
  if (identities.length !== 1)
    throw new Error("Matrícula/correo ausente o ambiguo; no unir por nombre");
  if (new Set(table.headers).size !== table.headers.length)
    throw new Error("Encabezados repetidos: requieren mapeo revisado por hash");
  return {
    identity: { header: identities[0]! },
    columns: table.headers
      .filter((h) => h !== identities[0])
      .map((header) => {
        const selector = { header };
        const kind = suggestColumn(header);
        if (["total", "category", "metadata"].includes(kind))
          return { selector, kind };
        if (
          /^(Nombre|Apellido\(s\)|Número de ID|Institución|Departamento)$/i.test(
            header,
          )
        )
          return { selector, kind: "metadata" };
        if (kind !== "activity" && header !== "Nota")
          throw new Error(
            "Encabezado no reconocido: revisar mapeo de actividad",
          );
        const units = [
          ...header.matchAll(/\b(?:unidad|sesi[oó]n)\s+(\d+)\b/gi),
        ].map((m) => Number(m[1]));
        const closing = /\b(?:cierre|final)\b/i.test(header);
        if (
          new Set(units).size > 1 ||
          units.some((n) => n < 1 || n > 7) ||
          (closing && units.some((n) => n !== 7))
        )
          throw new Error("Unidad ambigua o fuera de 1–7: revisar mapeo");
        const unit = units[0] ?? (closing ? 7 : undefined);
        return {
          selector,
          kind: "activity",
          activityId: `moodle-${createHash("sha256").update(header).digest("hex")}`,
          ...(unit ? { unit } : {}),
          additional: unit === undefined && header !== "Nota",
        };
      }),
  };
}
