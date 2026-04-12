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
    const runtime = new RemoteBrowserRuntimeAdapter();

    await expect(runtime.isAvailable(remoteProfile)).resolves.toBe(true);
    await expect(runtime.ensureBrowser(remoteProfile)).resolves.toMatchObject({
      provider: 'browserless',
    });
    await expect(runtime.releaseBrowser(remoteProfile)).resolves.toBeUndefined();
  });
});
