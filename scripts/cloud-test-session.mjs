import { readFileSync } from "node:fs";
import { stagingIdentity } from "./staging-identity.mjs";
import assert from "node:assert/strict";
export const project = "indicadores-academia";
if (process.env.CONFIRM_STAGING_PROJECT !== project)
  throw new Error("Confirmar proyecto de pruebas");
for (const key of [
  "CI",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
])
  assert(!process.env[key], `Entorno incompatible: ${key}`);
export const { sha, revision } = stagingIdentity();
const web = JSON.parse(readFileSync("private/staging-web.json", "utf8"));
assert.equal(web.projectId, project);
export const accounts = JSON.parse(
  readFileSync("private/staging-test-accounts.json", "utf8"),
);
const tokens = {};
const base = `https://us-central1-${project}.cloudfunctions.net`;
export async function call(name, data, role = "admin") {
  const r = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const b = await r.json();
  if (b.error) throw new Error(`${b.error.status}: ${b.error.message}`);
  assert(r.ok);
  return b.result;
}
assert.deepEqual(await call("environmentStatus", {}, null), {
  mode: "staging",
  projectId: project,
  release: sha,
  status: "ready",
});
for (const [role, account] of Object.entries(accounts)) {
  assert(account.email.endsWith("@example.invalid"));
  assert(account.uid.startsWith("staging-synthetic-"));
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${web.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    },
  );
  const b = await r.json();
  assert(r.ok && b.idToken, `Login ${role}`);
  assert.equal(b.localId, account.uid);
  tokens[role] = b.idToken;
}
export const api = (op, input, role = "admin") =>
  call("academicApi", { op, input }, role);
