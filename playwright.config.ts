import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/__tests__/e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  preserveOutput: "always",
  reporter: [["list"], ["html", { open: "never" }]],
});
