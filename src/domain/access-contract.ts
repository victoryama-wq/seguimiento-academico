import { z } from "zod";
const key = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const memberSchema = z.strictObject({
  role: z.enum(["admin", "coordinator"]),
  active: z.boolean(),
  careers: z.array(key).max(100),
});
export const accessOperations = {
  listAccessUsers: z.strictObject({
    search: z.string().trim().max(254).default(""),
    pageToken: z.string().max(4096).optional(),
    pageSize: z.int().min(1).max(25).default(15),
  }),
  reviewNewUser: z.strictObject({
    name: z.string().trim().min(1).max(120),
    email: z.email().trim().max(254),
    cycleId: key,
    catalogVersion: key,
    member: memberSchema,
  }),
  confirmNewUser: z.strictObject({ reviewId: key }),
  activateAccessUser: z.strictObject({ reviewId: key, attemptId: key }),
  accessCatalog: z.strictObject({ cycleId: key }),
  lookupAccess: z.strictObject({ email: z.email().trim().max(254) }),
  reviewAccess: z.strictObject({
    email: z.email().trim().max(254),
    cycleId: key,
    catalogVersion: key,
    accountVersion: key,
    memberVersion: key,
    member: memberSchema,
  }),
  assignMember: z.strictObject({ reviewId: key }),
};
export const accessCatalogSchema = z.object({
  version: z.string().nullable(),
  careers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      abbreviation: z.string(),
      responsible: z.string(),
      plan: z.string(),
    }),
  ),
});
export const accessAccountSchema = z.object({
  found: z.boolean(),
  account: z
    .object({ email: z.string(), name: z.string(), disabled: z.boolean() })
    .nullable(),
  accountVersion: z.string(),
  memberVersion: z.string(),
  member: memberSchema.nullable(),
  existingCareers: accessCatalogSchema.shape.careers.default([]),
});
export const accessReviewSchema = z.object({
  id: z.string(),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  retained: z.array(z.string()),
});
export const directorySchema = z.object({
  users: z.array(
    z.object({
      email: z.string(),
      name: z.string(),
      disabled: z.boolean(),
      member: memberSchema.nullable(),
      careerNames: z.array(z.string()),
      pendingCreation: z.string().nullable(),
    }),
  ),
  nextPageToken: z.string().nullable(),
});
export const newUserReviewSchema = z.object({
  id: z.string().optional(),
  existing: z.boolean(),
  email: z.string(),
});
export const newUserResultSchema = z.object({
  id: z.string(),
  email: z.string(),
  existing: z.boolean(),
  accountCreated: z.boolean(),
  permissionsAssigned: z.boolean(),
  activation: z.enum([
    "pending",
    "accepted",
    "uncertain",
    "synthetic_not_sent",
  ]),
  needsReview: z.boolean().default(false),
});
