import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/emulators/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
