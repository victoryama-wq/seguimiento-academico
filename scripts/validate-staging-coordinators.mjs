import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";
import XLSX from "xlsx";
import { api, accounts, project, sha } from "./cloud-test-session.mjs";
import { client } from "./cloud-operator-session.mjs";

// Crea exclusivamente un ciclo NUEVO sintético. Nunca borra, resembra ni sustituye
// fuentes/cortes/trabajos existentes; compara sus documentos antes y después.
const run = `coordinator-${Date.now()}`;
const directory = `private/cloud-runs/${run}`;
mkdirSync(directory, { recursive: true });
const url = `https://${project}.web.app`;
const evidence = {
  run,
  project,
  sha,
  url,
  cases: [],
  status: "running",
  startedAt: new Date().toISOString(),
};
const record = (name, detail = {}) =>
  evidence.cases.push({ name, result: "success", ...detail });
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((key) => [key, canonical(v[key])]),
        )
      : v;
const digest = (v) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
const firestore = client("https://firestore.googleapis.com");
const root = `/v1/projects/${project}/databases/(default)/documents`;
async function documents(collection) {
  const all = [];
  let token = "";
  do {
    const result = (
      await firestore.get(
        `${root}/${collection}?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`,
      )
    ).body;
    all.push(...(result.documents ?? []));
    token = result.nextPageToken ?? "";
  } while (token);
  return all;
}
async function preservation() {
  const result = {};
  for (const collection of [
    "cycles",
    "cuts",
    "courses",
    "jobs",
    "sources",
    "publications",
  ]) {
    const docs = await documents(collection);
    for (const doc of docs) result[doc.name] = digest(doc.fields);
    if (collection === "cuts")
      for (const doc of docs)
        for (const child of await documents(
          `cuts/${doc.name.split("/").at(-1)}/courses`,
        ))
          result[child.name] = digest(child.fields);
  }
  return result;
}
const csv = (rows) =>
  Buffer.from(
    rows
      .map((r) =>
        r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n"),
  );
function book(rows, type = "xlsx") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Datos");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: type }));
}
const inspect = (kind, name, bytes, role = "admin", cutId) =>
  api(
    "inspectOriginal",
    {
      kind,
      name,
      base64: bytes.toString("base64"),
      ...(cutId ? { cutId } : {}),
    },
    role,
  );
const selected = (v) => ({
  id: v.id,
  columns: v.columns,
  options: v.options,
  policyVersion: v.policyVersion,
});
async function ready(id, role = "admin") {
  const end = Date.now() + 150000;
  while (Date.now() < end) {
    const v = await api("preview", { jobId: id }, role);
    if (["ready", "published"].includes(v.job.status)) return v;
    assert(
      !["invalid", "failed"].includes(v.job.status),
      "Trabajo sintético requiere revisión",
    );
    await delay(1500);
  }
  throw Error("No terminó el trabajo en el plazo de observación cloud");
}
const before = await preservation();
writeFileSync(`${directory}/preservation-before.json`, JSON.stringify(before));
const browser = await chromium.launch();
try {
  const existing = Object.keys(before)
    .filter((name) => /\/documents\/cycles\/[^/]+$/.test(name))
    .map((name) => name.split("/").at(-1));
  const cycle = Array.from({ length: 7 }, (_, i) => `99-${93 + i}`).find(
    (c) => !existing.includes(c),
  );
  assert(
    cycle,
    "No hay ciclo sintético libre; no se sobrescribirá ningún ciclo",
  );
  assert.equal((await api("administrationContext", { cycle })).expected, null);
  const roster = await inspect(
    "roster",
    `${run}-roster.csv`,
    csv([
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
        `Finanzas ${run}`,
        `${cycle} LAF 11 01A`,
        "31/08/2026",
        "Escolarizado",
        "Matutino",
      ],
      [
        "000EJE",
        "Persona sintética J",
        `Finanzas ${run}`,
        `${cycle} LAF 23 01CA`,
        "29/08/2026",
        "Ejecutivo",
        "Matutino",
      ],
      [
        "000VIR",
        "Persona sintética V",
        `Arquitectura ${run}`,
        `${cycle} ARQ 53 01A`,
        "31/08/2026",
        "Virtual",
        "Sabatino Matutino",
      ],
      [
        "000BAJA",
        "Persona sintética X",
        `Finanzas ${run}`,
        `${cycle} LAF 11 01A`,
        "28/08/2026",
        "Escolarizado",
        "Matutino",
      ],
    ]),
  );
  const catalog = await inspect(
    "catalog",
    `${run}-catalog.xlsx`,
    book([
      ["Programa", "Nombre del plan", "Abreviatura", "Coordinadora", "Tipo"],
      [
        `Finanzas ${run}`,
        "Plan sintético A",
        "LAF",
        "Coordinación sintética A",
        "carrera",
      ],
      [
        `Arquitectura ${run}`,
        "Plan sintético B",
        "ARQ",
        "Coordinación sintética B",
        "carrera",
      ],
    ]),
  );
  const draft = await api("prepareAdministration", {
    cycle,
    expected: null,
    roster: selected(roster),
    catalog: selected(catalog),
    calendarChoices: [
      {
        date: "2026-08-31",
        kind: "base",
        reason: "Calendario de fixture sintética",
      },
      {
        date: "2026-08-29",
        kind: "especial",
        reason: "Calendario de fixture sintética",
      },
      {
        date: "2026-08-28",
        kind: "excluida",
        reason: "Calendario de fixture sintética",
      },
    ],
  });
  assert(!draft.blocking);
  assert.equal(draft.principals, 3);
  await api("confirmAdministration", { id: draft.id });
  const careers = {
    a: draft.catalog.find((c) => c.abbreviation === "LAF").id,
    b: draft.catalog.find((c) => c.abbreviation === "ARQ").id,
  };
  for (const role of ["a", "b"]) {
    const member = (await api("overview", {}, role)).member;
    assert.equal(member.role, "coordinator");
    assert(accounts[role].uid.startsWith("staging-synthetic-"));
    await api("assignMember", {
      uid: accounts[role].uid,
      member: {
        ...member,
        careers: [...new Set([...member.careers, careers[role]])],
      },
    });
  }
  const cut = await api("prepareOperationalCut", {
    cycle,
    requestId: digest(run),
    progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 3 },
  });
  const cutId = cut.id;
  record(
    "Administración confirma fuentes sintéticas nuevas y avance sin modificar datos previos",
  );
  const rows = [
    [
      "Dirección Email",
      "Tarea: Unidad 1",
      "Tarea: Unidad 3",
      "Tarea: Unidad 4",
      "Total del curso",
    ],
    ["000ESC", 0, 7, 9, 999],
    ["000EJE", 5, 6, 9, 999],
    ["000VIR", 8, 9, 9, 999],
    ["000BAJA", 10, 10, 10, 999],
    ["000AJENO", 10, 10, 10, 999],
  ];
  const contexts = [];
  for (const role of ["a", "b"]) {
    const context = await browser.newContext({
      viewport:
        role === "a"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
    });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(url);
    await expect(
      page.getByText("Entorno y versión de pruebas verificados", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 60000 });
    await page.getByLabel("Correo", { exact: true }).fill(accounts[role].email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(accounts[role].password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(
      page.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeVisible({ timeout: 60000 });
    await page.getByRole("button", { name: "Fuentes", exact: true }).click();
    let flow = page.getByRole("region", {
      name: "Carga de reportes de coordinación",
    });
    await flow.getByLabel("Corte para cargar y consultar").selectOption(cutId);
    const name = `881._Curso_Sintético_${cycle}.${role === "a" ? "xlsx" : "ods"}`;
    await flow.getByLabel("Seleccionar reportes originales").setInputFiles([
      {
        name,
        mimeType: "application/octet-stream",
        buffer: book(rows, role === "a" ? "xlsx" : "ods"),
      },
      ...(role === "a"
        ? [
            {
              name: `882._Inválido_${cycle}.xlsx`,
              mimeType: "application/octet-stream",
              buffer: Buffer.from("Fixture inválida"),
            },
          ]
        : []),
    ]);
    await expect(
      flow.getByRole("button", {
        name: "Revisar Curso Sintético",
        exact: true,
      }),
    ).toBeVisible({ timeout: 150000 });
    if (role === "a") {
      await expect(
        flow.getByRole("button", { name: "Reintentar este archivo" }),
      ).toBeEnabled();
      await page.reload();
      await page.getByRole("button", { name: "Fuentes", exact: true }).click();
      flow = page.getByRole("region", {
        name: "Carga de reportes de coordinación",
      });
      await expect(
        flow.getByLabel("Corte para cargar y consultar"),
      ).toHaveValue(cutId);
    }
    await flow
      .getByRole("button", { name: "Revisar Curso Sintético", exact: true })
      .click();
    const review = flow.getByRole("region", {
      name: "Revisión antes de publicar",
    });
    await expect(review).toContainText(role === "a" ? "000EJE" : "000VIR");
    await expect(review).not.toContainText(role === "a" ? "000VIR" : "000ESC");
    await expect(review).not.toContainText("000AJENO");
    await page.screenshot({
      path: `${directory}/coordinador-${role}.png`,
      fullPage: true,
    });
    await review.getByRole("checkbox").check();
    await review.getByRole("button", { name: "Confirmar publicación" }).click();
    await expect(
      flow.getByText(
        "Publicación confirmada. Puedes consultar los resultados de este corte.",
      ),
    ).toBeVisible({ timeout: 60000 });
    await flow
      .getByRole("button", { name: "Consultar resultados de este corte" })
      .click();
    await expect(page.getByLabel("Ciclo y corte")).toHaveValue(cutId);
    record(
      `${role}: primera carga sin registro manual, revisión filtrada, confirmación y resultados`,
    );
  }
  const query = { cutId, filters: {}, view: "institucion", section: "details" };
  const a = await api("dashboard", query, "a"),
    b = await api("dashboard", query, "b");
  assert.equal(a.counts.D, 3);
  assert.equal(b.counts.D, 2);
  assert(!JSON.stringify(a).includes("000VIR"));
  assert(!JSON.stringify(b).includes("000ESC"));
  const name = `881._Curso_Sintético_${cycle}.csv`;
  const view = await inspect(
    "report",
    name,
    csv([
      [rows[0][0], rows[0][1]],
      ["000EJE", 0],
      ["000VIR", 0],
    ]),
    "a",
    cutId,
  );
  const input = { cutId, file: selected(view), activities: view.activities };
  const sent = await api("prepareOperationalReport", input, "a"),
    p = await ready(sent.jobId, "a");
  await api(
    "publish",
    { jobId: sent.jobId, replace: true, reviewToken: p.reviewToken },
    "a",
  );
  assert.equal(
    (await api("prepareOperationalReport", input, "a")).jobId,
    sent.jobId,
  );
  await api("retry", { jobId: sent.jobId }, "a");
  assert.deepEqual((await api("dashboard", query, "b")).counts, b.counts);
  const exported = JSON.stringify(await api("exportDashboard", query, "a"));
  assert(exported.includes("000EJE"));
  assert(!exported.includes("000VIR"));
  await assert.rejects(
    api("dashboard", { ...query, filters: { careerId: careers.b } }, "a"),
    /PERMISSION_DENIED/,
  );
  await assert.rejects(
    api("original", { jobId: sent.jobId }, "a"),
    /PERMISSION_DENIED/,
  );
  const possible = JSON.stringify(
    await api("dashboard", { ...query, section: "possibleWithdrawals" }, "a"),
  );
  assert(possible.includes("000BAJA"));
  assert(!possible.includes("000AJENO"));
  record(
    "Acumulación parcial, cero, reenvío, exclusiones, exportación y permisos sin modificar B",
  );
  await api("closeCut", { cutId });
  await assert.rejects(
    api("prepareOperationalReport", input, "a"),
    /FAILED_PRECONDITION/,
  );
  assert.deepEqual((await api("dashboard", query, "b")).counts, b.counts);
  record("Corte cerrado conserva resultados y rechaza nuevas cargas");
  for (const context of contexts) await context.close();
  const after = await preservation();
  const changed = Object.keys(before).filter(
    (key) => before[key] !== after[key],
  );
  writeFileSync(`${directory}/preservation-after.json`, JSON.stringify(after));
  assert.equal(
    changed.length,
    0,
    "Cambió un documento académico preexistente; consultar evidencia privada",
  );
  record(
    "Fuentes, cortes, cursos, trabajos, publicaciones y punteros preexistentes conservados",
    { documents: Object.keys(before).length },
  );
  evidence.status = "success";
  evidence.cycle = cycle;
  evidence.cutId = cutId;
} catch (e) {
  evidence.status = "failed";
  evidence.error = e.message;
  throw e;
} finally {
  await browser.close();
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(`${directory}/result.json`, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      status: evidence.status,
      sha,
      project,
      cases: evidence.cases.length,
      evidence: directory,
    }),
  );
}
