import { z } from "zod";
import { countsSchema } from "./metrics";

const key = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(250);
export const metricFilters = z.strictObject({
  coordination: text.optional(),
  careerId: text.optional(),
  plan: text.optional(),
  group: text.optional(),
  modality: text.optional(),
  shift: text.optional(),
  courseId: key.optional(),
  student: text.optional(),
  teacher: text.optional(),
  activity: text.optional(),
  special: z.enum(["con_especial", "solo_base"]).optional(),
  registration: z
    .enum(["completo", "parcial", "ninguna_numerica", "sin_datos"])
    .optional(),
});
export const metricView = z.enum([
  "institucion",
  "coordinacion",
  "carrera",
  "grupo",
  "modalidad",
  "turno",
  "asignatura",
  "estudiante",
  "docente",
  "actividad",
]);
const request = z.strictObject({
  cutId: key,
  filters: metricFilters,
  view: metricView,
  snapshotId: key.optional(),
  offset: z.number().int().min(0).max(100000).default(0),
  section: z
    .enum(["groups", "details", "exclusions", "courses"])
    .default("groups"),
});
export const metricOperations = {
  dashboard: request,
  exportDashboard: request,
  configureMetrics: z.strictObject({
    cutId: key,
    courseId: key,
    versionId: key,
    expected: key.nullable(),
    activities: z
      .array(text)
      .max(256)
      .refine((a) => new Set(a).size === a.length),
    teachers: z.array(text).max(30).nullable(),
    reason: text,
  }),
};
export type MetricRequest = z.infer<typeof request>;
export const metricGroup = z.object({
  id: z.string(),
  counts: countsSchema,
  students: z.number(),
  coverage: z.number().nullable(),
  dashes: z.number().nullable(),
  registration: z.string(),
});
export const metricDetail = z.object({
  courseId: z.string(),
  versionId: z.string(),
  identity: z.string(),
  careerId: z.string(),
  group: z.string(),
  modality: z.string(),
  shift: z.string(),
  coordination: z.string(),
  plan: z.string(),
  special: z.boolean(),
  attribution: z.string(),
  enrollmentIds: z.array(z.string()),
  sourceVersions: z.record(z.string(), z.string()),
  issues: z.array(z.string()),
  values: z.array(
    z.object({
      activityId: z.string(),
      state: z.string(),
      raw: z.unknown(),
      sourceVersion: z.string().optional(),
    }),
  ),
  counts: countsSchema,
});
export const metricCourse = z.object({
  audit: z
    .object({
      actor: z.string(),
      reason: z.string(),
      previous: z.string().nullable(),
    })
    .nullable(),
  id: z.string(),
  name: z.string(),
  versionId: z.string().nullable(),
  selectionId: z.string().nullable(),
  activities: z.array(z.string()),
  available: z.array(z.string()),
  teachers: z.array(z.string()),
  teacherSource: z.string(),
  status: z.string(),
});
export const metricExclusion = z.object({
  identity: z.string(),
  careerId: z.string().nullable(),
  courseId: z.string().nullable(),
  reason: z.string(),
  provenance: z.string(),
});
export const dashboardSchema = z.object({
  snapshotId: z.string(),
  cutId: z.string(),
  cycleId: z.string(),
  date: z.string(),
  closed: z.boolean(),
  counts: countsSchema,
  coverage: z.number().nullable(),
  dashes: z.number().nullable(),
  students: z.number(),
  expected: z.number(),
  published: z.number(),
  measured: z.number(),
  received: z.number(),
  validated: z.number(),
  pending: z.number(),
  state: z.string(),
  exclusionsCount: z.number(),
  groups: z.array(metricGroup),
  details: z.array(metricDetail),
  exclusions: z.array(metricExclusion),
  courses: z.array(metricCourse),
  total: z.number(),
  next: z.number().nullable(),
  facets: z.object({
    coordination: z.array(z.string()),
    careerId: z.array(z.string()),
    plan: z.array(z.string()),
    group: z.array(z.string()),
    modality: z.array(z.string()),
    shift: z.array(z.string()),
    teacher: z.array(z.string()),
  }),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
