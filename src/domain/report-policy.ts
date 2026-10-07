import { z } from "zod";
import { civilDateSchema } from "./schemas";

const blocks = z.array(z.array(z.number().int().min(1).max(100)).min(1)).min(1);
export const scheduleSchema = z
  .strictObject({
    escolarizado: blocks,
    ejecutivo: blocks,
    virtual: blocks.nullable(),
    flexible: z.literal(true),
    cumulative: z.literal(true),
    completedWeek: z.literal(true),
    tracking: z
      .strictObject({
        version: z.literal("principal-modality-v1"),
        firstWeekEnd: civilDateSchema,
      })
      .optional(),
  })
  .superRefine((s, ctx) => {
    if (!s.tracking) return; // Las fotografías anteriores conservan su configuración.
    const weekly = [[1], [2], [3], [4], [5], [6], [7]];
    if (
      JSON.stringify(s.escolarizado) !==
        JSON.stringify([
          [1, 2],
          [3, 4, 5],
          [6, 7],
        ]) ||
      JSON.stringify(s.ejecutivo) !== JSON.stringify(weekly) ||
      JSON.stringify(s.virtual) !== JSON.stringify(weekly)
    )
      ctx.addIssue({
        code: "custom",
        message: "Calendario por modalidad distinto de la política aprobada",
      });
  });
export type TrackingSchedule = z.infer<typeof scheduleSchema>;
export function approvedSchedule(firstWeekEnd: string): TrackingSchedule {
  return scheduleSchema.parse({
    escolarizado: [
      [1, 2],
      [3, 4, 5],
      [6, 7],
    ],
    ejecutivo: [[1], [2], [3], [4], [5], [6], [7]],
    virtual: [[1], [2], [3], [4], [5], [6], [7]],
    flexible: true,
    cumulative: true,
    completedWeek: true,
    tracking: { version: "principal-modality-v1", firstWeekEnd },
  });
}
export function unitsForPrincipal(
  schedule: TrackingSchedule,
  modality: string,
  date: string,
  schoolCut?: number,
): number[] {
  if (!schedule.tracking)
    throw new Error("Política de seguimiento no configurada");
  const key = modality.trim().toLowerCase();
  if (key !== "escolarizado" && key !== "ejecutivo" && key !== "virtual")
    throw new Error("Modalidad principal sin calendario confirmado");
  if (key === "escolarizado") {
    const ordinal = z.number().int().min(1).max(3).parse(schoolCut);
    return schedule.escolarizado.slice(0, ordinal).flat();
  }
  const weeks = Math.max(
    0,
    Math.min(
      7,
      1 +
        Math.floor(
          (Date.parse(`${civilDateSchema.parse(date)}T00:00:00Z`) -
            Date.parse(`${schedule.tracking.firstWeekEnd}T00:00:00Z`)) /
            (7 * 86400000),
        ),
    ),
  );
  let elapsed = 0;
  return (schedule[key] ?? []).flatMap((block) => {
    elapsed += block.length;
    return elapsed <= weeks ? block : [];
  });
}
