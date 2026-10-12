import { test, expect } from "@playwright/test";
import {
  seedBase,
  source,
  people,
  password,
  stores,
  apiRaw,
} from "../fixtures/synthetic/stage03";
import { trackingPackage } from "../fixtures/synthetic/report-tracking";
test.setTimeout(120000);
test("Administración busca cuenta, filtra responsable, revisa selección múltiple y conserva permisos no catalogados", async ({
  page,
}, info) => {
  await seedBase();
  const p = trackingPackage();
  p.catalog = p.catalog.map((c) => ({
    ...c,
    program:
      c.abbreviation === "LAF"
        ? "Finanzas sintéticas"
        : "Arquitectura sintética",
    responsible: "Responsable sintético A",
  }));
  const { token } = await import("../fixtures/synthetic/stage03");
  await source(
    await token(people.admin),
    "academicPackage",
    JSON.stringify(p),
    {},
    "catalogo-visual.json",
  );
  await stores()
    .db.doc(`memberships/${people.a}`)
    .set({
      role: "coordinator",
      active: true,
      careers: ["laf-plan-1", "legado-sintetico"],
    });
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${people.admin}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const f = page.getByRole("region", { name: "Asignar acceso", exact: true });
  await f
    .getByLabel("Correo exacto de la cuenta")
    .fill("missing@example.invalid");
  await f.getByRole("button", { name: "Buscar cuenta" }).click();
  await expect(f).toContainText("No existe una cuenta con ese correo");
  await f
    .getByLabel("Correo exacto de la cuenta")
    .fill(`${people.a}@example.invalid`);
  await f.getByRole("button", { name: "Buscar cuenta" }).click();
  await expect(f).toContainText("Cuenta encontrada:");
  await expect(
    f
      .getByRole("group", { name: "Permisos fuera del catálogo" })
      .getByRole("checkbox"),
  ).toBeChecked();
  await f
    .getByLabel("Buscar carrera o responsable")
    .fill("responsable sintetico");
  await f
    .getByLabel("Filtrar por responsable")
    .selectOption("Responsable sintético A");
  await f
    .getByRole("button", { name: "Seleccionar carreras visibles" })
    .click();
  await expect(
    f
      .getByRole("group", { name: "Carreras del catálogo" })
      .getByRole("checkbox"),
  ).toHaveCount(2);
  await f.getByRole("button", { name: "Revisar cambios de acceso" }).click();
  const review = f.getByRole("region", { name: "Resumen de acceso" });
  await expect(review).toContainText("Arquitectura sintética");
  await review.getByRole("checkbox").check();
  await f.getByRole("switch", { name: "Acceso activo" }).uncheck();
  await expect(review).toHaveCount(0);
  await f.getByRole("switch", { name: "Acceso activo" }).check();
  await f.getByRole("button", { name: "Revisar cambios de acceso" }).click();
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Confirmar acceso" }).click();
  await expect(f).toContainText("Acceso actualizado.");
  expect(
    (await stores().db.doc(`memberships/${people.a}`).get())
      .data()!
      .careers.slice()
      .sort(),
  ).toEqual(["arq-plan-1", "laf-plan-1", "legado-sintetico"]);
  await expect(
    f.getByLabel(/UID|separadas por coma|Identificador de usuario/),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("asignacion-sintetica.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${people.b}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await expect(f).toHaveCount(0);
  await expect(
    apiRaw(
      "lookupAccess",
      { email: `${people.a}@example.invalid` },
      await token(people.b),
    ),
  ).rejects.toThrow("PERMISSION_DENIED");
});
