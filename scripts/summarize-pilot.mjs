import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
const [input, log, output] = process.argv.slice(2);
if (!input || !log || !output)
  throw new Error("Uso: input.json emulator.log output.json");
const result = JSON.parse(readFileSync(input, "utf8"));
const groups = {};
for (const item of result.measurements)
  (groups[item.operation] ??= []).push(item);
function stats(items) {
  const values = items.map((i) => i.ms).sort((a, b) => a - b);
  return {
    count: values.length,
    failures: items.filter((i) => !i.ok).length,
    sumMs: values.reduce((a, b) => a + b, 0),
    p50Ms: values[Math.ceil(values.length * 0.5) - 1],
    p95Ms: values[Math.ceil(values.length * 0.95) - 1],
    maxMs: values.at(-1),
  };
}
const samples = [
  ...readFileSync(log, "utf8").matchAll(/pilot-metric (\{[^\r\n]+\})/g),
].map((m) => JSON.parse(m[1]));
const worker = samples.filter((s) => s.operation === "worker");
const memory = samples.flatMap((s) => [s.before, s.after]);
delete result.measurements;
result.timings = Object.fromEntries(
  Object.entries(groups).map(([key, values]) => [key, stats(values)]),
);
result.telemetryScope = {
  log: basename(log),
  description: "worker y functionsMemory abarcan TODO el log suministrado; si contiene ambos escenarios no son medidas separadas por escenario. timings/clientMemory/inventarios pertenecen al JSON de entrada.",
};
result.worker = stats(worker);
result.functionsMemory = {
  scope:
    "Muestras RSS/heap de procesos Functions antes/después; no pico continuo, incluye concurrencia y GC",
  samples: memory.length,
  maxRssBytes: Math.max(0, ...memory.map((m) => m.rss)),
  maxHeapUsedBytes: Math.max(0, ...memory.map((m) => m.heapUsed)),
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    scenario: result.scenario,
    status: result.status,
    elapsedMs: result.elapsedMs,
  }),
);
