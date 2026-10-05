import { z } from "zod";
import { civilDateSchema } from "./schemas";
import { courseFilenameResolutionSchema } from "./academic";
import { historyOperations } from "./history-contract";
import { metricOperations } from "./metrics-contract";

export const filenameResolutionSchema = courseFilenameResolutionSchema
  .omit({ approvedBy: true, version: true })
  .extend({
    name: z.string().trim().min(1).max(180),
    reason: z.string().trim().min(1).max(1000),
  });

export const keySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const label = z.string().trim().min(1).max(180);
export const memberSchema = z.strictObject({
  role: z.enum(["admin", "coordinator"]),
  active: z.boolean(),
  careers: z.array(keySchema).max(100),
});
export type Member = z.infer<typeof memberSchema>;
export const sourceKind = z.enum([
  "roster",
  "catalog",
  "supplement",
  "withdrawals",
  "exceptions",
]);
export const descriptorSchema = z.strictObject({
  name: z.string().min(1).max(180),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z
    .int()
    .positive()
    .max(8 * 1024 * 1024),
  mapping: z.record(z.string(), z.unknown()),
});
export const calendarInput = z.record(
  civilDateSchema,
  z.enum(["base", "especial", "practica", "excluida"]),
);
export const operationSchemas = {
  ...metricOperations,
  ...historyOperations,
  overview: z.strictObject({}),
  assignMember: z.strictObject({ uid: keySchema, member: memberSchema }),
  createCycle: z.strictObject({ id: keySchema, dates: calendarInput }),
  createCourse: z.strictObject({
    cycleId: keySchema,
    id: keySchema,
    externalId: z.string().regex(/^\d+$/),
    name: label,
    careers: z.array(keySchema).min(1).max(100),
  }),
  createCut: z.strictObject({
    cycleId: keySchema,
    id: keySchema,
    date: civilDateSchema,
    parentId: keySchema.optional(),
    reason: label.optional(),
  }),
  closeCut: z.strictObject({ cutId: keySchema }),
  createSource: z.strictObject({
    cycleId: keySchema,
    kind: sourceKind,
    file: descriptorSchema,
  }),
  publishSource: z.strictObject({
    jobId: keySchema,
    replace: z.boolean().default(false),
  }),
  createBatch: z
    .strictObject({
      cutId: keySchema,
      files: z
        .array(
          descriptorSchema.extend({
            courseId: keySchema,
            filenameResolution: filenameResolutionSchema.optional(),
          }),
        )
        .min(1)
        .max(20),
    })
    .refine(
      (v) => v.files.reduce((s, f) => s + f.bytes, 0) <= 40 * 1024 * 1024,
      "Lote excede 40 MiB",
    ),
  upload: z.strictObject({
    jobId: keySchema,
    base64: z
      .string()
      .max(12 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  }),
  jobs: z.strictObject({
    cutId: keySchema.optional(),
    cursor: keySchema.optional(),
  }),
  preview: z.strictObject({
    jobId: keySchema,
    careerId: keySchema.optional(),
    cursor: keySchema.optional(),
  }),
  publish: z.strictObject({ jobId: keySchema, replace: z.boolean() }),
  retry: z.strictObject({ jobId: keySchema }),
  original: z.strictObject({ jobId: keySchema }),
  results: z.strictObject({
    cutId: keySchema,
    courseId: keySchema,
    careerId: keySchema,
    versionId: keySchema.optional(),
    cursor: keySchema.optional(),
  }),
  export: z.strictObject({
    cutId: keySchema,
    courseId: keySchema,
    careerId: keySchema,
    versionId: keySchema.optional(),
    cursor: keySchema.optional(),
  }),
} as const;
export type Operation = keyof typeof operationSchemas;
export const jobStatus = z.enum([
  "awaiting_upload",
  "queued",
  "processing",
  "ready",
  "invalid",
  "failed",
  "published",
]);
export const jobViewSchema = z.object({
  id: keySchema,
  status: jobStatus,
  kind: z.string(),
  courseId: z.string().nullable(),
  cutId: z.string().nullable(),
  attempt: z.number(),
  error: z.string().nullable(),
  replaces: z.string().nullable(),
});
export type JobView = z.infer<typeof jobViewSchema>;
export const rowViewSchema = z.object({
  id: z.string(),
  identity: z.string(),
  careerId: z.string(),
  row: z.number(),
  values: z.array(
    z.object({ activityId: z.string(), state: z.string(), raw: z.unknown() }),
  ),
  issues: z.array(z.string()),
});
export type RowView = z.infer<typeof rowViewSchema>;
export const overviewSchema = z.object({
  member: memberSchema,
  cycles: z.array(z.object({ id: z.string() })),
  cuts: z.array(
    z.object({
      id: z.string(),
      cycleId: z.string(),
      status: z.string(),
      date: z.string(),
    }),
  ),
  courses: z.array(
    z.object({
      id: z.string(),
      cycleId: z.string(),
      name: z.string(),
      externalId: z.string(),
      careers: z.array(z.string()),
    }),
  ),
});
export type Overview = z.infer<typeof overviewSchema>;
