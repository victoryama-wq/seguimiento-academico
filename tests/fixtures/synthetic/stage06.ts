import * as XLSX from "xlsx";
import { createHash } from "node:crypto";

export const pilotCareers = [
  "laf-plan-1",
  "arq-plan-1",
  "sis-plan-1",
  "der-plan-1",
  "adm-plan-1",
];
export const pilotAbbreviations = ["LAF", "ARQ", "SIS", "DER", "ADM"];
export const pilotActivities = ["cero", "numero", "guion", "vacio", "invalido"];
export const pilotMapping = {
  identity: { header: "Correo" },
  columns: pilotActivities.map((activityId) => ({
    selector: { header: activityId },
    kind: "activity",
    activityId,
  })),
};
export const pilotStudents = pilotCareers.flatMap((careerId, career) =>
  Array.from({ length: 10 }, (_, i) => ({
    id: `00PILOTO${career}${String(i).padStart(2, "0")}`,
    careerId,
    career,
  })),
);
export function pilotCourses(count: number) {
  if (![45, 230].includes(count)) throw new Error("Escenario no aprobado");
  return Array.from({ length: count }, (_, i) => ({
    id: `piloto-${i + 1}`,
    externalId: String(1000 + i),
    careers: i % 10 === 0 ? pilotCareers : [pilotCareers[i % 5]!],
    name: `Asignatura sintética ${i + 1}`,
    format: (["csv", "xlsx", "ods"] as const)[i % 3]!,
  }));
}
export function pilotFile(
  course: ReturnType<typeof pilotCourses>[number],
  revision = 0,
  duplicate = false,
) {
  const students = pilotStudents.filter((s) =>
    course.careers.includes(s.careerId),
  );
  const rows: (string | number | null)[][] = [
    ["Correo", ...pilotActivities],
    ...students.map((s) => [
      `${s.id}@example.invalid`,
      0,
      7 + revision,
      "-",
      null,
      "INVALIDO",
    ]),
    ["tup-d9000@example.invalid", 10, 10, 10, 10, 10],
  ];
  if (duplicate) rows.push(rows[1]!);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet(rows),
    "Sintetico",
  );
  const bytes =
    course.format === "csv"
      ? Buffer.from(XLSX.utils.sheet_to_csv(book.Sheets.Sintetico!))
      : Buffer.from(
          XLSX.write(book, {
            type: "buffer",
            bookType: course.format,
            compression: true,
          }),
        );
  return {
    bytes,
    students: students.length,
    descriptor: {
      name: `${course.externalId} Piloto 27-1.${course.format}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      mapping: pilotMapping,
      courseId: course.id,
    },
  };
}
