import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { api, accounts, project, sha } from "./cloud-test-session.mjs";
import { client } from "./cloud-operator-session.mjs";
const directory = `private/cloud-runs/access-${Date.now()}`;
mkdirSync(directory, { recursive: true });
const evidence = {
  sha,
  project,
  status: "running",
  cases: [],
  startedAt: new Date().toISOString(),
};
const record = (name) => evidence.cases.push({ name, result: "success" });
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
const before = await snapshot();
writeFileSync(`${directory}/before.json`, JSON.stringify(before));
const target = accounts.a;
assert(target.uid.startsWith("staging-synthetic-"));
assert(target.email.endsWith("@example.invalid"));
const baseline = await api("lookupAccess", { email: target.email });
assert(baseline.found);
assert.equal(baseline.member.role, "coordinator");
// Solo el catálogo sintético ya confirmado de la prueba anterior; nunca fuentes reales.
const cycleId = "99-95",
  catalog = await api("accessCatalog", { cycleId });
assert(catalog.version);
assert.equal(catalog.careers.length, 2);
assert(
  catalog.careers.every(
    (c) =>
      c.name.includes("coordinator-") && c.responsible.includes("sintética"),
  ),
);
const added = catalog.careers.find(
  (c) => !baseline.member.careers.includes(c.id),
);
assert(added, "Hace falta una carrera sintética adicional para la prueba");
const browser = await chromium.launch();
let changed = false;
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
  const f = page.getByRole("region", { name: "Asignar acceso", exact: true });
  await f.getByLabel("Ciclo del catálogo").selectOption(cycleId);
  await f
    .getByLabel("Correo exacto de la cuenta")
    .fill(`missing-access-${Date.now()}@example.invalid`);
  await f.getByRole("button", { name: "Buscar cuenta" }).click();
  await expect(f).toContainText("No existe una cuenta con ese correo", {
    timeout: 30000,
  });
  record("Cuenta inexistente sin alta ni invitación");
  await f.getByLabel("Correo exacto de la cuenta").fill(target.email);
  await f.getByRole("button", { name: "Buscar cuenta" }).click();
  await expect(f).toContainText("Cuenta encontrada:", { timeout: 30000 });
  await f.getByLabel("Buscar carrera o responsable").fill(added.responsible);
  await f.getByLabel("Filtrar por responsable").selectOption(added.responsible);
  await f
    .getByRole("button", { name: "Seleccionar carreras visibles" })
    .click();
  await f.getByRole("button", { name: "Revisar cambios de acceso" }).click();
  const review = f.getByRole("region", { name: "Resumen de acceso" });
  await expect(review).toContainText(added.name, { timeout: 30000 });
  await review.getByRole("checkbox").check();
  await f.getByRole("switch", { name: "Acceso activo" }).uncheck();
  await expect(review).toHaveCount(0);
  await f.getByRole("switch", { name: "Acceso activo" }).check();
  await f.getByRole("button", { name: "Revisar cambios de acceso" }).click();
  await expect(review).toContainText(added.name, { timeout: 30000 });
  await review.getByRole("checkbox").check();
  changed = true;
  await review.getByRole("button", { name: "Confirmar acceso" }).click();
  await expect(f).toContainText("Acceso actualizado.", { timeout: 30000 });
  const saved = await api("lookupAccess", { email: target.email });
  assert.deepEqual(
    saved.member.careers.slice().sort(),
    [...baseline.member.careers, added.id].sort(),
  );
  record(
    "Catálogo confirmado, filtro responsable, selección y confirmación conserva permisos existentes",
  );
  await page.screenshot({
    path: `${directory}/acceso-sintetico.png`,
    fullPage: true,
  });
  await assert.rejects(
    api("lookupAccess", { email: target.email }, "b"),
    /PERMISSION_DENIED/,
  );
  await assert.rejects(
    api("accessCatalog", { cycleId }, "b"),
    /PERMISSION_DENIED/,
  );
  await assert.rejects(
    api("assignMember", { reviewId: "ajeno" }, "b"),
    /PERMISSION_DENIED/,
  );
  record("Denegación servidor a coordinadores");
  const reviewInput = {
    email: target.email,
    cycleId,
    catalogVersion: catalog.version,
    accountVersion: saved.accountVersion,
    memberVersion: saved.memberVersion,
    member: saved.member,
  };
  const obsolete = await api("reviewAccess", reviewInput);
  const restore = await api("reviewAccess", {
    ...reviewInput,
    member: baseline.member,
  });
  await api("assignMember", { reviewId: restore.id });
  changed = false;
  await assert.rejects(
    api("assignMember", { reviewId: obsolete.id }),
    /FAILED_PRECONDITION/,
  );
  assert.deepEqual(
    (await api("lookupAccess", { email: target.email })).member,
    baseline.member,
  );
  record("Revisión obsoleta rechazada y acceso sintético original restaurado");
  const after = await snapshot();
  writeFileSync(`${directory}/after.json`, JSON.stringify(after));
  const modified = Object.keys(before).filter((k) => before[k] !== after[k]);
  assert.equal(modified.length, 0, "Documento preexistente cambiado");
  evidence.preservedDocuments = Object.keys(before).length;
  record("Datos, cortes, reportes y membresías previos conservados");
  evidence.status = "success";
} catch (e) {
  evidence.status = "failed";
  evidence.error = e.message;
  throw e;
} finally {
  if (changed) {
    const current = await api("lookupAccess", { email: target.email });
    const r = await api("reviewAccess", {
      email: target.email,
      cycleId,
      catalogVersion: catalog.version,
      accountVersion: current.accountVersion,
      memberVersion: current.memberVersion,
      member: baseline.member,
    });
    await api("assignMember", { reviewId: r.id });
  }
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
