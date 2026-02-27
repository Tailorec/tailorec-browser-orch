import { defineConfig } from "vitest/config";

const phase = Number(process.env.COVERAGE_PHASE || "1");

const coverageThresholds =
  phase >= 3
    ? { lines: 70, statements: 70, functions: 70, branches: 70 }
    : phase === 2
      ? { lines: 50, statements: 50, functions: 65, branches: 70 }
      : { lines: 35, statements: 35, functions: 60, branches: 65 };

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
      thresholds: coverageThresholds,
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
