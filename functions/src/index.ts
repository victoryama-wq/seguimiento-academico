import { HttpsError, onCall } from "firebase-functions/v2/https";
import { isEmulatorEnvironment } from "./environment";

// Diagnóstico sin datos, roles o SDK Admin. La nube se rechaza explícitamente.
export const environmentStatus = onCall(
  { region: "us-central1" },
  (request) => {
    if (!isEmulatorEnvironment(process.env)) {
      throw new HttpsError(
        "failed-precondition",
        "Solo disponible con emuladores completos.",
      );
    }
    if (
      request.data === null ||
      typeof request.data !== "object" ||
      Array.isArray(request.data) ||
      Object.keys(request.data).length !== 0
    ) {
      throw new HttpsError("invalid-argument", "Se espera un objeto vacío.");
    }
    return { mode: "emulator", stage: "01", status: "ready" };
  },
);
