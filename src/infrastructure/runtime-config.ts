import { z } from "zod";
import target from "../../config/staging-target.json";
import { stagingRuntime } from "../domain/staging";
import { readEmulatorConfig } from "./emulator-config";

export function readRuntimeConfig(
  env: Record<string, unknown>,
  hostname: string,
  approvedTarget: unknown = target,
) {
  const mode = env.VITE_FIREBASE_MODE ?? "emulator";
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? "demo-seguimiento-ci";
  if (mode === "emulator") return readEmulatorConfig(mode, projectId);
  if (mode !== "staging") throw new Error("Modo de ejecución no admitido");
  const config = stagingRuntime(
    approvedTarget,
    projectId,
    env.VITE_RELEASE_SHA,
  );
  if (
    ![
      `${config.hostingSite}.web.app`,
      `${config.hostingSite}.firebaseapp.com`,
    ].includes(hostname)
  )
    throw new Error("Hosting distinto del destino de pruebas revisado");
  return {
    ...config,
    mode: "staging" as const,
    apiKey: z.string().min(1).parse(env.VITE_FIREBASE_API_KEY),
    appId: z
      .string()
      .regex(/^1:\d+:web:[a-f0-9]+$/)
      .parse(env.VITE_FIREBASE_APP_ID),
    authDomain: `${config.projectId}.firebaseapp.com`,
  };
}

export function validateEnvironmentResponse(
  config: ReturnType<typeof readRuntimeConfig>,
  data: unknown,
) {
  if (config.mode === "emulator")
    z.strictObject({
      mode: z.literal("emulator"),
      stage: z.literal("01"),
      status: z.literal("ready"),
    }).parse(data);
  else
    z.strictObject({
      mode: z.literal("staging"),
      projectId: z.literal(config.projectId),
      release: z.literal(config.release),
      status: z.literal("ready"),
    }).parse(data);
}
