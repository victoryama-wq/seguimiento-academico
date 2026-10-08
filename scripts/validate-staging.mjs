import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { basename } from "node:path";

// Opt-in explícito. No usa SDK administrativo, no borra ni reinicializa datos.
const scenario = process.argv[2];
assert(["smoke", "45", "230"].includes(scenario), "Escenario: smoke, 45 o 230");
assert.equal(process.env.CONFIRM_STAGING_PROJECT, "indicadores-academia");
for (const key of [
  "CI",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
])
  assert(!process.env[key], `Entorno incompatible: ${key}`);
const target = JSON.parse(readFileSync("config/staging-target.json", "utf8"));
assert.equal(target.projectId, "indicadores-academia");
assert.equal(target.region, "us-central1");
assert.equal(target.hostingSite, target.projectId);
const web = JSON.parse(readFileSync("private/staging-web.json", "utf8"));
assert.equal(web.projectId, target.projectId);
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
assert.equal(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  "",
  "Árbol limpio requerido",
);
const base = `https://${target.region}-${target.projectId}.cloudfunctions.net`;
const run = `cloud-${scenario}-${Date.now()}`;
const out = `private/cloud-runs/${run}`;
mkdirSync(out, { recursive: true });
const evidence = {
  run,
  sha,
  project: target.projectId,
  region: target.region,
  scenario,
  startedAt: new Date().toISOString(),
  operations: [],
  assertions: [],
  status: "running",
};
const tokens = {};
const accounts = JSON.parse(
  readFileSync("private/staging-test-accounts.json", "utf8"),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function check(name, fn) {
  fn();
  evidence.assertions.push(name);
}
async function callable(name, data, role) {
  const res = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await res.json();
  if (body.error)
    throw new Error(`${body.error.status}: ${body.error.message}`);
  assert(res.ok, `HTTP ${res.status}`);
  return body.result;
}
async function api(op, input, role = "admin") {
  const start = performance.now();
  let ok = false;
  try {
    const value = await callable("academicApi", { op, input }, role);
    ok = true;
    return value;
  } finally {
    evidence.operations.push({
      op,
      role,
      ms: Math.round(performance.now() - start),
      ok,
    });
  }
}
async function denied(name, op, input, role, pattern = /PERMISSION_DENIED/) {
  await assert.rejects(api(op, input, role), pattern);
  evidence.assertions.push(name);
}
const query = (cutId) => ({
  cutId,
  filters: {},
  view: "institucion",
  section: "details",
});
const panel = (cutId, role = "admin") => api("dashboard", query(cutId), role);
const descriptor = (name, bytes, mapping = {}) => ({
  name,
  bytes: bytes.length,
  sha256: hash(bytes),
  mapping,
});
async function ready(id, role = "admin", expected = "ready") {
  const start = performance.now(),
    end = Date.now() + 180000;
  while (Date.now() < end) {
    const p = await api("preview", { jobId: id }, role);
    if (
      p.job.status === expected ||
      (expected === "ready" && p.job.status === "published")
    ) {
      evidence.operations.push({
        op: "processing:wait",
        ms: Math.round(performance.now() - start),
        ok: true,
      });
      return p;
    }
    if (["invalid", "failed"].includes(p.job.status))
      throw new Error(`Trabajo ${id}: ${p.job.status}`);
    await delay(1000);
  }
  throw new Error(`Timeout de trabajador ${id}`);
}
async function source(kind, bytes, cycleId, mapping = {}) {
  const job = await api("createSource", {
    cycleId,
    kind,
    file: descriptor(
      `${kind}.${kind === "academicPackage" ? "json" : "csv"}`,
      bytes,
      mapping,
    ),
  });
  if (job.status === "published") return job.id;
  await api("upload", { jobId: job.id, base64: bytes.toString("base64") });
  await ready(job.id);
  await api("publishSource", { jobId: job.id, replace: !!job.replaces });
  return job.id;
}
async function report(cutId, content, role = "a") {
  const bytes = Buffer.from(content),
    file = {
      ...descriptor("777._Curso_Multimodal_27-1 Calificaciones.csv", bytes, {
        profile: "moodle-institutional-v1",
      }),
      courseId: "cloud-mix",
    };
  const result = await api("createBatch", { cutId, files: [file] }, role);
  const job = result.jobs[0];
  if (job.status !== "published") {
    await api(
      "upload",
      { jobId: job.id, base64: bytes.toString("base64") },
      role,
    );
    await ready(job.id, role);
  }
  return job.id;
}
const publish = (jobId, role = "a") =>
  api("publish", { jobId, replace: true }, role);
const csv = (units, rows) =>
  [
    [
      "Dirección Email",
      ...units.map((n) => `Tarea:Actividad | Unidad ${n} (Real)`),
    ].join(","),
    ...rows.map(([id, ...grades]) =>
      [`${id}@example.invalid`, ...grades].join(","),
    ),
  ].join("\n");
const progress = { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 };
async function ensureCycle(id) {
  const overview = await api("overview", {});
  if (!overview.cycles.some((c) => c.id === id))
    await api("createCycle", {
      id,
      dates: { "2026-08-31": "base", "2026-08-29": "especial" },
    });
}
async function smoke() {
  await ensureCycle("27-1");
  await source(
    "academicPackage",
    input("small/paquete-sintetico.json"),
    "27-1",
  );
  if (!(await api("overview", {})).courses.some((c) => c.id === "cloud-mix"))
    await api("createCourse", {
      cycleId: "27-1",
      id: "cloud-mix",
      externalId: "777",
      name: "Curso Multimodal",
      careers: ["laf-plan-1", "arq-plan-1"],
    });
  const cut = `${run}-principal`,
    together = `${run}-junto`,
    separate = `${run}-separado`;
  for (const id of [cut, together, separate])
    await api("createCut", { id, cycleId: "27-1", progress });
  const initial = csv(
    [1, 2, 3, 4],
    [
      ["000ESC", "1", "2", "3", "4"],
      ["000EJE", "0", "2", "3", "4"],
      ["000VIR", "1", "2", "3", "4"],
      ["000BAJA", "9", "9", "9", "9"],
    ],
  );
  const first = await report(cut, initial);
  await publish(first);
  const before = await panel(cut),
    a = await panel(cut, "a"),
    b = await panel(cut, "b");
  check("multimodal: D7/N7/Z1, 3 personas y baja excluida", () => {
    assert.deepEqual(before.counts, { N: 7, G: 0, V: 0, E: 0, Z: 1, D: 7 });
    assert.equal(before.students, 3);
  });
  check("principal CA, modalidad independiente y U4 diferida", () => {
    const vir = before.details.find((d) =>
      d.identity.toLowerCase().startsWith("000vir"),
    );
    assert.equal(vir.attribution, "principal_especial_confirmada");
    assert.deepEqual(vir.expectedUnits, [1, 2]);
    assert.deepEqual(vir.deferredUnits, [3, 4]);
  });
  check("ámbitos A/B", () => {
    assert.equal(a.counts.D, 5);
    assert.equal(b.counts.D, 2);
    assert(!JSON.stringify(a).toLowerCase().includes("000vir"));
    assert(!JSON.stringify(b).toLowerCase().includes("000esc"));
  });
  await denied(
    "dashboard ajeno",
    "dashboard",
    { ...query(cut), filters: { careerId: "arq-plan-1" } },
    "a",
  );
  await denied(
    "exportación ajena",
    "exportDashboard",
    { ...query(cut), filters: { careerId: "laf-plan-1" } },
    "b",
  );
  await denied(
    "original compartido privado",
    "original",
    { jobId: first },
    "a",
  );
  const direct = await fetch(
    `https://firestore.googleapis.com/v1/projects/${target.projectId}/databases/(default)/documents/memberships/${accounts.admin.uid}`,
    { headers: { Authorization: `Bearer ${tokens.a}` } },
  );
  assert.equal(direct.status, 403);
  const original = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${target.storageBucket}/o/${encodeURIComponent(`originals/${first}/source`)}?alt=media`,
    { headers: { Authorization: `Firebase ${tokens.a}` } },
  );
  assert.equal(original.status, 403);
  evidence.assertions.push(
    "Rules reales: membresía admin y original denegados por identificador directo",
  );
  await denied(
    "modificación administrativa denegada",
    "createCut",
    { id: `${run}-denegado`, cycleId: "27-1", progress },
    "a",
  );
  const current = (await api("overview", {})).cuts.find((c) => c.id === cut);
  await api("editCutDate", {
    cutId: cut,
    expected: current.date,
    date: "2025-01-01",
    reason: "Prueba sintética: agenda no cambia avance",
  });
  assert.deepEqual((await panel(cut)).counts, before.counts);
  evidence.assertions.push("fecha no altera indicadores");
  const exported = await api(
    "exportDashboard",
    { ...query(cut), snapshotId: a.snapshotId },
    "a",
  );
  check("CSV aislado y avance explícito", () => {
    assert(exported.csv.includes("explicit-progress-v1"));
    assert(!exported.csv.toLowerCase().includes("000vir"));
  });
  const initialPartial = csv(
    [1, 2],
    [
      ["000EJE", "1", "2"],
      ["000VIR", "5", "6"],
    ],
  );
  const originalIds = [];
  for (const id of [together, separate]) {
    const j = await report(id, initialPartial);
    originalIds.push(j);
    await publish(j);
  }
  await publish(
    await report(together, csv([1, 2, 3], [["000EJE", "7", "8", "0"]])),
  );
  for (const [unit, value] of [
    [1, "7"],
    [2, "8"],
    [3, "0"],
  ])
    await publish(await report(separate, csv([unit], [["000EJE", value]])));
  const projectValues = (d) =>
    d.details.map((r) => [
      r.identity,
      r.values.map((v) => [v.activityId, v.state, v.raw]),
    ]);
  const joint = await panel(together),
    apart = await panel(separate);
  check("U1/U2/U3 juntas y separadas, ausencias conservadas", () => {
    assert.deepEqual(projectValues(joint), projectValues(apart));
    assert.deepEqual(apart.counts, { N: 5, G: 0, V: 0, E: 0, Z: 1, D: 5 });
  });
  for (const [i, id] of [together, separate].entries()) {
    assert.equal(await report(id, initialPartial), originalIds[i]);
    await api("retry", { jobId: originalIds[i] }, "a");
    await publish(originalIds[i]);
    assert.deepEqual((await panel(id)).counts, apart.counts);
  }
  evidence.assertions.push("reintento antiguo no revierte ni duplica");
  const replacement = await report(
    cut,
    csv(
      [1, 2, 3],
      [
        ["000EJE", "", "-", "3"],
        ["000VIR", "", "-", "3"],
      ],
    ),
  );
  const review = await api(
    "preview",
    { jobId: replacement, careerId: "laf-plan-1" },
    "a",
  );
  check(
    "revisión avisa dos pérdidas numéricas sin filtrar otra carrera",
    () => {
      assert.equal(review.review.numericCleared, 2);
      assert(!JSON.stringify(review).toLowerCase().includes("000vir"));
    },
  );
  const concurrent = await report(cut, csv([1], [["000EJE", "9"]]));
  await publish(concurrent);
  await denied(
    "propuesta obsoleta rechazada",
    "publish",
    { jobId: replacement, replace: true },
    "a",
    /ABORTED/,
  );
  const updated = await api("revalidate", { jobId: replacement }, "a");
  await ready(updated.id, "a");
  await publish(updated.id);
  assert.deepEqual((await panel(cut)).counts, {
    N: 3,
    G: 2,
    V: 2,
    E: 0,
    Z: 0,
    D: 7,
  });
  evidence.assertions.push(
    "revisión actualizada y publicación con procedencia",
  );
  // Carrera real de publicaciones: una gana; la otra debe volver a revisarse.
  const j1 = await report(cut, csv([1], [["000EJE", "6"]])),
    j2 = await report(cut, csv([1], [["000EJE", "8"]]));
  const races = await Promise.allSettled([publish(j1), publish(j2)]);
  check("concurrencia de publicación", () => {
    assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
    assert.match(
      String(races.find((r) => r.status === "rejected").reason),
      /ABORTED/,
    );
  });
  const pair = { beforeCut: together, afterCut: separate };
  const pairs = joint.details[0].values.map((v) => ({
    courseId: "cloud-mix",
    before: v.activityId,
    after: v.activityId,
  }));
  await api("configureComparison", {
    ...pair,
    expected: null,
    reason: "Identidades sintéticas de actividad explícitas",
    pairs,
  });
  const comparison = await api("compareCuts", { ...pair, filters: {} });
  check("comparación explícita sobre universo común", () => {
    assert.equal(comparison.before.D, 5);
    assert.equal(comparison.differencePoints, 0);
  });
  await api(
    "exportComparison",
    { ...pair, mappingId: comparison.mappingId, filters: {} },
    "a",
  );
  const pinned = await panel(cut);
  await api("closeCut", { cutId: cut });
  assert.deepEqual((await panel(cut)).counts, pinned.counts);
  await denied(
    "corte cerrado conserva datos",
    "createBatch",
    {
      cutId: cut,
      files: [
        {
          ...descriptor("777 Curso Multimodal 27-1.csv", Buffer.from(initial), {
            profile: "moodle-institutional-v1",
          }),
          courseId: "cloud-mix",
        },
      ],
    },
    "a",
    /FAILED_PRECONDITION/,
  );
  await api("exportDashboard", {
    ...query(cut),
    snapshotId: pinned.snapshotId,
  });
  evidence.small = {
    cut,
    together,
    separate,
    initialCounts: before.counts,
    closedCounts: pinned.counts,
    students: before.students,
  };
}
const root = "private/cloud-synthetic-inputs";
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8"));
assert.equal(manifest.synthetic, true);
function input(path) {
  const entry = manifest.files.find((f) => f.file === path);
  assert(entry, "Archivo sintético fuera de manifest");
  assert(!path.includes(".."));
  const bytes = readFileSync(`${root}/${path}`);
  assert.equal(hash(bytes), entry.sha256);
  assert.equal(bytes.length, entry.bytes);
  return bytes;
}
async function parallel(items, fn) {
  for (let i = 0; i < items.length; i += 3)
    await Promise.all(items.slice(i, i + 3).map(fn));
}
async function capacity(count) {
  await ensureCycle("27-6");
  for (const [kind, file, headers] of [
    [
      "roster",
      "padron-sintetico.csv",
      ["identity", "name", "careerId", "group", "modality", "shift", "date"],
    ],
    [
      "catalog",
      "catalogo-sintetico.csv",
      [
        "careerId",
        "plan",
        "abbreviation",
        "coordination",
        "kind",
        "architecture",
      ],
    ],
  ])
    await source(
      kind,
      input(`${count}/sources/${file}`),
      "27-6",
      Object.fromEntries(headers.map((header) => [header, { header }])),
    );
  const files = manifest.files.filter((f) =>
    f.file.startsWith(`${count}/batch-`),
  );
  assert.equal(files.length, count);
  const overview = await api("overview", {});
  await parallel(files, async (f) => {
    if (!overview.courses.some((c) => c.id === f.course.id))
      await api("createCourse", {
        cycleId: "27-6",
        id: f.course.id,
        externalId: f.course.externalId,
        name: f.course.name,
        careers: f.course.careers,
      });
  });
  const students = files.reduce((n, f) => n + f.students, 0),
    activities = ["cero", "numero", "guion", "vacio", "invalido"];
  const cuts = [`${run}-antes`, `${run}-despues`];
  for (const cutId of cuts) {
    await api("createCut", { id: cutId, cycleId: "27-6", date: "2026-09-21" });
    for (let offset = 0; offset < files.length; offset += 20) {
      const lot = files.slice(offset, offset + 20),
        request = {
          cutId,
          files: lot.map((f) => ({
            ...descriptor(basename(f.file), input(f.file), f.mapping),
            courseId: f.course.id,
          })),
        };
      const jobs = await api("createBatch", request),
        duplicate = await api("createBatch", request);
      assert.deepEqual(
        jobs.jobs.map((j) => j.id),
        duplicate.jobs.map((j) => j.id),
      );
      await parallel(
        jobs.jobs.map((job, i) => ({ job, file: lot[i] })),
        async ({ job, file }) => {
          await api("upload", {
            jobId: job.id,
            base64: input(file.file).toString("base64"),
          });
          await ready(job.id);
          await publish(job.id, "admin");
          await api("configureMetrics", {
            cutId,
            courseId: file.course.id,
            versionId: job.id,
            expected: null,
            activities,
            teachers: null,
            reason: "Cinco estados sintéticos seleccionados",
          });
        },
      );
      console.log(
        `${scenario}: ${cutId}, ${Math.min(offset + 20, count)}/${count} cursos publicados`,
      );
    }
    const p = await panel(cutId),
      a = await panel(cutId, "a"),
      b = await panel(cutId, "b");
    const expected = {
      N: students * 2,
      G: students,
      V: students,
      E: students,
      Z: students,
      D: students * 5,
    };
    assert.deepEqual(p.counts, expected);
    assert.equal(p.students, 50);
    assert.equal(p.coverage, 40);
    assert.equal(p.published, count);
    for (const [role, career, data] of [
      ["a", "laf-plan-1", a],
      ["b", "arq-plan-1", b],
    ]) {
      assert.equal(
        data.counts.D,
        files.filter((f) => f.course.careers.includes(career)).length * 50,
      );
      assert(data.details.every((d) => d.careerId === career));
      await denied(
        `capacidad: ${role} aislamiento`,
        "dashboard",
        {
          ...query(cutId),
          filters: { careerId: role === "a" ? "arq-plan-1" : "laf-plan-1" },
        },
        role,
      );
      const exported = await api(
        "exportDashboard",
        { ...query(cutId), snapshotId: data.snapshotId },
        role,
      );
      assert.equal(
        exported.csv.split("\r\n").filter((r) => r.startsWith('"observacion",'))
          .length,
        data.counts.D,
      );
    }
    let cursor = p.next,
      seen = new Set(p.details.map((d) => `${d.courseId}:${d.identity}`));
    while (cursor !== null) {
      const page = await api("dashboard", {
        ...query(cutId),
        snapshotId: p.snapshotId,
        offset: cursor,
      });
      for (const d of page.details) {
        const key = `${d.courseId}:${d.identity}`;
        assert(!seen.has(key));
        seen.add(key);
      }
      cursor = page.next;
    }
    assert.equal(seen.size, students);
    await api("closeCut", { cutId });
    assert.deepEqual((await panel(cutId)).counts, expected);
    evidence.assertions.push(
      `${count}: totales, personas únicas, reintentos, paginación, CSV, aislamiento y cierre ${cutId}`,
    );
  }
  const pair = { beforeCut: cuts[0], afterCut: cuts[1] };
  await api("configureComparison", {
    ...pair,
    expected: null,
    reason: "Comparación sintética idéntica",
    pairs: files.flatMap((f) =>
      activities.map((a) => ({ courseId: f.course.id, before: a, after: a })),
    ),
  });
  const comparison = await api("compareCuts", { ...pair, filters: {} });
  assert.equal(comparison.universe, students * 5);
  assert.equal(comparison.differencePoints, 0);
  await api(
    "exportComparison",
    { ...pair, mappingId: comparison.mappingId, filters: {} },
    "a",
  );
  evidence.capacity = {
    courses: count,
    cuts,
    uniqueStudents: 50,
    studentRowsPerCut: students,
    activitiesPerFile: 5,
    bytesPerCut: files.reduce((n, f) => n + f.bytes, 0),
    batchesPerCut: Math.ceil(count / 20),
    concurrency: 3,
    counts: comparison.before,
  };
}
try {
  const health = await callable("environmentStatus", {}, null);
  assert.deepEqual(health, {
    mode: "staging",
    projectId: target.projectId,
    release: sha,
    status: "ready",
  });
  for (const [role, account] of Object.entries(accounts)) {
    assert(account.email.endsWith("@example.invalid"));
    assert(account.uid.startsWith("staging-synthetic-"));
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${web.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
          returnSecureToken: true,
        }),
      },
    );
    const body = await res.json();
    assert(res.ok && body.idToken, `Login falló: ${role}`);
    assert.equal(body.localId, account.uid);
    tokens[role] = body.idToken;
  }
  await denied("anónimo rechazado", "overview", {}, null, /UNAUTHENTICATED/);
  await denied("sin membresía rechazado", "overview", {}, "outsider");
  for (const [role, career] of [
    ["a", "laf-plan-1"],
    ["b", "arq-plan-1"],
  ])
    await api("assignMember", {
      uid: accounts[role].uid,
      member: { role: "coordinator", active: true, careers: [career] },
    });
  if (scenario === "smoke") await smoke();
  else await capacity(Number(scenario));
  evidence.status = "success";
} catch (error) {
  evidence.status = "failure";
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  evidence.completedAt = new Date().toISOString();
  writeFileSync(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      run,
      status: evidence.status,
      error: evidence.error,
      evidence: `${out}/evidence.json`,
      assertions: evidence.assertions.length,
    }),
  );
}
