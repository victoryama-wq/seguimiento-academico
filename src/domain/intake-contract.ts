import { z } from "zod";
import { progressInputSchema } from "./report-policy";
import { civilDateSchema } from "./schemas";

const id = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().trim().min(1).max(4000);
export const fileKind = z.enum(["roster", "catalog", "matrix", "report"]);
export const columnsSchema = z.record(
  z.string(),
  z.number().int().min(0).max(255),
);
export const readOptionsSchema = z.strictObject({
  sheet: z.string().max(180).optional(),
  headerRow: z.number().int().min(1).max(100).optional(),
  delimiter: z.enum([",", ";", "\t"]).optional(),
});
const selectedFile = z.strictObject({
  id,
  columns: columnsSchema,
  options: readOptionsSchema,
  policyVersion: id.nullable().optional(),
});
export const continuityChoice = z.strictObject({
  previousKey: id,
  nextKey: id.nullable(),
  reason: text,
});
export const catalogChoice = z.strictObject({
  row: z.number().int().positive(),
  coordination: text.optional(),
  kind: z
    .enum(["carrera", "ingles", "clinicos", "deportes", "practica"])
    .optional(),
  acceptChange: z.boolean().optional(),
  reason: text,
});
export const intakeOperations = {
  inspectOriginal: z.strictObject({
    kind: fileKind,
    name: z.string().min(1).max(180),
    base64: z
      .string()
      .max(12 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  }),
  readOriginal: z.strictObject({
    id,
    options: readOptionsSchema,
    offset: z.number().int().min(0).max(10000).default(0),
  }),
  prepareAdministration: z.strictObject({
    calendarChoices: z
      .array(
        z.strictObject({
          date: civilDateSchema,
          kind: z.enum(["base", "especial", "practica", "excluida"]),
          reason: text,
        }),
      )
      .max(366)
      .default([]),
    roster: selectedFile,
    catalog: selectedFile,
    matrix: id.optional(),
    cycle: z.string().regex(/^\d{2}-\d+$/),
    expected: id.nullable(),
    continuity: z.array(continuityChoice).max(10000).default([]),
    catalogChoices: z.array(catalogChoice).max(500).default([]),
    programMappings: z
      .array(
        z.strictObject({
          program: z.string(),
          abbreviation: text,
          careerId: text,
          reason: text,
        }),
      )
      .max(1000)
      .default([]),
    matrixChoices: z
      .array(z.strictObject({ key: id, useMatrix: z.boolean(), reason: text }))
      .max(10000)
      .default([]),
    individualChoices: z
      .array(
        z.strictObject({
          key: id,
          kind: z.enum(["base", "especial", "excluida", "baja"]),
          primary: z.boolean(),
          originalDateApproved: z.boolean().default(false),
          groupApproved: z.boolean().default(false),
          reason: text,
        }),
      )
      .max(10000)
      .default([]),
  }),
  administrationContext: z.strictObject({
    cycle: z.string().regex(/^\d{2}-\d+$/),
  }),
  inspectCutSources: z.strictObject({ cutId: text }),
  administrationReview: z.strictObject({
    id,
    offset: z.number().int().min(0).max(20000).default(0),
  }),
  administrationDrafts: z.strictObject({}),
  administrationDraft: z.strictObject({ id }),
  confirmAdministration: z.strictObject({ id }),
  prepareOperationalCut: z.strictObject({
    cycle: z.string().regex(/^\d{2}-\d+$/),
    requestId: id,
    progress: progressInputSchema,
  }),
  prepareOperationalReport: z.strictObject({
    file: selectedFile,
    cutId: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
    identification: z
      .strictObject({
        externalId: z.string().regex(/^\d+$/),
        name: text,
        cycle: z.string().regex(/^\d{2}-\d+$/),
        reason: text,
      })
      .optional(),
    activities: z
      .array(
        z.strictObject({
          column: z.number().int().min(0).max(255),
          kind: z.enum(["activity", "total", "category", "metadata"]),
          unit: z.number().int().min(1).max(7).optional(),
          additional: z.boolean().optional(),
        }),
      )
      .max(256)
      .optional(),
  }),
} as const;
export const originalViewSchema = z.object({
  id,
  kind: fileKind,
  name: z.string(),
  sha256: id,
  sheets: z.array(z.string()),
  options: readOptionsSchema,
  headers: z.array(z.string()),
  columns: columnsSchema,
  samples: z.array(
    z.object({
      row: z.number(),
      values: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    }),
  ),
  count: z.number(),
  next: z.number().nullable(),
  cycles: z.array(z.string()),
  messages: z.array(z.string()),
  policyVersion: id.nullable().default(null),
  activities: z
    .array(
      z.object({
        column: z.number(),
        kind: z.enum(["activity", "total", "category", "metadata", "review"]),
        unit: z.number().optional(),
        additional: z.boolean().optional(),
      }),
    )
    .default([]),
});
export type OriginalView = z.infer<typeof originalViewSchema>;
export const administrativeReviewSchema = z.object({
  id,
  cycle: z.string(),
  expected: id.nullable(),
  published: z.boolean(),
  blocking: z.boolean(),
  count: z.number(),
  persons: z.number(),
  principals: z.number(),
  excluded: z.number(),
  excludedEnrollments: z.number(),
  preservedDecisions: z.number(),
  catalog: z.array(
    z.object({
      id: z.string(),
      program: z.string().optional(),
      plan: z.string(),
      abbreviation: z.string(),
      responsible: z.string().optional(),
      coordination: z.string().nullable(),
      kind: z.string(),
      campus: z.string().optional(),
    }),
  ),
  issues: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      row: z.number().optional(),
      previousKey: z.string().optional(),
      candidates: z
        .array(z.object({ key: z.string(), label: z.string() }))
        .optional(),
    }),
  ),
  rows: z.array(
    z.object({
      key: z.string(),
      identity: z.string(),
      name: z.string(),
      group: z.string(),
      career: z.string(),
      originalDate: z.string(),
      state: z.string(),
      reason: z.string(),
      file: z.string(),
      row: z.number(),
    }),
  ),
  next: z.number().nullable(),
});
export type AdministrativeReview = z.infer<typeof administrativeReviewSchema>;
