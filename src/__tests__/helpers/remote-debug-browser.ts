import { chromium } from "playwright";

export async function withRemoteDebugBrowser<T>(
  run: (cdpUrl: string) => Promise<T>,
  port = 9223,
): Promise<T> {
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${port}`],
  });

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await browser.close();
  }
}
