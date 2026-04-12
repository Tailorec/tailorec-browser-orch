import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserRouteContext } from '../../api/context/browser.context.js';

function createContext(
  overrides: Partial<Parameters<typeof createBrowserRouteContext>[0]> = {},
  profileOverrides: Record<string, unknown> = {},
) {
  const state = {
    server: {} as any,
    port: 4000,
    configuredProfiles: new Map([
      [
        'default',
        {
          name: 'default',
          provider: 'local' as const,
          browserPort: 9222,
          browserEndpoint: 'http://127.0.0.1:9222',
          browserEndpointIsLoopback: true,
          driver: 'chrome' as const,
          color: 'blue',
          ...profileOverrides,
        },
      ],
    ]),
    profiles: new Map<string, any>(),
    runSessions: new Map<string, any>(),
    targetOwners: new Map<string, string>(),
  };

  const deps = {
    getState: vi.fn(() => state),
    isBrowserAvailable: vi.fn(async () => true),
    ensureBrowser: vi.fn(async () => ({
      provider: 'local' as const,
      pid: 1,
      userDataDir: '/tmp/chrome',
      browserPort: 9222,
      startedAt: Date.now(),
    })),
    releaseBrowser: vi.fn(async () => undefined),
    listPages: vi.fn(async () => [{ targetId: 'tab-1', url: 'https://example.test' }]),
    focusPage: vi.fn(async () => undefined),
    createPage: vi.fn(async () => ({ targetId: 'new-tab', url: 'about:blank' })),
    ...overrides,
  };

  return { state, deps, ctx: createBrowserRouteContext(deps) };
}

describe('createBrowserRouteContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('state()', () => {
    it('returns state when server is started', () => {
      const { ctx, state } = createContext();
      expect(ctx.state()).toBe(state);
    });

    it('throws when server is not started', () => {
      const { ctx } = createContext({ getState: vi.fn(() => null) });
      expect(() => ctx.state()).toThrow('Server not started');
    });
  });

  describe('forProfile()', () => {
    it('throws when server is not started', () => {
      const { ctx } = createContext({ getState: vi.fn(() => null) });
      expect(() => ctx.forProfile('default')).toThrow('Server not started');
    });

    it('throws for unknown profile', () => {
      const { ctx } = createContext();
      expect(() => ctx.forProfile('unknown')).toThrow('Profile unknown not found');
    });

    it('returns the configured profile context', () => {
      const { ctx } = createContext();
      const profileCtx = ctx.forProfile('default');
      expect(profileCtx.profile.name).toBe('default');
      expect(profileCtx.profile.browserPort).toBe(9222);
    });

    it('fails fast when targetId is omitted for an existing browser session', async () => {
      const { ctx, state } = createContext();
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      await expect(ctx.forProfile('default').ensureTabAvailable('run-1')).rejects.toThrow(
        'targetId is required. Call navigate first to create a browser session.',
      );
    });

    it('creates a new tab when explicitly requested without a targetId', async () => {
      const { ctx, deps, state } = createContext();
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });

      expect(result).toEqual({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.createPage).toHaveBeenCalledWith('http://127.0.0.1:9222');
      expect(deps.focusPage).not.toHaveBeenCalled();
    });

    it('focuses the current tab when explicitly requested without a targetId', async () => {
      const { ctx, deps, state } = createContext({
        listPages: vi.fn(async () => [
          { targetId: 'tab-other', url: 'https://other.test' },
          { targetId: 'tab-current', url: 'https://current.test' },
        ]),
      });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });
      state.runSessions.set('run-1', { runId: 'run-1', profileName: 'default', activeTargetId: 'tab-current' });
      state.targetOwners.set('tab-current', 'run-1');

      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { useCurrentTab: true });

      expect(result).toEqual({ targetId: 'tab-current', url: 'https://current.test' });
      expect(deps.focusPage).toHaveBeenCalledWith('http://127.0.0.1:9222', 'tab-current');
      expect(deps.createPage).not.toHaveBeenCalled();
    });

    it('focuses an existing requested targetId', async () => {
      const { ctx, deps, state } = createContext({
        listPages: vi.fn(async () => [
          { targetId: 'tab-1', url: 'https://example.test' },
          { targetId: 'tab-2', url: 'https://example.org' },
        ]),
      });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      state.targetOwners.set('tab-2', 'run-1');
      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', 'tab-2');
      expect(result).toEqual({ targetId: 'tab-2', url: 'https://example.org' });
      expect(deps.focusPage).toHaveBeenCalledWith('http://127.0.0.1:9222', 'tab-2');
    });

    it('creates a new page when navigate requests a fresh browser session', async () => {
      const { ctx, deps, state } = createContext({ listPages: vi.fn(async () => []) });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });
      expect(result).toEqual({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.releaseBrowser).toHaveBeenCalled();
      expect(deps.createPage).toHaveBeenCalledWith('http://127.0.0.1:9222');
    });

    it('ensures a local browser when navigate creates a fresh session', async () => {
      const { ctx, deps } = createContext({ isBrowserAvailable: vi.fn(async () => false), listPages: vi.fn(async () => []) });
      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });
      expect(result).toEqual({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.ensureBrowser).toHaveBeenCalled();
    });

    it('releases stale local runtime when navigate creates a fresh session', async () => {
      const { ctx, deps, state } = createContext({ isBrowserAvailable: vi.fn(async () => false), listPages: vi.fn(async () => []) });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });
      expect(deps.releaseBrowser).toHaveBeenCalled();
      expect(deps.ensureBrowser).toHaveBeenCalled();
    });

    it('does not treat remote profiles as locally launched browsers when navigate creates a fresh session', async () => {
      const { ctx, deps } = createContext(
        {
          isBrowserAvailable: vi.fn(async () => true),
          ensureBrowser: vi.fn(async () => ({
            provider: 'browserless' as const,
            startedAt: Date.now(),
          })),
        },
        {
          provider: 'browserless',
          browserPort: undefined,
          browserEndpoint: 'wss://browser.example.com?token=test-token',
          browserEndpointIsLoopback: false,
        },
      );

      await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });
      expect(deps.ensureBrowser).toHaveBeenCalled();
      expect(deps.createPage).toHaveBeenCalledWith('wss://browser.example.com?token=test-token');
    });

    it('retries after a connection refused error while resolving a target', async () => {
      const listPages = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce([{ targetId: 'tab-1', url: 'https://example.test' }]);
      const { ctx, deps, state } = createContext({ listPages });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      state.targetOwners.set('tab-1', 'run-1');
      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', 'tab-1');
      expect(result).toEqual({ targetId: 'tab-1', url: 'https://example.test' });
      expect(deps.listPages).toHaveBeenCalledTimes(2);
    });

    it('stopRunningBrowser releases the active runtime', async () => {
      const { ctx, deps, state } = createContext();
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      await ctx.forProfile('default').stopRunningBrowser();
      expect(deps.releaseBrowser).toHaveBeenCalled();
      expect(state.profiles.get('default')?.runtime).toBeUndefined();
    });
  });

  describe('mapTabError()', () => {
    it('maps tab not found errors to 404', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError(new Error('tab not found'))).toEqual({
        status: 404,
        message: 'Tab not found or closed',
      });
    });

    it('maps target closed errors to 404', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError(new Error('Target closed'))).toEqual({
        status: 404,
        message: 'Tab not found or closed',
      });
    });

    it('maps ECONNREFUSED errors to 503', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError(new Error('ECONNREFUSED'))).toEqual({
        status: 503,
        message: 'Browser endpoint unavailable. Retry in a few seconds.',
      });
    });

    it('maps stale reference errors to 409', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError(new Error('Element not found or not visible'))).toEqual({
        status: 409,
        message: 'Reference became stale after page update. Take a new snapshot and retry.',
      });
    });

    it('maps snapshot refresh errors to 409', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError(new Error('Run a new snapshot to see current page elements'))).toEqual({
        status: 409,
        message: 'Reference became stale after page update. Take a new snapshot and retry.',
      });
    });

    it('maps timeout errors to 408', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError(new Error('Timeout 5000ms'))).toEqual({
        status: 408,
        message: 'Browser action timed out',
      });
    });

    it('returns null for unmapped errors', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError(new Error('Some other error'))).toBeNull();
    });

    it('returns null for non-Error values', () => {
      const { ctx } = createContext();
      expect(ctx.mapTabError('string error')).toBeNull();
    });
  });
});
