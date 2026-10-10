import { mkdtempSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const project = process.env.GCLOUD_PROJECT ?? "demo-seguimiento-ci";
if (!/^demo-[a-z0-9-]+$/.test(project) || project !== "demo-seguimiento-ci") {
  throw new Error(
    "Solo se admite el proyecto demo-seguimiento-ci. No se inició Firebase.",
  );
}
if (
  process.env.GOOGLE_CLOUD_PROJECT &&
  process.env.GOOGLE_CLOUD_PROJECT !== project
) {
  throw new Error("GOOGLE_CLOUD_PROJECT contradice el proyecto demo.");
}
const config = JSON.parse(
  readFileSync(new URL("../firebase.json", import.meta.url), "utf8"),
);
const names = ["auth", "firestore", "storage", "functions", "hub"];
const ports = new Set();
for (const name of names) {
  const endpoint = config.emulators?.[name];
  if (
    !endpoint ||
    endpoint.host !== "127.0.0.1" ||
    !Number.isInteger(endpoint.port) ||
    endpoint.port < 1024 ||
    endpoint.port > 65535 ||
    ports.has(endpoint.port)
  ) {
    throw new Error(`Configuración de emulador inválida: ${name}`);
  }
  ports.add(endpoint.port);
}
const mode = process.argv[2];
if (!["start", "integration", "e2e", "pilot", "check"].includes(mode))
  throw new Error("Modo desconocido");
if (mode !== "check") {
  // Impedir la reutilización accidental de un proceso con datos de otra sesión.
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  }
  const args = [
    "node_modules/firebase-tools/lib/bin/firebase.js",
    mode === "start" ? "emulators:start" : "emulators:exec",
    "--project",
    project,
    "--only",
    "auth,firestore,storage,functions",
  ];
  if (mode === "integration")
    args.push("vitest run --config vitest.emulators.config.ts");
  if (mode === "e2e") args.push("playwright test");
  if (mode === "pilot") args.push("vitest run --config vitest.pilot.config.ts");
  // Perfil efímero: no heredar login de Firebase CLI ni credenciales ADC del equipo.
  // La ruta ADC inexistente fuerza un fallo de credenciales en servicios no emulados.
  const isolatedConfig = mkdtempSync(join(tmpdir(), "seguimiento-emulators-"));
  const childEnv = { ...process.env };
  delete childEnv.FIREBASE_TOKEN;
  delete childEnv.FIREBASE_CONFIG;
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...childEnv,
      XDG_CONFIG_HOME: isolatedConfig,
      GOOGLE_APPLICATION_CREDENTIALS: join(
        isolatedConfig,
        "cloud-disabled.json",
      ),
      GCLOUD_PROJECT: project,
      GOOGLE_CLOUD_PROJECT: project,
      VITE_FIREBASE_MODE: "emulator",
      VITE_FIREBASE_PROJECT_ID: project,
      PILOT_METRICS: mode === "pilot" ? "1" : "0",
    },
  });
  child.once("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
