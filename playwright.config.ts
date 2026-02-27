import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/__tests__/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    headless: true,
  },
});
