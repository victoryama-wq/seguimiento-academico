import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import config from "../../firebase.json";

const projectId = "demo-seguimiento-ci";
const emulators = config.emulators;
// Nunca escribir si se invoca Vitest directamente sin el entorno seguro completo.
if (
  process.env.GCLOUD_PROJECT !== projectId ||
  [
    ["FIRESTORE_EMULATOR_HOST", emulators.firestore],
    ["FIREBASE_AUTH_EMULATOR_HOST", emulators.auth],
    ["FIREBASE_STORAGE_EMULATOR_HOST", emulators.storage],
  ].some(([key, endpoint]) => {
    const target = endpoint as { host: string; port: number };
    return process.env[key as string] !== `${target.host}:${target.port}`;
  })
)
  throw new Error(
    "Se requieren los emuladores demo completos antes de sembrar datos.",
  );

let environment: RulesTestEnvironment;
let app: FirebaseApp;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      ...emulators.firestore,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      ...emulators.storage,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
  app = initializeApp(
    {
      projectId,
      apiKey: "demo-only-not-a-secret",
      storageBucket: `${projectId}.appspot.com`,
    },
    "integration",
  );
  connectAuthEmulator(
    getAuth(app),
    `http://${emulators.auth.host}:${emulators.auth.port}`,
    { disableWarnings: true },
  );
  connectFirestoreEmulator(
    getFirestore(app),
    emulators.firestore.host,
    emulators.firestore.port,
  );
  connectStorageEmulator(
    getStorage(app),
    emulators.storage.host,
    emulators.storage.port,
  );
  connectFunctionsEmulator(
    getFunctions(app),
    emulators.functions.host,
    emulators.functions.port,
  );
});
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await signOut(getAuth(app));
  const response = await fetch(
    `http://${emulators.auth.host}:${emulators.auth.port}/emulator/v1/projects/${projectId}/accounts`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("No se pudo limpiar Auth");
  await environment.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc("persons/synthetic")
      .set({ matriculaOriginal: "TEST-0007" });
    await context
      .storage()
      .ref("originals/synthetic/shared.txt")
      .put(new Uint8Array([1, 2, 3]));
  });
});
afterAll(async () => {
  if (app) await deleteApp(app);
  if (environment) await environment.cleanup();
});

describe("reglas restrictivas de etapa 01", () => {
  it.each(["anonymous", "coordinator", "admin-claim"])(
    "Firestore deniega lectura, consulta y mutaciones: %s",
    async (role) => {
      const context =
        role === "anonymous"
          ? environment.unauthenticatedContext()
          : environment.authenticatedContext(`synthetic-${role}`, {
              role: role === "coordinator" ? "coordinator" : "admin",
            });
      const db = context.firestore();
      await assertFails(db.doc("persons/synthetic").get());
      await assertFails(db.collection("persons").limit(10).get());
      await assertFails(
        db.doc("persons/new").set({ matriculaOriginal: "TEST-0008" }),
      );
      await assertFails(
        db.doc("persons/synthetic").update({ matriculaOriginal: "cambio" }),
      );
      await assertFails(db.doc("persons/synthetic").delete());
      await assertFails(
        db.doc(`memberships/synthetic-${role}`).set({ role: "admin" }),
      );
    },
  );
  it.each(["anonymous", "coordinator", "admin-claim"])(
    "Storage protege originales y exportaciones: %s",
    async (role) => {
      const context =
        role === "anonymous"
          ? environment.unauthenticatedContext()
          : environment.authenticatedContext(`synthetic-${role}`, { role });
      const storage = context.storage();
      await assertFails(
        storage.ref("originals/synthetic/shared.txt").getDownloadURL(),
      );
      await assertFails(
        storage.ref("originals/synthetic/shared.txt").getMetadata(),
      );
      await assertFails(storage.ref("originals/synthetic").listAll());
      await assertFails(
        Promise.resolve(storage.ref("originals/new").put(new Uint8Array([4]))),
      );
      await assertFails(
        Promise.resolve(storage.ref("exports/new").put(new Uint8Array([4]))),
      );
      await assertFails(storage.ref("originals/synthetic/shared.txt").delete());
    },
  );
  it("Auth emite una sesión real de emulador que no abre acceso a expedientes", async () => {
    const auth = getAuth(app);
    await createUserWithEmailAndPassword(
      auth,
      "coordinacion@ejemplo.invalid",
      "Synthetic-test-only-2026",
    );
    await signOut(auth);
    const credential = await signInWithEmailAndPassword(
      auth,
      "coordinacion@ejemplo.invalid",
      "Synthetic-test-only-2026",
    );
    expect((await credential.user.getIdTokenResult()).claims.aud).toBe(
      projectId,
    );
    await expect(
      getDoc(doc(getFirestore(app), "persons/synthetic")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("Functions ejecutadas en el emulador", () => {
  it("permite diagnóstico sin exponer datos ni requerir una sesión simulada", async () => {
    const response = await httpsCallable(
      getFunctions(app),
      "environmentStatus",
    )({});
    expect(response.data).toEqual({
      mode: "emulator",
      stage: "01",
      status: "ready",
    });
  });
  it.each([{ role: "admin" }, null, []])(
    "rechaza payload ajeno al contrato: %s",
    async (payload) => {
      await expect(
        httpsCallable(getFunctions(app), "environmentStatus")(payload),
      ).rejects.toMatchObject({ code: "functions/invalid-argument" });
    },
  );
});
