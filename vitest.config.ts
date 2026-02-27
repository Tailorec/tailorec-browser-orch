import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/__tests__/**",
        "dist/**",
        // bootstrap / type-only / compatibility stubs (not production logic)
        "src/server.ts",
        "src/browser/client-actions-core.ts",
        "src/browser/client-actions-types.ts",
        "src/browser/routes/types.ts",
        "src/browser/control-service.ts",
        "src/browser/routes/dispatcher.ts",
      ],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/__tests__/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/__tests__/integration/**/*.test.ts"],
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "contract",
          include: ["src/__tests__/contract/**/*.test.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
