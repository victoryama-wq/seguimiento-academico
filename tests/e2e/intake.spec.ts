import { test, expect } from "@playwright/test";
import {
  seedBase,
  password,
  people,
  stores,
  waitJob,
} from "../fixtures/synthetic/stage03";
import {
  csv,
  book,
  rosterRows,
  rosterHeaders,
  catalogRows,
  catalogHeaders,
} from "../fixtures/synthetic/intake";

test.setTimeout(120000);
test("administrador: originales → revisión → avance → Moodle → publicación, sin JSON ni IDs", async ({
  page,
}, info) => {
  await seedBase();
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${people.admin}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Administración institucional" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  const flow = page.getByRole("region", { name: "Carga guiada institucional" });
  await flow.getByLabel("Seleccionar padrón original").setInputFiles({
    name: "alumnos.csv",
    mimeType: "text/csv",
    buffer: csv([rosterHeaders, ...rosterRows]),
  });
  await expect(flow.getByLabel("Ciclo de seguimiento")).toHaveValue("27-1");
  await flow.getByLabel("Seleccionar catálogo original").setInputFiles({
    name: "catalogo.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: book([catalogHeaders, ...catalogRows]),
  });
  await flow
    .getByRole("button", { name: "Revisar alumnos, carreras y decisiones" })
    .click();
  await expect(flow).toContainText(
    "4 inscripciones; 4 personas; 3 principales; 1 personas",
  );
  await expect(
    flow.getByRole("button", { name: "Confirmar padrón y catálogo" }),
  ).toBeDisabled();
  await flow
    .getByLabel(
      "Revisé esta propuesta y confirmo las fuentes y decisiones mostradas",
    )
    .check();
  await flow
    .getByRole("button", { name: "Confirmar padrón y catálogo" })
    .click();
  await expect(
    flow.getByText("Fuentes publicadas y originales conservados."),
  ).toBeVisible();
  await flow
    .getByRole("combobox", { name: "Unidad de avance Ejecutivo", exact: true })
    .selectOption("3");
  await flow
    .getByRole("combobox", { name: "Unidad de avance Virtual", exact: true })
    .selectOption("2");
  await flow
    .getByRole("button", { name: "Preparar corte con este avance" })
    .click();
  await expect(flow.getByLabel("Corte de trabajo")).not.toHaveValue("");
  const reportName = "911._Curso_Compartido_27-1 Calificaciones.ods";
  await flow.getByLabel("Seleccionar reportes originales").setInputFiles({
    name: reportName,
    mimeType: "application/vnd.oasis.opendocument.spreadsheet",
    buffer: book(
      [
        [
          "Dirección Email",
          "Tarea: Unidad 1",
          "Tarea: Unidad 3",
          "Tarea: Unidad 4",
          "Total del curso",
        ],
        ["000ESC@example.invalid", 0, 7, 9, 999],
        ["000EJE@example.invalid", "-", 8, 9, 999],
        ["000VIR@example.invalid", 7, 8, 9, 999],
        ["000BAJA@example.invalid", 10, 10, 10, 999],
      ],
      "ods",
    ),
  });
  await expect(flow).toContainText("Curso detectado: 911");
  await flow
    .getByRole("button", { name: `Validar reporte ${reportName}` })
    .click();
  await expect(
    flow.getByRole("button", { name: "Revisar resultado de Curso Compartido" }),
  ).toBeVisible();
  const jobs = await stores()
    .db.collection("jobs")
    .where("kind", "==", "report")
    .get();
  expect(jobs.docs).toHaveLength(1);
  await waitJob(jobs.docs[0]!.id);
  await flow
    .getByRole("button", { name: "Revisar resultado de Curso Compartido" })
    .click();
  await expect(
    flow.getByRole("region", { name: "Revisión de reporte" }),
  ).toContainText("000BAJA");
  await expect(
    flow.getByRole("region", { name: "Revisión de reporte" }),
  ).toContainText("Impartición no determinada");
  await flow
    .getByLabel("Revisé este reporte, sus observaciones y sustituciones")
    .check();
  await flow
    .getByRole("button", { name: "Confirmar publicación del reporte" })
    .click();
  await expect(
    flow.getByRole("region", { name: "Revisión de reporte" }),
  ).toContainText("Publicado");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("carga-guiada-sintetica.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await flow
    .getByRole("button", { name: "Recuperar revisiones guardadas" })
    .click();
  await flow.getByRole("button", { name: "Abrir revisión" }).first().click();
  await expect(flow).toContainText(
    "Fuentes publicadas y originales conservados.",
  );
  await expect(flow.getByLabel("Seleccionar padrón original")).toBeVisible();
});

test("dos encabezados de matrícula exigen selección visual; un cambio de archivo limpia la confirmación", async ({
  page,
}) => {
  await seedBase();
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${people.admin}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Administración institucional" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  const flow = page.getByRole("region", { name: "Carga guiada institucional" });
  await flow.getByLabel("Seleccionar padrón original").setInputFiles({
    name: "ambiguo.csv",
    mimeType: "text/csv",
    buffer: csv([
      [...rosterHeaders, "Correo"],
      ...rosterRows.map((r) => [...r, `${r[0]}@example.invalid`]),
    ]),
  });
  await flow
    .getByText("Revisar columnas reconocidas y formato", { exact: true })
    .click();
  await flow
    .getByRole("combobox", { name: "Matrícula o correo", exact: true })
    .selectOption("0");
  await flow.getByLabel("Seleccionar catálogo original").setInputFiles({
    name: "carreras.csv",
    mimeType: "text/csv",
    buffer: csv([catalogHeaders, ...catalogRows]),
  });
  await flow
    .getByRole("button", { name: "Revisar alumnos, carreras y decisiones" })
    .click();
  await flow
    .getByLabel(
      "Revisé esta propuesta y confirmo las fuentes y decisiones mostradas",
    )
    .check();
  await flow.getByLabel("Seleccionar padrón original").setInputFiles({
    name: "nuevo.csv",
    mimeType: "text/csv",
    buffer: csv([rosterHeaders, ...rosterRows.slice(0, 3)]),
  });
  await expect(
    flow.getByRole("button", { name: "Confirmar padrón y catálogo" }),
  ).toHaveCount(0);
  await flow
    .getByRole("button", { name: "Revisar alumnos, carreras y decisiones" })
    .click();
  await expect(
    flow.getByRole("button", { name: "Confirmar padrón y catálogo" }),
  ).toBeDisabled();
});
