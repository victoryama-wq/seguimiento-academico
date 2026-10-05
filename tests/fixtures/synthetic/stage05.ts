import { seedMetrics } from "./stage04";
import { api, source, rosterCsv, rosterMap, batch, waitJob } from "./stage03";

export const historyPairs = [
  { courseId: "compartido", before: "A", after: "A2" },
  { courseId: "compartido", before: "B", after: "B" },
  { courseId: "compartido", before: "C", after: "C" },
  { courseId: "solo-a", before: "A", after: "A" },
];
export const historyRequest = {
  beforeCut: "metricas",
  afterCut: "posterior",
  filters: {},
};
export async function seedHistory(
  configure = true,
  options: {
    omitWithdrawnRow?: boolean;
    omitWithdrawalEvidence?: boolean;
  } = {},
) {
  const s = await seedMetrics();
  await api("closeCut", { cutId: "metricas" }, s.admin);
  await source(
    s.admin,
    "roster",
    rosterCsv.replace("27-1 LAF 24 01A", "27-1 LAF 24 02A") +
      "\n000SINT01,Estudiante especial,laf-plan-1,27-1 LAF 24 05C.A,Ejecutivo,Vespertino,2026-08-29\n000SINT01,Estudiante ingles,ingles-plan,27-1 ING 11 01A,Escolarizado,Matutino,2026-08-31\n000BAJA,Baja sintetica,laf-plan-1,27-1 LAF 24 01A,Ejecutivo,Vespertino,2026-08-31\n000NUEVO,Incorporacion sintetica,arq-plan-1,27-1 ARQ 11 01A,Escolarizado,Matutino,2026-08-31",
    rosterMap,
  );
  await source(
    s.admin,
    "withdrawals",
    JSON.stringify(
      [
        {
          identity: "000BAJA",
          effectiveDate: "2026-09-21",
          confirmedCutId: "posterior",
          reason: "Baja sintética previa",
        },
        {
          identity: "000SINT02",
          effectiveDate: "2026-10-12",
          confirmedCutId: "posterior",
          reason: "Baja sintética segundo corte",
        },
      ].filter(
        (w) => !options.omitWithdrawalEvidence || w.identity !== "000SINT02",
      ),
    ),
    {},
    "bajas-posteriores.json",
  );
  await api(
    "createCut",
    { cycleId: "27-1", id: "posterior", date: "2026-10-12" },
    s.admin,
  );
  const mapping = {
    identity: { header: "Correo" },
    columns: ["A", "B", "C", "Futura"].map((activity) => ({
      selector: { header: activity },
      kind: "activity",
      activityId: activity === "A" ? "A2" : activity,
    })),
  };
  const jobs = await batch(
    s.admin,
    [
      {
        name: "1 Curso compartido 27-1.csv",
        courseId: "compartido",
        mapping,
        content:
          "Correo,A,B,C,Futura\n000SINT01@example.invalid,0,7,,-\n" +
          (options.omitWithdrawnRow
            ? ""
            : "000SINT02@example.invalid,10,10,10,10\n") +
          "000NUEVO@example.invalid,1,2,3,4\n000BAJA@example.invalid,9,9,9,9\ntup-d1@example.invalid,10,10,10,10\n",
      },
      {
        name: "2 Curso A 27-1.csv",
        courseId: "solo-a",
        mapping: {
          identity: { header: "Correo" },
          columns: [
            { selector: { header: "Nota" }, kind: "activity", activityId: "A" },
          ],
        },
        content: "Correo,Nota\n000SINT01@example.invalid,9\n",
      },
    ],
    "posterior",
  );
  for (const [index, job] of jobs.entries()) {
    const courseId = index === 0 ? "compartido" : "solo-a";
    await waitJob(job.id);
    await api("publish", { jobId: job.id, replace: false }, s.admin);
    await api(
      "configureMetrics",
      {
        cutId: "posterior",
        courseId: courseId,
        versionId: job.id,
        expected: null,
        activities:
          courseId === "compartido" ? ["A2", "B", "C", "Futura"] : ["A"],
        teachers: null,
        reason: "Selección posterior sintética",
      },
      s.admin,
    );
  }
  await api("closeCut", { cutId: "posterior" }, s.admin);
  if (configure)
    await api(
      "configureComparison",
      {
        ...historyRequest,
        filters: undefined,
        expected: null,
        reason:
          "Correspondencia explícita revisada sobre actividades sintéticas",
        pairs: historyPairs,
      },
      s.admin,
    );
  return s;
}
