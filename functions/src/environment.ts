export function isEmulatorEnvironment(env: NodeJS.ProcessEnv): boolean {
  return (
    env.FUNCTIONS_EMULATOR === "true" &&
    /^demo-[a-z0-9-]+$/.test(env.GCLOUD_PROJECT ?? "") &&
    [
      "FIREBASE_AUTH_EMULATOR_HOST",
      "FIRESTORE_EMULATOR_HOST",
      "FIREBASE_STORAGE_EMULATOR_HOST",
    ].every((key) => /^127\.0\.0\.1:\d+$/.test(env[key] ?? ""))
  );
}
