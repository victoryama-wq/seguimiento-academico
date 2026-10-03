import { z } from "zod";

export const countsSchema = z.object({
  N: z.number(),
  G: z.number(),
  V: z.number(),
  E: z.number(),
  Z: z.number(),
  D: z.number(),
});
export type Counts = z.infer<typeof countsSchema>;
export const emptyCounts = (): Counts => ({
  N: 0,
  G: 0,
  V: 0,
  E: 0,
  Z: 0,
  D: 0,
});
export function addValue(
  counts: Counts,
  value: { state: string; raw: unknown },
) {
  counts.D++;
  if (value.state === "numerica") {
    counts.N++;
    if (Number(value.raw) === 0) counts.Z++;
  } else if (value.state === "guion") counts.G++;
  else if (value.state === "vacia") counts.V++;
  else counts.E++;
}
export function percentages(c: Counts) {
  return {
    coverage: c.D ? (100 * c.N) / c.D : null,
    dashes: c.D ? (100 * c.G) / c.D : null,
  };
}
export function registration(c: Counts) {
  return c.D === 0
    ? "sin_datos"
    : c.N === c.D
      ? "completo"
      : c.N
        ? "parcial"
        : "ninguna_numerica";
}
export function csvCell(raw: unknown) {
  const text = String(raw ?? "");
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}
