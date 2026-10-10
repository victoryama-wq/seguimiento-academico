import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

// Cargar las entradas CommonJS del SDK con Node evita la carga ESM parcial de
// jose al transformar las fixtures con Playwright; no modifica el SDK probado.
const require = createRequire(import.meta.url);
const { initializeApp, getApps } =
  require("firebase-admin/app") as typeof import("firebase-admin/app");
const { getAuth } =
  require("firebase-admin/auth") as typeof import("firebase-admin/auth");
const { getFirestore } =
  require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
const { getStorage } =
  require("firebase-admin/storage") as typeof import("firebase-admin/storage");

export function guard() {
  if (
    process.env.GCLOUD_PROJECT !== "demo-seguimiento-ci" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199"
  )
    throw new Error("Se requieren emuladores demo completos.");
}
export function stores() {
  guard();
  const app =
    getApps().find((v) => v.name === "stage03-tests") ??
    initializeApp(
      {
        projectId: "demo-seguimiento-ci",
        storageBucket: "demo-seguimiento-ci.appspot.com",
      },
      "stage03-tests",
    );
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    bucket: getStorage(app).bucket(),
  };
}
export const password = "Synthetic-only-stage03-2026";
export const people = {
  admin: "admin-sintetico",
  a: "coordinador-a",
  b: "coordinador-b",
  outsider: "sin-acceso",
};
export async function token(uid: string) {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-only",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${uid}@example.invalid`,
        password,
        returnSecureToken: true,
      }),
    },
  );
  const data = (await response.json()) as { idToken?: string };
  if (!data.idToken) throw new Error("No se obtuvo sesión sintética");
  return data.idToken;
}
export async function api(
  op: string,
  input: unknown,
  authToken?: string,
): Promise<unknown> {
  guard();
  const response = await fetch(
    "http://127.0.0.1:5001/demo-seguimiento-ci/us-central1/academicApi",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ data: { op, input } }),
    },
  );
  const body = (await response.json()) as {
    error?: { status: string; message: string };
    result?: unknown;
  };
  if (body.error)
    throw new Error(`${body.error.status}: ${body.error.message}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return body.result;
}
export const moodleMapping = {
  identity: { header: "Correo" },
  columns: [
    {
      selector: { header: "Nota" },
      kind: "activity",
      activityId: "actividad-1",
    },
  ],
};
export const rosterHeaders = [
  "identity",
  "name",
  "careerId",
  "group",
  "modality",
  "shift",
  "date",
];
export const rosterMap = Object.fromEntries(
  rosterHeaders.map((header) => [header, { header }]),
);
export const rosterCsv = [
  rosterHeaders.join(","),
  "000SINT01,Estudiante A,laf-plan-1,27-1 LAF 24 01A,Ejecutivo,Vespertino,2026-08-31",
  "000SINT02,Estudiante B,arq-plan-1,27-1 ARQ 11 01A,Escolarizado,Matutino,2026-08-31",
].join("\n");
export const catalogHeaders = [
  "careerId",
  "plan",
  "abbreviation",
  "coordination",
  "kind",
  "architecture",
];
export const catalogCsv = [
  catalogHeaders.join(","),
  "laf-plan-1,plan-1,LAF,coord-a,carrera,false",
  "arq-plan-1,plan-1,ARQ,coord-b,carrera,true",
].join("\n");
export const catalogMap = Object.fromEntries(
  catalogHeaders.map((header) => [header, { header }]),
);
export const reportCsv =
  "Correo,Nota\n000SINT01@example.invalid,0\n000SINT02@example.invalid,-\ntup-d1@example.invalid,10\n";
export function descriptor(
  name: string,
  content: string,
  mapping: unknown = moodleMapping,
) {
  const bytes = Buffer.from(content);
  return {
    name,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    mapping,
  };
}
export async function waitJob(id: string, status = "ready") {
  const until = Date.now() + 45000;
  while (Date.now() < until) {
    const doc = (await stores().db.doc(`jobs/${id}`).get()).data();
    if (doc?.status === status) return doc;
    if (
      ["invalid", "failed"].includes(String(doc?.status)) &&
      status === "ready"
    )
      throw new Error(`Trabajo ${id}: ${doc?.status}/${doc?.error}`);
    await delay(100);
  }
  throw new Error(`Trabajo ${id} no alcanzó ${status}`);
}
export async function source(
  authToken: string,
  kind: string,
  content: string,
  mapping: unknown = {},
  name = `${kind}.csv`,
  cycleId = "27-1",
) {
  const job = (await api(
    "createSource",
    { cycleId, kind, file: descriptor(name, content, mapping) },
    authToken,
  )) as { id: string; replaces: string | null };
  await api(
    "upload",
    { jobId: job.id, base64: Buffer.from(content).toString("base64") },
    authToken,
  );
  await waitJob(job.id);
  await api(
    "publishSource",
    { jobId: job.id, replace: !!job.replaces },
    authToken,
  );
  return job.id;
}
export async function batch(
  authToken: string,
  files: {
    name: string;
    content: string;
    courseId: string;
    mapping: unknown;
  }[] = [
    {
      name: "1 Curso compartido 27-1.csv",
      content: reportCsv,
      courseId: "compartido",
      mapping: moodleMapping,
    },
  ],
  cutId = "corte-1",
) {
  const result = (await api(
    "createBatch",
    {
      cutId,
      files: files.map((f) => ({
        ...descriptor(f.name, f.content, f.mapping),
        courseId: f.courseId,
      })),
    },
    authToken,
  )) as { jobs: { id: string; status: string }[] };
  for (const [i, job] of result.jobs.entries())
    await api(
      "upload",
      {
        jobId: job.id,
        base64: Buffer.from(files[i]!.content).toString("base64"),
      },
      authToken,
    );
  return result.jobs;
}
export async function seedBase() {
  const { db, auth } = stores();
  const clear = await fetch(
    "http://127.0.0.1:8080/emulator/v1/projects/demo-seguimiento-ci/databases/(default)/documents",
    { method: "DELETE" },
  );
  if (!clear.ok) throw new Error("No se pudo limpiar Firestore demo");
  // No se borran objetos: los IDs incorporan el actor sintético constante y las fuentes
  // son inmutables; cada fixture se confirma por su hash al reusarlo.
  for (const uid of Object.values(people)) {
    try {
      await auth.getUser(uid);
    } catch {
      await auth.createUser({ uid, email: `${uid}@example.invalid`, password });
    }
  }
  await db
    .doc(`memberships/${people.admin}`)
    .set({ role: "admin", active: true, careers: [] });
  const adminToken = await token(people.admin);
  await api(
    "assignMember",
    {
      uid: people.a,
      member: { role: "coordinator", active: true, careers: ["laf-plan-1"] },
    },
    adminToken,
  );
  await api(
    "assignMember",
    {
      uid: people.b,
      member: { role: "coordinator", active: true, careers: ["arq-plan-1"] },
    },
    adminToken,
  );
  await api(
    "createCycle",
    {
      id: "27-1",
      dates: {
        "2026-08-31": "base",
        "2026-08-29": "especial",
        "2026-08-30": "practica",
        "2026-08-28": "excluida",
        "2026-08-27": "excluida",
        "2026-08-26": "excluida",
      },
    },
    adminToken,
  );
  const roster = await source(adminToken, "roster", rosterCsv, rosterMap);
  const catalog = await source(adminToken, "catalog", catalogCsv, catalogMap);
  await api(
    "createCourse",
    {
      cycleId: "27-1",
      id: "compartido",
      externalId: "1",
      name: "Curso compartido",
      careers: ["laf-plan-1", "arq-plan-1"],
    },
    adminToken,
  );
  await api(
    "createCourse",
    {
      cycleId: "27-1",
      id: "solo-a",
      externalId: "2",
      name: "Curso A",
      careers: ["laf-plan-1"],
    },
    adminToken,
  );
  await api(
    "createCut",
    { cycleId: "27-1", id: "corte-1", date: "2026-09-21" },
    adminToken,
  );
  return {
    admin: adminToken,
    a: await token(people.a),
    b: await token(people.b),
    outsider: await token(people.outsider),
    roster,
    catalog,
  };
}
