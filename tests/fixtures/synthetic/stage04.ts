import {
  api,
  seedBase,
  source,
  rosterCsv,
  rosterMap,
  catalogCsv,
  catalogMap,
  batch,
  waitJob,
  descriptor,
} from "./stage03";

export const metricMapping = {
  identity: { header: "Correo" },
  columns: ["A", "B", "C", "Futura"]
    .map((activityId) => ({
      selector: { header: activityId },
      kind: "activity",
      activityId,
    }))
    .concat([{ selector: { header: "Total" }, kind: "total", activityId: "" }])
    .map((c) =>
      c.kind === "total" ? { selector: c.selector, kind: c.kind } : c,
    ),
};
export const metricCsv =
  "Correo,A,B,C,Futura,Total\n000SINT01@example.invalid,0,-,,99,99\n000SINT02@example.invalid,8,texto,4,99,99\n000BAJA@example.invalid,9,9,9,99,99\ntup-d1@example.invalid,10,10,10,99,99\n";
export async function seedMetrics(selected = true) {
  const sessions = await seedBase();
  await source(
    sessions.admin,
    "catalog",
    catalogCsv + "\ningles-plan,idiomas,ING,coord-a,ingles,false",
    catalogMap,
  );
  await source(
    sessions.admin,
    "roster",
    rosterCsv +
      "\n000SINT01,Estudiante A especial,laf-plan-1,27-1 LAF 24 05C.A,Ejecutivo,Vespertino,2026-08-29\n000SINT01,Estudiante A ingles,ingles-plan,27-1 ING 11 01A,Escolarizado,Matutino,2026-08-31\n000BAJA,Baja sintetica,laf-plan-1,27-1 LAF 24 01A,Ejecutivo,Vespertino,2026-08-31",
    rosterMap,
  );
  await source(
    sessions.admin,
    "withdrawals",
    JSON.stringify([
      {
        identity: "000BAJA",
        effectiveDate: null,
        confirmedCutId: "metricas",
        reason: "Baja sintética confirmada",
      },
    ]),
    {},
    "bajas.json",
  );
  await api(
    "createCut",
    { cycleId: "27-1", id: "metricas", date: "2026-09-21" },
    sessions.admin,
  );
  await api(
    "createCourse",
    {
      cycleId: "27-1",
      id: "sin-archivo",
      externalId: "3",
      name: "Curso pendiente",
      careers: ["arq-plan-1"],
    },
    sessions.admin,
  );
  const first = (
    (await api(
      "createBatch",
      {
        cutId: "metricas",
        files: [
          {
            ...descriptor(
              "1 Curso compartido 27-1.csv",
              metricCsv,
              metricMapping,
            ),
            courseId: "compartido",
          },
        ],
      },
      sessions.admin,
    )) as { jobs: { id: string }[] }
  ).jobs[0]!.id;
  await api(
    "upload",
    { jobId: first, base64: Buffer.from(metricCsv).toString("base64") },
    sessions.admin,
  );
  await waitJob(first);
  await api("publish", { jobId: first, replace: false }, sessions.admin);
  const [second] = await batch(
    sessions.admin,
    [
      {
        name: "2 Curso A 27-1.csv",
        content: "Correo,Nota\n000SINT01@example.invalid,6\n",
        courseId: "solo-a",
        mapping: {
          identity: { header: "Correo" },
          columns: [
            { selector: { header: "Nota" }, kind: "activity", activityId: "A" },
          ],
        },
      },
    ],
    "metricas",
  );
  await waitJob(second!.id);
  await api("publish", { jobId: second!.id, replace: false }, sessions.admin);
  if (selected) {
    for (const [courseId, versionId, activities] of [
      ["compartido", first, ["A", "B", "C"]],
      ["solo-a", second!.id, ["A"]],
    ] as const)
      await api(
        "configureMetrics",
        {
          cutId: "metricas",
          courseId,
          versionId,
          expected: null,
          activities,
          teachers: null,
          reason: "Universo sintético calculado manualmente",
        },
        sessions.admin,
      );
  }
  return { ...sessions, first, second: second!.id };
}
