import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { stagingRuntime } from "../functions/lib/src/domain/staging.js";

// Solo prepara configuración pública. No crea recursos, cuentas ni despliega.
const target = JSON.parse(readFileSync("config/staging-target.json", "utf8"));
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
stagingRuntime(target, target.projectId, sha); // destino pendiente: fallar antes de escribir
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw new Error(
    "El build de pruebas requiere un árbol limpio y un SHA revisable",
  );
const web = z
  .strictObject({
    projectId: z.literal(target.projectId),
    apiKey: z.string().regex(/^[A-Za-z0-9_-]+$/),
    appId: z.string().regex(/^1:\d+:web:[a-f0-9]+$/),
  })
  .parse(JSON.parse(readFileSync("private/staging-web.json", "utf8")));
for (const [key, expected] of Object.entries({
  VITE_FIREBASE_MODE: "staging",
  VITE_FIREBASE_PROJECT_ID: target.projectId,
  VITE_FIREBASE_API_KEY: web.apiKey,
  VITE_FIREBASE_APP_ID: web.appId,
  VITE_RELEASE_SHA: sha,
})) {
  if (process.env[key] !== undefined && process.env[key] !== expected)
    throw new Error(`La variable heredada ${key} contradice el build revisado`);
}
writeFileSync(
  ".env.staging.local",
  [
    "VITE_FIREBASE_MODE=staging",
    `VITE_FIREBASE_PROJECT_ID=${target.projectId}`,
    `VITE_FIREBASE_API_KEY=${web.apiKey}`,
    `VITE_FIREBASE_APP_ID=${web.appId}`,
    `VITE_RELEASE_SHA=${sha}`,
    "",
  ].join("\n"),
);
writeFileSync(
  `functions/.env.${target.projectId}`,
  `TRACKING_RUNTIME=staging\nTRACKING_RELEASE_SHA=${sha}\n`,
);
console.log(
  JSON.stringify({
    purpose: "staging",
    projectId: target.projectId,
    region: target.region,
    sha,
    deployed: false,
  }),
);
