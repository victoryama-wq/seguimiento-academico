import { chromium, expect, devices } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import XLSX from "xlsx";
import {
  api,
  accounts,
  project,
  sha,
  revision,
} from "./cloud-test-session.mjs";

// Exclusivamente sintéticos; sin seed/reset ni acceso administrativo directo a Firebase.
const url = `https://${project}.web.app`,
  run = `cloud-intake-${Date.now()}`;
const directory = `private/cloud-runs/${run}`;
mkdirSync(directory, { recursive: true });
const evidence = {
  run,
  project,
  sha,
  verifierRevision: revision,
  url,
  cases: [],
  startedAt: new Date().toISOString(),
  status: "running",
};
const record = (name, detail = {}) =>
  evidence.cases.push({ name, ...detail, result: "success" });
const csv = (rows) =>
  Buffer.from(
    rows
      .map((row) =>
        row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n"),
  );
function book(rows, type) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Datos");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: type }));
}
async function ready(id) {
  const end = Date.now() + 150000;
  while (Date.now() < end) {
    const p = await api("preview", { jobId: id });
    if (p.job.status === "ready" || p.job.status === "published") return p;
    assert(
      !["failed", "invalid"].includes(p.job.status),
      "Trabajo requiere revisión",
    );
    await delay(1500);
  }
  throw new Error("El trabajo no terminó en el plazo de observación cloud");
}
const browser = await chromium.launch();
try {
  for (const [device, cycle] of [
    ["desktop", "99-91"],
    ["mobile", "99-92"],
  ]) {
    const prior = await api("administrationContext", { cycle });
    if (prior.expected) {
      const original = await api("original", { jobId: prior.expected });
      const previous = JSON.parse(
        Buffer.from(original.base64, "base64").toString("utf8"),
      );
      assert(
        previous.cycle === cycle &&
          previous.enrollments.every((e) =>
            ["000ESC", "000EJE", "000VIR", "000BAJA"].includes(
              e.original.identity,
            ),
          ) &&
          previous.sources.every((s) =>
            s.name.startsWith("cloud-intake-synthetic-"),
          ),
        "No sustituir fuentes ajenas al verificador",
      );
    }
    const context = await browser.newContext(
      device === "mobile"
        ? devices["Pixel 7"]
        : { viewport: { width: 1440, height: 1000 } },
    );
    const page = await context.newPage();
    await page.goto(url);
    await expect(
      page.getByText("Entorno y versión de pruebas verificados", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 60000 });
    await page.getByLabel("Correo", { exact: true }).fill(accounts.admin.email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(accounts.admin.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(
      page.getByRole("heading", { name: "Administración institucional" }),
    ).toBeVisible({ timeout: 60000 });
    await page.getByRole("button", { name: "Fuentes", exact: true }).click();
    const flow = page.getByRole("region", {
      name: "Carga guiada institucional",
    });
    const roster = csv([
      [
        "Matrícula",
        "Nombre",
        "Carrera",
        "Grupo",
        "Fecha",
        "Modalidad",
        "Turno",
      ],
      [
        "000ESC",
        "Persona sintética E",
        "Finanzas sintéticas",
        `${cycle} LAF 11 01A`,
        "31/08/2026",
        "Escolarizado",
        "Matutino",
      ],
      [
        "000EJE",
        "Persona sintética J",
        "Finanzas sintéticas",
        `${cycle} LAF 23 01CA`,
        "29/08/2026",
        "Ejecutivo",
        "Matutino",
      ],
      [
        "000VIR",
        "Persona sintética V",
        "Arquitectura sintética",
        `${cycle} ARQ 53 01A`,
        "31/08/2026",
        "Virtual",
        "Sabatino Matutino",
      ],
      [
        "000BAJA",
        "Persona sintética X",
        "Finanzas sintéticas",
        `${cycle} LAF 11 01A`,
        "28/08/2026",
        "Escolarizado",
        "Matutino",
      ],
    ]);
    const catalog = book(
      [
        ["Programa", "Nombre del plan", "Abreviatura", "Coordinadora", "Tipo"],
        [
          "Finanzas sintéticas",
          "Plan sintético A",
          "LAF",
          "Coordinación sintética A",
          "carrera",
        ],
        [
          "Arquitectura sintética",
          "Plan sintético B",
          "ARQ",
          "Coordinación sintética B",
          "carrera",
        ],
      ],
      "xlsx",
    );
    await flow.getByLabel("Seleccionar padrón original").setInputFiles({
      name: `cloud-intake-synthetic-${cycle}.csv`,
      mimeType: "text/csv",
      buffer: roster,
    });
    await expect(flow.getByLabel("Ciclo de seguimiento")).toHaveValue(cycle, {
      timeout: 60000,
    });
    await flow.getByLabel("Seleccionar catálogo original").setInputFiles({
      name: "cloud-intake-synthetic-catalog.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: catalog,
    });
    await flow
      .getByRole("button", { name: "Revisar alumnos, carreras y decisiones" })
      .click();
    await expect(flow.getByText(/4 inscripciones; 4 personas/)).toBeVisible({
      timeout: 60000,
    });
    if (!prior.expected) {
      for (const [date, kind] of [
        ["2026-08-31", "base"],
        ["2026-08-29", "especial"],
        ["2026-08-28", "excluida"],
      ]) {
        await flow
          .getByLabel(`Clasificación institucional de la fecha ${date}`)
          .selectOption(kind);
        await flow
          .getByLabel(`Motivo de clasificación de ${date}`)
          .fill("Regla de fixture sintética, no decisión académica real");
      }
      await flow
        .getByRole("button", { name: "Volver a validar las decisiones" })
        .click();
    }
    await expect(
      flow.getByText(/3 principales; 1 personas excluidas/),
    ).toBeVisible({ timeout: 60000 });
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
    ).toBeVisible({ timeout: 60000 });
    record(
      `${device}: originales CSV/XLSX, calendario visual y confirmación de fuentes`,
    );
    await flow
      .getByRole("combobox", {
        name: "Unidad de avance Ejecutivo",
        exact: true,
      })
      .selectOption("3");
    await flow
      .getByRole("combobox", { name: "Unidad de avance Virtual", exact: true })
      .selectOption("2");
    await flow
      .getByRole("button", { name: "Preparar corte con este avance" })
      .click();
    await expect(flow.getByLabel("Corte de trabajo")).not.toHaveValue("", {
      timeout: 60000,
    });
    const cutId = await flow.getByLabel("Corte de trabajo").inputValue();
    await expect(
      flow.getByRole("region", { name: "Padrón utilizado por el corte" }),
    ).toContainText("4 inscripciones; 3 personas con afiliación principal", {
      timeout: 60000,
    });
    const name = `9801._Curso_Sintetico_Compartido_${cycle} Calificaciones.ods`;
    const possibleIdentity = `SYN-${run}-${device}`;
    const columns = [
      "Dirección Email",
      "Tarea: Unidad 1",
      "Tarea: Unidad 3",
      "Tarea: Unidad 4",
      "Total del curso",
      ...Array.from(
        { length: 27 },
        (_, i) => `Total categoría sintética ${i + 1}`,
      ),
    ];
    await flow.getByLabel("Seleccionar reportes originales").setInputFiles([
      {
        name,
        mimeType: "application/vnd.oasis.opendocument.spreadsheet",
        buffer: book(
          [
            columns,
            ...[
              ["000ESC@example.invalid", 0, 7, 9, 999],
              ["000EJE@example.invalid", "-", 8, 9, 999],
              ["000VIR@example.invalid", 7, 8, 9, 999],
              ["000BAJA@example.invalid", 10, 10, 10, 999],
              [possibleIdentity, 10, 10, 10, 999],
            ].map((row) => [...row, ...Array.from({ length: 27 }, () => 999)]),
            ...Array.from({ length: 995 }, () =>
              Array.from({ length: 32 }, () => ""),
            ),
          ],
          "ods",
        ),
      },
      {
        name: "cloud-intake-synthetic-invalido.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from("No es un libro: fixture inválida intencional"),
      },
    ]);
    await expect(
      flow
        .getByRole("alert")
        .filter({ hasText: "cloud-intake-synthetic-invalido.xlsx" }),
    ).toContainText("Vuelve a exportarlo", { timeout: 60000 });
    await expect(
      flow.getByText("ZIP incompleto [400]", { exact: true }),
    ).toBeHidden();
    record(
      `${device}: lote parcial conserva el reporte válido ante un archivo inválido`,
    );
    await expect(flow).toContainText("995 filas totalmente vacías", {
      timeout: 60000,
    });
    const originals = flow.getByRole("region", {
      name: `Filas originales de ${name}`,
      exact: true,
    });
    await expect(originals.getByRole("row")).toHaveCount(6);
    const widths = await originals.evaluate((el) => ({
      overflow: el.scrollWidth > el.clientWidth,
      minimum: Math.min(
        ...Array.from(el.querySelectorAll("th")).map(
          (c) => c.getBoundingClientRect().width,
        ),
      ),
      rowHeight: el.querySelector("tbody tr").getBoundingClientRect().height,
    }));
    assert(widths.overflow && widths.minimum > 150 && widths.rowHeight < 120);
    record(
      `${device}: 32 columnas legibles, 1000 filas físicas y cinco registros; padrón del corte visible`,
      widths,
    );
    await expect(
      flow.getByRole("button", {
        name: "Revisar resultado de Curso Sintetico Compartido",
      }),
    ).toBeVisible({ timeout: 60000 });
    let jobs = (await api("jobs", { cutId })).jobs;
    const jobId = jobs[0].id;
    await ready(jobId);
    await flow
      .getByRole("button", {
        name: "Revisar resultado de Curso Sintetico Compartido",
      })
      .click();
    await expect(
      flow.getByRole("region", { name: "Revisión de reporte" }),
    ).toContainText("Impartición no determinada", { timeout: 60000 });
    const previewRegion = flow.getByRole("region", {
      name: "Revisión de reporte",
    });
    await expect(previewRegion).toContainText(
      "Alumnos incluidos: 3. Registros excluidos: 2",
    );
    await expect(previewRegion).toContainText(
      "No pertenece al padrón activo del ciclo",
    );
    const resultWidths = await flow
      .getByRole("region", { name: "Resultados del reporte" })
      .evaluate((el) =>
        Array.from(el.querySelectorAll("th"))
          .slice(0, 2)
          .map((c) => c.getBoundingClientRect().width),
      );
    assert(Math.min(...resultWidths) >= 200);
    await flow
      .getByLabel("Revisé este reporte, sus observaciones y sustituciones")
      .check();
    await flow
      .getByRole("button", { name: "Confirmar publicación del reporte" })
      .click();
    await expect(
      flow.getByRole("region", { name: "Revisión de reporte" }),
    ).toContainText("Publicado", { timeout: 60000 });
    const panel = await api("dashboard", {
      cutId,
      filters: {},
      view: "institucion",
      section: "details",
    });
    assert.deepEqual(panel.counts, { D: 4, N: 3, G: 1, V: 0, E: 0, Z: 1 });
    assert.equal(panel.students, 3);
    const withdrawalQuery = {
      cutId,
      filters: {},
      view: "institucion",
      section: "possibleWithdrawals",
    };
    const possible = await api("dashboard", withdrawalQuery);
    assert.equal(possible.possibleWithdrawalsCount, 1);
    assert.equal(possible.possibleWithdrawals[0].status, "posible baja");
    assert.equal(
      possible.possibleWithdrawals[0].identity,
      possibleIdentity.toLowerCase(),
    );
    record(
      `${device}: Eventarc efectivo, curso automático, principal C.A., avance y exclusión`,
      { counts: panel.counts, students: panel.students },
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Desbordamiento horizontal",
    );
    await flow.screenshot({ path: `${directory}/${device}-sintetico.png` });
    const sourceId = (await api("administrationContext", { cycle })).expected;
    const review = await api("administrationReview", { id: sourceId });
    const a = review.catalog.find((c) => c.abbreviation === "LAF").id,
      b = review.catalog.find((c) => c.abbreviation === "ARQ").id;
    for (const [role, career] of [
      ["a", a],
      ["b", b],
    ]) {
      const member = (await api("overview", {}, role)).member;
      await api("assignMember", {
        uid: accounts[role].uid,
        member: {
          ...member,
          careers: [...new Set([...member.careers, career])],
        },
      });
    }
    for (const [role, denied] of [
      ["a", b],
      ["b", a],
    ]) {
      await assert.rejects(
        api("administrationReview", { id: sourceId }, role),
        /PERMISSION_DENIED/,
      );
      await assert.rejects(
        api("inspectCutSources", { cutId }, role),
        /PERMISSION_DENIED/,
      );
      await assert.rejects(
        api(
          "dashboard",
          {
            cutId,
            filters: { careerId: denied },
            view: "institucion",
            section: "details",
          },
          role,
        ),
        /PERMISSION_DENIED/,
      );
      const d = await api(
        "dashboard",
        { cutId, filters: {}, view: "institucion", section: "details" },
        role,
      );
      assert.equal(d.counts.D, role === "a" ? 3 : 1);
      assert.equal(d.possibleWithdrawalsCount, 0);
      const exported = await api(
        "exportDashboard",
        {
          cutId,
          filters: {},
          view: "institucion",
          section: "details",
          snapshotId: d.snapshotId,
        },
        role,
      );
      assert(
        !exported.csv
          .toLowerCase()
          .includes(role === "a" ? "000vir" : "000esc"),
        "Exportación fuera de ámbito",
      );
      assert(!exported.csv.includes(possibleIdentity));
      await assert.rejects(
        api(
          "exportDashboard",
          {
            cutId,
            filters: { careerId: denied },
            view: "institucion",
            section: "details",
          },
          role,
        ),
        /PERMISSION_DENIED/,
      );
    }
    record(
      `${device}: coordinadores A/B aislados y fuentes privadas denegadas`,
    );
    await page.getByRole("button", { name: "Panel", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Ciclo y corte", exact: true })
      .selectOption(cutId);
    await page
      .getByRole("button", { name: "Posibles bajas", exact: true })
      .click();
    await expect(page.getByRole("table")).toContainText(possibleIdentity);
    await page.screenshot({
      path: `${directory}/${device}-posibles-bajas-sinteticas.png`,
      fullPage: true,
    });
    await page.reload();
    await page.getByRole("button", { name: "Fuentes", exact: true }).click();
    await flow.getByLabel("Corte de trabajo").selectOption(cutId);
    await flow
      .getByRole("button", { name: "Recuperar trabajos del corte" })
      .click();
    await expect(
      flow.getByRole("button", {
        name: "Revisar resultado de Curso Sintetico Compartido",
      }),
    ).toBeVisible({ timeout: 60000 });
    record(`${device}: trabajo recuperado después de recargar navegador`);
    const partial = await api("inspectOriginal", {
      kind: "report",
      name: name.replace(".ods", ".csv"),
      base64: csv([
        ["Dirección Email", "Tarea: Unidad 1"],
        ["000ESC@example.invalid", ""],
      ]).toString("base64"),
    });
    const input = {
      cutId,
      file: {
        id: partial.id,
        columns: partial.columns,
        options: partial.options,
      },
    };
    const update = await api("prepareOperationalReport", input);
    const preview = await ready(update.jobId);
    assert.equal(preview.review.numericCleared, 1);
    assert(preview.review.preserved > 0);
    await api("publish", { jobId: update.jobId, replace: true });
    assert.equal(
      (await api("prepareOperationalReport", input)).jobId,
      update.jobId,
    );
    await api("publish", { jobId, replace: true });
    const after = await api("dashboard", {
      cutId,
      filters: {},
      view: "institucion",
      section: "details",
    });
    assert.deepEqual(after.counts, { D: 4, N: 2, G: 1, V: 1, E: 0, Z: 0 });
    await api("closeCut", { cutId });
    await assert.rejects(
      api("prepareOperationalReport", input),
      /FAILED_PRECONDITION/,
    );
    const closed = await api("dashboard", {
      cutId,
      filters: {},
      view: "institucion",
      section: "details",
    });
    assert.deepEqual(closed.counts, after.counts);
    assert.equal(closed.possibleWithdrawalsCount, 1);
    record(
      `${device}: actualización parcial, aviso numérico, reintento idempotente y corte cerrado conservado`,
      { counts: closed.counts },
    );
    const decision = {
      jobId: sourceId,
      decision: {
        identity: possibleIdentity,
        reason: "Baja confirmada sintética",
        sourceReference: run,
      },
    };
    await assert.rejects(
      api("reviseCycleWithdrawal", decision, "a"),
      /PERMISSION_DENIED/,
    );
    const revised = await api("reviseCycleWithdrawal", decision);
    await ready(revised.id);
    await api("publishSource", { jobId: revised.id, replace: true });
    assert.equal((await api("reviseCycleWithdrawal", decision)).id, revised.id);
    const nextCut = await api("prepareOperationalCut", {
      cycle,
      requestId: createHash("sha256").update(`${device}-${run}`).digest("hex"),
      progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 },
    });
    const absentOriginal = await api("inspectOriginal", {
      kind: "report",
      name: name.replace(".ods", ".csv"),
      base64: csv([
        ["Nombre", "Dirección Email", "Tarea: Unidad 1"],
        ["Nombre sintético", possibleIdentity, 0],
      ]).toString("base64"),
    });
    const nextReport = await api("prepareOperationalReport", {
      cutId: nextCut.id,
      file: {
        id: absentOriginal.id,
        columns: absentOriginal.columns,
        options: absentOriginal.options,
      },
    });
    const nextPreview = await ready(nextReport.jobId);
    assert.equal(nextPreview.blocking, false);
    assert.equal(nextPreview.rows.length, 0);
    await api("publish", { jobId: nextReport.jobId, replace: false });
    const confirmed = await api("dashboard", {
      ...withdrawalQuery,
      cutId: nextCut.id,
    });
    assert.equal(confirmed.possibleWithdrawals[0].status, "baja confirmada");
    assert.equal(confirmed.counts.D, 0);
    assert.equal(confirmed.coverage, null);
    const old = await api("dashboard", withdrawalQuery);
    assert.equal(old.possibleWithdrawals[0].status, "posible baja");
    const exportedCase = await api("exportDashboard", {
      ...withdrawalQuery,
      cutId: nextCut.id,
      snapshotId: confirmed.snapshotId,
    });
    assert(exportedCase.csv.includes("baja confirmada"));
    record(
      `${device}: posible baja, confirmación auditada idempotente, CSV y cierre histórico inmutable`,
      { unique: 1, D: confirmed.counts.D },
    );
    await context.close();
  }
  evidence.status = "success";
} catch (error) {
  evidence.status = "failed";
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(`${directory}/result.json`, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      directory,
      sha,
      status: evidence.status,
      checks: evidence.cases.length,
      error: evidence.error,
    }),
  );
}
