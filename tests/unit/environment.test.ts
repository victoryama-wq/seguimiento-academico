import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  emulatorConfigSchema,
  readEmulatorConfig,
} from "../../src/infrastructure/emulator-config";
import { isEmulatorEnvironment } from "../../functions/src/environment";

describe("aislamiento local", () => {
  it("configura los cuatro servicios sin fallback a nube", () => {
    expect(
      readEmulatorConfig("emulator", "demo-seguimiento-ci").functions.port,
    ).toBe(5001);
    expect(() => readEmulatorConfig("cloud", "demo-seguimiento-ci")).toThrow();
    expect(() => readEmulatorConfig("emulator", "produccion")).toThrow();
  });
  it("rechaza emuladores incompletos y hosts externos", () => {
    const config = readEmulatorConfig("emulator", "demo-seguimiento-ci");
    expect(
      emulatorConfigSchema.safeParse({ ...config, storage: undefined }).success,
    ).toBe(false);
    expect(
      emulatorConfigSchema.safeParse({
        ...config,
        auth: { host: "example.com", port: 9099 },
      }).success,
    ).toBe(false);
    expect(
      emulatorConfigSchema.safeParse({ ...config, auth: config.firestore })
        .success,
    ).toBe(false);
  });
  it("Functions rechaza nube y entorno parcial antes de atender solicitudes", () => {
    const env = {
      GCLOUD_PROJECT: "demo-seguimiento-ci",
      FUNCTIONS_EMULATOR: "true",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    };
    expect(isEmulatorEnvironment(env)).toBe(true);
    expect(
      isEmulatorEnvironment({ ...env, GCLOUD_PROJECT: "produccion" }),
    ).toBe(false);
    expect(isEmulatorEnvironment({ ...env, FIRESTORE_EMULATOR_HOST: "" })).toBe(
      false,
    );
    expect(isEmulatorEnvironment({ ...env, FUNCTIONS_EMULATOR: "" })).toBe(
      false,
    );
  });
  it("el ejecutor rechaza proyecto real antes de iniciar emuladores", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/emulators.mjs", "check"],
      {
        env: { ...process.env, GCLOUD_PROJECT: "produccion" },
        encoding: "utf8",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No se inició Firebase");
  });
});
