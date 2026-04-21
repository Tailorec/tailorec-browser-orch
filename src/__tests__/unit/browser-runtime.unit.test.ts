import { describe, expect, it, vi } from 'vitest';
import { LocalBrowserRuntimeAdapter } from '../../adapters/browser/local.browser-runtime.adapter.js';
import { RemoteBrowserRuntimeAdapter } from '../../adapters/browser/remote.browser-runtime.adapter.js';

const localProfile = {
  name: 'default',
  provider: 'local' as const,
  browserPort: 9222,
  browserEndpoint: 'http://127.0.0.1:9222',
  browserEndpointIsLoopback: true,
  driver: 'chrome' as const,
  color: 'blue',
};

const remoteProfile = {
  name: 'default',
  provider: 'browserless' as const,
  browserPort: undefined,
  browserEndpoint: 'wss://browser.example.com?token=test-token',
  browserEndpointIsLoopback: false,
  driver: 'chrome' as const,
  color: 'blue',
};

describe('browser runtime adapters', () => {
  it('local runtime checks endpoint availability', async () => {
    const chromeLauncher = {
      isReachable: vi.fn(async () => true),
      launch: vi.fn(),
      getRunning: vi.fn(),
      stop: vi.fn(),
    } as any;

    const runtime = new LocalBrowserRuntimeAdapter(chromeLauncher, { headless: true });

    await expect(runtime.isAvailable(localProfile)).resolves.toBe(true);
    expect(chromeLauncher.isReachable).toHaveBeenCalledWith('http://127.0.0.1:9222', 500);
  });

  it('local runtime launches and releases local chrome processes', async () => {
    const chromeLauncher = {
      isReachable: vi.fn(),
      launch: vi.fn(async () => ({
        pid: 123,
        cdpPort: 9222,
        userDataDir: '/tmp/openclaw-browser-default',
        startedAt: 1000,
      })),
      getRunning: vi.fn(() => ({ pid: 123, cdpPort: 9222 })),
      stop: vi.fn(async () => undefined),
    } as any;

    const runtime = new LocalBrowserRuntimeAdapter(chromeLauncher, { headless: true });
    const running = await runtime.ensureBrowser(localProfile);

    expect(running).toMatchObject({
      provider: 'local',
      pid: 123,
      browserPort: 9222,
    });
    expect(chromeLauncher.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        cdpPort: 9222,
        userDataDir: expect.stringContaining('openclaw-browser-default-9222'),
      }),
    );

    await runtime.releaseBrowser(localProfile, running);
    expect(chromeLauncher.getRunning).toHaveBeenCalledWith(9222);
    expect(chromeLauncher.stop).toHaveBeenCalled();
  });

  it('remote runtime is always available and never launches locally', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sess-123',
          connect: 'wss://browser.example.com/e/sess-123/chromium/playwright',
          stop: 'https://browser.example.com/session/sess-123?token=test-token',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      });
    const runtime = new RemoteBrowserRuntimeAdapter({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(runtime.isAvailable(remoteProfile)).resolves.toBe(true);
    const running = await runtime.ensureBrowser(remoteProfile);
    expect(running).toMatchObject({
      provider: 'browserless',
      browserSessionId: 'sess-123',
      browserEndpoint: 'wss://browser.example.com/e/sess-123/chromium/playwright',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://browser.example.com/session?token=test-token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(runtime.releaseBrowser(remoteProfile, running)).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://browser.example.com/session/sess-123?token=test-token&force=true',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('remote runtime tolerates already-stopped sessions during release', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sess-404',
          connect: 'wss://browser.example.com/e/sess-404/chromium/playwright',
          stop: 'https://browser.example.com/session/sess-404?token=test-token',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found',
      });
    const runtime = new RemoteBrowserRuntimeAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const running = await runtime.ensureBrowser(remoteProfile);
    await expect(runtime.releaseBrowser(remoteProfile, running)).resolves.toBeUndefined();
  });
});
