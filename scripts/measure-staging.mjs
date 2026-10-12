import { client, project } from "./cloud-operator-session.mjs";
import { writeFileSync } from "node:fs";
const start = process.argv[2];
if (!start || !Number.isFinite(Date.parse(start)))
  throw new Error("Fecha inicial UTC requerida");
const end = new Date().toISOString();
const out = { project, start, end, metrics: {}, objects: [], errors: [] };
const types = [
  "firestore.googleapis.com/document/read_count",
  "firestore.googleapis.com/document/write_count",
  "firestore.googleapis.com/storage/data_and_index_storage_bytes",
  "run.googleapis.com/request_count",
  "run.googleapis.com/container/memory/utilizations",
  "run.googleapis.com/container/instance_count",
  "run.googleapis.com/container/billable_instance_time",
];
for (const type of types) {
  const q = new URLSearchParams({
    filter: `metric.type="${type}"`,
    "interval.startTime": start,
    "interval.endTime": end,
    view: "FULL",
    pageSize: "10000",
  });
  try {
    out.metrics[type] = (
      await client("https://monitoring.googleapis.com").get(
        `/v3/projects/${project}/timeSeries?${q}`,
      )
    ).body;
  } catch (e) {
    out.errors.push({ type, message: e.message });
  }
}
let pageToken;
do {
  const q = new URLSearchParams({
    maxResults: "1000",
    fields: "items(name,size,generation),nextPageToken",
    ...(pageToken ? { pageToken } : {}),
  });
  const page = (
    await client("https://storage.googleapis.com").get(
      `/storage/v1/b/${project}.firebasestorage.app/o?${q}`,
    )
  ).body;
  out.objects.push(...(page.items ?? []));
  pageToken = page.nextPageToken;
} while (pageToken);
out.storage = {
  objects: out.objects.length,
  bytes: out.objects.reduce((sum, o) => sum + Number(o.size), 0),
};
writeFileSync("private/cloud-observability.json", JSON.stringify(out, null, 2));
console.log(
  JSON.stringify({
    start,
    end,
    storage: out.storage,
    series: Object.fromEntries(
      Object.entries(out.metrics).map(([k, v]) => [
        k,
        v.timeSeries?.length ?? 0,
      ]),
    ),
    errors: out.errors,
  }),
);
