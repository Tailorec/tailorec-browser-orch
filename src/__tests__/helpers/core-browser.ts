import { chromium, type LaunchOptions, type Page } from "playwright-core";

export async function withCorePage<T>(
  run: (page: Page) => Promise<T>,
  options: LaunchOptions = { headless: true },
): Promise<T> {
  const browser = await chromium.launch(options);
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    return await run(page);
  } finally {
    await browser.close();
  }
}
