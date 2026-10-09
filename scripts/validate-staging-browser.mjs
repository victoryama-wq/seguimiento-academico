import { chromium, expect, devices } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { stagingIdentity } from "./staging-identity.mjs";

assert.equal(process.env.CONFIRM_STAGING_PROJECT, "indicadores-academia");
assert(!process.env.CI, "El piloto cloud nunca se ejecuta desde CI");
const project = "indicadores-academia",
  url = `https://${project}.web.app`;
const { sha, revision } = stagingIdentity();
const health = await fetch(
  `https://us-central1-${project}.cloudfunctions.net/environmentStatus`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"data":{}}',
  },
);
assert.deepEqual((await health.json()).result, {
  mode: "staging",
  projectId: project,
  release: sha,
  status: "ready",
});
const accounts = JSON.parse(
  readFileSync("private/staging-test-accounts.json", "utf8"),
);
const run = `cloud-browser-${Date.now()}`,
  directory = `private/cloud-runs/${run}`;
mkdirSync(directory, { recursive: true });
const evidence = {
  run,
  project,
  sha,
  verifierRevision: revision,
  url,
  startedAt: new Date().toISOString(),
  cases: [],
  status: "running",
};
const browser = await chromium.launch();
async function login(page, role) {
  await page.goto(url);
  await page.getByLabel("Correo", { exact: true }).fill(accounts[role].email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByLabel("Ciclo y corte")).toBeVisible({
    timeout: 60000,
  });
}
const filename = "777._Curso_Multimodal_27-1 Calificaciones.csv";
const header =
  "Dirección Email,Tarea:Actividad | Unidad 1 (Real),Tarea:Actividad | Unidad 2 (Real),Tarea:Actividad | Unidad 3 (Real),Tarea:Actividad | Unidad 4 (Real)";
try {
  for (const device of ["desktop", "mobile"]) {
    const options =
      device === "mobile"
        ? devices["Pixel 7"]
        : { viewport: { width: 1440, height: 1000 } };
    let context = await browser.newContext(options),
      page = await context.newPage();
    const cut = `${run}-${device}`;
    await login(page, "admin");
    await page
      .getByRole("button", { name: "Ciclos y cortes", exact: true })
      .click();
    await page.getByText("Crear corte", { exact: true }).first().click();
    const form = page.locator("form").filter({
      has: page.getByLabel("Identificador del corte", { exact: true }),
    });
    await form.getByLabel("Ciclo del corte", { exact: true }).fill("27-1");
    await form.getByLabel("Identificador del corte", { exact: true }).fill(cut);
    await form
      .getByLabel("Corte Escolarizado (1: U1–2; 2: U1–5; 3: U1–7)")
      .selectOption("1");
    await form.getByLabel("Unidad de avance Ejecutivo").selectOption("3");
    await form.getByLabel("Unidad de avance Virtual").selectOption("2");
    await form
      .getByRole("button", { name: "Crear corte", exact: true })
      .click();
    await expect(form.getByRole("status")).toHaveText("Operación confirmada.", {
      timeout: 60000,
    });
    await context.close();
    context = await browser.newContext(options);
    page = await context.newPage();
    await login(page, "a");
    await page.getByRole("button", { name: "Fuentes", exact: true }).click();
    await page.getByLabel("Corte de seguimiento").selectOption(cut);
    await page.getByLabel("Reportes Moodle").setInputFiles({
      name: filename,
      mimeType: "text/csv",
      buffer: Buffer.from(
        `${header}\n000ESC@example.invalid,1,2,3,4\n000EJE@example.invalid,0,2,3,4\n000VIR@example.invalid,1,2,3,4`,
      ),
    });
    await page
      .getByRole("button", { name: "Enviar lote", exact: true })
      .click();
    await expect(
      page.getByText("Operación confirmada.", { exact: true }),
    ).toBeVisible({ timeout: 60000 });
    await context.close(); // Trabajo aceptado sobrevive sin navegador.
    context = await browser.newContext(options);
    page = await context.newPage();
    await login(page, "a");
    await page.getByRole("button", { name: "Fuentes", exact: true }).click();
    await page.getByLabel("Corte de seguimiento").selectOption(cut);
    const job = page.locator(".job-list li").filter({ hasText: "cloud-mix" });
    await expect(job).toContainText("Validado para revisión", {
      timeout: 180000,
    });
    await job.getByRole("button", { name: "Revisar cloud-mix" }).click();
    await expect(page.locator(".preview")).not.toContainText(/000vir/i);
    await page.getByRole("button", { name: "Confirmar publicación" }).click();
    await expect(job).toContainText("Publicado", { timeout: 60000 });
    await page.getByLabel("Reportes Moodle").setInputFiles({
      name: filename,
      mimeType: "text/csv",
      buffer: Buffer.from(`${header}\n000EJE@example.invalid,,-,3,4`),
    });
    await page
      .getByRole("button", { name: "Enviar lote", exact: true })
      .click();
    const ready = page
      .locator(".job-list li")
      .filter({ hasText: "Validado para revisión" });
    await expect(ready).toHaveCount(1, { timeout: 180000 });
    await ready.getByRole("button", { name: "Revisar cloud-mix" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "calificaciones numéricas serán sustituidas" }),
    ).toContainText("2 calificaciones");
    await page.screenshot({
      path: `${directory}/${device}-revision.png`,
      fullPage: true,
    });
    await page
      .getByLabel(
        "Confirmo sustituir la versión anterior, conservando su historial",
      )
      .check();
    await page.getByRole("button", { name: "Confirmar publicación" }).click();
    await expect(
      page.locator(".job-list li").filter({ hasText: "Publicado" }),
    ).toHaveCount(2, { timeout: 60000 });
    await page.getByRole("button", { name: "Panel", exact: true }).click();
    await page.getByLabel("Ciclo y corte").selectOption(cut);
    await expect(page.getByTestId("count-D")).toHaveText("5", {
      timeout: 60000,
    });
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar alcance filtrado" })
      .click();
    const stream = await (await download).createReadStream(),
      chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    assert(!Buffer.concat(chunks).toString().toLowerCase().includes("000vir"));
    await page.screenshot({
      path: `${directory}/${device}-a.png`,
      fullPage: true,
    });
    await context.close();
    context = await browser.newContext(options);
    page = await context.newPage();
    await login(page, "b");
    await page.getByLabel("Ciclo y corte").selectOption(cut);
    await expect(page.getByTestId("count-D")).toHaveText("2", {
      timeout: 60000,
    });
    const view = page.getByRole("combobox", { name: "Vista", exact: true });
    await view.focus();
    await view.selectOption("grupo");
    await view.press("Tab");
    await expect(view).not.toBeFocused();
    await expect(page.locator(".metrics")).not.toContainText(/000esc|000eje/i);
    await page.screenshot({
      path: `${directory}/${device}-b.png`,
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await context.close();
    evidence.cases.push({ device, cut, status: "success" });
  }
  evidence.status = "success";
} catch (error) {
  evidence.status = "failure";
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  evidence.completedAt = new Date().toISOString();
  writeFileSync(
    `${directory}/evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      run,
      status: evidence.status,
      error: evidence.error,
      evidence: `${directory}/evidence.json`,
    }),
  );
}
