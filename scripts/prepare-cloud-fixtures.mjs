import { createServer } from "vite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Solo importa módulos sintéticos versionados. No importa clientes Firebase ni seedBase.
const root = "private/cloud-synthetic-inputs";
if (existsSync(root))
  throw new Error(
    "El paquete ya existe; conservarlo y revisar su manifest. No se sobrescribe.",
  );
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { trackingPackage } = await server.ssrLoadModule(
    "/tests/fixtures/synthetic/report-tracking.ts",
  );
  const {
    pilotCourses,
    pilotFile,
    pilotMapping,
    pilotStudents,
    pilotCareers,
    pilotAbbreviations,
  } = await server.ssrLoadModule("/tests/fixtures/synthetic/stage06.ts");
  mkdirSync(root, { recursive: true });
  const files = [];
  function save(name, data, details) {
    const bytes = Buffer.from(data);
    const path = join(root, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, bytes, { flag: "wx" });
    files.push({
      file: name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      ...details,
    });
  }
  const p = trackingPackage();
  delete p.schedule.tracking;
  save("small/paquete-sintetico.json", JSON.stringify(p, null, 2), {
    purpose: "academicPackage",
    synthetic: true,
  });
  const filename = "777._Curso_Multimodal_27-1 Calificaciones.csv";
  const header =
    "Dirección Email,Tarea:Actividad | Unidad 1 (Real),Tarea:Actividad | Unidad 2 (Real),Tarea:Actividad | Unidad 3 (Real),Tarea:Actividad | Unidad 4 (Real)";
  save(
    `small/initial/${filename}`,
    `${header}\n000ESC@example.invalid,1,2,3,4\n000EJE@example.invalid,0,2,3,4\n000VIR@example.invalid,1,2,3,4\n000BAJA@example.invalid,9,9,9,9`,
    {
      activities: 4,
      rows: 4,
      expected: { D: 7, N: 7, Z: 1, students: 3 },
      progress: { schoolCut: 1, executiveUnit: 3, virtualUnit: 2 },
    },
  );
  save(`small/update/${filename}`, `${header}\n000EJE@example.invalid,,-,3,4`, {
    rows: 1,
    numericReplacements: 2,
  });
  for (const count of [45, 230]) {
    save(
      `${count}/sources/padron-sintetico.csv`,
      [
        "identity,name,careerId,group,modality,shift,date",
        ...pilotStudents.map(
          (s) =>
            `${s.id},Persona sintetica,${s.careerId},27-6 ${pilotAbbreviations[s.career]} 11 01A,Escolarizado,Matutino,2026-08-31`,
        ),
      ].join("\n"),
      { purpose: "roster", cycleId: "27-6" },
    );
    save(
      `${count}/sources/catalogo-sintetico.csv`,
      [
        "careerId,plan,abbreviation,coordination,kind,architecture",
        ...pilotCareers.map(
          (career, i) =>
            `${career},plan-1,${pilotAbbreviations[i]},coord-${i},carrera,${i === 1}`,
        ),
      ].join("\n"),
      { purpose: "catalog", cycleId: "27-6" },
    );
    const courses = pilotCourses(count);
    for (const [index, course] of courses.entries()) {
      const file = pilotFile(course);
      save(
        `${count}/batch-${Math.floor(index / 20) + 1}/${file.descriptor.name.replace("27-1", "27-6")}`,
        file.bytes,
        {
          course,
          mapping: pilotMapping,
          students: file.students,
          rows: file.students + 1,
          activities: 5,
          cycleId: "27-6",
        },
      );
    }
    const first = courses[0];
    const replacement = pilotFile(first, 1);
    const duplicate = pilotFile(first, 0, true);
    save(
      `${count}/replacement/${replacement.descriptor.name.replace("27-1", "27-6")}`,
      replacement.bytes,
      {
        course: first,
        purpose: "replacement",
        mapping: pilotMapping,
      },
    );
    save(
      `${count}/duplicate-row/${duplicate.descriptor.name.replace("27-1", "27-6")}`,
      duplicate.bytes,
      {
        course: first,
        purpose: "duplicate-row",
        mapping: pilotMapping,
      },
    );
    save(`${count}/invalid/1000 Piloto 27-6.ods`, "INVALIDO SINTETICO", {
      purpose: "invalid",
      course: first,
    });
  }
  writeFileSync(
    join(root, "manifest.json"),
    JSON.stringify(
      {
        synthetic: true,
        uploaded: false,
        batchLimit: 20,
        files,
        note: "Generación local; no hay datos ni mediciones de nube. Sembrar catálogo/padrón por API antes de reportes; ver fixtures stage06 y guía.",
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      directory: root,
      files: files.length,
      bytes: files.reduce((n, f) => n + f.bytes, 0),
      uploaded: false,
    }),
  );
} finally {
  await server.close();
}
