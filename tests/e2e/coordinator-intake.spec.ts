import { test, expect, type Page } from "@playwright/test";
import {
  seedBase,
  password,
  people,
  api,
  source,
} from "../fixtures/synthetic/stage03";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";
import { book, csv } from "../fixtures/synthetic/intake";
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
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
}
const flow = (page: Page) =>
  page.getByRole("region", { name: "Carga de reportes de coordinación" });
const file = (ext = "xlsx", grade = 5) => ({
  name: `811._Compartido_Sintético_27-1.${ext}`,
  mimeType: "application/octet-stream",
  buffer:
    ext === "csv"
      ? csv([
          ["Dirección Email", "Tarea: Unidad 1"],
          ["000EJE", grade],
          ["000VIR", 0],
        ])
      : book(
          [
            [
              "Dirección Email",
              "Tarea: Unidad 1",
              "Tarea: Unidad 3",
              "Tarea: Unidad 4",
              "Total del curso",
            ],
            ["000ESC", 0, 7, 9, 999],
            ["000EJE", grade, 6, 9, 999],
            ["000VIR", 8, 9, 9, 999],
            ["000BAJA", 10, 10, 10, 999],
            ["000AJENO", 10, 10, 10, 999],
          ],
          ext as "xlsx" | "ods",
        ),
});
async function publish(page: Page) {
  const f = flow(page),
    job = f
      .getByRole("article", { name: "Trabajo Compartido Sintético" })
      .filter({ hasText: "Listo para revisar" });
  await expect(job).toBeVisible({ timeout: 45000 });
  await job
    .getByRole("button", { name: "Revisar Compartido Sintético", exact: true })
    .click();
  const review = f.getByRole("region", { name: "Revisión antes de publicar" });
  await expect(review).toBeVisible();
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(
    f.getByText(
      "Publicación confirmada. Puedes consultar los resultados de este corte.",
    ),
  ).toBeVisible();
}
test("A/B: primera asignatura, lote parcial, recuperación, principal C.A., ámbitos, cambios acumulativos y resultados", async ({
  browser,
}, info) => {
  const sessions = await seedBase();
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(trackingPackage()),
    {},
    "e2e-coordinator.json",
  );
  await api(
    "createCut",
    {
      id: "flujo",
      cycleId: "27-1",
      progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 3 },
    },
    sessions.admin,
  );
  const context = await browser.newContext(),
    page = await context.newPage();
  await login(page, people.a);
  const f = flow(page);
  await f.getByLabel("Corte para cargar y consultar").selectOption("flujo");
  await expect(
    f.getByText("Ejecutivo: unidades incluidas 1, 2, 3.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel(/JSON|Carreras autorizadas|Seleccionar padrón original/),
  ).toHaveCount(0);
  await f.getByLabel("Seleccionar reportes originales").setInputFiles([
    file(),
    {
      name: "812._Inválido_27-1.xlsx",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("no es un libro"),
    },
  ]);
  await expect(
    f
      .getByRole("article", { name: "Archivo 812._Inválido_27-1.xlsx" })
      .getByRole("button", { name: "Reintentar este archivo" }),
  ).toBeEnabled();
  await expect(f).not.toContainText("000VIR");
  await expect(f).not.toContainText("000AJENO");
  await page.reload();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await expect(
    flow(page).getByLabel("Corte para cargar y consultar"),
  ).toHaveValue("flujo");
  await publish(page);
  await flow(page)
    .getByRole("button", { name: "Consultar resultados de este corte" })
    .click();
  await expect(page.getByLabel("Ciclo y corte")).toHaveValue("flujo");
  await expect(
    page.getByText("Cobertura", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("coordinacion-a-resultados.png"),
    fullPage: true,
  });
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    pageB = await b.newPage();
  await login(pageB, people.b);
  await flow(pageB)
    .getByLabel("Corte para cargar y consultar")
    .selectOption("flujo");
  await expect(
    flow(pageB).getByRole("article", { name: /Trabajo/ }),
  ).toHaveCount(0);
  await flow(pageB)
    .getByLabel("Seleccionar reportes originales")
    .setInputFiles(file("ods"));
  await expect(
    flow(pageB).getByRole("button", {
      name: "Revisar Compartido Sintético",
      exact: true,
    }),
  ).toBeVisible({ timeout: 45000 });
  await flow(pageB)
    .getByRole("button", { name: "Revisar Compartido Sintético", exact: true })
    .click();
  const reviewB = flow(pageB).getByRole("region", {
    name: "Revisión antes de publicar",
  });
  await expect(reviewB).toContainText("000VIR");
  await expect(reviewB).toContainText("C.A");
  await expect(reviewB).not.toContainText("000ESC");
  const table = reviewB.getByRole("region", {
    name: "Alumnos y principal de seguimiento",
  });
  await table.focus();
  await pageB.keyboard.press("ArrowRight");
  expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  await pageB.screenshot({
    path: info.outputPath("coordinacion-b-movil.png"),
    fullPage: true,
  });
  await reviewB.getByRole("checkbox").check();
  await reviewB.getByRole("button", { name: "Confirmar publicación" }).click();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await flow(page)
    .getByLabel("Seleccionar reportes originales")
    .setInputFiles(file("csv", 0));
  await publish(page);
  await flow(page)
    .getByLabel("Seleccionar reportes originales")
    .setInputFiles(file("csv", 0));
  await expect(
    flow(page).getByRole("article", { name: "Trabajo Compartido Sintético" }),
  ).toHaveCount(2);
  await context.close();
  await b.close();
});

test("dos propuestas: la revisión y confirmación anterior se limpian al cambiar de trabajo", async ({
  page,
}) => {
  const sessions = await seedBase();
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(trackingPackage()),
    {},
    "e2e-coordinator-confirm.json",
  );
  await api(
    "createCut",
    {
      id: "confirmar",
      cycleId: "27-1",
      progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 3 },
    },
    sessions.admin,
  );
  await login(page, people.a);
  const f = flow(page);
  await f.getByLabel("Corte para cargar y consultar").selectOption("confirmar");
  await f.getByLabel("Seleccionar reportes originales").setInputFiles(file());
  await expect(
    f.getByRole("button", {
      name: "Revisar Compartido Sintético",
      exact: true,
    }),
  ).toHaveCount(1, { timeout: 45000 });
  await f
    .getByLabel("Seleccionar reportes originales")
    .setInputFiles(file("csv", 9));
  const buttons = f.getByRole("button", {
    name: "Revisar Compartido Sintético",
    exact: true,
  });
  await expect(buttons).toHaveCount(2, { timeout: 45000 });
  await buttons.nth(0).click();
  await f.getByRole("checkbox").check();
  await expect(
    f.getByRole("button", { name: "Confirmar publicación" }),
  ).toBeEnabled();
  await buttons.nth(1).click();
  await expect(f.getByRole("checkbox")).not.toBeChecked();
  await expect(
    f.getByRole("button", { name: "Confirmar publicación" }),
  ).toBeDisabled();
});
