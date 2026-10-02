import { expect, test, type Page } from "@playwright/test";
import {
  api,
  moodleMapping,
  password,
  people,
  reportCsv,
  rosterCsv,
  rosterMap,
  seedBase,
  stores,
} from "../fixtures/synthetic/stage03";

test.setTimeout(120000);
async function login(page: Page, uid: string) {
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${uid}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
}

test("administrador publica una nueva fuente conservando el corte existente", async ({
  page,
}, info) => {
  const sessions = await seedBase();
  await login(page, people.admin);
  await expect(
    page.getByRole("heading", { name: "Administración institucional" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await page.getByLabel("Corte de seguimiento").selectOption("");
  await page.getByLabel("Archivo de fuente").setInputFiles({
    name: "padron-revisado.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      rosterCsv.replace("Estudiante A", "Estudiante A revisado"),
    ),
  });
  await page
    .getByLabel("Mapeo aprobado de encabezados (JSON)")
    .fill(JSON.stringify(rosterMap));
  await page
    .getByRole("button", { name: "Enviar fuente", exact: true })
    .click();
  const job = page
    .locator(".job-list li")
    .filter({ hasText: "Validado para revisión" });
  await expect(job).toHaveCount(1, { timeout: 45000 });
  const jobTestId = (await job.getAttribute("data-testid"))!;
  await job.getByRole("button", { name: "Revisar roster" }).click();
  await expect(page.getByText("Registros procesados: 2")).toBeVisible();
  await page
    .getByLabel(
      "Confirmo sustituir la versión anterior, conservando su historial",
    )
    .check();
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(page.getByTestId(jobTestId)).toContainText("Publicado");
  await expect(
    page
      .locator(".preview")
      .getByRole("button", { name: "Confirmar publicación" }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("administracion-fuentes.png"),
    fullPage: true,
  });
  const overview = (await api("overview", {}, sessions.admin)) as {
    cuts: { id: string }[];
  };
  expect(overview.cuts.map((c) => c.id)).toContain("corte-1");
  expect(
    (await stores().db.doc("cycles/27-1").get()).data()!.sources.roster,
  ).not.toBe(sessions.roster);
  expect(
    (await stores().db.doc("cuts/corte-1").get()).data()!.sources.roster,
  ).toBe(sessions.roster);
});

test("dos coordinadores: lote parcial, cierre del navegador y curso compartido aislado", async ({
  browser,
}, info) => {
  await seedBase();
  const a = await browser.newContext();
  let page = await a.newPage();
  await login(page, people.a);
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await page.getByLabel("Reportes Moodle").setInputFiles([
    {
      name: "1 Curso compartido 27-1.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(reportCsv),
    },
    {
      name: "2 Curso A 27-1.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("<html>inválido</html>"),
    },
  ]);
  await page
    .getByLabel("Instancia para 1 Curso compartido 27-1.csv")
    .selectOption("compartido");
  await page
    .getByLabel("Instancia para 2 Curso A 27-1.csv")
    .selectOption("solo-a");
  for (const name of ["1 Curso compartido 27-1.csv", "2 Curso A 27-1.csv"])
    await page
      .getByLabel(`Mapeo aprobado para ${name}`)
      .fill(JSON.stringify(moodleMapping));
  await page.getByRole("button", { name: "Enviar lote", exact: true }).click();
  await expect(
    page.getByText("Operación confirmada.", { exact: true }),
  ).toBeVisible();
  await a.close(); // Ningún navegador ni polling dirige el procesamiento del worker.
  const resumed = await browser.newContext();
  page = await resumed.newPage();
  await login(page, people.a);
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  const valid = page.locator(".job-list li").filter({ hasText: "compartido" });
  const invalid = page.locator(".job-list li").filter({ hasText: "solo-a" });
  await expect(valid).toContainText("Validado para revisión", {
    timeout: 45000,
  });
  await expect(invalid).toContainText("Archivo inválido", { timeout: 45000 });
  await valid.getByRole("button", { name: "Revisar compartido" }).click();
  await expect(page.locator(".preview")).toContainText("000SINT01");
  await expect(page.locator(".preview")).not.toContainText("000SINT02");
  await expect(
    page.getByRole("button", { name: "Descargar original" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(valid).toContainText("Publicado");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar mi carrera" }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe("resultados-carrera.csv");
  const stream = await downloaded.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = Buffer.concat(chunks).toString();
  expect(exported).toContain("000SINT01");
  expect(exported).not.toContain("000SINT02");
  await page.screenshot({
    path: info.outputPath("coordinacion-a.png"),
    fullPage: true,
  });
  const b = await browser.newContext();
  const pageB = await b.newPage();
  await login(pageB, people.b);
  await pageB.getByRole("button", { name: "Fuentes", exact: true }).click();
  await expect(pageB.locator(".job-list")).not.toContainText("solo-a");
  await pageB.getByRole("button", { name: "Revisar compartido" }).click();
  await expect(pageB.locator(".preview")).toContainText("000SINT02");
  await expect(pageB.locator(".preview")).not.toContainText("000SINT01");
  await pageB.screenshot({
    path: info.outputPath("coordinacion-b.png"),
    fullPage: true,
  });
  await resumed.close();
  await b.close();
});
