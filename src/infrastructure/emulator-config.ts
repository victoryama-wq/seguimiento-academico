import { z } from "zod";
import firebaseConfig from "../../firebase.json";

const endpoint = z.strictObject({
  host: z.literal("127.0.0.1"),
  port: z.int().min(1024).max(65535),
});
export const emulatorConfigSchema = z
  .object({
    mode: z.literal("emulator"),
    projectId: z.string().regex(/^demo-[a-z0-9-]+$/),
    auth: endpoint,
    firestore: endpoint,
    storage: endpoint,
    functions: endpoint,
  })
  .refine(
    (value) =>
      new Set([
        value.auth.port,
        value.firestore.port,
        value.storage.port,
        value.functions.port,
      ]).size === 4,
    "Puertos repetidos",
  );

export function readEmulatorConfig(mode: unknown, projectId: unknown) {
  return emulatorConfigSchema.parse({
    mode,
    projectId,
    ...firebaseConfig.emulators,
  });
}
