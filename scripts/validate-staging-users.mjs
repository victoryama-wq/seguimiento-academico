import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { api, accounts, project, sha } from "./cloud-test-session.mjs";
import { client } from "./cloud-operator-session.mjs";
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const db = client("https://firestore.googleapis.com"),
  root = `/v1/projects/${project}/databases/(default)/documents`;
async function docs(collection) {
  let token = "",
    all = [];
  do {
    const r = (
      await db.get(
        `${root}/${collection}?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`,
      )
    ).body;
    all.push(...(r.documents ?? []));
    token = r.nextPageToken ?? "";
  } while (token);
  return all;
}
async function snapshot() {
  const out = {};
  for (const c of [
    "cycles",
    "cuts",
    "courses",
    "jobs",
    "sources",
    "publications",
    "memberships",
  ]) {
    const rows = await docs(c);
    for (const row of rows) {
      out[row.name] = createHash("sha256")
        .update(JSON.stringify(canonical(row.fields)))
        .digest("hex");
      if (c === "cuts")
        for (const p of await docs(
          `cuts/${row.name.split("/").at(-1)}/courses`,
        ))
          out[p.name] = createHash("sha256")
            .update(JSON.stringify(canonical(p.fields)))
            .digest("hex");
    }
  }
  return out;
}

const directory = `private/cloud-runs/users-${Date.now()}`;
mkdirSync(directory, { recursive: true });
const evidence = {
  project,
  sha,
  status: "running",
  cases: [],
  startedAt: new Date().toISOString(),
};
const record = (name) => evidence.cases.push({ name, result: "success" });
const before = await snapshot();
writeFileSync(`${directory}/before.json`, JSON.stringify(before));
const cycleId = "99-95",
  catalog = await api("accessCatalog", { cycleId });
assert(catalog.version && catalog.careers.length === 2);
assert(
  catalog.careers.every(
    (c) =>
      c.name.includes("coordinator-") && c.responsible.includes("sintética"),
  ),
);
const email = `directory-synthetic-${Date.now()}@example.invalid`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(`https://${project}.web.app`);
  await expect(
    page.getByText("Entorno y versión de pruebas verificados", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Correo", { exact: true }).fill(accounts.admin.email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(accounts.admin.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Usuarios y accesos",
    exact: true,
  });
  await expect(panel.getByRole("table")).toBeVisible({ timeout: 30000 });
  await panel
    .getByRole("button", { name: "Nuevo usuario", exact: true })
    .click();
  const form = panel.getByRole("region", {
    name: "Asignar acceso",
    exact: true,
  });
  await form
    .getByLabel("Nombre", { exact: true })
    .fill("Persona de validación sintética");
  await form.getByLabel("Correo exacto de la cuenta").fill(email);
  await form.getByLabel("Ciclo del catálogo").selectOption(cycleId);
  await expect(
    form
      .getByRole("group", { name: "Carreras del catálogo" })
      .getByRole("checkbox"),
  ).toHaveCount(2);
  await form
    .getByRole("button", { name: "Seleccionar carreras visibles" })
    .click();
  await form.getByRole("button", { name: "Revisar alta", exact: true }).click();
  const review = form.getByRole("region", { name: "Resumen de acceso" });
  await expect(review).toContainText(email, { timeout: 30000 });
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Confirmar alta" }).click();
  await expect(form).toContainText("sin envío externo a cuenta sintética", {
    timeout: 30000,
  });
  const found = await api("lookupAccess", { email });
  assert.deepEqual(
    found.member.careers.slice().sort(),
    catalog.careers.map((c) => c.id).sort(),
  );
  record("Alta revisada en interfaz, múltiples carreras y sin correo externo");
  const id = await page.evaluate(() =>
    localStorage.getItem("pending-user-creation"),
  );
  const retry = await api("confirmNewUser", { reviewId: id });
  assert(retry.permissionsAssigned);
  const duplicate = await api("reviewNewUser", {
    name: "No sustituir identidad",
    email,
    cycleId,
    catalogVersion: catalog.version,
    member: found.member,
  });
  assert(duplicate.existing && !duplicate.id);
  assert.equal(
    (await api("lookupAccess", { email })).account.name,
    "Persona de validación sintética",
  );
  record("Reintento y correo existente no duplican ni sustituyen identidad");
  for (const op of [
    "listAccessUsers",
    "reviewNewUser",
    "confirmNewUser",
    "activateAccessUser",
  ])
    await assert.rejects(api(op, {}, "b"), /PERMISSION_DENIED/);
  record("Directorio, alta y activación denegados a coordinadores");
  const first = await api("listAccessUsers", { pageSize: 1 });
  assert(first.users.length <= 1 && first.nextPageToken);
  const second = await api("listAccessUsers", {
    pageSize: 1,
    pageToken: first.nextPageToken,
  });
  assert(second.users.length <= 1);
  assert.notEqual(first.users[0].email, second.users[0].email);
  record("Paginación de cuentas en servidor");
  await panel.getByLabel("Buscar usuarios por nombre o correo").fill(email);
  await panel
    .getByRole("button", { name: "Buscar usuarios", exact: true })
    .click();
  for (let i = 0; i < 100; i++) {
    await expect(panel.getByRole("table")).toBeVisible();
    if (
      await panel
        .getByRole("table")
        .getByRole("button", { name: `Gestionar ${email}`, exact: true })
        .count()
    )
      break;
    const next = panel.getByRole("button", { name: "Siguiente página" });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(panel.getByRole("table")).toBeVisible();
  }
  await expect(panel.getByRole("table")).toContainText(email);
  await panel.screenshot({ path: `${directory}/usuarios-sinteticos.png` });
  const after = await snapshot();
  assert(
    Object.keys(before).every((k) => before[k] === after[k]),
    "Cambió un documento preexistente",
  );
  evidence.preservedDocuments = Object.keys(before).length;
  record("Datos académicos y accesos preexistentes conservados");
  evidence.status = "success";
} finally {
  await browser.close();
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(`${directory}/result.json`, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      status: evidence.status,
      sha,
      cases: evidence.cases.length,
      evidence: directory,
    }),
  );
}
