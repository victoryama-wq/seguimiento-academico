import { test, expect } from "@playwright/test";
import {
  api,
  password,
  people,
  seedBase,
  source,
} from "../fixtures/synthetic/stage03";
import {
  trackingPackage,
  fullTrackingCsv,
} from "../fixtures/synthetic/report-tracking";
test.setTimeout(120000);
test("curso multimodal: reconoce reporte y publica sin elegir inscripción; muestra el grupo de seguimiento", async ({
  page,
}, info) => {
  const sessions = await seedBase();
  await source(
    sessions.admin,
    "academicPackage",
    JSON.stringify(trackingPackage()),
    {},
    "tracking.json",
  );
  await api(
    "createCourse",
    {
      cycleId: "27-1",
      id: "mix",
      externalId: "777",
      name: "Curso Multimodal",
      careers: ["laf-plan-1", "arq-plan-1"],
    },
    sessions.admin,
  );
  await api(
    "createCut",
    { cycleId: "27-1", id: "semana3", date: "2026-09-20", schoolCut: 1 },
    sessions.admin,
  );
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${people.a}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await page
    .getByLabel("Corte para cargar y consultar")
    .selectOption("semana3");
  await page.getByLabel("Seleccionar reportes originales").setInputFiles({
    name: "777._Curso_Multimodal_27-1 Calificaciones.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(fullTrackingCsv),
  });
  const jobs = page.getByRole("article", { name: "Trabajo Curso Multimodal" });
  await expect(jobs).toHaveCount(1, { timeout: 45000 });
  await expect(jobs).toContainText("Listo para revisar", {
    timeout: 45000,
  });
  await jobs
    .getByRole("button", { name: "Revisar Curso Multimodal", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Revisión antes de publicar" }),
  ).not.toContainText("000VIR");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(jobs).toContainText("Publicado");
  await page.getByRole("button", { name: "Panel", exact: true }).click();
  await page.getByLabel("Ciclo y corte").selectOption("semana3");
  await expect(page.getByTestId("count-D")).toHaveText("4");
  await expect(page.getByTestId("count-N")).toHaveText("3");
  await page
    .getByRole("button", { name: "Detalle de estudiantes", exact: true })
    .click();
  await expect(
    page
      .getByText(
        "Grupo principal de seguimiento. Grupo de impartición: no determinado.",
      )
      .first(),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("000VIR");
  await page.screenshot({
    path: info.outputPath("seguimiento-principal-sintetico.png"),
    fullPage: true,
  });
});
