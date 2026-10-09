import { api, accounts, sha, project } from "./cloud-test-session.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const smoke = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(smoke.status, "success");
assert.equal(smoke.sha, sha);
const cutId = smoke.small.cut;
const target = { cutId, courseId: "cloud-mix", student: "000EJE" };
const query = { cutId, filters: {}, view: "institucion", section: "details" };
const out = {
  project,
  sha,
  startedAt: new Date().toISOString(),
  assertions: [],
};
let temporary = false;
try {
  const before = await api("dashboard", query);
  const note = {
    ...target,
    expected: null,
    requestId: "cloud-initial",
    observation: "Observación sintética",
    responsible: "Responsable sintético A",
    contactDate: "2026-10-01",
    nextAction: "Revisar calificación",
    status: "abierto",
  };
  const initial = await api("saveCase", note, "a");
  assert.deepEqual(await api("saveCase", note, "a"), initial);
  const race = await Promise.allSettled(
    ["cloud-edit-a", "cloud-edit-b"].map((requestId) =>
      api(
        "saveCase",
        { ...note, expected: initial.head, requestId, observation: requestId },
        "a",
      ),
    ),
  );
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    String(race.find((r) => r.status === "rejected").reason),
    /ABORTED/,
  );
  let history = await api("caseHistory", target, "a");
  assert.equal(history.rows.length, 2);
  for (let n = 2; n < 26; n++) {
    await api(
      "saveCase",
      {
        ...note,
        expected: history.head,
        requestId: `cloud-edit-${n}`,
        observation: `Registro sintético ${n}`,
      },
      "a",
    );
    history = await api("caseHistory", target, "a");
  }
  assert.equal(history.rows.length, 25);
  assert(history.cursor);
  const next = await api(
    "caseHistory",
    { ...target, cursor: history.cursor },
    "a",
  );
  assert.equal(next.rows.length, 1);
  const exported = await api("exportCase", target, "a");
  assert.equal(exported.csv.split("\r\n").length, 29);
  assert(
    history.rows.every(
      (r) =>
        r.actor === accounts.a.uid &&
        r.contactDate === "2026-10-01" &&
        typeof r.recordedAt === "number",
    ),
  );
  for (const [op, input] of [
    ["caseById", { id: history.id, cursor: history.cursor }],
    ["exportCase", target],
    ["saveCase", { ...note, requestId: "cross" }],
  ])
    await assert.rejects(api(op, input, "b"), /NOT_FOUND|PERMISSION_DENIED/);
  assert.deepEqual((await api("dashboard", query)).counts, before.counts);
  out.assertions.push(
    "Bitácora: idempotencia, concurrencia, 26 revisiones/25+1 paginadas, exportación, autor y fecha de contacto; aislamiento por ID y sin alterar fotografía",
  );
  await api("assignMember", {
    uid: accounts.outsider.uid,
    member: { role: "coordinator", active: true, careers: ["laf-plan-1"] },
  });
  temporary = true;
  const historical = await api("dashboard", query, "outsider");
  assert.equal(historical.counts.D, 5);
  await api("caseById", { id: history.id }, "outsider");
  await api("assignMember", {
    uid: accounts.outsider.uid,
    member: { role: "coordinator", active: true, careers: ["arq-plan-1"] },
  });
  for (const [op, input] of [
    ["caseById", { id: history.id, cursor: history.cursor }],
    ["exportCase", target],
    ["dashboard", { ...query, filters: { careerId: "laf-plan-1" } }],
    [
      "exportDashboard",
      {
        ...query,
        filters: { careerId: "laf-plan-1" },
        snapshotId: historical.snapshotId,
      },
    ],
  ])
    await assert.rejects(
      api(op, input, "outsider"),
      /NOT_FOUND|PERMISSION_DENIED/,
    );
  assert.equal((await api("dashboard", query, "outsider")).counts.D, 2);
  out.assertions.push(
    "Revocación histórica vigente en servidor usando el mismo token: ID, paginación y exportación denegados; nuevo ámbito D2",
  );
  const revision = `cloud-correction-${Date.now()}`;
  await api("createCut", {
    id: revision,
    cycleId: "27-1",
    parentId: cutId,
    progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 },
    reason: "Corrección sintética atribuible sin modificar original",
  });
  await api("closeCut", { cutId: revision });
  assert.deepEqual((await api("dashboard", query)).counts, before.counts);
  out.assertions.push(
    "Revisión de corte atribuible creada/cerrada; original conservado",
  );
  out.status = "success";
} catch (e) {
  out.status = "failure";
  out.error = e.message;
  process.exitCode = 1;
} finally {
  if (temporary)
    await api("assignMember", {
      uid: accounts.outsider.uid,
      member: { role: "coordinator", active: false, careers: [] },
    });
  out.completedAt = new Date().toISOString();
  writeFileSync(
    "private/cloud-history-validation.json",
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out));
}
