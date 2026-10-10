import { test, expect, devices, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seedHistory, historyPairs } from "../fixtures/synthetic/stage05";
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
  await page.getByRole("button", { name: /Historial y seguimiento/ }).click();
}
async function compare(page: Page) {
  await page
    .getByRole("combobox", { name: "Corte anterior", exact: true })
    .selectOption("metricas");
  await page
    .getByRole("combobox", { name: "Corte posterior", exact: true })
    .selectOption("posterior");
  await page
    .getByRole("button", { name: "Comparar cortes", exact: true })
    .click();
  await expect(page.getByTestId("history-totals")).toBeVisible();
}
test("administrador revisa equivalencias, cambios y calendario con evidencia sintética", async ({
  page,
}, info) => {
  await seedHistory(false);
  await login(page, people.admin);
  await compare(page);
  await expect(
    page.getByText(/No comparable: sin correspondencias aprobadas/),
  ).toBeVisible();
  await page
    .getByText("Administrar correspondencias explícitas", { exact: true })
    .click();
  await page
    .getByLabel("Correspondencias revisadas (JSON)")
    .fill(JSON.stringify(historyPairs));
  await page
    .getByLabel("Motivo de correspondencia")
    .fill("Revisión sintética de equivalencias de ambos reportes");
  await page.getByRole("button", { name: "Guardar correspondencias" }).click();
  await expect(page.getByTestId("history-totals")).toContainText(
    "25 puntos porcentuales",
  );
  await page.screenshot({
    path: info.outputPath("historial-administracion.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cambios y exclusiones", exact: true })
    .click();
  await expect(
    page.getByText(/Baja; no representa recuperación/),
  ).toBeVisible();
  await expect(page.getByText(/posterior: Futura/)).toBeVisible();
  await page
    .getByRole("button", { name: "Consultar calendario y pendientes" })
    .click();
  await expect(
    page.getByRole("region", { name: "Calendario de seguimiento" }),
  ).toContainText("Pendientes de carga: 1");
  await page
    .getByText("Proponer calendario de cortes", { exact: true })
    .click();
  await page.getByLabel("Primer corte", { exact: true }).fill("2026-11-02");
  await page.getByLabel("Número de cortes", { exact: true }).fill("2");
  await page
    .getByLabel("Corte Escolarizado (1: U1–2; 2: U1–5; 3: U1–7)")
    .selectOption("1");
  await page.getByLabel("Unidad de avance Ejecutivo").selectOption("3");
  await page.getByLabel("Unidad de avance Virtual").selectOption("2");
  await page
    .getByRole("button", { name: "Crear calendario", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Calendario de seguimiento" }),
  ).toContainText("2026-11-23");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("coordinación A navega por teclado, exporta y conserva una bitácora atribuible", async ({
  page,
}, info) => {
  await seedHistory();
  await login(page, people.a);
  await compare(page);
  await expect(page.getByTestId("history-totals")).toContainText(
    "25 puntos porcentuales",
  );
  await expect(
    page.getByRole("region", { name: "Comparación histórica" }),
  ).not.toContainText(/000sint02/i);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar comparación completa" })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "comparacion-historica.csv",
  );
  await page
    .getByRole("combobox", { name: "Corte de seguimiento", exact: true })
    .selectOption("metricas");
  await page
    .getByRole("combobox", { name: "Curso de seguimiento", exact: true })
    .selectOption("compartido");
  await page
    .getByLabel("Matrícula de seguimiento", { exact: true })
    .fill("000SINT01");
  await page
    .getByRole("button", { name: "Consultar bitácora", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Sin observaciones registradas.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Observación", { exact: true })
    .fill("Seguimiento sintético de registro; entrega desconocida");
  await page
    .getByLabel("Responsable", { exact: true })
    .fill("Responsable ficticio A");
  await page
    .getByLabel("Fecha de contacto", { exact: true })
    .fill("2026-09-25");
  await page
    .getByLabel("Siguiente acción", { exact: true })
    .fill("Revisar fuente en próximo corte");
  await page
    .getByRole("button", { name: "Guardar seguimiento", exact: true })
    .click();
  await expect(page.getByText(/Autor: coordinador-a/)).toBeVisible();
  await expect(page.getByText(/Contacto: 2026-09-25/)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("bitacora-coordinacion-a.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Ciclo y corte")).toBeVisible();
  await page.getByRole("button", { name: /Historial y seguimiento/ }).click();
  await page
    .getByRole("combobox", { name: "Corte de seguimiento", exact: true })
    .selectOption("metricas");
  await page
    .getByRole("combobox", { name: "Curso de seguimiento", exact: true })
    .selectOption("compartido");
  await page
    .getByLabel("Matrícula de seguimiento", { exact: true })
    .fill("000SINT01");
  await page
    .getByRole("button", { name: "Consultar bitácora", exact: true })
    .click();
  await expect(page.getByText(/Autor: coordinador-a/)).toBeVisible();
});
test("coordinación B conserva no comparable, permisos y estados de error", async ({
  page,
}, info) => {
  await seedHistory(true, { omitWithdrawnRow: true });
  await login(page, people.b);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/academicApi", async (route) => {
    if (route.request().postDataJSON()?.data?.op === "compareCuts") await gate;
    await route.continue();
  });
  const pending = compare(page);
  try {
    await expect(
      page.getByText("Cargando comparación…", { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
  await pending;
  await page.unroute("**/academicApi");
  await expect(
    page.getByText(/No comparable: sin denominador común elegible/),
  ).toBeVisible();
  await expect(page.getByTestId("history-totals")).toContainText(
    "0 observaciones",
  );
  await page.getByRole("button", { name: "Cambios y exclusiones" }).click();
  await expect(
    page.getByText(/Baja; no representa recuperación/),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Comparación histórica" }),
  ).not.toContainText(/000sint01/i);
  await page.screenshot({
    path: info.outputPath("historial-coordinacion-b.png"),
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Corte de seguimiento", exact: true })
    .selectOption("metricas");
  await page
    .getByRole("combobox", { name: "Curso de seguimiento", exact: true })
    .selectOption("compartido");
  await page
    .getByLabel("Matrícula de seguimiento", { exact: true })
    .fill("000SINT01");
  await page.getByRole("button", { name: "Consultar bitácora" }).click();
  await expect(
    page
      .getByRole("region", { name: "Bitácora de seguimiento" })
      .getByRole("alert"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar seguimiento" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("dos sesiones conservan ausencia de correspondencias hasta actualizar y exportan A→A2 por curso", async ({
  page,
  browser,
}, info) => {
  await seedHistory(false, { omitWithdrawnRow: true });
  await login(page, people.a);
  await compare(page);
  await expect(
    page.getByText(/No comparable: sin correspondencias aprobadas/),
  ).toBeVisible();
  const context = await browser.newContext({
    ...(info.project.name.includes("mobile")
      ? devices["Pixel 7"]
      : devices["Desktop Chrome"]),
    baseURL: "http://127.0.0.1:4173",
  });
  try {
    const admin = await context.newPage();
    await login(admin, people.admin);
    await compare(admin);
    await admin
      .getByText("Administrar correspondencias explícitas", { exact: true })
      .click();
    await admin
      .getByLabel("Correspondencias revisadas (JSON)")
      .fill(JSON.stringify(historyPairs));
    await admin
      .getByLabel("Motivo de correspondencia")
      .fill("Segunda sesión: equivalencias sintéticas revisadas");
    await admin
      .getByRole("button", { name: "Guardar correspondencias" })
      .click();
    await expect(admin.getByTestId("history-totals")).toContainText(
      "25 puntos porcentuales",
    );
    await page.getByRole("button", { name: "Cambios y exclusiones" }).click();
    await expect(page.getByTestId("history-totals")).toContainText(
      "0 observaciones",
    );
    await expect(
      page.getByText(/No comparable: sin correspondencias aprobadas/),
    ).toBeVisible();
    const exportCsv = async () => {
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Exportar comparación completa" })
        .click();
      const path = await (await pending).path();
      return readFile(path!, "utf8");
    };
    const pinned = await exportCsv();
    expect(pinned).toContain('"Universo común","0"');
    expect(pinned).toContain("Sin correspondencia aprobada");
    await page.screenshot({
      path: info.outputPath("revision-ausencia-fijada.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Actualizar correspondencias" })
      .click();
    await expect(page.getByTestId("history-totals")).toContainText(
      "4 observaciones",
    );
    await page.getByLabel("Actividad del corte anterior").fill("A");
    await page
      .getByRole("button", { name: "Comparar cortes", exact: true })
      .click();
    await expect(page.getByTestId("history-totals")).toContainText(
      "2 observaciones",
    );
    const filtered = await exportCsv();
    expect(filtered).toContain('"Universo común","2"');
    expect(filtered).toContain('"compartido","A","A2"');
    expect(filtered).toContain('"solo-a","A","A"');
    expect(filtered.toLowerCase()).not.toContain("000sint02");
    await page.screenshot({
      path: info.outputPath("revision-actividad-mapeada.png"),
      fullPage: true,
    });
    await page.getByLabel("Actividad del corte anterior").fill("A2");
    await page
      .getByRole("button", { name: "Comparar cortes", exact: true })
      .click();
    await expect(page.getByTestId("history-totals")).toContainText(
      "0 observaciones",
    );
    await expect(
      page.getByText(/No comparable: sin correspondencias aprobadas/),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
