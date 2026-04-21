import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaywrightBrowserDriverAdapter } from '../../adapters/playwright/playwright.browser-driver.adapter.js';

describe('PlaywrightBrowserDriverAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('does not use json list url fallback for target lookup', async () => {
    const adapter = new PlaywrightBrowserDriverAdapter();
    const page = {
      url: vi.fn(() => 'https://example.test'),
      context: vi.fn(() => ({
        newCDPSession: vi.fn(async () => ({
          send: vi.fn(async () => ({ targetInfo: { targetId: 'other-target' } })),
          detach: vi.fn(async () => undefined),
        })),
      })),
    };
    const browser = {
      contexts: vi.fn(() => [{ pages: vi.fn(() => [page]) }]),
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: 'target-1', url: 'https://example.test' }],
    })) as any;

    const found = await (adapter as any).findPageByTargetId(
      browser,
      'target-1',
      'wss://browser.example.com?token=test-token',
    );

    expect(found).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
