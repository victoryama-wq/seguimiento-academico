import { test, expect, devices, type Page } from "@playwright/test";
import { seedMetrics } from "../fixtures/synthetic/stage04";
import { people, password } from "../fixtures/synthetic/stage03";

test.setTimeout(120000);
async function login(page: Page, uid: string) {
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${uid}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByLabel("Ciclo y corte")).toBeVisible();
  await page.getByLabel("Ciclo y corte").selectOption("metricas");
}
test("administración selecciona universo persistente y revisa cálculo manual", async ({
  page,
}, info) => {
  await seedMetrics(false);
  await login(page, people.admin);
  await expect(
    page.getByText("Sin actividades seleccionadas", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("count-D")).toHaveText("0");
  await page
    .getByRole("button", { name: "Cursos y actividades", exact: true })
    .click();
  for (const name of ["Curso compartido", "Curso A"]) {
    const card = page
      .locator(".metric-course")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    for (const activity of name === "Curso compartido"
      ? ["A", "B", "C"]
      : ["A"])
      await card
        .getByRole("checkbox", {
          name: name === "Curso A" ? "Nota" : activity,
          exact: true,
        })
        .check();
    await card
      .getByLabel("Motivo de la selección o asignación")
      .fill("Universo sintético revisado desde UI");
    await card
      .getByRole("button", { name: `Guardar universo de ${name}`, exact: true })
      .click();
    await expect(card.getByText(/Versión:/)).not.toContainText("Sin selección");
  }
  await expect(page.getByTestId("count-D")).toHaveText("7");
  await expect(page.getByTestId("count-N")).toHaveText("4");
  await page.screenshot({
    path: info.outputPath("seleccion-actividades.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByLabel("Ciclo y corte").selectOption("metricas");
  await expect(page.getByTestId("count-D")).toHaveText("7");
  await expect(page.getByTestId("metric-totals")).toContainText("57.14 %");
  await page.screenshot({
    path: info.outputPath("panel-administracion.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("dos coordinadores navegan por teclado, conservan filtros y exportan su alcance", async ({
  browser,
  page,
}, info) => {
  await seedMetrics();
  await login(page, people.a);
  await expect(page.getByTestId("count-D")).toHaveText("4");
  await expect(
    page
      .getByRole("combobox", { name: "Carrera", exact: true })
      .locator('option[value="arq-plan-1"]'),
  ).toHaveCount(0);
  const view = page.getByRole("combobox", { name: "Vista", exact: true });
  await view.focus();
  await view.selectOption("grupo");
  await view.press("Tab");
  await expect(view).not.toBeFocused();
  const detail = page.getByRole("button", {
    name: "Ver detalle de 27-1 LAF 24 01A",
    exact: true,
  });
  await detail.focus();
  await detail.press("Enter");
  await expect(
    page.getByRole("combobox", {
      name: "Grupo principal de seguimiento",
      exact: true,
    }),
  ).toHaveValue("27-1 LAF 24 01A");
  await expect(page.locator(".metrics table")).toContainText("000SINT01");
  await expect(page.locator(".metrics")).not.toContainText("000SINT02");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar alcance filtrado" }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString();
  expect(csv).toContain('"2","1","1","0","1","4","50","25","1"');
  expect(csv).toContain("27-1 LAF 24 01A");
  expect(csv).not.toContain("000SINT02");
  await page.screenshot({
    path: info.outputPath("panel-coordinacion-a.png"),
    fullPage: true,
  });
  const student = page.getByRole("textbox", {
    name: "Matrícula del estudiante",
    exact: true,
  });
  await student.fill("000BAJA");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.getByTestId("count-D")).toHaveText("0");
  await page
    .getByRole("button", { name: "Exclusiones e incidencias", exact: true })
    .click();
  await expect(page.locator(".metrics table tbody tr")).toHaveCount(2);
  await expect(page.locator(".metrics table")).toContainText("000BAJA");
  await expect(page.locator(".metrics table")).toContainText("baja");
  await expect(page.locator(".metrics table")).toContainText(":fila:");
  await expect(page.getByTestId("metric-totals")).toContainText("Sin datos");
  await page.screenshot({
    path: info.outputPath("baja-filtrada.png"),
    fullPage: true,
  });
  await student.fill("");
  const special = page.getByRole("combobox", {
    name: "Caso especial",
    exact: true,
  });
  await special.selectOption("con_especial");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.getByTestId("count-D")).toHaveText("4");
  await expect(page.locator(".metrics table")).toContainText("000SINT01");
  await expect(page.locator(".metrics table")).not.toContainText("000BAJA");
  await special.selectOption("solo_base");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.getByTestId("count-D")).toHaveText("0");
  await expect(page.locator(".metrics table")).toContainText("000BAJA");
  await expect(page.locator(".metrics table")).not.toContainText("000SINT01");
  const b = await browser.newContext({
    ...devices[
      info.project.name === "mobile-chromium" ? "Pixel 7" : "Desktop Chrome"
    ],
  });
  const pageB = await b.newPage();
  await login(pageB, people.b);
  await expect(pageB.getByTestId("count-D")).toHaveText("3");
  await pageB
    .getByRole("button", { name: "Detalle de estudiantes", exact: true })
    .click();
  await expect(pageB.locator(".metrics table")).toContainText("texto");
  await expect(pageB.locator(".metrics")).not.toContainText("000SINT01");
  await pageB.screenshot({
    path: info.outputPath("panel-coordinacion-b.png"),
    fullPage: true,
  });
  await b.close();
});
test("panel sin archivos, carga y error recuperable sin porcentajes ficticios", async ({
  page,
}, info) => {
  await seedMetrics(false);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/academicApi", async (route) => {
    const input = route.request().postDataJSON()?.data;
    if (input?.op === "dashboard" && input.input?.cutId === "metricas") {
      await gate;
      await route.continue();
      finish();
    } else await route.continue();
  });
  await login(page, people.a);
  await expect(
    page.getByText("Calculando el alcance autorizado…", { exact: true }),
  ).toBeVisible();
  release();
  await finished;
  await page.unroute("**/academicApi");
  await expect(
    page.getByText("Sin actividades seleccionadas", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("metric-totals")).not.toContainText("0 %");
  await page.getByLabel("Ciclo y corte").selectOption("corte-1");
  await expect(
    page.getByText("Sin archivos publicados", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("panel-sin-datos.png"),
    fullPage: true,
  });
  await page.route("**/academicApi", async (route) => {
    if (route.request().postDataJSON()?.data?.op === "dashboard")
      await route.abort();
    else await route.continue();
  });
  await page.getByRole("button", { name: "Actualizar versiones" }).click();
  await expect(
    page.getByRole("button", { name: "Reintentar panel" }),
  ).toBeVisible();
  await page.unroute("**/academicApi");
  await page.getByRole("button", { name: "Reintentar panel" }).click();
  await expect(
    page.getByText("Sin archivos publicados", { exact: true }),
  ).toBeVisible();
});
