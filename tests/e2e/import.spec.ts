import { openLegacySources } from "./legacy-sources";
import { expect, test, type Page } from "@playwright/test";
import {
  api,
  batch,
  descriptor,
  moodleMapping,
  password,
  people,
  reportCsv,
  rosterCsv,
  rosterMap,
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
}

test("administrador publica una nueva fuente conservando el corte existente", async ({
  page,
}, info) => {
  const sessions = await seedBase();
  await login(page, people.admin);
  await expect(
    page.getByRole("heading", { name: "Administración institucional" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await openLegacySources(page);
  await page.getByLabel("Corte de seguimiento").selectOption("");
  await page.getByLabel("Archivo de fuente").setInputFiles({
    name: "padron-revisado.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      rosterCsv.replace("Estudiante A", "Estudiante A revisado"),
    ),
  });
  await page
    .getByLabel("Mapeo aprobado de encabezados (JSON)")
    .fill(JSON.stringify(rosterMap));
  await page
    .getByRole("button", { name: "Enviar fuente", exact: true })
    .click();
  const job = page
    .locator(".job-list li")
    .filter({ hasText: "Validado para revisión" });
  await expect(job).toHaveCount(1, { timeout: 45000 });
  const jobTestId = (await job.getAttribute("data-testid"))!;
  await job.getByRole("button", { name: "Revisar roster" }).click();
  await expect(page.getByText("Registros procesados: 2")).toBeVisible();
  await page
    .getByLabel(
      "Confirmo sustituir la versión anterior, conservando su historial",
    )
    .check();
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(page.getByTestId(jobTestId)).toContainText("Publicado");
  await expect(
    page
      .locator(".preview")
      .getByRole("button", { name: "Confirmar publicación" }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("administracion-fuentes.png"),
    fullPage: true,
  });
  const overview = (await api("overview", {}, sessions.admin)) as {
    cuts: { id: string }[];
  };
  expect(overview.cuts.map((c) => c.id)).toContain("corte-1");
  expect(
    (await stores().db.doc("cycles/27-1").get()).data()!.sources.roster,
  ).not.toBe(sessions.roster);
  expect(
    (await stores().db.doc("cuts/corte-1").get()).data()!.sources.roster,
  ).toBe(sessions.roster);
});

for (const kind of ["report", "roster"] as const) {
  test(`${kind}: confirmación exclusiva por propuesta y respuestas fuera de orden`, async ({
    page,
  }) => {
    const sessions = await seedBase();
    const ids: string[] = [];
    if (kind === "report") {
      const [base] = await batch(sessions.admin);
      await waitJob(base!.id);
      await api("publish", { jobId: base!.id, replace: false }, sessions.admin);
    }
    for (const value of ["5", "8"]) {
      if (kind === "report") {
        const [job] = await batch(sessions.admin, [
          {
            name: "1 Curso compartido 27-1.csv",
            content: reportCsv.replace(",0", `,${value}`),
            courseId: "compartido",
            mapping: moodleMapping,
          },
        ]);
        ids.push(job!.id);
      } else {
        const content = rosterCsv.replace(
          "Estudiante A",
          `Estudiante A ${value}`,
        );
        const job = (await api(
          "createSource",
          {
            cycleId: "27-1",
            kind,
            file: descriptor("padron.csv", content, rosterMap),
          },
          sessions.admin,
        )) as { id: string };
        await api(
          "upload",
          { jobId: job.id, base64: Buffer.from(content).toString("base64") },
          sessions.admin,
        );
        ids.push(job.id);
      }
      await waitJob(ids.at(-1)!);
    }
    await login(page, people.admin);
    await page.getByRole("button", { name: "Fuentes", exact: true }).click();
    await openLegacySources(page);
    if (kind === "roster")
      await page.getByLabel("Corte de seguimiento").selectOption("");
    const review = (id: string) =>
      page
        .getByTestId(`job-${id}`)
        .getByRole("button", { name: /^Revisar/ })
        .click();
    const checkbox = page.getByRole("checkbox");
    const publish = page.getByRole("button", { name: "Confirmar publicación" });
    await review(ids[0]!);
    await checkbox.check();
    await expect(publish).toBeEnabled();
    await review(ids[1]!);
    await expect(page.getByTestId(`preview-${ids[1]}`)).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await expect(publish).toBeDisabled();

    // Retener una respuesta real del servidor; liberar después de revisar/confirmar la otra.
    let release!: () => void, held!: () => void, completed!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const intercepted = new Promise<void>((resolve) => {
      held = resolve;
    });
    const fulfilled = new Promise<void>((resolve) => {
      completed = resolve;
    });
    await page.route("**/academicApi", async (route) => {
      const data = route.request().postDataJSON()?.data;
      if (data?.op === "preview" && data.input.jobId === ids[0]) {
        const response = await route.fetch();
        held();
        await gate;
        await route.fulfill({ response });
        completed();
      } else await route.continue();
    });
    await review(ids[0]!);
    await intercepted;
    await review(ids[1]!);
    await expect(page.getByTestId(`preview-${ids[1]}`)).toBeVisible();
    await checkbox.check();
    release();
    await fulfilled;
    await expect(page.getByTestId(`preview-${ids[1]}`)).toBeVisible();
    await expect(checkbox).toBeChecked();
    await page.unroute("**/academicApi");
    await review(ids[0]!);
    await expect(page.getByTestId(`preview-${ids[0]}`)).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await expect(publish).toBeDisabled();
    for (const jobId of ids)
      expect(
        (await stores().db.doc(`jobs/${jobId}`).get()).data()!.status,
      ).toBe("ready");
  });
}

test("administración corrige el nombre original rechazado y publica la nueva propuesta auditada", async ({
  page,
}) => {
  const sessions = await seedBase();
  const name = "99 1 Curso compartido 27-1.csv";
  const [rejected] = await batch(sessions.admin, [
    {
      name,
      content: reportCsv,
      courseId: "compartido",
      mapping: moodleMapping,
    },
  ]);
  await waitJob(rejected!.id, "invalid");
  await login(page, people.admin);
  await page.getByRole("button", { name: "Fuentes", exact: true }).click();
  await openLegacySources(page);
  await page
    .getByTestId(`job-${rejected!.id}`)
    .getByRole("button", { name: /^Revisar/ })
    .click();
  await page
    .getByText("Procedencia y resolución del nombre", { exact: true })
    .click();
  await expect(page.locator(".preview")).toContainText(name);
  await page.getByLabel("Reportes Moodle").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(reportCsv),
  });
  await page.getByLabel(`Instancia para ${name}`).selectOption("compartido");
  await page
    .getByLabel(`Mapeo aprobado para ${name}`)
    .fill(JSON.stringify(moodleMapping));
  await page
    .getByLabel(`Resolución administrativa del nombre para ${name}`)
    .fill(
      JSON.stringify({
        externalId: "1",
        name: "Curso compartido",
        cycle: "27-1",
        reason: "Resolución sintética E2E",
      }),
    );
  await page.getByRole("button", { name: "Enviar lote", exact: true }).click();
  const ready = page
    .locator(".job-list li")
    .filter({ hasText: "Validado para revisión" });
  await expect(ready).toHaveCount(1, { timeout: 45000 });
  const id = (await ready.getAttribute("data-testid"))!.slice(4);
  await ready.getByRole("button", { name: /^Revisar/ }).click();
  await page
    .getByText("Procedencia y resolución del nombre", { exact: true })
    .click();
  await expect(page.locator(".preview")).toContainText(
    "Resolución sintética E2E",
  );
  await expect(page.locator(".preview")).toContainText(people.admin);
  await expect(page.locator(".preview")).toContainText(id);
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(page.getByTestId(`job-${id}`)).toContainText("Publicado");
  await expect(page.getByTestId(`job-${rejected!.id}`)).toContainText(
    "Archivo inválido",
  );
});
