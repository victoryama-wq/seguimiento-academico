import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { seedMetrics } from "../fixtures/synthetic/stage04";
import {
  api,
  source,
  rosterCsv,
  rosterMap,
  batch,
  waitJob,
  stores,
  people,
} from "../fixtures/synthetic/stage03";
import {
  dashboardSchema,
  type Dashboard,
  type MetricRequest,
} from "../../src/domain/metrics-contract";
import { csvCell } from "../../src/domain/metrics";

let sessions: Awaited<ReturnType<typeof seedMetrics>>;
beforeAll(async () => {
  sessions = await seedMetrics();
  // Hace consultable la inscripción de inglés ya existente en el fixture,
  // para comprobar que el filtro es por persona, no por tipo de inscripción.
  await api(
    "createCourse",
    {
      cycleId: "27-1",
      id: "ingles-sintetico",
      externalId: "4",
      name: "Inglés sintético",
      careers: ["ingles-plan"],
    },
    sessions.admin,
  );
}, 60000);

async function evidence(
  filters: MetricRequest["filters"],
  session = sessions.admin,
  cutId = "metricas",
) {
  const input = { cutId, filters, view: "institucion", section: "exclusions" };
  const first = dashboardSchema.parse(await api("dashboard", input, session));
  const rows: Dashboard["exclusions"] = [...first.exclusions];
  let next = first.next;
  while (next !== null) {
    const page = dashboardSchema.parse(
      await api(
        "dashboard",
        { ...input, snapshotId: first.snapshotId, offset: next },
        session,
      ),
    );
    expect(page.exclusionsCount).toBe(first.exclusionsCount);
    expect(page.total).toBe(first.total);
    expect(page.counts).toEqual(first.counts);
    rows.push(...page.exclusions);
    next = page.next;
  }
  expect(first.exclusionsCount).toBe(rows.length);
  expect(first.total).toBe(rows.length);
  const { csv } = (await api(
    "exportDashboard",
    { ...input, snapshotId: first.snapshotId },
    session,
  )) as { csv: string };
  expect(
    csv.split("\r\n").filter((line) => line.startsWith('"trazabilidad"')),
  ).toEqual(
    rows.map((r) =>
      [
        "trazabilidad",
        r.identity,
        r.careerId,
        r.courseId,
        r.reason,
        r.provenance,
      ]
        .map(csvCell)
        .join(","),
    ),
  );
  const details = dashboardSchema.parse(
    await api(
      "dashboard",
      { ...input, section: "details", snapshotId: first.snapshotId },
      session,
    ),
  );
  return { panel: first, rows, csv, details };
}

describe.sequential(
  "exclusiones filtradas conservan población, alcance y procedencia",
  () => {
    it.each(["admin", "a"] as const)(
      "%s conserva baja sin observaciones al combinar matrícula/carrera/grupo",
      async (role) => {
        for (const filters of [
          { student: "000BAJA" },
          {
            student: "000baja@example.invalid",
            careerId: "laf-plan-1",
            group: "27-1 LAF 24 01A",
            modality: "Ejecutivo",
            shift: "Vespertino",
          },
        ]) {
          const { panel, rows, csv, details } = await evidence(
            filters,
            sessions[role],
          );
          expect(panel.counts).toEqual({ N: 0, G: 0, V: 0, E: 0, Z: 0, D: 0 });
          expect(panel.coverage).toBeNull();
          expect(panel.students).toBe(0);
          expect(details.details).toEqual([]);
          expect(rows).toHaveLength(2); // Reporte y padrón, cada uno con su procedencia.
          expect(
            rows.every(
              (r) =>
                r.identity.toUpperCase().startsWith("000BAJA") &&
                r.reason.includes("baja"),
            ),
          ).toBe(true);
          expect(
            rows.find((r) => r.courseId === "compartido")!.provenance,
          ).toMatch(new RegExp(`^${sessions.first}:fila:`));
          expect(rows.find((r) => r.courseId === null)!.provenance).toMatch(
            /^[a-f0-9]{64}:fila:\d+$/,
          );
          expect(csv).toContain(
            '"0","0","0","0","0","0","sin datos","sin datos","0"',
          );
          expect(csv).not.toContain('"observacion",');
        }
        expect(
          (
            await evidence(
              { student: "000BAJA", group: "27-1 ARQ 48 01A" },
              sessions[role],
            )
          ).rows,
        ).toEqual([]);
      },
    );

    it.each(["admin", "a"] as const)(
      "%s aplica con_especial y solo_base a toda la persona",
      async (role) => {
        for (const scope of [
          {},
          { careerId: "laf-plan-1", group: "27-1 LAF 24 01A" },
        ]) {
          const special = await evidence(
            { ...scope, special: "con_especial" },
            sessions[role],
          );
          expect(special.panel.counts.D).toBe(4);
          expect(special.rows.some((r) => r.reason.includes("especial"))).toBe(
            true,
          );
          expect(
            special.rows.every((r) => r.identity.startsWith("000SINT01")),
          ).toBe(true);
          expect(special.csv).not.toContain("000BAJA");
          expect(special.csv).not.toContain("000SINT02");
          expect(special.details.details.every((r) => r.special)).toBe(true);
          const base = await evidence(
            { ...scope, special: "solo_base" },
            sessions[role],
          );
          expect(base.csv).not.toContain("000SINT01");
          expect(base.rows.some((r) => r.identity.startsWith("000BAJA"))).toBe(
            true,
          );
          expect(base.details.details.every((r) => !r.special)).toBe(true);
        }
        expect(
          (
            await evidence(
              { student: "000BAJA", special: "con_especial" },
              sessions[role],
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await evidence(
              { student: "000SINT01", special: "solo_base" },
              sessions[role],
            )
          ).rows,
        ).toEqual([]);
      },
    );

    it("conserva otras inscripciones de la persona especial solo cuando corresponden al filtro", async () => {
      const special = await evidence({
        careerId: "ingles-plan",
        special: "con_especial",
        group: "27-1 LAF 24 01A",
      });
      expect(special.rows).toHaveLength(1);
      expect(special.rows[0]).toMatchObject({
        identity: "000SINT01",
        careerId: "ingles-plan",
        reason: "excluida",
        courseId: null,
      });
      expect(special.rows[0]!.provenance).toContain(":fila:");
      expect(special.panel.counts.D).toBe(0);
      const base = await evidence({
        careerId: "ingles-plan",
        special: "solo_base",
      });
      expect(base.rows).toEqual([]);
      expect(base.csv).not.toContain("000SINT01");
      // Consultar no cambia las fuentes ni elimina la inscripción original.
      expect((await evidence({ careerId: "ingles-plan" })).rows).toEqual(
        special.rows,
      );
    });

    it("coordinador B solo ve su población y no accede a bajas, especiales ni carreras ajenas", async () => {
      for (const special of ["con_especial", "solo_base"] as const) {
        const result = await evidence(
          { special, careerId: "arq-plan-1", group: "27-1 ARQ 11 01A" },
          sessions.b,
        );
        expect(result.panel.counts.D).toBe(special === "solo_base" ? 3 : 0);
        expect(result.rows).toEqual([]);
        expect(result.csv).not.toContain("000SINT01");
        expect(result.csv).not.toContain("000BAJA");
      }
      const foreign = await evidence({ student: "000BAJA" }, sessions.b);
      expect(foreign.rows).toEqual([]);
      expect(foreign.panel.counts.D).toBe(0);
      for (const op of ["dashboard", "exportDashboard"])
        for (const [session, careerId] of [
          [sessions.a, "arq-plan-1"],
          [sessions.b, "laf-plan-1"],
        ] as const)
          await expect(
            api(
              op,
              {
                cutId: "metricas",
                view: "institucion",
                filters: { careerId, student: "000BAJA", special: "solo_base" },
              },
              session,
            ),
          ).rejects.toThrow("PERMISSION_DENIED");
      const general = await evidence({});
      expect(general.panel.counts).toEqual({
        N: 4,
        G: 1,
        V: 1,
        E: 1,
        Z: 1,
        D: 7,
      });
      expect(general.panel.students).toBe(2);
      expect(general.panel.coverage).toBeCloseTo(400 / 7);
    });

    it("conserva la exportación anterior a la corrección y reutiliza el CSV corregido al reintentar", async () => {
      const filters = { student: "000BAJA" };
      const input = { cutId: "metricas", filters, view: "institucion" };
      const panel = dashboardSchema.parse(
        await api("dashboard", input, sessions.admin),
      );
      // Clave usada antes de la corrección: manifiesto/filtros/vista, sin contenido.
      const legacyKey = createHash("sha256")
        .update(
          JSON.stringify({
            filters,
            snapshot: panel.snapshotId,
            view: "institucion",
          }),
        )
        .digest("hex");
      const legacyPath = `exports/${people.admin}/${legacyKey}.csv`;
      const original = Buffer.from(
        "Exportación sintética anterior sin exclusiones",
      );
      await stores().bucket.file(legacyPath).save(original);
      const first = (await api(
        "exportDashboard",
        { ...input, snapshotId: panel.snapshotId },
        sessions.admin,
      )) as { path: string; csv: string };
      expect(first.path).not.toBe(legacyPath);
      expect(first.csv).toContain('"trazabilidad","000BAJA');
      expect((await stores().bucket.file(legacyPath).download())[0]).toEqual(
        original,
      );
      const retry = await api(
        "exportDashboard",
        { ...input, snapshotId: panel.snapshotId },
        sessions.admin,
      );
      expect(retry).toEqual(first);
    });

    it("pagina 52 procedencias de 26 bajas y exporta exactamente el mismo alcance", async () => {
      const ids = Array.from({ length: 26 }, (_, i) => `BAJA-PAG-${i}`);
      await source(
        sessions.admin,
        "roster",
        rosterCsv +
          ids
            .map(
              (id) =>
                `\n${id},Baja sintética,laf-plan-1,27-1 LAF 24 01A,Ejecutivo,Vespertino,2026-08-31`,
            )
            .join(""),
        rosterMap,
      );
      await source(
        sessions.admin,
        "withdrawals",
        JSON.stringify(
          ids.map((identity) => ({
            identity,
            effectiveDate: null,
            confirmedCutId: "bajas-paginadas",
            reason: "Baja sintética para paginación",
          })),
        ),
        {},
        "bajas.json",
      );
      await api(
        "createCut",
        { cycleId: "27-1", id: "bajas-paginadas", date: "2026-09-21" },
        sessions.admin,
      );
      const [job] = await batch(
        sessions.admin,
        [
          {
            name: "2 Curso A 27-1.csv",
            courseId: "solo-a",
            content:
              "Correo,Nota\n" +
              ids.map((id) => `${id}@example.invalid,9`).join("\n"),
            mapping: {
              identity: { header: "Correo" },
              columns: [
                {
                  selector: { header: "Nota" },
                  kind: "activity",
                  activityId: "A",
                },
              ],
            },
          },
        ],
        "bajas-paginadas",
      );
      await waitJob(job!.id);
      await api("publish", { jobId: job!.id, replace: false }, sessions.admin);
      const result = await evidence(
        {
          careerId: "laf-plan-1",
          group: "27-1 LAF 24 01A",
          special: "solo_base",
        },
        sessions.a,
        "bajas-paginadas",
      );
      expect(result.panel.exclusions).toHaveLength(25);
      expect(result.panel.next).toBe(25);
      expect(result.rows).toHaveLength(52);
      expect(
        new Set(result.rows.map((r) => `${r.courseId}:${r.provenance}`)).size,
      ).toBe(52);
      expect(result.panel.counts.D).toBe(0);
      expect(result.panel.students).toBe(0);
      expect(result.panel.coverage).toBeNull();
    }, 60000);
  },
);
