import { expect, test } from "@playwright/test";

test("pantalla inicial sin cifras inventadas, conexión real y navegación", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Panel académico" }),
  ).toBeVisible();
  await expect(page.getByText("ENTORNO EMULADO")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Conexión local verificada · Sin sesión iniciada",
    { timeout: 20_000 },
  );
  await expect(
    page.getByRole("heading", { name: "Aún no hay un corte disponible" }),
  ).toBeVisible();
  await expect(
    page.getByText("No hay datos académicos cargados."),
  ).toBeVisible();
  await expect(page.getByText(/\d+\s*%/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("panel.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ver preparación del ciclo" }).click();
  await expect(
    page.getByRole("heading", { name: "Ciclos y cortes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await expect(
    page.getByText("Todavía no se han incorporado fuentes"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await expect(
    page.getByText("Los accesos están pendientes de configuración"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Volver al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Panel académico" }),
  ).toBeVisible();
});

test("estado de carga visible mientras responde el backend", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/environmentStatus", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText(
    "Comprobando conexión con los emuladores…",
  );
  release();
  await expect(page.getByRole("status")).toContainText(
    "Conexión local verificada",
  );
});

test("error de conexión y reintento contra Functions real", async ({
  page,
}) => {
  await page.route("**/environmentStatus", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { status: "UNAVAILABLE", message: "Fallo sintético" },
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo verificar la conexión local",
  );
  await page.unroute("**/environmentStatus");
  await page.getByRole("button", { name: "Reintentar conexión" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Conexión local verificada",
  );
});

test("navegación por teclado y enlace para saltar al contenido", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Fuentes", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Fuentes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fuentes", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
