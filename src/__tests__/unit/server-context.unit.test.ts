import { describe, expect, it, vi } from 'vitest';
import { createBrowserRouteContext } from '../../api/context/browser.context.js';

describe('createBrowserRouteContext', () => {
  it('reuses an existing tab when targetId is omitted', async () => {
    const focusPage = vi.fn(async () => undefined);
    const ctx = createBrowserRouteContext({
      getState: () => ({
        server: {} as any,
        port: 4000,
        configuredProfiles: new Map([
          [
            'default',
            {
              name: 'default',
              cdpPort: 9222,
              cdpUrl: 'http://127.0.0.1:9222',
              cdpIsLoopback: true,
              driver: 'chrome',
              color: 'blue',
            },
          ],
        ]),
        profiles: new Map([
          [
            'default',
            {
              name: 'default',
              config: {
                name: 'default',
                cdpPort: 9222,
                cdpUrl: 'http://127.0.0.1:9222',
                cdpIsLoopback: true,
                driver: 'chrome',
                color: 'blue',
              },
              chrome: {
                pid: 1,
                userDataDir: '/tmp/chrome',
                cdpPort: 9222,
                startedAt: Date.now(),
              },
            },
          ],
        ]),
      }),
      isChromeReachable: vi.fn(async () => true),
      launchChrome: vi.fn(async () => {
        throw new Error('should not launch');
      }),
      stopChrome: vi.fn(async () => undefined),
      listPages: vi.fn(async () => [{ targetId: 'tab-1', url: 'https://example.test' }]),
      focusPage,
      createPage: vi.fn(async () => ({ targetId: 'new-tab', url: 'about:blank' })),
    });

    const result = await ctx.forProfile('default').ensureTabAvailable();

    expect(result).toEqual({ targetId: 'tab-1', url: 'https://example.test' });
    expect(focusPage).toHaveBeenCalledWith('http://127.0.0.1:9222', 'tab-1');
  });

  it('launches chrome when the profile is not running and maps common tab errors', async () => {
    const launchChrome = vi.fn(async () => ({
      pid: 2,
      userDataDir: '/tmp/chrome-2',
      cdpPort: 9223,
      startedAt: Date.now(),
    }));

    const ctx = createBrowserRouteContext({
      getState: () => ({
        server: {} as any,
        port: 4000,
        configuredProfiles: new Map([
          [
            'default',
            {
              name: 'default',
              cdpPort: 9223,
              cdpUrl: 'http://127.0.0.1:9223',
              cdpIsLoopback: true,
              driver: 'chrome',
              color: 'blue',
            },
          ],
        ]),
        profiles: new Map(),
      }),
      isChromeReachable: vi.fn(async () => false),
      launchChrome,
      stopChrome: vi.fn(async () => undefined),
      listPages: vi.fn(async () => []),
      focusPage: vi.fn(async () => undefined),
      createPage: vi.fn(async () => ({ targetId: 'tab-2', url: 'about:blank' })),
    });

    const result = await ctx.forProfile('default').ensureTabAvailable();
    expect(result).toEqual({ targetId: 'tab-2', url: 'about:blank' });
    expect(launchChrome).toHaveBeenCalled();

    expect(ctx.mapTabError(new Error('TimeoutError while clicking'))).toEqual({
      status: 408,
      message: 'Browser action timed out',
    });
    expect(ctx.mapTabError(new Error('Target closed'))).toEqual({
      status: 404,
      message: 'Tab not found or closed',
    });
  });
});
