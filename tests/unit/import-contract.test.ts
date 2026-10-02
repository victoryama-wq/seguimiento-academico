import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  descriptorSchema,
  operationSchemas,
} from "../../src/domain/import-contract";

const file = {
  name: "1 Curso 27-1.csv",
  sha256: "a".repeat(64),
  bytes: 8 * 1024 * 1024,
  mapping: {},
  courseId: "curso",
};
describe("fronteras de la importación persistente", () => {
  it("acepta el límite de 40 MiB y rechaza un byte adicional y más de veinte archivos", () => {
    const files = Array.from({ length: 5 }, () => ({ ...file }));
    expect(
      operationSchemas.createBatch.safeParse({ cutId: "corte", files }).success,
    ).toBe(true);
    expect(
      operationSchemas.createBatch.safeParse({
        cutId: "corte",
        files: [...files, { ...file, bytes: 1 }],
      }).success,
    ).toBe(false);
    expect(
      operationSchemas.createBatch.safeParse({
        cutId: "corte",
        files: Array.from({ length: 21 }, () => ({ ...file, bytes: 1 })),
      }).success,
    ).toBe(false);
  });
  it("rechaza rutas, metadatos extra, hashes y bytes no válidos", () => {
    const descriptor = {
      name: file.name,
      sha256: file.sha256,
      bytes: file.bytes,
      mapping: file.mapping,
    };
    expect(
      descriptorSchema.parse({ ...descriptor, name: " nombre original.csv " })
        .name,
    ).toBe(" nombre original.csv ");
    for (const extra of [
      { bytes: 0 },
      { bytes: file.bytes + 1 },
      { sha256: "inventado" },
      { role: "admin" },
    ])
      expect(
        descriptorSchema.safeParse({ ...descriptor, ...extra }).success,
      ).toBe(false);
    expect(
      operationSchemas.original.safeParse({ jobId: "../originals" }).success,
    ).toBe(false);
    expect(
      operationSchemas.assignMember.safeParse({
        uid: "alguien",
        member: { role: "superadmin", active: true, careers: [] },
      }).success,
    ).toBe(false);
  });
  it("la herramienta privilegiada falla antes de acceder a un proyecto real", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/bootstrap-admin.mjs", "admin-sintetico"],
      {
        env: { ...process.env, GCLOUD_PROJECT: "real-no-autorizado" },
        encoding: "utf8",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Solo emuladores demo explícitos");
    expect(result.stdout).not.toContain("asignado");
  });
});
