import { performance } from "node:perf_hooks";
import { isEmulatorEnvironment } from "./environment";

/** Opt-in local samples, no identities, arguments, filenames, tokens or responses. */
export async function pilotMeasure<T>(
  operation: string,
  work: () => Promise<T>,
): Promise<T> {
  if (process.env.PILOT_METRICS !== "1" || !isEmulatorEnvironment(process.env))
    return work();
  const start = performance.now();
  const before = process.memoryUsage();
  let ok = false;
  try {
    const result = await work();
    ok = true;
    return result;
  } finally {
    console.log(
      "pilot-metric",
      JSON.stringify({
        operation,
        ok,
        ms: Math.round(performance.now() - start),
        before,
        after: process.memoryUsage(),
      }),
    );
  }
}
