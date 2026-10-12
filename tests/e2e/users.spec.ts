import { test, expect } from "@playwright/test";
import {
  seedBase,
  people,
  password,
  stores,
} from "../fixtures/synthetic/stage03";
test.setTimeout(120000);
test("Usuarios y accesos: directorio, alta revisada, múltiples carreras y correo existente", async ({
  page,
}, info) => {
  await seedBase();
  const email = `alta-visual-${info.project.name}@example.invalid`;
  await page.goto("/");
  await page
    .getByLabel("Correo", { exact: true })
    .fill(`${people.admin}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Usuarios y accesos",
    exact: true,
  });
  await expect(panel).toContainText("Sin permisos académicos");
  await expect(panel).toContainText("Administrador · alcance institucional");
  await panel
    .getByRole("button", { name: "Nuevo usuario", exact: true })
    .click();
  const form = panel.getByRole("region", {
    name: "Asignar acceso",
    exact: true,
  });
  await form
    .getByLabel("Nombre", { exact: true })
    .fill("Coordinación nueva sintética");
  await form.getByLabel("Correo exacto de la cuenta").fill(email);
  await form
    .getByRole("button", { name: "Seleccionar carreras visibles" })
    .click();
  await form.getByRole("button", { name: "Revisar alta", exact: true }).click();
  const review = form.getByRole("region", { name: "Resumen de acceso" });
  await expect(review).toContainText("Coordinación nueva sintética");
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Confirmar alta" }).click();
  await expect(form).toContainText("Cuenta creada. Permisos asignados.");
  await expect(form).toContainText("solicitud aceptada por Firebase");
  const user = await stores().auth.getUserByEmail(email);
  expect(
    (await stores().db.doc(`memberships/${user.uid}`).get()).data()?.careers,
  ).toHaveLength(2);
  await page.screenshot({
    path: info.outputPath("usuarios-sinteticos.png"),
    fullPage: true,
  });
  await panel
    .getByRole("button", { name: "Nuevo usuario", exact: true })
    .click();
  await form
    .getByLabel("Nombre", { exact: true })
    .fill("No debe sustituir identidad");
  await form.getByLabel("Correo exacto de la cuenta").fill(email);
  await form.getByRole("button", { name: "Revisar alta" }).click();
  await expect(panel).toContainText("El correo ya existe.");
  await expect(form).toContainText(
    "Cuenta encontrada: Coordinación nueva sintética",
  );
  await expect(
    form
      .getByRole("group", { name: "Carreras del catálogo" })
      .getByRole("checkbox")
      .first(),
  ).toBeChecked();
  await panel
    .getByLabel("Buscar usuarios por nombre o correo")
    .fill("alta-visual");
  await panel
    .getByRole("button", { name: "Buscar usuarios", exact: true })
    .click();
  await expect(panel.getByRole("table")).toContainText(
    "Coordinación nueva sintética",
  );
  await expect(panel.getByRole("table")).not.toContainText(
    `${people.b}@example.invalid`,
  );
});
