import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 120_000,
    include: ["tests/integration/*.test.ts"],
    maxWorkers: 1,
    testTimeout: 300_000,
  },
});

