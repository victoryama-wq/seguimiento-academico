import { z } from "zod";
import {
  academicCycleSchema,
  catalogSchema,
  enrollmentDecisionSchema,
} from "./academic";
import { civilDateSchema } from "./schemas";
import { scheduleSchema } from "./report-policy";
import { cycleWithdrawalSchema } from "./possible-withdrawals";

const text = z.string().trim().min(1).max(4000);
export const originalEnrollmentSchema = z.strictObject({
  identity: z.string(),
  name: z.string(),
  career: z.string(),
  group: z.string(),
  date: z.string(),
  modality: z.string(),
  shift: z.string(),
});
export const packageDecisionSchema = enrollmentDecisionSchema.omit({
  version: true,
  approvedBy: true,
});
export const academicPackageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  rulesVersion: z.literal("approved-2026-10"),
  cycle: academicCycleSchema,
  reason: text,
  approvals: z
    .array(
      z.strictObject({
        rule: text,
        statement: text,
        scope: z.string(),
        declaredAuthor: text,
        decisionDate: civilDateSchema,
        sourceReference: text,
      }),
    )
    .max(200)
    .optional(),
  revisionOf: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  calendar: z.record(
    civilDateSchema,
    z.enum(["base", "especial", "practica", "excluida"]),
  ),
  schedule: scheduleSchema,
  sources: z
    .array(
      z.strictObject({
        id: text,
        name: text,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        sheet: text,
        bytes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(20),
  catalog: catalogSchema.max(500),
  catalogMappings: z
    .array(
      z.strictObject({
        program: z.string(),
        abbreviation: text,
        careerId: text,
        reason: text,
        sourceReference: text,
      }),
    )
    .max(1000)
    .optional(),
  enrollments: z
    .array(
      z.strictObject({
        key: z.string().regex(/^[a-f0-9]{64}$/),
        occurrence: z.number().int().min(1),
        original: originalEnrollmentSchema,
        sourceId: text,
        row: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(10000),
  decisions: z.array(packageDecisionSchema).max(10000),
  cycleWithdrawals: z.array(cycleWithdrawalSchema).max(10000).optional(),
  reviews: z
    .array(
      z.strictObject({
        id: text,
        enrollmentKeys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
        rule: text,
        reason: text,
        decisionDate: civilDateSchema,
        sourceReference: text,
        status: z.literal("resolved"),
      }),
    )
    .max(10000),
});
export type AcademicPackage = z.infer<typeof academicPackageSchema>;
export function approvedCalendarDates(
  p: AcademicPackage,
  modality: "escolarizado" | "ejecutivo" | "virtual",
  firstDate: string,
  count: number,
) {
  const units = p.schedule[modality];
  if (!units)
    throw new Error(
      "Calendario de Virtual pendiente de configuración explícita",
    );
  if (count > units.length)
    throw new Error("Cantidad de cortes fuera del calendario configurado");
  const start = Date.parse(`${civilDateSchema.parse(firstDate)}T00:00:00Z`);
  let days = 0;
  return units.slice(0, count).map((block, i) => {
    if (i) days += block.length * 7;
    return new Date(start + days * 86400000).toISOString().slice(0, 10);
  });
}
export const observationSchema = z.object({
  id: z.string(),
  identity: z.string(),
  careerId: z.string().nullable(),
  group: z.string(),
  file: z.string(),
  sheet: z.string(),
  row: z.number(),
  original: z.unknown(),
  effective: z.unknown(),
  reason: z.string(),
  rule: z.string(),
  state: z.enum(["pendiente", "resuelto", "excluido"]),
  action: z.string(),
  sourceVersion: z.string(),
});
export type Observation = z.infer<typeof observationSchema>;
