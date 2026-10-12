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
