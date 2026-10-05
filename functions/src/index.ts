import { HttpsError, onCall } from "firebase-functions/v2/https";
import { isEmulatorEnvironment } from "./environment";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { z } from "zod";
import { academicOperation, requestSchema } from "./api";
import { processJob } from "./jobs";
import { localOnly } from "./store";
import { pilotMeasure } from "./pilot-telemetry";

export const academicApi = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    concurrency: 4,
    maxInstances: 3,
  },
  async (request) => {
    localOnly();
    try {
      const data = requestSchema.parse(request.data);
      return await pilotMeasure(data.op, () =>
        academicOperation(data.op, data.input, request.auth?.uid),
      );
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof z.ZodError)
        throw new HttpsError("invalid-argument", "Datos o mapeo inválidos.");
      throw new HttpsError(
        "failed-precondition",
        "No se pudo completar la operación; revisa el estado antes de reintentar.",
      );
    }
  },
);

export const importWorker = onDocumentWritten(
  {
    document: "jobs/{jobId}",
    region: "us-central1",
    retry: true,
    timeoutSeconds: 120,
    memory: "1GiB",
    concurrency: 1,
    maxInstances: 3,
  },
  async (event) => {
    if (event.data?.after.data()?.status === "queued")
      await pilotMeasure("worker", () => processJob(event.params.jobId));
  },
);

// Contrato de diagnóstico de etapa 01 conservado; no concede permisos académicos.
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
