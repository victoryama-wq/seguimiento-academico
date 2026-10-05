import { test, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, totalmem, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import {
  api,
  seedBase,
  source,
  rosterMap,
  catalogMap,
  stores,
  waitJob,
  password,
  token,
} from "../fixtures/synthetic/stage03";
import {
  pilotActivities,
  pilotAbbreviations,
  pilotCareers,
  pilotCourses,
  pilotFile,
  pilotStudents,
} from "../fixtures/synthetic/stage06";
import { dashboardSchema } from "../../src/domain/metrics-contract";
import { comparisonSchema } from "../../src/domain/history-contract";
import { pilotRecovery } from "../fixtures/synthetic/pilot-recovery";

const counts = process.env.PILOT_COURSES
  ? [Number(process.env.PILOT_COURSES)]
  : [45, 230];
if (counts.some((n) => ![45, 230].includes(n)))
  throw new Error("PILOT_COURSES: 45 o 230");
for (const count of counts)
  test(`capacidad reproducible: ${count} cursos`, async () => {
    const started = performance.now();
    const timings: { operation: string; ms: number; ok: boolean }[] = [];
    const evidence: Record<string, unknown> = {
      scenario: count,
      startedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: platform(),
        release: release(),
        cpus: cpus().length,
        ramBytes: totalmem(),
      },
      measurements: timings,
      status: "running",
      apiConcurrency: 4,
      batchLimit: 20,
      memoryScope:
        "Proceso de pruebas: RSS muestreada y maxRSS del SO; Functions: muestras pilot-metric en log, no pico continuo.",
    };
    let sampledRss = process.memoryUsage().rss;
    const sampler = setInterval(() => {
      sampledRss = Math.max(sampledRss, process.memoryUsage().rss);
    }, 100);
    const measure = async <T>(
      operation: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const t = performance.now();
      let ok = false;
      try {
        const result = await fn();
        ok = true;
        return result;
      } finally {
        timings.push({ operation, ms: Math.round(performance.now() - t), ok });
      }
    };
    const parallel = async <T>(
      items: T[],
      fn: (item: T) => Promise<unknown>,
    ) => {
      for (let i = 0; i < items.length; i += 4)
        await Promise.all(items.slice(i, i + 4).map(fn));
    };
    try {
      const session = await measure("seed", () => seedBase());
      const call = <T = unknown>(
        op: string,
        input: unknown,
        auth = session.admin,
      ) => measure(op, () => api(op, input, auth)) as Promise<T>;
      const cycleId = "27-6";
      await call("createCycle", {
        id: cycleId,
        dates: { "2026-08-31": "base", "2026-08-29": "especial" },
      });
      const roster = [
        "identity,name,careerId,group,modality,shift,date",
        ...pilotStudents.map(
          (s) =>
            `${s.id},Persona sintetica,${s.careerId},27-6 ${pilotAbbreviations[s.career]} 11 01A,Escolarizado,Matutino,2026-08-31`,
        ),
      ].join("\n");
      await source(
        session.admin,
        "roster",
        roster,
        rosterMap,
        "padron-sintetico.csv",
        cycleId,
      );
      await source(
        session.admin,
        "catalog",
        [
          "careerId,plan,abbreviation,coordination,kind,architecture",
          ...pilotCareers.map(
            (career, i) =>
              `${career},plan-1,${pilotAbbreviations[i]},coord-${i},carrera,${i === 1}`,
          ),
        ].join("\n"),
        catalogMap,
        "catalogo-sintetico.csv",
        cycleId,
      );
      const coordinatorTokens: string[] = [];
      for (const [i, career] of pilotCareers.entries()) {
        const uid = `piloto-coordinador-${i}`;
        try {
          await stores().auth.getUser(uid);
        } catch {
          await stores().auth.createUser({
            uid,
            email: `${uid}@example.invalid`,
            password,
          });
        }
        await call("assignMember", {
          uid,
          member: { role: "coordinator", active: true, careers: [career] },
        });
        coordinatorTokens.push(await token(uid));
      }
      const courses = pilotCourses(count);
      const files = courses.map((c) => {
        const f = pilotFile(c);
        return {
          ...f,
          descriptor: {
            ...f.descriptor,
            name: f.descriptor.name.replace("27-1", cycleId),
          },
        };
      });
      evidence.files = files.map((f, i) => ({
        course: courses[i]!.id,
        format: courses[i]!.format,
        bytes: f.bytes.length,
        students: f.students,
        rows: f.students + 1,
        activities: 5,
        shared: courses[i]!.careers.length > 1,
      }));
      const studentRows = files.reduce((n, f) => n + f.students, 0);
      evidence.population = {
        uniqueStudents: 50,
        studentRowsPerCut: studentRows,
        teacherRowsPerCut: count,
        activitiesPerFile: 5,
        cellsPerCut: (studentRows + 2 * count) * 6,
      };
      await parallel(courses, (c) =>
        call("createCourse", {
          cycleId,
          id: c.id,
          externalId: c.externalId,
          name: c.name,
          careers: c.careers,
        }),
      );
      const cutIds = [`piloto-${count}-antes`, `piloto-${count}-despues`];
      const versions: string[][] = [];
      for (const [cutIndex, cutId] of cutIds.entries()) {
        await call("createCut", {
          id: cutId,
          cycleId,
          date: cutIndex ? "2026-10-12" : "2026-09-21",
        });
        const published: string[] = [];
        for (let offset = 0; offset < files.length; offset += 20) {
          const lot = files.slice(offset, offset + 20);
          const request = { cutId, files: lot.map((f) => f.descriptor) };
          const batchStart = performance.now();
          const result = await call<{ jobs: { id: string }[] }>(
            "createBatch",
            request,
          );
          const duplicate = await call<{ jobs: { id: string }[] }>(
            "createBatch",
            request,
          );
          expect(duplicate.jobs.map((j) => j.id)).toEqual(
            result.jobs.map((j) => j.id),
          );
          await parallel(
            result.jobs.map((job, i) => ({ job, file: lot[i]! })),
            async ({ job, file }) => {
              await call("upload", {
                jobId: job.id,
                base64: file.bytes.toString("base64"),
              });
              await measure("processing:waitReady", () => waitJob(job.id));
              await call("publish", { jobId: job.id, replace: false });
              await call("configureMetrics", {
                cutId,
                courseId: file.descriptor.courseId,
                versionId: job.id,
                expected: null,
                activities: pilotActivities,
                teachers: null,
                reason: "Piloto sintetico: cinco estados originales",
              });
            },
          );
          published.push(...result.jobs.map((j) => j.id));
          timings.push({
            operation: `batch:${cutIndex}:${offset}`,
            ms: Math.round(performance.now() - batchStart),
            ok: true,
          });
        }
        versions.push(published);
        if (cutIndex === 0)
          evidence.recovery = await measure(
            "recovery:partialConcurrentBatch",
            () => pilotRecovery(session.admin, cutId, published[0]!),
          );
        const request = {
          cutId,
          filters: {},
          view: "institucion",
          section: "details",
        };
        const dashboard = dashboardSchema.parse(
          await call("dashboard", request),
        );
        expect(dashboard.counts).toEqual({
          N: studentRows * 2,
          G: studentRows,
          V: studentRows,
          E: studentRows,
          Z: studentRows,
          D: studentRows * 5,
        });
        expect(dashboard.students).toBe(50);
        expect(dashboard.coverage).toBe(40);
        expect(dashboard.published).toBe(count);
        expect(dashboard.pending).toBe(0);
        // Recorrer dos páginas sin adoptar versiones nuevas; exportar todo un ámbito.
        expect(dashboard.next).not.toBeNull();
        const page = dashboardSchema.parse(
          await call("dashboard", {
            ...request,
            offset: dashboard.next,
            snapshotId: dashboard.snapshotId,
          }),
        );
        expect(
          page.details
            .map((d) => `${d.courseId}:${d.identity}`)
            .some((id) =>
              dashboard.details.some(
                (d) => `${d.courseId}:${d.identity}` === id,
              ),
            ),
        ).toBe(false);
        for (const [i, auth] of coordinatorTokens.entries()) {
          const scoped = dashboardSchema.parse(
            await call("dashboard", request, auth),
          );
          const expectedRows =
            files.filter((_, j) =>
              courses[j]!.careers.includes(pilotCareers[i]!),
            ).length * 10;
          expect(scoped.students).toBe(10);
          expect(scoped.counts.D).toBe(expectedRows * 5);
          expect(
            scoped.details.every((d) => d.careerId === pilotCareers[i]),
          ).toBe(true);
          await expect(
            call(
              "dashboard",
              { ...request, filters: { careerId: pilotCareers[(i + 1) % 5] } },
              auth,
            ),
          ).rejects.toThrow(/PERMISSION_DENIED/);
        }
        const exported = await call<{ csv: string }>(
          "exportDashboard",
          { ...request, filters: { careerId: pilotCareers[0] } },
          coordinatorTokens[0],
        );
        expect(
          exported.csv
            .split("\r\n")
            .filter((r) => r.startsWith('"observacion",')).length,
        ).toBe(
          files.filter((_, j) => courses[j]!.careers.includes(pilotCareers[0]!))
            .length * 50,
        );
        expect(exported.csv).not.toContain("00piloto100");
        evidence[`cut${cutIndex}`] = {
          counts: dashboard.counts,
          students: dashboard.students,
          coverage: dashboard.coverage,
          exportBytesCareer0: Buffer.byteLength(exported.csv),
        };
        await call("closeCut", { cutId });
        const closed = dashboardSchema.parse(await call("dashboard", request));
        expect(closed.closed).toBe(true);
        expect(closed.counts).toEqual(dashboard.counts);
        await expect(
          call("configureMetrics", {
            cutId,
            courseId: courses[0]!.id,
            versionId: published[0],
            expected: null,
            activities: [],
            teachers: null,
            reason: "No alterar cerrado",
          }),
        ).rejects.toThrow(/FAILED_PRECONDITION/);
      }
      const pair = { beforeCut: cutIds[0], afterCut: cutIds[1] };
      await call("configureComparison", {
        ...pair,
        expected: null,
        reason: "Correspondencias sintéticas explícitas",
        pairs: courses.flatMap((c) =>
          pilotActivities.map((a) => ({ courseId: c.id, before: a, after: a })),
        ),
      });
      const comparison = comparisonSchema.parse(
        await call("compareCuts", { ...pair, filters: {} }),
      );
      expect(comparison.universe).toBe(studentRows * 5);
      expect(comparison.before.D).toBe(studentRows * 5);
      expect(comparison.after).toEqual(comparison.before);
      expect(comparison.differencePoints).toBe(0);
      await call(
        "exportComparison",
        {
          ...pair,
          mappingId: comparison.mappingId,
          filters: { careerId: pilotCareers[0] },
        },
        coordinatorTokens[0],
      );
      const jobs = await stores()
        .db.collection("jobs")
        .where("cycleId", "==", cycleId)
        .get();
      expect(jobs.docs.filter((d) => d.data().kind === "report").length).toBe(
        count * 2 + 4,
      );
      expect(new Set(versions.flat()).size).toBe(count * 2);
      const [objects] = await stores().bucket.getFiles();
      const storage: Record<string, { objects: number; bytes: number }> = {};
      for (const object of objects) {
        const prefix = object.name.split("/")[0]!;
        const metadata =
          object.metadata.size === undefined
            ? (await object.getMetadata())[0]
            : object.metadata;
        const item = (storage[prefix] ??= { objects: 0, bytes: 0 });
        item.objects++;
        item.bytes += Number(metadata.size);
      }
      evidence.storage = {
        scope:
          "Bucket demo completo al terminar; incluye seed y escenarios anteriores; no es incremento aislado.",
        prefixes: storage,
      };
      evidence.firestore = {
        jobsForScenario: jobs.size,
        baselineReportRows: 2 * (studentRows + count),
        recoveryAdditionalAttempts:
          "Dos sustituciones, duplicado bloqueante y archivo inválido; una fila parcial conserva intento abandonado.",
        readWriteBilling:
          "No medido. Consultas callable medidas en measurements; inventario no equivale a operaciones facturadas.",
      };
      const storedRows = await stores().db.collectionGroup("rows").get();
      evidence.firestoreRowPayload = {
        scope:
          "Filas de todos los intentos del Firestore demo limpio; JSON UTF-8 medido, excluye overhead e índices de Firestore",
        documents: storedRows.size,
        bytes: storedRows.docs.reduce(
          (n, d) => n + Buffer.byteLength(JSON.stringify(d.data())),
          0,
        ),
      };
      evidence.status = "passed";
    } catch (error) {
      evidence.status = "failed";
      evidence.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      clearInterval(sampler);
      evidence.elapsedMs = Math.round(performance.now() - started);
      evidence.clientMemory = {
        sampledPeakRssBytes: sampledRss,
        osMaxRssKiB: process.resourceUsage().maxRSS,
      };
      mkdirSync("test-results/pilot", { recursive: true });
      writeFileSync(
        `test-results/pilot/${count}.json`,
        JSON.stringify(evidence, null, 2),
      );
    }
  });
