import { progressSchema, progressInputSchema } from "./report-policy";
import { z } from "zod";
import { civilDateSchema } from "./schemas";
import {
  metricFilters,
  metricDetail,
  metricExclusion,
} from "./metrics-contract";
import { countsSchema } from "./metrics";

const key = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(1000);
export const correspondence = z.strictObject({
  courseId: key,
  before: text,
  after: text,
});
const pair = { beforeCut: key, afterCut: key };
const comparisonRequest = z.strictObject({
  ...pair,
  // Omitted: current configuration. Null: preserve the observed absence.
  mappingId: key.nullable().optional(),
  filters: metricFilters,
  section: z.enum(["common", "changes"]).default("common"),
  offset: z.int().min(0).max(100000).default(0),
});
const target = { cutId: key, courseId: key, student: text };
export const historyOperations = {
  planCalendar: z.strictObject({
    progress: progressInputSchema.optional(),
    schoolCut: z.number().int().min(1).max(3).optional(),
    modality: z.enum(["escolarizado", "ejecutivo", "virtual"]).optional(),
    cycleId: key,
    firstDate: civilDateSchema,
    count: z.int().min(1).max(20),
  }),
  editCutDate: z.strictObject({
    cutId: key,
    date: civilDateSchema,
    expected: civilDateSchema,
    reason: text,
  }),
  historyCalendar: z.strictObject({ cycleId: key }),
  configureComparison: z.strictObject({
    ...pair,
    expected: key.nullable(),
    reason: text,
    pairs: z.array(correspondence).min(1).max(2560),
  }),
  compareCuts: comparisonRequest,
  exportComparison: comparisonRequest,
  caseHistory: z.strictObject({
    ...target,
    cursor: key.optional(),
    head: key.optional(),
  }),
  caseById: z.strictObject({
    id: key,
    cursor: key.optional(),
    head: key.optional(),
  }),
  exportCase: z.strictObject({ ...target, head: key.optional() }),
  saveCase: z.strictObject({
    ...target,
    expected: key.nullable(),
    requestId: key,
    observation: text,
    responsible: text,
    contactDate: civilDateSchema.nullable(),
    nextAction: text,
    status: z.enum(["abierto", "en_seguimiento", "cerrado"]),
  }),
};
export const caseRevision = z.object({
  id: z.string(),
  caseId: z.string(),
  snapshotId: z.string(),
  previous: z.string().nullable(),
  actor: z.string(),
  recordedAt: z.number(),
  observation: z.string(),
  responsible: z.string(),
  contactDate: z.string().nullable(),
  nextAction: z.string(),
  status: z.string(),
});
export const casePage = z.object({
  id: z.string(),
  head: z.string().nullable(),
  rows: z.array(caseRevision),
  cursor: z.string().nullable(),
});
export const commonObservation = z.object({
  student: z.string(),
  courseId: z.string(),
  beforeActivity: z.string(),
  afterActivity: z.string(),
  before: metricDetail.shape.values.element,
  after: metricDetail.shape.values.element,
  beforeVersion: z.string(),
  afterVersion: z.string(),
});
export const historyChange = z.object({
  kind: z.string(),
  student: z.string(),
  courseId: z.string(),
  description: z.string(),
  provenance: z.string(),
});
export const comparisonSchema = z.object({
  beforeCut: z.string(),
  afterCut: z.string(),
  mappingId: z.string().nullable(),
  comparable: z.boolean(),
  reason: z.string(),
  before: countsSchema,
  after: countsSchema,
  beforeCoverage: z.number().nullable(),
  afterCoverage: z.number().nullable(),
  differencePoints: z.number().nullable(),
  students: z.number(),
  universe: z.number(),
  common: z.array(commonObservation),
  changes: z.array(historyChange),
  total: z.number(),
  next: z.number().nullable(),
  snapshots: z.array(z.string()),
  mappingAudit: z.string(),
});
export const calendarSchema = z.object({
  cuts: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      schoolCut: z.number().int().min(1).max(3).optional(),
      progress: progressSchema.optional(),
      status: z.string(),
      parentId: z.string().nullable(),
      reason: z.string().nullable(),
      author: z.string(),
      pending: z.number(),
      closure: z.string().nullable(),
    }),
  ),
});
export type Detail = z.infer<typeof metricDetail>;
export type Exclusion = z.infer<typeof metricExclusion>;
export type Correspondence = z.infer<typeof correspondence>;
