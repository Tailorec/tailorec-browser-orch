import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isWebSocketEndpoint,
  normalizeCdpUrl,
  resolvePlaywrightCdpEndpoint,
} from '../../adapters/utils/cdp.utils.js';

describe('cdp utils', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('detects direct websocket endpoints', () => {
    expect(isWebSocketEndpoint('ws://127.0.0.1:9222/devtools/browser/abc')).toBe(true);
    expect(isWebSocketEndpoint('wss://browser.example.com?token=test-token')).toBe(true);
    expect(isWebSocketEndpoint('http://127.0.0.1:9222')).toBe(false);
  });

  it('normalizes trailing /json/version paths', () => {
    expect(normalizeCdpUrl('http://127.0.0.1:9222/json/version')).toBe('http://127.0.0.1:9222');
    expect(normalizeCdpUrl('wss://browser.example.com/devtools/browser/abc/')).toBe(
      'wss://browser.example.com/devtools/browser/abc',
    );
  });

  it('returns websocket endpoints directly without probing json version', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    await expect(
      resolvePlaywrightCdpEndpoint('wss://browser.example.com?token=test-token'),
    ).resolves.toBe('wss://browser.example.com?token=test-token');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves http endpoints through json version discovery', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser/abc',
      }),
    })) as any;

    await expect(
      resolvePlaywrightCdpEndpoint('https://browser.example.com?token=test-token'),
    ).resolves.toBe('wss://browser.example.com/devtools/browser/abc?token=test-token');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://browser.example.com/json/version?token=test-token',
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
  });
});
