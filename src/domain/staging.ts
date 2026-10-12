import { z } from "zod";

// Una lista explícita compartida por ambos builds; null mantiene nube deshabilitada.
export const stagingTargetSchema = z.strictObject({
  purpose: z.literal("staging"),
  projectId: z
    .string()
    .regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/)
    .refine((id) => !id.startsWith("demo-")),
  region: z.string().regex(/^[a-z]+-[a-z]+\d$/),
  storageBucket: z.string().regex(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/),
  hostingSite: z.string().regex(/^[a-z0-9][a-z0-9-]+[a-z0-9]$/),
});
export const releaseSchema = z.string().regex(/^[a-f0-9]{40}$/);

export function stagingRuntime(
  target: unknown,
  project: unknown,
  release: unknown,
) {
  const parsed = stagingTargetSchema.parse(target);
  if (project !== parsed.projectId)
    throw new Error("Proyecto distinto del destino de pruebas revisado");
  return { ...parsed, release: releaseSchema.parse(release) };
}
