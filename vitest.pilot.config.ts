import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/pilot/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
    fileParallelism: false,
    testTimeout: 1_200_000,
    hookTimeout: 30_000,
  },
});
