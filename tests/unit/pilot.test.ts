import { describe, expect, it } from "vitest";
import { readTable } from "../../src/importing/files";
import { parseMoodle } from "../../src/importing/mapping";
import {
  pilotCourses,
  pilotFile,
  pilotMapping,
} from "../fixtures/synthetic/stage06";

describe("fixture reproducible del piloto", () => {
  for (const [i, format] of ["csv", "xlsx", "ods"].entries()) {
    it(`${format}: conserva cinco estados, docente y originales`, () => {
      const course = pilotCourses(45)[i]!;
      const file = pilotFile(course);
      expect(file.descriptor.name.endsWith(`.${format}`)).toBe(true);
      expect(pilotFile(course).bytes.equals(file.bytes)).toBe(true);
      const table = readTable(file.bytes, file.descriptor.name);
      const parsed = parseMoodle(table, {
        ...pilotMapping,
        version: "sintetica-06",
        approvedBy: "admin-sintetico",
      });
      expect(parsed.accepted).toHaveLength(file.students);
      expect(parsed.teachers).toHaveLength(1);
      expect(parsed.unresolved).toHaveLength(0);
      expect(parsed.accepted[0]!.values.map((v) => v.grade.state)).toEqual([
        "numerica",
        "numerica",
        "guion",
        "vacia",
        "invalida",
      ]);
      expect(Number(parsed.accepted[0]!.values[0]!.grade.raw)).toBe(0);
      expect(parsed.accepted[0]!.values[2]!.grade.raw).toBe("-");
      expect(parsed.accepted[0]!.values[4]!.grade.raw).toBe("INVALIDO");
      const duplicated = pilotFile(course, 0, true);
      const conflict = parseMoodle(
        readTable(duplicated.bytes, duplicated.descriptor.name),
        {
          ...pilotMapping,
          version: "sintetica-06",
          approvedBy: "admin-sintetico",
        },
      );
      expect(conflict.unresolved).toHaveLength(2);
      expect(
        conflict.issues.some((issue) => issue.code === "fila_duplicada"),
      ).toBe(true);
    });
  }
  it("declara universo y lotes sin aumentar límites de importación", () => {
    for (const count of [45, 230]) {
      const courses = pilotCourses(count);
      expect(courses.filter((c) => c.careers.length === 5)).toHaveLength(
        Math.ceil(count / 10),
      );
      const rows = courses.reduce((sum, c) => sum + c.careers.length * 10, 0);
      expect(rows).toBe(count === 45 ? 650 : 3220);
      for (let i = 0; i < count; i += 20)
        expect(courses.slice(i, i + 20).length).toBeLessThanOrEqual(20);
    }
  });
});
