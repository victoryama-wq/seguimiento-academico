import { expect, type Page } from "@playwright/test";

/** Espera la autorización/espacio real antes de abrir el diagnóstico administrativo. */
export async function openLegacySources(page: Page) {
  const advanced = page.getByText("Herramientas avanzadas y diagnóstico", {
    exact: true,
  });
  await expect(
    advanced
      .or(
        page.getByRole("heading", {
          name: "Fuentes e importaciones",
          exact: true,
        }),
      )
      .first(),
  ).toBeVisible();
  if (await advanced.isVisible()) {
    if ((await advanced.locator("..").getAttribute("open")) === null)
      await advanced.click();
  }
}
