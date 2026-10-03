import { beforeAll, describe, expect, it } from "vitest";
import {
  api,
  stores,
  people,
  batch,
  waitJob,
  source,
  rosterCsv,
  rosterMap,
} from "../fixtures/synthetic/stage03";
import {
  seedHistory,
  historyRequest,
  historyPairs,
} from "../fixtures/synthetic/stage05";
import {
  comparisonSchema,
  casePage,
  calendarSchema,
} from "../../src/domain/history-contract";
import { dashboardSchema } from "../../src/domain/metrics-contract";

let s: Awaited<ReturnType<typeof seedHistory>>;
const compare = async (extra = {}, session = s.admin) =>
  comparisonSchema.parse(
    await api("compareCuts", { ...historyRequest, ...extra }, session),
  );
const target = {
  cutId: "metricas",
  courseId: "compartido",
  student: "000SINT01",
};
const note = {
  ...target,
  expected: null,
  requestId: "first-note",
  observation: "Observación sintética, sin inferir entrega",
  responsible: "Responsable sintético A",
  contactDate: "2026-09-25",
  nextAction: "Revisar registro",
  status: "abierto",
};
beforeAll(async () => {
  s = await seedHistory();
}, 60000);
describe.sequential("fotografías, comparación y seguimiento autorizado", () => {
  it("preserva el cálculo D7/N4 y calcula un universo común D4 con +25 puntos", async () => {
    const p = dashboardSchema.parse(
      await api(
        "dashboard",
        { cutId: "metricas", filters: {}, view: "institucion" },
        s.admin,
      ),
    );
    expect(p.counts).toEqual({ N: 4, G: 1, V: 1, E: 1, Z: 1, D: 7 });
    expect(p.students).toBe(2);
    const r = await compare();
    expect(r.before).toEqual({ N: 2, G: 1, V: 1, E: 0, Z: 1, D: 4 });
    expect(r.after).toEqual({ N: 3, G: 0, V: 1, E: 0, Z: 1, D: 4 });
    expect(r.beforeCoverage).toBe(50);
    expect(r.afterCoverage).toBe(75);
    expect(r.differencePoints).toBe(25);
    expect(r.students).toBe(1);
    expect(r.common.some((c) => c.student.toLowerCase() === "000sint02")).toBe(
      false,
    );
    const changes = await compare({ section: "changes" });
    expect(
      changes.changes.some(
        (c) => c.kind === "baja" && c.student.includes("000SINT02"),
      ),
    ).toBe(true);
    expect(
      changes.changes.some(
        (c) => c.kind === "afiliacion" && c.description.includes("02A"),
      ),
    ).toBe(true);
    expect(
      changes.changes.some(
        (c) => c.kind === "incorporacion" && c.student.includes("000NUEVO"),
      ),
    ).toBe(true);
    expect(changes.changes.some((c) => c.kind === "sin_archivo")).toBe(true);
    expect(changes.changes.some((c) => c.description.includes("Futura"))).toBe(
      true,
    );
  });
  it("conserva afiliaciones, fuentes, mapeos y catálogo ante fuentes actuales nuevas", async () => {
    const cut = (await stores().db.doc("cuts/metricas").get()).data()!;
    const original = (
      await stores().bucket.file(cut.closurePath).download()
    )[0].toString();
    const frozen = JSON.parse(original);
    expect(frozen.academic.persons.length).toBeGreaterThan(0);
    expect(
      frozen.snapshot.entries.find(
        (e: { course: { id: string } }) => e.course.id === "compartido",
      ).job.file.mapping.identity.header,
    ).toBe("Correo");
    await source(
      s.admin,
      "roster",
      rosterCsv.replace(
        "Estudiante A",
        "Cambio posterior sin efecto histórico",
      ),
      rosterMap,
    );
    const before = await compare();
    expect(before.before.D).toBe(4);
    expect(before.differencePoints).toBe(25);
    expect(
      (await stores().bucket.file(cut.closurePath).download())[0].toString(),
    ).toBe(original);
    await api(
      "createCourse",
      {
        cycleId: "27-1",
        id: "nuevo-despues",
        externalId: "77",
        name: "Posterior al cierre",
        careers: ["laf-plan-1"],
      },
      s.admin,
    );
    const p = dashboardSchema.parse(
      await api(
        "dashboard",
        { cutId: "metricas", filters: {}, view: "institucion" },
        s.admin,
      ),
    );
    expect(p.expected).toBe(3);
  });
  it("autoriza ambos coordinadores y deniega consultas manipuladas, correspondencias y exportación cruzadas", async () => {
    const a = await compare({}, s.a),
      b = await compare({}, s.b);
    expect(a.before.D).toBe(4);
    expect(b.comparable).toBe(false);
    expect(b.before.D).toBe(0);
    expect(b.differencePoints).toBeNull();
    for (const session of [s.a, s.b]) {
      const wrong = session === s.a ? "arq-plan-1" : "laf-plan-1";
      for (const op of ["compareCuts", "exportComparison"])
        await expect(
          api(
            op,
            { ...historyRequest, filters: { careerId: wrong }, offset: 25 },
            session,
          ),
        ).rejects.toThrow(/PERMISSION_DENIED/);
      await expect(
        api(
          "configureComparison",
          {
            beforeCut: "metricas",
            afterCut: "posterior",
            expected: null,
            reason: "Rol falsificado",
            pairs: historyPairs,
          },
          session,
        ),
      ).rejects.toThrow(/PERMISSION_DENIED/);
    }
    const csvA = (await api(
      "exportComparison",
      { ...historyRequest, mappingId: a.mappingId },
      s.a,
    )) as { csv: string };
    const csvB = (await api("exportComparison", historyRequest, s.b)) as {
      csv: string;
    };
    expect(csvA.csv).toContain('"Diferencia en puntos porcentuales","25"');
    expect(csvA.csv.toLowerCase()).not.toContain("000sint02");
    expect(csvA.csv.toLowerCase()).not.toContain("000nuevo");
    expect(csvB.csv.toLowerCase()).not.toContain("000sint01");
    expect(csvB.csv).toContain("Baja; no representa recuperación");
    await expect(api("compareCuts", historyRequest)).rejects.toThrow(
      /UNAUTHENTICATED/,
    );
    await expect(
      api(
        "compareCuts",
        { ...historyRequest, mappingId: "inventado" },
        s.admin,
      ),
    ).rejects.toThrow(/NOT_FOUND/);
  });
  it("mantiene bajas, casos especiales, grupo y procedencia al filtrar las fotografías", async () => {
    const baja = await compare(
      { filters: { student: "000BAJA" }, section: "changes" },
      s.a,
    );
    expect(baja.before.D).toBe(0);
    expect(baja.beforeCoverage).toBeNull();
    expect(
      baja.changes.some((c) => c.student.includes("000BAJA") && !!c.provenance),
    ).toBe(true);
    const special = await compare(
      { filters: { special: "con_especial" } },
      s.a,
    );
    expect(special.before.D).toBe(4);
    const base = await compare(
      { filters: { special: "solo_base" }, section: "changes" },
      s.a,
    );
    expect(base.before.D).toBe(0);
    expect(base.changes.some((c) => c.student.includes("000SINT01"))).toBe(
      false,
    );
    expect(
      (await compare({ filters: { group: "27-1 LAF 24 01A" } }, s.a))
        .comparable,
    ).toBe(false);
  });
  it("audita corrección como revisión de corte y conserva ambas fotografías", async () => {
    await api(
      "createCut",
      {
        cycleId: "27-1",
        id: "revision-metricas",
        date: "2026-09-21",
        parentId: "metricas",
        reason: "Corrección sintética atribuible",
      },
      s.admin,
    );
    await api("closeCut", { cutId: "revision-metricas" }, s.admin);
    const revision = (
      await stores().db.doc("cuts/revision-metricas").get()
    ).data()!;
    expect(revision.parentId).toBe("metricas");
    expect(revision.createdBy).toBe(people.admin);
    expect(revision.reason).toBe("Corrección sintética atribuible");
    expect(revision.closurePath).toBeTruthy();
    expect(
      (await stores().db.doc("cuts/metricas").get()).data()?.closurePath,
    ).not.toBe(revision.closurePath);
    const unmapped = await compare({ afterCut: "revision-metricas" });
    expect(unmapped.comparable).toBe(false);
    expect(unmapped.reason).toContain("sin correspondencias");
  });
  it("bitácora idempotente, ediciones simultáneas sin pérdida y fechas separadas", async () => {
    const initial = (await api("saveCase", note, s.a)) as {
      id: string;
      head: string;
    };
    expect(await api("saveCase", note, s.a)).toEqual(initial);
    await expect(
      api(
        "saveCase",
        { ...note, observation: "Mismo id, otro contenido" },
        s.a,
      ),
    ).rejects.toThrow(/ABORTED/);
    const writes = await Promise.allSettled(
      ["edicion-a", "edicion-b"].map((requestId) =>
        api(
          "saveCase",
          {
            ...note,
            expected: initial.head,
            requestId,
            observation: requestId,
          },
          s.a,
        ),
      ),
    );
    expect(writes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(writes.filter((r) => r.status === "rejected")).toHaveLength(1);
    const page = casePage.parse(await api("caseHistory", target, s.a));
    expect(page.rows).toHaveLength(2);
    expect(page.rows.every((r) => r.actor === people.a)).toBe(true);
    expect(
      page.rows.every(
        (r) =>
          r.contactDate === "2026-09-25" && typeof r.recordedAt === "number",
      ),
    ).toBe(true);
    expect((await compare()).before.D).toBe(4);
    await expect(api("caseById", { id: initial.id }, s.b)).rejects.toThrow(
      /NOT_FOUND|PERMISSION_DENIED/,
    );
    await expect(api("exportCase", target, s.b)).rejects.toThrow(
      /NOT_FOUND|PERMISSION_DENIED/,
    );
    await expect(
      api("saveCase", { ...note, requestId: "cross" }, s.b),
    ).rejects.toThrow(/NOT_FOUND|PERMISSION_DENIED/);
    const btarget = { ...target, student: "000SINT02" };
    await api("saveCase", { ...note, ...btarget, requestId: "b-note" }, s.b);
    expect(
      casePage.parse(await api("caseHistory", btarget, s.b)).rows,
    ).toHaveLength(1);
  });
  it("pagina 26 revisiones, exporta historial completo y respeta revocación de carrera", async () => {
    let page = casePage.parse(await api("caseHistory", target, s.a));
    for (let i = page.rows.length; i < 26; i++) {
      await api(
        "saveCase",
        {
          ...note,
          requestId: `revision-${i}`,
          expected: page.head,
          observation: `Registro sintético ${i}`,
        },
        s.a,
      );
      page = casePage.parse(await api("caseHistory", target, s.a));
    }
    expect(page.rows).toHaveLength(25);
    expect(page.cursor).not.toBeNull();
    const next = casePage.parse(
      await api("caseHistory", { ...target, cursor: page.cursor }, s.a),
    );
    expect(next.rows).toHaveLength(1);
    const csv = (await api("exportCase", target, s.a)) as { csv: string };
    expect(csv.csv.split("\r\n")).toHaveLength(29);
    await api(
      "assignMember",
      {
        uid: people.a,
        member: { role: "coordinator", active: true, careers: ["arq-plan-1"] },
      },
      s.admin,
    );
    await expect(
      api("caseById", { id: page.id, cursor: page.cursor }, s.a),
    ).rejects.toThrow(/NOT_FOUND|PERMISSION_DENIED/);
    await expect(api("exportCase", target, s.a)).rejects.toThrow(
      /NOT_FOUND|PERMISSION_DENIED/,
    );
    const changed = await compare({}, s.a);
    expect(changed.before.D).toBe(0);
    expect(changed.common).toHaveLength(0);
    await api(
      "assignMember",
      {
        uid: people.a,
        member: { role: "coordinator", active: true, careers: ["laf-plan-1"] },
      },
      s.admin,
    );
  });
  it("calendario editable, reintento sin duplicación y pendientes del alcance", async () => {
    await api(
      "planCalendar",
      { cycleId: "27-1", firstDate: "2026-11-02", count: 2 },
      s.admin,
    );
    await api(
      "editCutDate",
      {
        cutId: "27-1-2026-11-02",
        expected: "2026-11-02",
        date: "2026-11-03",
        reason: "Ajuste sintético",
      },
      s.admin,
    );
    await api(
      "planCalendar",
      { cycleId: "27-1", firstDate: "2026-11-02", count: 2 },
      s.admin,
    );
    await expect(
      api(
        "editCutDate",
        {
          cutId: "metricas",
          expected: "2026-09-21",
          date: "2026-09-22",
          reason: "No autorizado",
        },
        s.admin,
      ),
    ).rejects.toThrow(/FAILED_PRECONDITION/);
    await expect(
      api(
        "planCalendar",
        { cycleId: "27-1", firstDate: "2026-11-02", count: 2 },
        s.a,
      ),
    ).rejects.toThrow(/PERMISSION_DENIED/);
    const cal = calendarSchema.parse(
      await api("historyCalendar", { cycleId: "27-1" }, s.b),
    );
    expect(cal.cuts.find((c) => c.id === "27-1-2026-11-02")?.date).toBe(
      "2026-11-03",
    );
    expect(cal.cuts.find((c) => c.id === "27-1-2026-11-23")?.date).toBe(
      "2026-11-23",
    );
    expect(cal.cuts.find((c) => c.id === "metricas")?.pending).toBe(1);
  });
  it("serializa cierre, publicación y selección; conserva el estado ganador íntegro", async () => {
    await api(
      "createCut",
      { cycleId: "27-1", id: "concurrente", date: "2026-10-12" },
      s.admin,
    );
    const file = {
      name: "2 Curso A 27-1.csv",
      courseId: "solo-a",
      mapping: {
        identity: { header: "Correo" },
        columns: [
          { selector: { header: "Nota" }, kind: "activity", activityId: "A" },
        ],
      },
      content: "Correo,Nota\n000SINT01@example.invalid,-\n",
    };
    const [first] = await batch(s.admin, [file], "concurrente");
    await waitJob(first!.id);
    await api("publish", { jobId: first!.id, replace: false }, s.admin);
    const openTarget = {
      cutId: "concurrente",
      courseId: "solo-a",
      student: "000SINT01",
    };
    await api(
      "saveCase",
      { ...note, ...openTarget, requestId: "nota-corte-abierto" },
      s.a,
    );
    const originalNote = casePage.parse(
      await api("caseHistory", openTarget, s.a),
    );
    expect(originalNote.rows[0]?.snapshotId).toBeTruthy();
    const [second] = await batch(
      s.admin,
      [{ ...file, content: file.content.replace(",-", ",8") }],
      "concurrente",
    );
    await waitJob(second!.id);
    const results = await Promise.allSettled([
      api("closeCut", { cutId: "concurrente" }, s.admin),
      api("publish", { jobId: second!.id, replace: true }, s.admin),
      api(
        "configureMetrics",
        {
          cutId: "concurrente",
          courseId: "solo-a",
          versionId: first!.id,
          expected: null,
          activities: ["A"],
          teachers: null,
          reason: "Selección concurrente",
        },
        s.admin,
      ),
    ]);
    for (const result of results)
      if (result.status === "rejected")
        expect(String(result.reason)).toMatch(/ABORTED|FAILED_PRECONDITION/);
    await api("closeCut", { cutId: "concurrente" }, s.admin);
    expect(casePage.parse(await api("caseHistory", openTarget, s.a))).toEqual(
      originalNote,
    );
    const c = (await stores().db.doc("cuts/concurrente").get()).data()!;
    const payload = JSON.parse(
      (await stores().bucket.file(c.closurePath).download())[0].toString(),
    );
    const entry = payload.snapshot.entries.find(
      (e: { course: { id: string } }) => e.course.id === "solo-a",
    );
    expect(entry.job.id).toBe(
      (await stores().db.doc("cuts/concurrente/courses/solo-a").get()).data()
        ?.versionId,
    );
    expect(entry.selection?.id ?? null).toBe(
      (
        await stores()
          .db.doc("cuts/concurrente/activitySelections/solo-a")
          .get()
      ).data()?.id ?? null,
    );
    const p = dashboardSchema.parse(
      await api(
        "dashboard",
        { cutId: "concurrente", filters: {}, view: "institucion" },
        s.admin,
      ),
    );
    expect(p.counts.D).toBe(
      entry.selection?.versionId === entry.job.id ? 1 : 0,
    );
    await expect(
      api(
        "configureMetrics",
        {
          cutId: "concurrente",
          courseId: "solo-a",
          versionId: entry.job.id,
          expected: null,
          activities: ["A"],
          teachers: null,
          reason: "Posterior",
        },
        s.admin,
      ),
    ).rejects.toThrow(/FAILED_PRECONDITION/);
  });
});
