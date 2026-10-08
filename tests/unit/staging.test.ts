import { describe, expect, it } from "vitest";
import target from "../../config/staging-target.json";
import {
  readRuntimeConfig,
  validateEnvironmentResponse,
} from "../../src/infrastructure/runtime-config";
import { runtimeEnvironment } from "../../functions/src/environment";

const approved = {
  purpose: "staging",
  projectId: "synthetic-tracking-test",
  region: "us-central1",
  storageBucket: "synthetic-tracking-test.firebasestorage.app",
  hostingSite: "synthetic-tracking-test",
};
const sha = "a".repeat(40);
const browser = {
  VITE_FIREBASE_MODE: "staging",
  VITE_FIREBASE_PROJECT_ID: approved.projectId,
  VITE_RELEASE_SHA: sha,
  VITE_FIREBASE_API_KEY: "synthetic-public-key",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
};
const server = {
  TRACKING_RUNTIME: "staging",
  GCLOUD_PROJECT: approved.projectId,
  TRACKING_RELEASE_SHA: sha,
};
describe("destino explícito de pruebas, sin fallback", () => {
  it("no habilita la UI si el backend pertenece a otra versión o proyecto", () => {
    const config = readRuntimeConfig(
      browser,
      `${approved.hostingSite}.web.app`,
      approved,
    );
    const response = {
      mode: "staging",
      projectId: approved.projectId,
      release: sha,
      status: "ready",
    };
    expect(() => validateEnvironmentResponse(config, response)).not.toThrow();
    expect(() =>
      validateEnvironmentResponse(config, {
        ...response,
        projectId: "other-project",
      }),
    ).toThrow();
    expect(() =>
      validateEnvironmentResponse(config, {
        ...response,
        release: "b".repeat(40),
      }),
    ).toThrow();
    expect(() =>
      validateEnvironmentResponse(config, {
        mode: "emulator",
        stage: "01",
        status: "ready",
      }),
    ).toThrow();
  });
  it("el destino pendiente bloquea frontend y servidor aunque existan variables de nube", () => {
    expect(() =>
      readRuntimeConfig(browser, `${approved.hostingSite}.web.app`, target),
    ).toThrow();
    expect(() => runtimeEnvironment(server, target)).toThrow();
  });
  it("conecta ambos extremos al mismo proyecto, región, bucket y SHA revisados", () => {
    const web = readRuntimeConfig(
      browser,
      `${approved.hostingSite}.web.app`,
      approved,
    );
    const backend = runtimeEnvironment(server, approved);
    expect(web).toMatchObject({
      mode: "staging",
      projectId: approved.projectId,
      region: approved.region,
      storageBucket: approved.storageBucket,
      release: sha,
      authDomain: `${approved.projectId}.firebaseapp.com`,
    });
    expect(backend).toMatchObject({
      mode: "staging",
      projectId: approved.projectId,
      storageBucket: approved.storageBucket,
      release: sha,
    });
  });
  it("rechaza proyecto ajeno, producción y preview sin dominio aprobado", () => {
    expect(() =>
      readRuntimeConfig(
        { ...browser, VITE_FIREBASE_PROJECT_ID: "other-project" },
        `${approved.hostingSite}.web.app`,
        approved,
      ),
    ).toThrow();
    expect(() =>
      runtimeEnvironment(
        { ...server, GCLOUD_PROJECT: "other-project" },
        approved,
      ),
    ).toThrow();
    expect(() =>
      runtimeEnvironment(
        { ...server, GOOGLE_CLOUD_PROJECT: "other-project" },
        approved,
      ),
    ).toThrow();
    for (const hostname of [
      "localhost",
      "production.web.app",
      `${approved.hostingSite}--preview.web.app`,
    ])
      expect(() => readRuntimeConfig(browser, hostname, approved)).toThrow();
    expect(() =>
      readRuntimeConfig(
        { ...browser, VITE_FIREBASE_MODE: "production" },
        `${approved.hostingSite}.web.app`,
        approved,
      ),
    ).toThrow();
  });
  it("requiere versión trazable y configuración web completa", () => {
    for (const key of [
      "VITE_RELEASE_SHA",
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_APP_ID",
    ])
      expect(() =>
        readRuntimeConfig(
          { ...browser, [key]: "" },
          `${approved.hostingSite}.web.app`,
          approved,
        ),
      ).toThrow();
    expect(() =>
      runtimeEnvironment({ ...server, TRACKING_RELEASE_SHA: "rama" }, approved),
    ).toThrow();
    expect(() =>
      runtimeEnvironment({ ...server, TRACKING_RUNTIME: "" }, approved),
    ).toThrow();
  });
  it.each([
    "FUNCTIONS_EMULATOR",
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
    "STORAGE_EMULATOR_HOST",
  ])("rechaza mezcla con %s antes de usar servicios", (key) => {
    expect(() =>
      runtimeEnvironment({ ...server, [key]: "127.0.0.1:9099" }, approved),
    ).toThrow();
  });
  it("mantiene el demo explícito y no lo transforma en staging", () => {
    const env = {
      FUNCTIONS_EMULATOR: "true",
      GCLOUD_PROJECT: "demo-seguimiento-ci",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    };
    expect(runtimeEnvironment(env).mode).toBe("emulator");
    expect(readRuntimeConfig({}, "127.0.0.1").mode).toBe("emulator");
    expect(() =>
      runtimeEnvironment({ ...env, TRACKING_RUNTIME: "staging" }, approved),
    ).toThrow();
    expect(() =>
      readRuntimeConfig(
        { VITE_FIREBASE_PROJECT_ID: approved.projectId },
        "127.0.0.1",
      ),
    ).toThrow();
  });
});
