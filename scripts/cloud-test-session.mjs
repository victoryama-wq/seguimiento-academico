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
// Compatibilidad de fixtures sintéticas: la API ya no acepta asignaciones directas.
// Toda actualización pasa por catálogo confirmado, revisión y confirmación.
export async function api(op, input, role = "admin") {
  if (op !== "assignMember" || !input?.member)
    return call("academicApi", { op, input }, role);
  const target = Object.values(accounts).find((a) => a.uid === input.uid);
  assert(target, "Solo cuentas sintéticas verificadas en este helper");
  const found = await api("lookupAccess", { email: target.email }, role);
  const existing = found.member?.careers ?? [];
  const added = input.member.careers.filter((id) => !existing.includes(id));
  const overview = await api("overview", {}, role);
  let selected;
  for (const cycle of overview.cycles) {
    if (input.cycleId && cycle.id !== input.cycleId) continue;
    const catalog = await api("accessCatalog", { cycleId: cycle.id }, role);
    if (
      catalog.version &&
      added.every((id) => catalog.careers.some((c) => c.id === id))
    ) {
      selected = { cycleId: cycle.id, version: catalog.version };
      break;
    }
  }
  assert(
    selected,
    "Se requiere un catálogo confirmado para revisar el acceso sintético",
  );
  const review = await api(
    "reviewAccess",
    {
      email: target.email,
      cycleId: selected.cycleId,
      catalogVersion: selected.version,
      accountVersion: found.accountVersion,
      memberVersion: found.memberVersion,
      member: input.member,
    },
    role,
  );
  return api("assignMember", { reviewId: review.id }, role);
}
