import { z } from "zod";
import { civilDateSchema } from "./schemas";

export const progressInputSchema = z.strictObject({
  schoolCut: z.number().int().min(1).max(3),
  executiveUnit: z.number().int().min(1).max(7),
  virtualUnit: z.number().int().min(1).max(7),
});
export const progressSchema = progressInputSchema.extend({
  id: z.string(),
  policy: z.literal("explicit-progress-v1"),
  actor: z.string(),
  recordedAt: z.number(),
  previous: z.string().nullable(),
  reason: z.string(),
});
export type AcademicProgress = z.infer<typeof progressSchema>;
export function unitsForProgress(
  progress: z.infer<typeof progressInputSchema>,
  modality: string,
): number[] {
  const p = progressInputSchema.parse({
    schoolCut: progress.schoolCut,
    executiveUnit: progress.executiveUnit,
    virtualUnit: progress.virtualUnit,
  });
  const key = modality.trim().toLowerCase();
  const end =
    key === "escolarizado"
      ? [2, 5, 7][p.schoolCut - 1]
      : key === "ejecutivo"
        ? p.executiveUnit
        : key === "virtual"
          ? p.virtualUnit
          : undefined;
  if (!end) throw new Error("Modalidad principal sin avance confirmado");
  return Array.from({ length: end }, (_, i) => i + 1);
}

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
