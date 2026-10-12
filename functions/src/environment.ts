import target from "../../config/staging-target.json";
import { stagingRuntime } from "../../src/domain/staging";

export function isEmulatorEnvironment(env: NodeJS.ProcessEnv): boolean {
  return (
    (!env.TRACKING_RUNTIME || env.TRACKING_RUNTIME === "emulator") &&
    env.FUNCTIONS_EMULATOR === "true" &&
    /^demo-[a-z0-9-]+$/.test(env.GCLOUD_PROJECT ?? "") &&
    [
      "FIREBASE_AUTH_EMULATOR_HOST",
      "FIRESTORE_EMULATOR_HOST",
      "FIREBASE_STORAGE_EMULATOR_HOST",
    ].every((key) => /^127\.0\.0\.1:\d+$/.test(env[key] ?? ""))
  );
}

export function runtimeEnvironment(
  env: NodeJS.ProcessEnv,
  approvedTarget: unknown = target,
) {
  if (isEmulatorEnvironment(env))
    return { mode: "emulator" as const, projectId: env.GCLOUD_PROJECT! };
  if (
    env.TRACKING_RUNTIME !== "staging" ||
    [
      "FUNCTIONS_EMULATOR",
      "FIREBASE_AUTH_EMULATOR_HOST",
      "FIRESTORE_EMULATOR_HOST",
      "FIREBASE_STORAGE_EMULATOR_HOST",
      "STORAGE_EMULATOR_HOST",
    ].some((key) => !!env[key])
  )
    throw new Error("Entorno no autorizado o mezcla de nube y emuladores");
  const config = stagingRuntime(
    approvedTarget,
    env.GCLOUD_PROJECT,
    env.TRACKING_RELEASE_SHA,
  );
  if (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== config.projectId)
    throw new Error("Proyecto de credenciales incompatible");
  return { ...config, mode: "staging" as const };
}
