import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { z } from "zod";
import { readEmulatorConfig } from "./emulator-config";

const healthSchema = z.strictObject({
  mode: z.literal("emulator"),
  stage: z.literal("01"),
  status: z.literal("ready"),
});

// Construcción diferida: una configuración inválida llega al estado de error de la UI.
function createServices() {
  const config = readEmulatorConfig(
    import.meta.env.VITE_FIREBASE_MODE ?? "emulator",
    import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-seguimiento-ci",
  );
  const app = initializeApp({
    projectId: config.projectId,
    apiKey: "demo-only-not-a-secret",
    authDomain: `${config.projectId}.firebaseapp.com`,
    storageBucket: `${config.projectId}.appspot.com`,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, "us-central1");
  connectAuthEmulator(auth, `http://${config.auth.host}:${config.auth.port}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, config.firestore.host, config.firestore.port);
  connectStorageEmulator(storage, config.storage.host, config.storage.port);
  connectFunctionsEmulator(
    functions,
    config.functions.host,
    config.functions.port,
  );
  return { functions, auth, db, storage };
}

let services: ReturnType<typeof createServices> | undefined;
export function firebaseServices() { return services ??= createServices(); }
export async function checkEnvironment(): Promise<void> {
  services ??= createServices();
  const health = httpsCallable(services.functions, "environmentStatus", {
    timeout: 8_000,
  });
  const response = await health({});
  healthSchema.parse(response.data);
}
