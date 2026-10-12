import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import {
  readRuntimeConfig,
  validateEnvironmentResponse,
} from "./runtime-config";

// Construcción diferida: una configuración inválida llega al estado de error de la UI.
function createServices() {
  const config = readRuntimeConfig(
    {
      VITE_FIREBASE_MODE: import.meta.env.VITE_FIREBASE_MODE,
      VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
      VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
      VITE_RELEASE_SHA: import.meta.env.VITE_RELEASE_SHA,
    },
    window.location.hostname,
  );
  const app = initializeApp({
    projectId: config.projectId,
    apiKey:
      config.mode === "emulator" ? "demo-only-not-a-secret" : config.apiKey,
    authDomain: `${config.projectId}.firebaseapp.com`,
    storageBucket:
      config.mode === "emulator"
        ? `${config.projectId}.appspot.com`
        : config.storageBucket,
    ...(config.mode === "staging" ? { appId: config.appId } : {}),
  });
  const auth = getAuth(app);
  const functions = getFunctions(
    app,
    config.mode === "emulator" ? "us-central1" : config.region,
  );
  if (config.mode === "emulator") {
    connectAuthEmulator(
      auth,
      `http://${config.auth.host}:${config.auth.port}`,
      { disableWarnings: true },
    );
    connectFunctionsEmulator(
      functions,
      config.functions.host,
      config.functions.port,
    );
  }
  // El navegador opera mediante Functions. Firestore y Storage son privados;
  // sus SDK de cliente no son necesarios para consultar ni cargar archivos.
  return { functions, auth, config };
}

let services: ReturnType<typeof createServices> | undefined;
export function firebaseServices() {
  return (services ??= createServices());
}
export async function checkEnvironment(): Promise<void> {
  services ??= createServices();
  const health = httpsCallable(services.functions, "environmentStatus", {
    timeout: 8_000,
  });
  const response = await health({});
  validateEnvironmentResponse(services.config, response.data);
}
