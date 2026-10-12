import { test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

test("Hosting admite build público y rechaza originales, exportaciones, configuraciones y credenciales", () => {
  const root = mkdtempSync(join(tmpdir(), "seguimiento-public-test-"));
  const run = () =>
    spawnSync(process.execPath, ["scripts/verify-public-build.mjs", root], {
      encoding: "utf8",
    });
  try {
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "index.html"), "<main>Demo sintética</main>");
    writeFileSync(
      join(root, "assets", "index-hash123.js"),
      "console.log('publico')",
    );
    expect(run().status).toBe(0);
    for (const name of [
      "padron.csv",
      "exportacion.json",
      ".env",
      "fuente.ods",
      "fuente.xlsx",
      "archivo.zip",
    ]) {
      const path = join(root, name);
      writeFileSync(path, "SINTETICO");
      expect(run().status).not.toBe(0);
      rmSync(path);
    }
    writeFileSync(
      join(root, "assets", "index-hash123.js"),
      '"type": "service_account"',
    );
    expect(run().status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
