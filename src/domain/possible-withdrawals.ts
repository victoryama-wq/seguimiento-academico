import { z } from "zod";
import { identity } from "./academic";

export const absentRosterReason = "No pertenece al padrón activo del ciclo";
export const cycleWithdrawalSchema = z.strictObject({
  identity: z
    .string()
    .trim()
    .min(1)
    .max(250)
    .refine((v) => !!identity(v).normalized && !identity(v).teacher),
  reason: z.string().trim().min(1).max(4000),
  sourceReference: z.string().trim().min(1).max(4000),
});
export const possibleWithdrawalSchema = z.object({
  identity: z.string(),
  originals: z.array(z.string()),
  names: z.array(z.string()),
  status: z.enum(["posible baja", "baja confirmada"]),
  courses: z.array(z.object({ id: z.string(), name: z.string() })),
  provenance: z.array(z.string()),
  observations: z.array(z.string()),
});
export type WithdrawalEvidence = {
  identity: string;
  name: string;
  status: "posible baja" | "baja confirmada";
  courseId: string;
  courseName: string;
  provenance: string;
};
// Recibe exclusivamente evidencia ya autorizada y filtrada por el servidor.
export function groupPossibleWithdrawals(rows: WithdrawalEvidence[]) {
  const groups = new Map<string, z.infer<typeof possibleWithdrawalSchema>>();
  for (const row of rows) {
    const key = identity(row.identity).normalized;
    if (!key || identity(row.identity).teacher) continue;
    const group = groups.get(key) ?? {
      identity: key,
      originals: [],
      names: [],
      status: row.status,
      courses: [],
      provenance: [],
      observations: [],
    };
    if (!group.originals.includes(row.identity))
      group.originals.push(row.identity);
    if (row.name && !group.names.includes(row.name)) group.names.push(row.name);
    if (!group.courses.some((c) => c.id === row.courseId))
      group.courses.push({ id: row.courseId, name: row.courseName });
    if (!group.provenance.includes(row.provenance))
      group.provenance.push(row.provenance);
    if (row.status === "baja confirmada") group.status = row.status;
    group.observations =
      group.names.length > 1
        ? ["El reporte conserva variantes del nombre; revisar los originales."]
        : [];
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.identity.localeCompare(b.identity),
  );
}
