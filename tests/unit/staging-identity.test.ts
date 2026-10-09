import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const helper = resolve("scripts/staging-identity.mjs");
const directory = mkdtempSync(join(tmpdir(), "tracking-sha-test-"));
const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let base: string;
const inspect = (sha: string) =>
  JSON.parse(
    execFileSync(process.execPath, [helper], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, STAGING_RELEASE_SHA: sha },
    }),
  );
beforeAll(() => {
  git("init");
  git("config", "user.email", "synthetic@example.invalid");
  git("config", "user.name", "Synthetic test");
  mkdirSync(join(directory, "src"));
  mkdirSync(join(directory, "docs"));
  writeFileSync(
    join(directory, "src", "app.ts"),
    "export const version = 1;\n",
  );
  git("add", ".");
  git(
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "Synthetic deployed application",
  );
  base = git("rev-parse", "HEAD");
});
afterAll(() => {
  if (
    dirname(directory) !== resolve(tmpdir()) ||
    !basename(directory).startsWith("tracking-sha-test-")
  )
    throw new Error("Directorio temporal inesperado");
  rmSync(directory, { recursive: true, force: true });
});
describe.sequential(
  "trazabilidad entre aplicación desplegada e informe posterior",
  () => {
    it("acepta el SHA exacto y un descendiente que solo añade evidencia", () => {
      expect(inspect(base)).toEqual({ sha: base, revision: base });
      writeFileSync(
        join(directory, "docs", "evidence.md"),
        "Synthetic evidence\n",
      );
      git("add", ".");
      git("-c", "commit.gpgsign=false", "commit", "-m", "Evidence only");
      expect(inspect(base)).toEqual({
        sha: base,
        revision: git("rev-parse", "HEAD"),
      });
    });
    it("rechaza cambios sin commit y un SHA abreviado", () => {
      writeFileSync(
        join(directory, "docs", "evidence.md"),
        "Pending evidence\n",
      );
      expect(() => inspect(base)).toThrow();
      git("add", ".");
      git("-c", "commit.gpgsign=false", "commit", "-m", "More evidence");
      expect(() => inspect(base.slice(0, 7))).toThrow();
    });
    it("rechaza el SHA anterior si cambia código, aunque el árbol esté limpio", () => {
      writeFileSync(
        join(directory, "src", "app.ts"),
        "export const version = 2;\n",
      );
      git("add", ".");
      git("-c", "commit.gpgsign=false", "commit", "-m", "Changed application");
      expect(() => inspect(base)).toThrow();
      const current = git("rev-parse", "HEAD");
      expect(inspect(current)).toEqual({ sha: current, revision: current });
    });
    it("rechaza cambios de scripts de build aunque no cambie src", () => {
      const deployed = git("rev-parse", "HEAD");
      mkdirSync(join(directory, "scripts"));
      writeFileSync(join(directory, "scripts", "build-staging.mjs"), "// changed build\n");
      git("add", ".");
      git("-c", "commit.gpgsign=false", "commit", "-m", "Changed build script");
      expect(() => inspect(deployed)).toThrow();
    });
  },
);
