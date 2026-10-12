import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// La evidencia puede añadirse después del despliegue sin cambiar la aplicación.
// Una referencia explícita solo admite descendientes con cambios de docs/pruebas.
export function stagingIdentity() {
  const git = (...args) =>
    execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  assert.equal(git("status", "--porcelain"), "", "Árbol limpio requerido");
  const revision = git("rev-parse", "HEAD");
  const sha = process.env.STAGING_RELEASE_SHA ?? revision;
  assert.match(sha, /^[a-f0-9]{40}$/, "SHA desplegado completo requerido");
  git("merge-base", "--is-ancestor", sha, revision);
  const changed = git("diff", "--name-only", "--no-renames", sha, revision)
    .split("\n")
    .filter(Boolean);
  assert(
    changed.every(
      (path) =>
        /^(docs|tests)\//.test(path) ||
        /^scripts\/(?:staging-identity|cloud-(?:test|operator)-session|validate-staging(?:-(?:browser|history|concurrency|recovery))?|measure-staging)\.mjs$/.test(path) ||
        ["README.md", "AGENTS.md"].includes(path),
    ),
    "La aplicación/configuración difiere del SHA desplegado",
  );
  return { sha, revision };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(stagingIdentity()));
