import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  api,
  batch,
  catalogCsv,
  catalogMap,
  descriptor,
  moodleMapping,
  people,
  reportCsv,
  rosterCsv,
  rosterMap,
  seedBase,
  source,
  stores,
  token,
  waitJob,
} from "../fixtures/synthetic/stage03";

let sessions: Awaited<ReturnType<typeof seedBase>>;
beforeAll(async () => {
  sessions = await seedBase();
}, 60000);

describe.sequential("etapa 03: autorización, fuentes y trabajos reales", () => {
  it("autentica y rechaza roles del navegador, cuentas sin membresía y escrituras directas", async () => {
    await expect(api("overview", {})).rejects.toThrow("UNAUTHENTICATED");
    await stores().auth.setCustomUserClaims(people.outsider, { role: "admin" });
    await expect(
      api("overview", {}, await token(people.outsider)),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(
      api("overview", { role: "admin" }, sessions.a),
    ).rejects.toThrow("INVALID_ARGUMENT");
    await expect(
      api(
        "assignMember",
        { uid: people.b, member: { role: "admin", active: true, careers: [] } },
        sessions.a,
      ),
    ).rejects.toThrow("PERMISSION_DENIED");
    const env = await initializeTestEnvironment({
      projectId: "demo-seguimiento-ci",
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: readFileSync("firestore.rules", "utf8"),
      },
      storage: {
        host: "127.0.0.1",
        port: 9199,
        rules: readFileSync("storage.rules", "utf8"),
      },
    });
    try {
      await assertSucceeds(
        env
          .authenticatedContext(people.a)
          .firestore()
          .doc(`memberships/${people.a}`)
          .get(),
      );
      await assertFails(
        env
          .authenticatedContext(people.a)
          .firestore()
          .doc(`memberships/${people.b}`)
          .get(),
      );
      await assertFails(
        env
          .authenticatedContext(people.a, { role: "admin" })
          .firestore()
          .doc(`memberships/${people.a}`)
          .set({ role: "admin", active: true, careers: [] }),
      );
      await assertFails(
        env
          .authenticatedContext(people.admin)
          .firestore()
          .doc("cycles/27-1")
          .update({ sources: {} }),
      );
      await assertSucceeds(
        env
          .authenticatedContext(people.admin)
          .storage("gs://demo-seguimiento-ci.appspot.com")
          .ref(`originals/${sessions.roster}/source`)
          .getMetadata(),
      );
      await assertFails(
        env
          .authenticatedContext(people.a)
          .storage("gs://demo-seguimiento-ci.appspot.com")
          .ref(`originals/${sessions.roster}/source`)
          .getMetadata(),
      );
      await assertFails(
        env
          .authenticatedContext(people.b)
          .storage("gs://demo-seguimiento-ci.appspot.com")
          .ref(`originals/${sessions.roster}/source`)
          .getDownloadURL(),
      );
      await assertFails(
        env
          .authenticatedContext(people.admin)
          .storage("gs://demo-seguimiento-ci.appspot.com")
          .ref(`originals/${sessions.roster}/source`)
          .delete(),
      );
    } finally {
      await env.cleanup();
    }
  });

  it("un lote parcial publica el archivo válido y no revela la otra carrera", async () => {
    const jobs = await batch(sessions.a, [
      {
        name: "1 Curso compartido 27-1.csv",
        content: reportCsv,
        courseId: "compartido",
        mapping: moodleMapping,
      },
      {
        name: "2 Curso A 27-1.csv",
        content: "<html>inválido</html>",
        courseId: "solo-a",
        mapping: moodleMapping,
      },
    ]);
    const valid = jobs[0]!.id,
      invalid = jobs[1]!.id;
    const staged = await waitJob(valid);
    await waitJob(invalid, "invalid");
    const a = await api(
      "preview",
      { jobId: valid, careerId: "laf-plan-1" },
      sessions.a,
    );
    expect(JSON.stringify(a)).toContain("000SINT01");
    expect(JSON.stringify(a)).not.toContain("000SINT02");
    await expect(
      api("preview", { jobId: valid, careerId: "arq-plan-1" }, sessions.b),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(
      api("preview", { jobId: valid, careerId: "arq-plan-1" }, sessions.a),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(api("original", { jobId: valid }, sessions.a)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    const original = (await api(
      "original",
      { jobId: valid },
      sessions.admin,
    )) as { base64: string };
    expect(Buffer.from(original.base64, "base64").toString()).toBe(reportCsv);
    await expect(
      api("publish", { jobId: invalid, replace: false }, sessions.a),
    ).rejects.toThrow("FAILED_PRECONDITION");
    await api("publish", { jobId: valid, replace: false }, sessions.a);
    const rows = await stores()
      .db.collection(`jobs/${valid}/attempts/${staged.token}/rows`)
      .get();
    expect(rows.size).toBe(1);
    const env = await initializeTestEnvironment({
      projectId: "demo-seguimiento-ci",
      firestore: { host: "127.0.0.1", port: 8080 },
    });
    try {
      const path = `jobs/${valid}/attempts/${staged.token}/rows`;
      await assertSucceeds(
        env
          .authenticatedContext(people.a)
          .firestore()
          .collection(path)
          .where("careerId", "==", "laf-plan-1")
          .get(),
      );
      await assertFails(
        env.authenticatedContext(people.a).firestore().collection(path).get(),
      );
      await assertFails(
        env
          .authenticatedContext(people.a)
          .firestore()
          .doc(`${path}/000003`)
          .get(),
      );
      await assertFails(
        env.unauthenticatedContext().firestore().doc(`${path}/000002`).get(),
      );
      await assertFails(
        env
          .authenticatedContext(people.b)
          .firestore()
          .doc(`${path}/000003`)
          .get(),
      );
    } finally {
      await env.cleanup();
    }
    const exported = (await api(
      "export",
      { cutId: "corte-1", courseId: "compartido", careerId: "laf-plan-1" },
      sessions.a,
    )) as { csv: string };
    expect(exported.csv).toContain("000SINT01");
    expect(exported.csv).not.toContain("000SINT02");
    await expect(
      api(
        "export",
        { cutId: "corte-1", courseId: "compartido", careerId: "arq-plan-1" },
        sessions.a,
      ),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(
      api(
        "createBatch",
        {
          cutId: "corte-1",
          files: [
            {
              ...descriptor("2 Curso A 27-1.csv", reportCsv),
              courseId: "solo-a",
            },
          ],
        },
        sessions.b,
      ),
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  it("reimportación, confirmaciones concurrentes y reintentos conservan conteos", async () => {
    const [a, b] = await Promise.all([batch(sessions.a), batch(sessions.a)]);
    expect(a[0]!.id).toBe(b[0]!.id);
    const id = a[0]!.id;
    const before = (
      await stores().db.doc(`cuts/corte-1/courses/compartido`).get()
    ).data();
    await Promise.all([
      api("publish", { jobId: id, replace: false }, sessions.a),
      api("publish", { jobId: id, replace: false }, sessions.a),
      api("retry", { jobId: id }, sessions.a),
    ]);
    expect(
      (await stores().db.doc("cuts/corte-1/courses/compartido").get()).data(),
    ).toEqual(before);
    expect(
      (
        await stores()
          .db.collection("publications")
          .where("courseId", "==", "compartido")
          .get()
      ).size,
    ).toBe(1);
  });

  it("dos versiones concurrentes exigen sustitución y solo una avanza el puntero", async () => {
    const [a, b] = await Promise.all([
      batch(sessions.a, [
        {
          name: "1 Curso compartido 27-1.csv",
          content: reportCsv.replace(",0", ",5"),
          courseId: "compartido",
          mapping: moodleMapping,
        },
      ]),
      batch(sessions.b, [
        {
          name: "1 Curso compartido 27-1.csv",
          content: reportCsv.replace(",0", ",8"),
          courseId: "compartido",
          mapping: moodleMapping,
        },
      ]),
    ]);
    await Promise.all([waitJob(a[0]!.id), waitJob(b[0]!.id)]);
    await expect(
      api("publish", { jobId: a[0]!.id, replace: false }, sessions.a),
    ).rejects.toThrow("FAILED_PRECONDITION");
    const result = await Promise.allSettled([
      api("publish", { jobId: a[0]!.id, replace: true }, sessions.a),
      api("publish", { jobId: b[0]!.id, replace: true }, sessions.b),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      result
        .filter((r) => r.status === "rejected")
        .map((r) => String(r.reason)),
    ).toEqual([expect.stringContaining("ABORTED")]);
    const pointer = (
      await stores().db.doc("cuts/corte-1/courses/compartido").get()
    ).data()!;
    expect(pointer.revision).toBe(2);
    expect(
      (
        await stores()
          .db.collection("publications")
          .where("courseId", "==", "compartido")
          .get()
      ).size,
    ).toBe(2);
  });

  it("recupera un intento abandonado sin publicar filas parciales y acota reintentos", async () => {
    const result = (await api(
      "createBatch",
      {
        cutId: "corte-1",
        files: [
          {
            ...descriptor(
              "1 Curso compartido 27-1.csv",
              reportCsv.replace(",0", ",7"),
            ),
            courseId: "compartido",
          },
        ],
      },
      sessions.a,
    )) as { jobs: { id: string }[] };
    const id = result.jobs[0]!.id;
    await stores()
      .bucket.file(`originals/${id}/source`)
      .save(Buffer.from(reportCsv.replace(",0", ",7")), { resumable: false });
    await stores()
      .db.doc(`jobs/${id}/attempts/abandonado/rows/000002`)
      .set({ identity: "NO_PUBLICAR", careerId: "laf-plan-1" });
    await stores().db.doc(`jobs/${id}`).update({
      status: "processing",
      attempt: 1,
      token: "abandonado",
      lease: 0,
    });
    expect(
      JSON.stringify(
        await api("preview", { jobId: id, careerId: "laf-plan-1" }, sessions.a),
      ),
    ).not.toContain("NO_PUBLICAR");
    await api("retry", { jobId: id }, sessions.a);
    const done = await waitJob(id);
    expect(done.attempt).toBe(2);
    expect(done.token).not.toBe("abandonado");
    await api("publish", { jobId: id, replace: true }, sessions.a);
    expect(
      JSON.stringify(
        await api(
          "results",
          { cutId: "corte-1", courseId: "compartido", careerId: "laf-plan-1" },
          sessions.a,
        ),
      ),
    ).not.toContain("NO_PUBLICAR");
    // Estado sintético de agotamiento: no se reinicia el contador desde el cliente.
    const exhaustedId = "agotado-sintetico";
    await stores()
      .db.doc(`jobs/${exhaustedId}`)
      .set({ ...done, id: exhaustedId, status: "failed", attempt: 3 });
    await expect(
      api("retry", { jobId: exhaustedId }, sessions.a),
    ).rejects.toThrow("FAILED_PRECONDITION");
  });

  it("rechaza límites de lote y contenido que no coincide antes de aceptar el trabajo", async () => {
    const file = {
      ...descriptor("1 Curso compartido 27-1.csv", reportCsv),
      courseId: "compartido",
    };
    for (const files of [
      Array.from({ length: 21 }, () => file),
      Array.from({ length: 6 }, () => ({ ...file, bytes: 8 * 1024 * 1024 })),
    ]) {
      await expect(
        api("createBatch", { cutId: "corte-1", files }, sessions.a),
      ).rejects.toThrow("INVALID_ARGUMENT");
    }
    const result = (await api(
      "createBatch",
      {
        cutId: "corte-1",
        files: [
          { ...file, ...descriptor(file.name, reportCsv.replace(",0", ",6")) },
        ],
      },
      sessions.a,
    )) as { jobs: { id: string }[] };
    const id = result.jobs[0]!.id;
    await expect(
      api(
        "upload",
        { jobId: id, base64: Buffer.from(reportCsv).toString("base64") },
        sessions.a,
      ),
    ).rejects.toThrow("INVALID_ARGUMENT");
    expect((await stores().db.doc(`jobs/${id}`).get()).data()!.status).toBe(
      "awaiting_upload",
    );
    expect(
      (await stores().bucket.file(`originals/${id}/source`).exists())[0],
    ).toBe(false);
  });

  it("un fallo de infraestructura se reintenta automáticamente y termina al tercer intento", async () => {
    const result = (await api(
      "createBatch",
      {
        cutId: "corte-1",
        files: [
          {
            ...descriptor(
              "1 Curso compartido 27-1.csv",
              reportCsv.replace(",0", ",9"),
            ),
            courseId: "compartido",
          },
        ],
      },
      sessions.a,
    )) as { jobs: { id: string }[] };
    const id = result.jobs[0]!.id;
    // Fallo de Storage sintético: evento aceptado sin objeto disponible. Ejecuta el worker real.
    await stores().db.doc(`jobs/${id}`).update({ status: "queued" });
    const failed = await waitJob(id, "failed");
    expect(failed.attempt).toBe(3);
    expect((await stores().db.doc(`publications/${id}`).get()).exists).toBe(
      false,
    );
    await expect(api("retry", { jobId: id }, sessions.a)).rejects.toThrow(
      "FAILED_PRECONDITION",
    );
  });

  it("cerrar durante procesamiento conserva el original y bloquea la confirmación tardía", async () => {
    await api(
      "createCut",
      { cycleId: "27-1", id: "corte-cierre", date: "2026-09-21" },
      sessions.admin,
    );
    const result = (await api(
      "createBatch",
      {
        cutId: "corte-cierre",
        files: [
          {
            ...descriptor("1 Curso compartido 27-1.csv", reportCsv),
            courseId: "compartido",
          },
        ],
      },
      sessions.a,
    )) as { jobs: { id: string }[] };
    const id = result.jobs[0]!.id;
    await stores()
      .bucket.file(`originals/${id}/source`)
      .save(Buffer.from(reportCsv), { resumable: false });
    // Barrera determinista de un worker interrumpido, sin sleeps dependientes de velocidad.
    await stores()
      .db.doc(`jobs/${id}`)
      .update({ status: "processing", attempt: 1, token: "pausado", lease: 0 });
    await api("closeCut", { cutId: "corte-cierre" }, sessions.admin);
    const closed = (await stores().db.doc("cuts/corte-cierre").get()).data();
    await api("closeCut", { cutId: "corte-cierre" }, sessions.admin);
    expect((await stores().db.doc("cuts/corte-cierre").get()).data()).toEqual(
      closed,
    );
    // Redelivery del evento: staging puede terminar, pero nunca activar un corte cerrado.
    await stores().db.doc(`jobs/${id}`).update({ status: "queued" });
    await waitJob(id);
    await expect(
      api("publish", { jobId: id, replace: false }, sessions.a),
    ).rejects.toThrow("FAILED_PRECONDITION");
    expect(
      (await stores().db.doc("cuts/corte-cierre/courses/compartido").get())
        .exists,
    ).toBe(false);
    expect(
      (
        await stores().bucket.file(`originals/${id}/source`).download()
      )[0].toString(),
    ).toBe(reportCsv);
  });

  it("revocación de carreras surte efecto con el mismo token", async () => {
    await api(
      "assignMember",
      {
        uid: people.b,
        member: { role: "coordinator", active: false, careers: ["arq-plan-1"] },
      },
      sessions.admin,
    );
    await expect(
      api(
        "results",
        { cutId: "corte-1", courseId: "compartido", careerId: "arq-plan-1" },
        sessions.b,
      ),
    ).rejects.toThrow("PERMISSION_DENIED");
    await api(
      "assignMember",
      {
        uid: people.b,
        member: { role: "coordinator", active: true, careers: ["arq-plan-1"] },
      },
      sessions.admin,
    );
  });

  it("publica notas inválidas sin perder originales ni exponer la otra carrera; identidad y estructura siguen bloqueadas", async () => {
    const cutId = "corte-notas";
    await api(
      "createCut",
      { cycleId: "27-1", id: cutId, date: "2026-09-21" },
      sessions.admin,
    );
    const mapping = {
      identity: { header: "Correo" },
      columns: ["Numero", "Cero", "Guion", "Vacio", "Texto"].map((header) => ({
        selector: { header },
        kind: "activity",
        activityId: header,
      })),
    };
    const content =
      "Correo,Numero,Cero,Guion,Vacio,Texto\n000SINT01@example.invalid,8,0,-,,texto-A\n000SINT02@example.invalid,7,0,-,,texto-B\n";
    const [job] = await batch(
      sessions.admin,
      [
        {
          name: "1 Curso compartido 27-1.csv",
          content,
          mapping,
          courseId: "compartido",
        },
      ],
      cutId,
    );
    expect((await waitJob(job!.id)).blocking).toBe(false);
    await api("publish", { jobId: job!.id, replace: false }, sessions.admin);
    for (const [session, careerId, own, other, number] of [
      [sessions.a, "laf-plan-1", "A", "B", "8"],
      [sessions.b, "arq-plan-1", "B", "A", "7"],
    ] as const) {
      const input = { cutId, courseId: "compartido", careerId };
      const result = (await api("results", input, session)) as {
        rows: { values: { state: string; raw: unknown }[]; issues: string[] }[];
      };
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.values.map((v) => v.raw)).toEqual([
        number,
        "0",
        "-",
        "",
        `texto-${own}`,
      ]);
      expect(result.rows[0]!.values.map((v) => v.state)).toEqual([
        "numerica",
        "numerica",
        "guion",
        "vacia",
        "invalida",
      ]);
      expect(result.rows[0]!.issues).toContain("calificacion_invalida");
      const preview = await api(
        "preview",
        { jobId: job!.id, careerId },
        session,
      );
      expect(JSON.stringify(preview)).not.toContain(`texto-${other}`);
      const exported = (await api("export", input, session)) as { csv: string };
      expect(exported.csv).toContain(`texto-${own}`);
      expect(exported.csv).toContain("invalida");
      expect(exported.csv).not.toContain(`texto-${other}`);
      expect(JSON.stringify(result)).not.toContain(`texto-${other}`);
    }
    await expect(
      api(
        "export",
        { cutId, courseId: "compartido", careerId: "arq-plan-1" },
        sessions.a,
      ),
    ).rejects.toThrow("PERMISSION_DENIED");
    for (const [bad, status] of [
      ["Correo,Nota\n,8\n", "ready"],
      ["Correo,Nota\n000SINT01@example.invalid,8,extra\n", "invalid"],
    ]) {
      const [invalid] = await batch(
        sessions.a,
        [
          {
            name: "1 Curso compartido 27-1.csv",
            content: bad!,
            mapping: moodleMapping,
            courseId: "compartido",
          },
        ],
        cutId,
      );
      const staged = await waitJob(invalid!.id, status);
      if (status === "ready") expect(staged.blocking).toBe(true);
      await expect(
        api("publish", { jobId: invalid!.id, replace: true }, sessions.a),
      ).rejects.toThrow("FAILED_PRECONDITION");
    }
  });

  it("resuelve un nombre ambiguo con actor real, conserva el rechazo y reenvía sin duplicados", async () => {
    const cutId = "corte-nombre";
    await api(
      "createCut",
      { cycleId: "27-1", id: cutId, date: "2026-09-21" },
      sessions.admin,
    );
    const name = "99 1 Curso compartido 27-1.csv";
    const file = { ...descriptor(name, reportCsv), courseId: "compartido" };
    const create = async (files: unknown[], session = sessions.admin) =>
      (
        (await api("createBatch", { cutId, files }, session)) as {
          jobs: { id: string }[];
        }
      ).jobs[0]!.id;
    const upload = async (jobId: string) =>
      api(
        "upload",
        { jobId, base64: Buffer.from(reportCsv).toString("base64") },
        sessions.admin,
      );
    const rejected = await create([file]);
    await upload(rejected);
    await waitJob(rejected, "invalid");
    const filenameResolution = {
      externalId: "1",
      name: "Curso compartido",
      cycle: "27-1",
      reason: "Instancia contrastada con catálogo sintético",
    };
    const resolved = { ...file, filenameResolution };
    await expect(create([resolved], sessions.a)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    for (const invalid of [
      { externalId: "99" },
      { cycle: "28-1" },
      { approvedBy: people.admin },
      { version: "falsa" },
      { reason: "" },
    ])
      await expect(
        create([
          {
            ...file,
            filenameResolution: { ...filenameResolution, ...invalid },
          },
        ]),
      ).rejects.toThrow("INVALID_ARGUMENT");
    const id = await create([resolved]);
    expect(id).not.toBe(rejected);
    await upload(id);
    const staged = await waitJob(id);
    expect(staged.blocking).toBe(false);
    const preview = (await api("preview", { jobId: id }, sessions.admin)) as {
      filename: unknown;
    };
    expect(preview.filename).toEqual({
      original: name,
      sha256: file.sha256,
      resolution: {
        original: name,
        ...filenameResolution,
        approvedBy: people.admin,
        version: id,
      },
    });
    expect(
      await api("preview", { jobId: id, careerId: "laf-plan-1" }, sessions.a),
    ).toMatchObject({
      filename: null,
    });
    await api("publish", { jobId: id, replace: false }, sessions.admin);
    const pointer = (
      await stores().db.doc(`cuts/${cutId}/courses/compartido`).get()
    ).data();
    expect(await create([resolved])).toBe(id);
    await upload(id);
    await api("publish", { jobId: id, replace: false }, sessions.admin);
    expect(
      (await stores().db.doc(`cuts/${cutId}/courses/compartido`).get()).data(),
    ).toEqual(pointer);
    expect(
      (
        await stores()
          .db.collection("publications")
          .where("cutId", "==", cutId)
          .get()
      ).size,
    ).toBe(1);
    expect(
      (await stores().db.doc(`jobs/${rejected}`).get()).data()!.status,
    ).toBe("invalid");
    for (const jobId of [rejected, id])
      expect(
        (
          await stores().bucket.file(`originals/${jobId}/source`).download()
        )[0].toString(),
      ).toBe(reportCsv);
    const artifact = JSON.parse(
      (
        await stores()
          .bucket.file(staged.artifact as string)
          .download()
      )[0].toString(),
    ) as { filename: unknown };
    expect(artifact.filename).toEqual(
      (preview.filename as { resolution: unknown }).resolution,
    );
  });

  it("fuentes de un corte cerrado no cambian; una corrección crea revisión independiente", async () => {
    const before = (await stores().db.doc("cuts/corte-1").get()).data()!;
    await api("closeCut", { cutId: "corte-1" }, sessions.admin);
    const roster2 = await source(
      sessions.admin,
      "roster",
      rosterCsv.replace("Estudiante A", "Estudiante A corregido"),
      rosterMap,
    );
    expect(
      (await stores().db.doc("cuts/corte-1").get()).data()!.sources,
    ).toEqual(before.sources);
    expect(
      (await stores().db.doc("cycles/27-1").get()).data()!.sources.roster,
    ).toBe(roster2);
    await expect(batch(sessions.a)).rejects.toThrow("FAILED_PRECONDITION");
    await api(
      "createCut",
      {
        cycleId: "27-1",
        id: "revision-1",
        date: "2026-09-21",
        parentId: "corte-1",
        reason: "Corrección sintética autorizada",
      },
      sessions.admin,
    );
    expect(
      (await stores().db.doc("cuts/revision-1").get()).data(),
    ).toMatchObject({
      sources: { roster: roster2 },
      parentId: "corte-1",
      status: "open",
    });
    expect(
      (await stores().db.doc(`sources/${sessions.roster}`).get()).exists,
    ).toBe(true);
    expect(
      (
        await stores()
          .bucket.file(`originals/${sessions.roster}/source`)
          .download()
      )[0].toString(),
    ).toBe(rosterCsv);
  });

  it("admin publica suplementos, bajas y excepciones con auditoría del servidor", async () => {
    const headers = [
      ...Object.keys(rosterMap),
      "replacesId",
      "approvedBy",
      "reason",
    ];
    const map = Object.fromEntries(
      headers.map((header) => [header, { header }]),
    );
    const rosterId = (await stores().db.doc("cycles/27-1").get()).data()!
      .sources.roster;
    const supplement = `${headers.join(",")}\n000SINT01,Estudiante A,laf-plan-1,27-1 LAF 24 02A,Ejecutivo,Vespertino,2026-08-31,${rosterId}:fila:2,otro-actor,Corrección sintética`;
    await source(sessions.admin, "supplement", supplement, map);
    const id = await source(
      sessions.admin,
      "withdrawals",
      JSON.stringify([
        {
          identity: "000SINT02",
          effectiveDate: null,
          confirmedCutId: "futuro",
          version: "falsa",
          approvedBy: "falso",
          reason: "Baja sintética",
        },
      ]),
      {},
      "bajas.json",
    );
    await source(sessions.admin, "exceptions", "[]", {}, "excepciones.json");
    const metadata = (await stores().db.doc(`sources/${id}`).get()).data()!;
    const artifact = JSON.parse(
      (
        await stores()
          .bucket.file(metadata.artifact as string)
          .download()
      )[0].toString(),
    ) as { data: { approvedBy: string; version: string }[] };
    expect(artifact.data[0]).toMatchObject({
      approvedBy: people.admin,
      version: id,
    });
    await expect(
      api(
        "createSource",
        {
          cycleId: "27-1",
          kind: "catalog",
          file: descriptor("catalogo.csv", "x", catalogMap),
        },
        sessions.a,
      ),
    ).rejects.toThrow("PERMISSION_DENIED");
  });
  it("presenta bajas solo a su carrera y conserva docentes exclusivamente en revisión administrativa", async () => {
    await api(
      "createCut",
      { cycleId: "27-1", id: "futuro", date: "2026-09-21" },
      sessions.admin,
    );
    const created = (await api(
      "createBatch",
      {
        cutId: "futuro",
        files: [
          {
            ...descriptor("1 Curso compartido 27-1.csv", reportCsv),
            courseId: "compartido",
          },
        ],
      },
      sessions.admin,
    )) as { jobs: { id: string }[] };
    const jobId = created.jobs[0]!.id;
    await api(
      "upload",
      { jobId, base64: Buffer.from(reportCsv).toString("base64") },
      sessions.admin,
    );
    await waitJob(jobId);
    const a = await api(
      "preview",
      { jobId, careerId: "laf-plan-1" },
      sessions.a,
    );
    const b = (await api(
      "preview",
      { jobId, careerId: "arq-plan-1" },
      sessions.b,
    )) as { rows: unknown[]; excluded: { identity: string; reason: string }[] };
    expect(b.rows).toHaveLength(0);
    expect(b.excluded).toEqual([
      expect.objectContaining({
        identity: "000SINT02@example.invalid",
        reason: "baja",
      }),
    ]);
    expect(JSON.stringify(a)).not.toContain("000SINT02");
    expect(JSON.stringify(b)).not.toContain("000SINT01");
    expect(JSON.stringify(a) + JSON.stringify(b)).not.toContain("tup-d1");
    expect(
      JSON.stringify(await api("preview", { jobId }, sessions.admin)),
    ).toContain("tup-d1");
    await api("publish", { jobId, replace: false }, sessions.admin);
  });

  it("pagina un curso compartido sin filtrar otras carreras ni duplicar filas", async () => {
    await api(
      "createCycle",
      { id: "28-1", dates: { "2026-08-31": "base" } },
      sessions.admin,
    );
    const roster = [
      rosterCsv.split("\n")[0]!,
      ...Array.from(
        { length: 202 },
        (_, i) =>
          `SINT${String(i).padStart(4, "0")},Estudiante sintetico ${i},${i % 2 ? "arq-plan-1,28-1 ARQ 11 01A,Escolarizado,Matutino" : "laf-plan-1,28-1 LAF 24 01A,Ejecutivo,Vespertino"},2026-08-31`,
      ),
    ].join("\n");
    await source(
      sessions.admin,
      "roster",
      roster,
      rosterMap,
      "padron.csv",
      "28-1",
    );
    await source(
      sessions.admin,
      "catalog",
      catalogCsv,
      catalogMap,
      "catalogo.csv",
      "28-1",
    );
    await api(
      "createCourse",
      {
        cycleId: "28-1",
        id: "paginado",
        externalId: "3",
        name: "Compartido paginado",
        careers: ["laf-plan-1", "arq-plan-1"],
      },
      sessions.admin,
    );
    await api(
      "createCut",
      { cycleId: "28-1", id: "corte-paginas", date: "2026-09-21" },
      sessions.admin,
    );
    const content = [
      "Correo,Nota",
      ...Array.from(
        { length: 202 },
        (_, i) =>
          `SINT${String(i).padStart(4, "0")}@example.invalid,${i % 2 ? "-" : "0"}`,
      ),
    ].join("\n");
    const created = (await api(
      "createBatch",
      {
        cutId: "corte-paginas",
        files: [
          {
            ...descriptor("3 Compartido paginado 28-1.csv", content),
            courseId: "paginado",
          },
        ],
      },
      sessions.a,
    )) as { jobs: { id: string }[] };
    const jobId = created.jobs[0]!.id;
    await api(
      "upload",
      { jobId, base64: Buffer.from(content).toString("base64") },
      sessions.a,
    );
    await waitJob(jobId);
    const first = (await api(
      "preview",
      { jobId, careerId: "laf-plan-1" },
      sessions.a,
    )) as { rows: { identity: string; careerId: string }[]; cursor: string };
    const second = (await api(
      "preview",
      { jobId, careerId: "laf-plan-1", cursor: first.cursor },
      sessions.a,
    )) as typeof first;
    expect(first.rows).toHaveLength(100);
    expect(second.rows).toHaveLength(1);
    expect(second.cursor).toBeNull();
    const rows = [...first.rows, ...second.rows];
    expect(new Set(rows.map((r) => r.identity)).size).toBe(101);
    expect(rows.every((r) => r.careerId === "laf-plan-1")).toBe(true);
    await api("publish", { jobId, replace: false }, sessions.a);
    const input = {
      cutId: "corte-paginas",
      courseId: "paginado",
      careerId: "laf-plan-1",
      versionId: jobId,
    };
    const output = (await api("export", input, sessions.a)) as {
      csv: string;
      cursor: string;
    };
    const tail = (await api(
      "export",
      { ...input, cursor: output.cursor },
      sessions.a,
    )) as { csv: string; cursor: null };
    expect(output.csv.split("\r\n")).toHaveLength(101);
    expect(tail.csv.split("\r\n")).toHaveLength(2);
    expect(output.csv + tail.csv).not.toContain("SINT0001@");
  });

  it("las decisiones de base y duplicados se aplican con aprobador real y mantienen los originales", async () => {
    await api(
      "createCycle",
      { id: "29-1", dates: { "2026-08-31": "base" } },
      sessions.admin,
    );
    const roster =
      rosterCsv.replaceAll("27-1", "29-1") +
      "\n" +
      rosterCsv.split("\n")[1]!.replace("27-1", "29-1").replace("01A", "02A");
    const rosterId = await source(
      sessions.admin,
      "roster",
      roster,
      rosterMap,
      "padron.csv",
      "29-1",
    );
    await source(
      sessions.admin,
      "catalog",
      catalogCsv,
      catalogMap,
      "catalogo.csv",
      "29-1",
    );
    const resolution = await source(
      sessions.admin,
      "exceptions",
      JSON.stringify({
        exceptions: [],
        baseResolutions: [
          {
            identity: "000SINT01",
            cutId: "corte-resuelto",
            baseEnrollmentId: `${rosterId}:fila:2`,
            reason: "Base sintética confirmada",
            approvedBy: "falso",
            version: "falsa",
          },
        ],
      }),
      {},
      "decisiones.json",
      "29-1",
    );
    const metadata = (
      await stores().db.doc(`sources/${resolution}`).get()
    ).data()!;
    const artifact = JSON.parse(
      (
        await stores()
          .bucket.file(metadata.artifact as string)
          .download()
      )[0].toString(),
    ) as {
      data: { baseResolutions: { approvedBy: string; version: string }[] };
    };
    expect(artifact.data.baseResolutions[0]).toMatchObject({
      approvedBy: people.admin,
      version: resolution,
    });
    await api(
      "createCourse",
      {
        cycleId: "29-1",
        id: "resolucion",
        externalId: "4",
        name: "Curso resuelto",
        careers: ["laf-plan-1", "arq-plan-1"],
      },
      sessions.admin,
    );
    await api(
      "createCut",
      { cycleId: "29-1", id: "corte-resuelto", date: "2026-09-21" },
      sessions.admin,
    );
    const content = reportCsv + "000SINT01@example.invalid,9\n";
    const mapping = {
      ...moodleMapping,
      resolutions: [
        {
          rows: [2, 5],
          keep: 2,
          identity: { header: "Correo" },
          reason: "Fila confirmada con original",
          approvedBy: "falso",
          version: "falsa",
        },
      ],
    };
    const files = [
      {
        ...descriptor("4 Curso resuelto 29-1.csv", content, mapping),
        courseId: "resolucion",
      },
    ];
    await expect(
      api("createBatch", { cutId: "corte-resuelto", files }, sessions.a),
    ).rejects.toThrow("PERMISSION_DENIED");
    const created = (await api(
      "createBatch",
      { cutId: "corte-resuelto", files },
      sessions.admin,
    )) as { jobs: { id: string }[] };
    const jobId = created.jobs[0]!.id;
    await api(
      "upload",
      { jobId, base64: Buffer.from(content).toString("base64") },
      sessions.admin,
    );
    const done = await waitJob(jobId);
    expect(done.blocking).toBe(false);
    await api("publish", { jobId, replace: false }, sessions.admin);
    expect(
      (
        await stores().bucket.file(`originals/${jobId}/source`).download()
      )[0].toString(),
    ).toBe(content);
    const preview = (await api(
      "preview",
      { jobId, careerId: "laf-plan-1" },
      sessions.a,
    )) as { rows: unknown[] };
    expect(preview.rows).toHaveLength(1);
  });

  it("la herramienta privilegiada asigna el administrador inicial una sola vez", async () => {
    const uid = "bootstrap-sintetico";
    await stores().auth.createUser({ uid, email: `${uid}@example.invalid` });
    const output = execFileSync(
      process.execPath,
      ["scripts/bootstrap-admin.mjs", uid],
      { encoding: "utf8" },
    );
    expect(output).toContain("Administrador inicial asignado en emuladores");
    expect(
      (await stores().db.doc(`memberships/${uid}`).get()).data(),
    ).toMatchObject({ role: "admin", active: true });
    expect(() =>
      execFileSync(
        process.execPath,
        ["scripts/bootstrap-admin.mjs", people.outsider],
        { stdio: "pipe" },
      ),
    ).toThrow();
    expect(
      (await stores().db.doc(`memberships/${people.outsider}`).get()).exists,
    ).toBe(false);
  });
});
