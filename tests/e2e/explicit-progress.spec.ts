import { test, expect, type Page } from "@playwright/test";
import {
  api,
  batch,
  password,
  people,
  seedBase,
  source,
  waitJob,
} from "../fixtures/synthetic/stage03";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";

test.setTimeout(120000);
async function login(page: Page, uid: string) {
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${uid}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByLabel("Ciclo y corte")).toBeVisible();
}
test("selección explícita sin fecha y revisión de pérdida numérica en curso compartido", async ({
  page,
}, info) => {
  const s = await seedBase();
  const p = trackingPackage();
  delete p.schedule.tracking;
  await source(
    s.admin,
    "academicPackage",
    JSON.stringify(p),
    {},
    "explicit-e2e.json",
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
    s.admin,
  );
  await login(page, people.admin);
  await page
    .getByRole("button", { name: "Ciclos y cortes", exact: true })
    .click();
  await page.getByText("Crear corte", { exact: true }).first().click();
  const form = page.locator("form").filter({
    has: page.getByLabel("Identificador del corte", { exact: true }),
  });
  await form.getByLabel("Ciclo del corte", { exact: true }).fill("27-1");
  await form
    .getByLabel("Identificador del corte", { exact: true })
    .fill("explicit-ui");
  await form
    .getByLabel("Corte Escolarizado (1: U1–2; 2: U1–5; 3: U1–7)")
    .selectOption("1");
  await form.getByLabel("Unidad de avance Ejecutivo").selectOption("3");
  await form.getByLabel("Unidad de avance Virtual").selectOption("2");
  await form.getByRole("button", { name: "Crear corte", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText("Operación confirmada.");
  await page.getByRole("button", { name: /Historial y seguimiento/ }).click();
  await page
    .getByRole("button", { name: "Consultar calendario y pendientes" })
    .click();
  const region = page.getByRole("region", {
    name: "Avance de explicit-ui",
    exact: true,
  });
  await expect(region).toContainText("Ejecutivo: unidades incluidas 1, 2, 3.");
  await region
    .getByText("Configurar avance de explicit-ui", { exact: true })
    .click();
  await region.getByLabel("Unidad de avance Virtual").selectOption("3");
  await region
    .getByLabel("Motivo del cambio de avance")
    .fill("Avance sintético confirmado");
  await region.getByRole("button", { name: "Guardar avance" }).click();
  await expect(region).toContainText("Virtual: unidades incluidas 1, 2, 3.");
  const filename = "777._Curso_Multimodal_27-1 Calificaciones.csv";
  const header =
    "Dirección Email,Tarea:Actividad | Unidad 1 (Real),Tarea:Actividad | Unidad 2 (Real),Tarea:Actividad | Unidad 3 (Real),Tarea:Actividad | Unidad 4 (Real)";
  const initial = `${header}\n000EJE@example.invalid,0,8,3,4\n000VIR@example.invalid,7,8,3,4`;
  const [job] = await batch(
    s.a,
    [
      {
        name: filename,
        content: initial,
        courseId: "mix",
        mapping: { profile: "moodle-institutional-v1" },
      },
    ],
    "explicit-ui",
  );
  await waitJob(job!.id);
  await api("publish", { jobId: job!.id, replace: false }, s.a);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  // El click inicia signOut, pero no espera su persistencia asíncrona. No
  // navegar hasta que Auth confirme la salida mediante el formulario visible.
  await expect(
    page.getByRole("heading", { name: "Acceso institucional" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(
    0,
  );
  await login(page, people.a);
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await page
    .getByLabel("Corte para cargar y consultar")
    .selectOption("explicit-ui");
  await page.getByLabel("Seleccionar reportes originales").setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(
      `${header}\n000EJE@example.invalid,,-,3,4\n000VIR@example.invalid,,-,3,4`,
    ),
  });
  const ready = page
    .getByRole("article", { name: "Trabajo Curso Multimodal" })
    .filter({ hasText: "Listo para revisar" });
  await expect(ready).toHaveCount(1, { timeout: 45000 });
  await ready
    .getByRole("button", { name: "Revisar Curso Multimodal", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Revisión antes de publicar" }),
  ).not.toContainText(/000vir/i);
  await expect(
    page.getByRole("region", { name: "Revisión antes de publicar" }),
  ).toContainText("Calificaciones modificadas: 2. Valores sin cambios: 2");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "calificaciones numéricas serán sustituidas" }),
  ).toContainText("2 calificaciones");
  await expect(
    page.getByRole("button", { name: "Confirmar publicación" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("revision-acumulativa-sintetica.png"),
    fullPage: true,
  });
  await page
    .getByLabel(
      "He revisado esta propuesta y sus advertencias; confirmo la publicación en mi ámbito.",
    )
    .check();
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(
    page
      .getByRole("article", { name: "Trabajo Curso Multimodal" })
      .filter({ hasText: "Publicado" }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Panel", exact: true }).click();
  await page.getByLabel("Ciclo y corte").selectOption("explicit-ui");
  await expect(page.getByTestId("count-D")).toHaveText("3");
  await expect(page.getByTestId("count-N")).toHaveText("1");
  await page
    .getByRole("button", { name: "Detalle de estudiantes", exact: true })
    .click();
  await expect(
    page.getByText(
      "Unidades conservadas para después: 4. Fuera del cálculo actual.",
    ),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/000vir/i);
  await page.screenshot({
    path: info.outputPath("avance-explicito-sintetico.png"),
    fullPage: true,
  });
});
