import { openLegacySources } from "./legacy-sources";
import { test, expect, type Page } from "@playwright/test";
import {
  approvedPackage,
  enrollment,
} from "../fixtures/synthetic/approved-package";
import {
  api,
  password,
  people,
  reportCsv,
  seedBase,
  stores,
  waitJob,
} from "../fixtures/synthetic/stage03";
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
  if (uid === people.admin) await openLegacySources(page);
}
test("paquete privado sintético: observación, corrección administrativa, revalidación y dos coordinadores", async ({
  browser,
}, info) => {
  const sessions = await seedBase(),
    p = approvedPackage();
  p.enrollments[0] = enrollment("000SINT01", "27-1 LAF 11 01A", "17/09/2026");
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, people.admin);
  await page.getByLabel("Corte de seguimiento").selectOption("");
  await page.getByLabel("Tipo de fuente").selectOption("academicPackage");
  await page.getByLabel("Archivo de fuente").setInputFiles({
    name: "decisiones-sinteticas.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page
    .getByRole("button", { name: "Enviar fuente", exact: true })
    .click();
  const candidates = page
    .locator(".job-list li")
    .filter({ hasText: "academicPackage" });
  await expect(candidates).toHaveCount(1, { timeout: 45000 });
  await expect(candidates).toContainText("Validado para revisión", {
    timeout: 45000,
  });
  const initialId = (await candidates.getAttribute("data-testid"))!.slice(4);
  await candidates
    .getByRole("button", { name: "Revisar academicPackage" })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmar publicación" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await page
    .getByText("000SINT01 · 27-1 LAF 11 01A · pendiente", { exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Observaciones académicas" }),
  ).toContainText("fecha_desconocida");
  await page.screenshot({
    path: info.outputPath("observacion-sintetica.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Registrar revisión de 000SINT01" })
    .click();
  await page.getByLabel("Fecha efectiva (opcional)").fill("2026-08-31");
  await page.getByLabel("Regla o decisión").fill("DEC-sintética");
  await page
    .getByLabel("Motivo de la corrección")
    .fill("Fecha validada en acta sintética");
  await page.getByLabel("Fecha de la decisión").fill("2026-10-07");
  await page.getByLabel("Referencia de autorización").fill("Acta de prueba");
  await page.getByRole("button", { name: "Guardar nueva propuesta" }).click();
  await expect(candidates).toHaveCount(2, { timeout: 45000 });
  // Seleccionar por la identidad persistente de la nueva propuesta, no por su posición.
  const sourceJobs = (await api("jobs", {}, sessions.admin)) as {
    jobs: { id: string; kind: string }[];
  };
  const correctedId = sourceJobs.jobs.find(
    (j) => j.kind === "academicPackage" && j.id !== initialId,
  )!.id;
  await waitJob(correctedId);
  await page
    .getByTestId(`job-${correctedId}`)
    .getByRole("button", { name: "Revisar academicPackage" })
    .click();
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(page.getByTestId(`job-${correctedId}`)).toContainText(
    "Publicado",
  );
  // Una pestaña antigua no puede sustituir la fuente publicada con una copia
  // que omita su decisión. El rechazo viene del servidor y se muestra en UI.
  await page
    .getByTestId(`job-${initialId}`)
    .getByRole("button", { name: "Revisar academicPackage" })
    .click();
  const oldObservation = page.locator("details:not(.admin-form)").filter({
    has: page.getByText("000SINT01 · 27-1 LAF 11 01A · pendiente", {
      exact: true,
    }),
  });
  if ((await oldObservation.getAttribute("open")) === null)
    await oldObservation.locator("summary").click();
  await page
    .getByRole("button", { name: "Registrar revisión de 000SINT01" })
    .click();
  await page.getByLabel("Fecha efectiva (opcional)").fill("2026-08-31");
  await page.getByLabel("Regla o decisión").fill("DEC-sintética-antigua");
  await page
    .getByLabel("Motivo de la corrección")
    .fill("Intento desde una propuesta anterior");
  await page.getByLabel("Fecha de la decisión").fill("2026-10-07");
  await page
    .getByLabel("Referencia de autorización")
    .fill("Acta de prueba anterior");
  await page.getByRole("button", { name: "Guardar nueva propuesta" }).click();
  await expect(
    page
      .getByRole("region", { name: "Observaciones académicas" })
      .getByRole("status"),
  ).toContainText("Actualiza y revisa la propuesta");
  await expect(candidates).toHaveCount(2);
  expect(
    (await stores().db.doc("cycles/27-1").get()).data()!.sources
      .academicPackage,
  ).toBe(correctedId);
  await page.getByLabel("Corte de seguimiento").selectOption("corte-1");
  await page
    .getByRole("button", {
      name: "Actualizar fuentes del corte abierto sin resultados",
    })
    .click();
  await expect
    .poll(
      async () =>
        (await stores().db.doc("cuts/corte-1").get()).data()?.sources
          .academicPackage,
    )
    .toBe(correctedId);
  await context.close();
  const a = await browser.newContext();
  let pa = await a.newPage();
  await login(pa, people.a);
  await pa.getByLabel("Seleccionar reportes originales").setInputFiles({
    name: "1 Curso compartido 27-1.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      reportCsv.replace("Correo,Nota", "Dirección Email,Tarea: Unidad 1"),
    ),
  });
  const jobs = pa.getByRole("article", { name: "Trabajo Curso compartido" });
  await expect(jobs).toHaveCount(1, { timeout: 45000 });
  await expect(jobs).toContainText("Listo para revisar", {
    timeout: 45000,
  });
  const reportId = (await jobs.getAttribute("data-testid"))!.slice(4);
  await pa.close();
  pa = await a.newPage();
  await pa.goto("/");
  await pa.getByRole("button", { name: "Fuentes", exact: true }).click();
  await pa
    .getByTestId(`job-${reportId}`)
    .getByRole("button", { name: "Revisar Curso compartido", exact: true })
    .click();
  await expect(
    pa.getByRole("region", { name: "Revisión antes de publicar" }),
  ).not.toContainText("000SINT02");
  await expect(
    pa
      .getByRole("region", { name: "Revisión antes de publicar" })
      .getByRole("button", { name: /Registrar revisión/ }),
  ).toHaveCount(0);
  await pa
    .getByTestId(`job-${reportId}`)
    .getByRole("button", { name: "Revalidar con fuentes vigentes" })
    .click();
  await expect(
    pa.getByRole("article", { name: "Trabajo Curso compartido" }),
  ).toHaveCount(2, { timeout: 45000 });
  const all = (await api("jobs", { cutId: "corte-1" }, sessions.a)) as {
    jobs: { id: string }[];
  };
  const revalidated = all.jobs.find((j) => j.id !== reportId)!.id;
  await waitJob(revalidated);
  await pa.getByRole("button", { name: "Recuperar trabajos" }).click();
  await pa
    .getByTestId(`job-${revalidated}`)
    .getByRole("button", { name: "Revisar Curso compartido", exact: true })
    .click();
  const observation = pa
    .getByRole("region", { name: "Revisión antes de publicar" })
    .getByRole("article")
    .filter({ hasText: "000SINT01" })
    .first();
  await observation.getByText("Diagnóstico", { exact: true }).click();
  await expect(observation).toContainText("17/09/2026");
  await expect(observation).toContainText("2026-08-31");
  expect(
    await pa.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await pa.getByRole("checkbox").check();
  await pa.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(pa.getByTestId(`job-${revalidated}`)).toContainText("Publicado");
  await pa.screenshot({
    path: info.outputPath("resolucion-publicada-sintetica.png"),
    fullPage: true,
  });
  const b = await browser.newContext();
  const pb = await b.newPage();
  await login(pb, people.b);
  await expect(pb.getByTestId(`job-${revalidated}`)).toHaveCount(0);
  await pb.getByLabel("Seleccionar reportes originales").setInputFiles({
    name: "1 Curso compartido 27-1.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      reportCsv.replace("Correo,Nota", "Dirección Email,Tarea: Unidad 1"),
    ),
  });
  const own = pb.getByRole("article", { name: "Trabajo Curso compartido" });
  await expect(own).toContainText("Listo para revisar", { timeout: 45000 });
  await own
    .getByRole("button", { name: "Revisar Curso compartido", exact: true })
    .click();
  const previewB = pb.getByRole("region", {
    name: "Revisión antes de publicar",
  });
  await expect(previewB).toContainText("000SINT02");
  await expect(previewB).not.toContainText("000SINT01");
  await a.close();
  await b.close();
});
