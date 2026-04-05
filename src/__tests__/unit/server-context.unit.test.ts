import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserRouteContext } from '../../api/context/browser.context.js';

function createContext(overrides: Partial<Parameters<typeof createBrowserRouteContext>[0]> = {}) {
  const state = {
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
          driver: 'chrome' as const,
          color: 'blue',
        },
      ],
    ]),
    profiles: new Map<string, any>(),
  };

  const deps = {
    getState: vi.fn(() => state),
    isChromeReachable: vi.fn(async () => true),
    launchChrome: vi.fn(async () => ({
      pid: 1,
      userDataDir: '/tmp/chrome',
      cdpPort: 9222,
      startedAt: Date.now(),
    })),
    stopChrome: vi.fn(async () => undefined),
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
      expect(profileCtx.profile.cdpPort).toBe(9222);
    });

    it('reuses an existing tab when targetId is omitted', async () => {
      const { ctx, deps, state } = createContext();
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        chrome: { pid: 1, userDataDir: '/tmp/chrome', cdpPort: 9222, startedAt: Date.now() },
      });

      const result = await ctx.forProfile('default').ensureTabAvailable();

      expect(result).toEqual({ targetId: 'tab-1', url: 'https://example.test' });
      expect(deps.focusPage).toHaveBeenCalledWith('http://127.0.0.1:9222', 'tab-1');
      expect(deps.createPage).not.toHaveBeenCalled();
    });

    it('creates a new tab when explicitly requested without a targetId', async () => {
      const { ctx, deps, state } = createContext();
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        chrome: { pid: 1, userDataDir: '/tmp/chrome', cdpPort: 9222, startedAt: Date.now() },
      });

      const result = await ctx.forProfile('default').ensureTabAvailable(undefined, { createNewTab: true });

      expect(result).toEqual({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.createPage).toHaveBeenCalledWith('http://127.0.0.1:9222');
      expect(deps.focusPage).not.toHaveBeenCalled();
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
        chrome: { pid: 1, userDataDir: '/tmp/chrome', cdpPort: 9222, startedAt: Date.now() },
      });

      const result = await ctx.forProfile('default').ensureTabAvailable('tab-2');
      expect(result).toEqual({ targetId: 'tab-2', url: 'https://example.org' });
      expect(deps.focusPage).toHaveBeenCalledWith('http://127.0.0.1:9222', 'tab-2');
    });

    it('creates a new page when none exist', async () => {
      const { ctx, deps, state } = createContext({ listPages: vi.fn(async () => []) });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        chrome: { pid: 1, userDataDir: '/tmp/chrome', cdpPort: 9222, startedAt: Date.now() },
      });

      const result = await ctx.forProfile('default').ensureTabAvailable();
      expect(result).toEqual({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.createPage).toHaveBeenCalledWith('http://127.0.0.1:9222');
    });

    it('launches chrome when the profile is not running', async () => {
      const { ctx, deps } = createContext({ isChromeReachable: vi.fn(async () => false), listPages: vi.fn(async () => []) });
      const result = await ctx.forProfile('default').ensureTabAvailable();
      expect(result).toEqual({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.launchChrome).toHaveBeenCalled();
    });

    it('stops stale chrome when a running profile is unreachable', async () => {
      const { ctx, deps, state } = createContext({ isChromeReachable: vi.fn(async () => false), listPages: vi.fn(async () => []) });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        chrome: { pid: 1, userDataDir: '/tmp/chrome', cdpPort: 9222, startedAt: Date.now() },
      });

      await ctx.forProfile('default').ensureTabAvailable();
      expect(deps.stopChrome).toHaveBeenCalled();
      expect(deps.launchChrome).toHaveBeenCalled();
    });

    it('retries after a connection refused error', async () => {
      const listPages = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce([{ targetId: 'tab-1', url: 'https://example.test' }]);
      const { ctx, deps, state } = createContext({ listPages });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        chrome: { pid: 1, userDataDir: '/tmp/chrome', cdpPort: 9222, startedAt: Date.now() },
      });

      const result = await ctx.forProfile('default').ensureTabAvailable();
      expect(result).toEqual({ targetId: 'tab-1', url: 'https://example.test' });
      expect(deps.listPages).toHaveBeenCalledTimes(2);
    });

    it('stopRunningBrowser stops the active chrome instance', async () => {
      const { ctx, deps, state } = createContext();
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        chrome: { pid: 1, userDataDir: '/tmp/chrome', cdpPort: 9222, startedAt: Date.now() },
      });

      await ctx.forProfile('default').stopRunningBrowser();
      expect(deps.stopChrome).toHaveBeenCalled();
      expect(state.profiles.get('default')?.chrome).toBeUndefined();
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
        message: 'Browser CDP unavailable. Retry in a few seconds.',
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
