import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../fixtures/synthetic/stage03";
import { seedHistory, historyRequest } from "../fixtures/synthetic/stage05";
import { comparisonSchema } from "../../src/domain/history-contract";
import { dashboardSchema } from "../../src/domain/metrics-contract";

let s: Awaited<ReturnType<typeof seedHistory>>;
const compare = async (filters = {}, session = s.admin, section = "common") =>
  comparisonSchema.parse(
    await api("compareCuts", { ...historyRequest, filters, section }, session),
  );
const csv = async (filters = {}, session = s.admin) =>
  (
    (await api(
      "exportComparison",
      { ...historyRequest, filters },
      session,
    )) as { csv: string }
  ).csv;
beforeAll(async () => {
  s = await seedHistory(true, { omitWithdrawnRow: true });
}, 60000);

describe.sequential("regresiones de revisión histórica", () => {
  it("resuelve A por instancia: A→A2 compartido y A→A solo-a, también en CSV", async () => {
    for (const session of [s.admin, s.a]) {
      const r = await compare({ activity: "A" }, session);
      expect(
        r.common
          .map((c) => [c.courseId, c.beforeActivity, c.afterActivity])
          .sort(),
      ).toEqual([
        ["compartido", "A", "A2"],
        ["solo-a", "A", "A"],
      ]);
      expect(r.before).toEqual({ N: 2, G: 0, V: 0, E: 0, Z: 1, D: 2 });
      expect(r.after).toEqual(r.before);
      expect(r.differencePoints).toBe(0);
      const exported = await csv({ activity: "A" }, session);
      expect(exported).toContain('"Universo común","2"');
      expect(exported).toContain('"compartido","A","A2","numerica","0"');
      expect(exported).toContain('"solo-a","A","A","numerica","6"');
      expect(
        exported
          .toLowerCase()
          .split("\r\n")
          .filter((l) => l.startsWith('"000sint01","')),
      ).toHaveLength(2);
    }
    expect(
      (await compare({ activity: "A", courseId: "compartido" }, s.a)).before.D,
    ).toBe(1);
    // Registration is evaluated AFTER the mapped activity filter, at both ends.
    expect(
      (await compare({ activity: "A", registration: "completo" }, s.a)).before
        .D,
    ).toBe(2);
    expect(
      (await compare({ activity: "A", registration: "parcial" }, s.a)).before.D,
    ).toBe(0);
  });
  it("sin correspondencia de origen no usa IDs posteriores ni otras actividades", async () => {
    for (const activity of ["A2", "Futura", "inexistente"]) {
      const r = await compare({ activity }, s.a);
      expect(r.comparable).toBe(false);
      expect(r.before.D).toBe(0);
      expect(r.afterCoverage).toBeNull();
      expect(r.common).toEqual([]);
      expect(await csv({ activity }, s.a)).toContain('"Universo común","0"');
    }
  });
  it("mantiene alcance y deniega filtros manipulados en comparación y exportación", async () => {
    expect((await compare({ activity: "A" }, s.b)).before.D).toBe(0);
    for (const session of [s.a, s.b]) {
      const other = session === s.a ? "000sint02" : "000sint01";
      expect(
        (await csv({ activity: "A" }, session)).toLowerCase(),
      ).not.toContain(other);
      for (const op of ["compareCuts", "exportComparison"]) {
        await expect(
          api(
            op,
            {
              ...historyRequest,
              filters: {
                activity: "A",
                careerId: session === s.a ? "arq-plan-1" : "laf-plan-1",
              },
            },
            session,
          ),
        ).rejects.toThrow(/PERMISSION_DENIED/);
      }
    }
    for (const op of ["compareCuts", "exportComparison"])
      await expect(
        api(
          op,
          { ...historyRequest, filters: { activity: "A", courseId: "solo-a" } },
          s.b,
        ),
      ).rejects.toThrow(/PERMISSION_DENIED/);
  });
  it("reconoce baja solo en padrón, conserva su procedencia y no calcula recuperación", async () => {
    const filters = { student: "000SINT02" };
    const posterior = dashboardSchema.parse(
      await api(
        "dashboard",
        {
          cutId: "posterior",
          filters,
          view: "institucion",
          section: "exclusions",
        },
        s.b,
      ),
    );
    const withdrawal = posterior.exclusions.find(
      (e) => e.courseId === null && /baja/.test(e.reason),
    );
    expect(withdrawal).toBeDefined();
    expect(posterior.exclusions.every((e) => e.courseId === null)).toBe(true);
    const r = await compare(filters, s.b, "changes");
    expect(r.changes.find((c) => c.kind === "baja")).toMatchObject({
      courseId: "compartido",
      provenance: withdrawal!.provenance,
    });
    expect(r.changes.some((c) => c.kind === "fuera_del_universo")).toBe(false);
    expect(r.before.D).toBe(0);
    expect(r.after.D).toBe(0);
    expect(r.differencePoints).toBeNull();
    const exported = await csv(filters, s.b);
    expect(exported).toContain("Baja; no representa recuperación.");
    expect(exported).toContain(withdrawal!.provenance);
    expect(exported.toLowerCase()).not.toContain("000sint01");
    expect((await compare(filters, s.a, "changes")).changes).toEqual([]);
  });
  it("conserva cálculos originales y comunes sin sumar la baja", async () => {
    const original = dashboardSchema.parse(
      await api(
        "dashboard",
        { cutId: "metricas", filters: {}, view: "institucion" },
        s.admin,
      ),
    );
    expect(original.counts).toEqual({ N: 4, G: 1, V: 1, E: 1, Z: 1, D: 7 });
    expect(original.students).toBe(2);
    const r = await compare();
    expect(r.before).toEqual({ N: 2, G: 1, V: 1, E: 0, Z: 1, D: 4 });
    expect(r.after).toEqual({ N: 3, G: 0, V: 1, E: 0, Z: 1, D: 4 });
    expect(r.differencePoints).toBe(25);
  });
  it("ausencia sin evidencia de baja permanece fuera del universo", async () => {
    s = await seedHistory(true, {
      omitWithdrawnRow: true,
      omitWithdrawalEvidence: true,
    });
    const filters = { student: "000SINT02" };
    const r = await compare(filters, s.b, "changes");
    expect(r.changes.some((c) => c.kind === "baja")).toBe(false);
    expect(r.changes.some((c) => c.kind === "fuera_del_universo")).toBe(true);
    expect(r.differencePoints).toBeNull();
    expect(await csv(filters, s.b)).not.toContain(
      "Baja; no representa recuperación.",
    );
  }, 60000);
});
