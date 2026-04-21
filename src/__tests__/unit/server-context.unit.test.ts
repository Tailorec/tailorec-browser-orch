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
      await ctx.forProfile('default').ensureRunSession('run-1');

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
      await ctx.forProfile('default').ensureRunSession('run-1');

      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });

      expect(result).toMatchObject({ targetId: 'new-tab', url: 'about:blank' });
      expect(result.browserEndpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(deps.createPage).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/));
      expect(deps.focusPage).not.toHaveBeenCalled();
    });

    it('focuses the current tab when explicitly requested without a targetId', async () => {
      const { ctx, deps, state } = createContext({
        listPages: vi.fn(async () => [{ targetId: 'tab-current', url: 'https://current.test' }]),
      });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });
      state.runSessions.set('run-1', {
        runId: 'run-1',
        profileName: 'default',
        activeTargetId: 'tab-current',
        browserEndpoint: 'http://127.0.0.1:9222',
        runtimeProfile: state.configuredProfiles.get('default'),
      });
      state.targetOwners.set('tab-current', 'run-1');

      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { useCurrentTab: true });

      expect(result).toMatchObject({ targetId: 'tab-current', url: 'https://current.test' });
      expect(deps.focusPage).toHaveBeenCalledWith('http://127.0.0.1:9222', 'tab-current');
      expect(deps.createPage).not.toHaveBeenCalled();
    });

    it('focuses an existing requested targetId', async () => {
      const { ctx, deps, state } = createContext({
        listPages: vi.fn(async () => [{ targetId: 'tab-2', url: 'https://example.org' }]),
      });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      state.targetOwners.set('tab-2', 'run-1');
      await ctx.forProfile('default').ensureRunSession('run-1');
      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', 'tab-2');
      expect(result).toMatchObject({ targetId: 'tab-2', url: 'https://example.org' });
      expect(deps.focusPage).toHaveBeenCalledWith(result.browserEndpoint, 'tab-2');
    });

    it('rejects unsupported multi-tab flow for existing target', async () => {
      const { ctx, state } = createContext({
        listPages: vi.fn(async () => [
          { targetId: 'tab-2', url: 'https://example.org' },
          { targetId: 'popup-1', url: 'https://popup.example' },
        ]),
      });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });
      state.targetOwners.set('tab-2', 'run-1');
      await ctx.forProfile('default').ensureRunSession('run-1');

      await expect(ctx.forProfile('default').ensureTabAvailable('run-1', 'tab-2')).rejects.toMatchObject({
        status: 409,
        code: 'unsupported_flow',
      });
    });

    it('creates a new page when navigate requests a fresh browser session', async () => {
      const { ctx, deps, state } = createContext({ listPages: vi.fn(async () => []) });
      state.profiles.set('default', {
        name: 'default',
        config: state.configuredProfiles.get('default'),
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });
      await ctx.forProfile('default').ensureRunSession('run-1');

      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });
      expect(result).toMatchObject({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.createPage).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/));
    });

    it('ensures a local browser when navigate creates a fresh session', async () => {
      const { ctx, deps } = createContext({ isBrowserAvailable: vi.fn(async () => false), listPages: vi.fn(async () => []) });
      await ctx.forProfile('default').ensureRunSession('run-1');
      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true });
      expect(result).toMatchObject({ targetId: 'new-tab', url: 'about:blank' });
      expect(deps.ensureBrowser).toHaveBeenCalled();
    });

    it('releases stale local runtime when navigate creates a fresh session', async () => {
      const { ctx, deps, state } = createContext({ isBrowserAvailable: vi.fn(async () => false), listPages: vi.fn(async () => []) });
      const runtimeProfile = state.configuredProfiles.get('default');
      state.runSessions.set('run-1', {
        runId: 'run-1',
        profileName: 'default',
        browserEndpoint: 'http://127.0.0.1:9222',
        runtimeProfile,
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

      await ctx.forProfile('default').ensureRunSession('run-1');
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
      await ctx.forProfile('default').ensureRunSession('run-1');
      const result = await ctx.forProfile('default').ensureTabAvailable('run-1', 'tab-1');
      expect(result).toMatchObject({ targetId: 'tab-1', url: 'https://example.test' });
      expect(deps.listPages).toHaveBeenCalledTimes(2);
    });

    it('stopRunningBrowser releases the active runtime', async () => {
      const { ctx, deps, state } = createContext();
      const runtimeProfile = state.configuredProfiles.get('default');
      state.runSessions.set('run-1', {
        runId: 'run-1',
        profileName: 'default',
        browserEndpoint: 'http://127.0.0.1:9222',
        runtimeProfile,
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome', browserPort: 9222, startedAt: Date.now() },
      });

      await ctx.forProfile('default').stopRunningBrowser();
      expect(deps.releaseBrowser).toHaveBeenCalled();
      expect(state.runSessions.get('run-1')?.runtime).toBeUndefined();
    });

    it('enforces local browser max sessions (5)', async () => {
      const { ctx, state } = createContext({ listPages: vi.fn(async () => []) });
      const runtimeProfile = state.configuredProfiles.get('default');
      for (let i = 1; i <= 5; i += 1) {
        state.runSessions.set(`run-${i}`, {
          runId: `run-${i}`,
          profileName: 'default',
          browserEndpoint: `http://127.0.0.1:${9200 + i}`,
          runtimeProfile,
          runtime: { provider: 'local', pid: i, userDataDir: `/tmp/chrome-${i}`, browserPort: 9200 + i, startedAt: Date.now() },
        });
      }

      await expect(ctx.forProfile('default').ensureRunSession('run-overflow')).rejects.toThrow(
        'local browser capacity exceeded',
      );
    });

    it('counts local capacity across profiles', async () => {
      const { ctx, state } = createContext({ listPages: vi.fn(async () => []) });
      const runtimeProfile = state.configuredProfiles.get('default');
      for (let i = 1; i <= 5; i += 1) {
        state.runSessions.set(`run-${i}`, {
          runId: `run-${i}`,
          profileName: `profile-${i}`,
          browserEndpoint: `http://127.0.0.1:${9200 + i}`,
          runtimeProfile,
          runtime: { provider: 'local', pid: i, userDataDir: `/tmp/chrome-${i}`, browserPort: 9200 + i, startedAt: Date.now() },
        });
      }

      await expect(ctx.forProfile('default').ensureRunSession('run-overflow')).rejects.toThrow(
        'local browser capacity exceeded',
      );
    });

    it('enforces browserless max sessions (20)', async () => {
      const { ctx, state } = createContext(
        { listPages: vi.fn(async () => []) },
        {
          provider: 'browserless',
          browserPort: undefined,
          browserEndpoint: 'wss://browser.example.com?token=test-token',
          browserEndpointIsLoopback: false,
        },
      );
      const runtimeProfile = state.configuredProfiles.get('default');
      for (let i = 1; i <= 20; i += 1) {
        state.runSessions.set(`run-${i}`, {
          runId: `run-${i}`,
          profileName: 'default',
          browserEndpoint: `wss://browser.example.com?session=${i}`,
          runtimeProfile,
          runtime: { provider: 'browserless', startedAt: Date.now() },
        });
      }

      await expect(ctx.forProfile('default').ensureRunSession('run-overflow')).rejects.toThrow(
        'browserless capacity exceeded',
      );
    });

    it('enforces global browser max sessions (200)', async () => {
      const { ctx, state } = createContext({ listPages: vi.fn(async () => []) });
      const runtimeProfile = state.configuredProfiles.get('default');
      for (let i = 1; i <= 200; i += 1) {
        state.runSessions.set(`run-${i}`, {
          runId: `run-${i}`,
          profileName: `profile-${i}`,
          browserEndpoint: `http://127.0.0.1:${9200 + i}`,
          runtimeProfile,
          runtime: {
            provider: 'local',
            pid: i,
            userDataDir: `/tmp/chrome-${i}`,
            browserPort: 9200 + i,
            startedAt: Date.now(),
          },
        });
      }

      await expect(ctx.forProfile('default').ensureRunSession('run-overflow')).rejects.toThrow(
        'global browser capacity exceeded',
      );
    });

    it('serializes concurrent create requests for the same run', async () => {
      let createCount = 0;
      const { ctx, deps } = createContext({
        listPages: vi.fn(async () => []),
        createPage: vi.fn(async () => {
          createCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { targetId: 'new-tab', url: 'about:blank' };
        }),
      });
      await ctx.forProfile('default').ensureRunSession('run-1');

      const [first, second] = await Promise.all([
        ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true }),
        ctx.forProfile('default').ensureTabAvailable('run-1', undefined, { createNewTab: true }),
      ]);

      expect(first.targetId).toBe('new-tab');
      expect(second.targetId).toBe('new-tab');
      expect(createCount).toBe(1);
      expect(deps.createPage).toHaveBeenCalledTimes(1);
    });

    it('returns cached create response for duplicate idempotency key', async () => {
      const { ctx, deps, state } = createContext({
        listPages: vi.fn(async () => []),
        createPage: vi
          .fn(async () => ({ targetId: 'new-tab-1', url: 'about:blank' }))
          .mockImplementationOnce(async () => ({ targetId: 'new-tab-1', url: 'about:blank' }))
          .mockImplementationOnce(async () => ({ targetId: 'new-tab-2', url: 'about:blank' })),
      });
      await ctx.forProfile('default').ensureRunSession('run-1');

      const first = await ctx
        .forProfile('default')
        .ensureTabAvailable('run-1', undefined, { createNewTab: true, idempotencyKey: 'req-1' });

      const session = state.runSessions.get('run-1');
      if (session) {
        session.activeTargetId = undefined;
        session.activeTargetUrl = undefined;
      }

      const second = await ctx
        .forProfile('default')
        .ensureTabAvailable('run-1', undefined, { createNewTab: true, idempotencyKey: 'req-1' });

      expect(first.targetId).toBe('new-tab-1');
      expect(second.targetId).toBe('new-tab-1');
      expect(deps.createPage).toHaveBeenCalledTimes(1);
    });

    it('keeps create path single-writer under parallel same-run load', async () => {
      const createdTargets: string[] = [];
      const { ctx, deps } = createContext({
        listPages: vi.fn(async () => []),
        createPage: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          const targetId = `new-tab-${createdTargets.length + 1}`;
          createdTargets.push(targetId);
          return { targetId, url: 'about:blank' };
        }),
      });
      await ctx.forProfile('default').ensureRunSession('run-race');

      const calls = Array.from({ length: 10 }, () =>
        ctx.forProfile('default').ensureTabAvailable('run-race', undefined, { createNewTab: true }),
      );
      const results = await Promise.all(calls);

      expect(results.every((result) => result.targetId === 'new-tab-1')).toBe(true);
      expect(deps.createPage).toHaveBeenCalledTimes(1);
      expect(createdTargets).toEqual(['new-tab-1']);
    });

    it('evicts idle run sessions before handling new requests', async () => {
      const { ctx, deps, state } = createContext({ listPages: vi.fn(async () => []) });
      const runtimeProfile = state.configuredProfiles.get('default');
      const now = Date.now();
      state.runSessions.set('run-idle', {
        runId: 'run-idle',
        profileName: 'default',
        browserEndpoint: 'http://127.0.0.1:9222',
        runtimeProfile,
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome-idle', browserPort: 9222, startedAt: now - 1_000 },
        activeTargetId: 'idle-tab',
        activeTargetUrl: 'https://idle.example',
        createdAt: now - 21 * 60 * 1000,
        lastTouchedAt: now - 21 * 60 * 1000,
      });
      state.targetOwners.set('idle-tab', 'run-idle');

      await ctx.forProfile('default').ensureRunSession('run-fresh');
      await ctx.forProfile('default').ensureTabAvailable('run-fresh', undefined, { createNewTab: true });

      expect(state.runSessions.has('run-idle')).toBe(false);
      expect(state.targetOwners.has('idle-tab')).toBe(false);
      expect(deps.releaseBrowser).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'local' }),
        expect.objectContaining({ pid: 1 }),
      );
    });

    it('does not resurrect an idle-evicted target', async () => {
      const { ctx, state } = createContext({
        listPages: vi.fn(async () => []),
      });
      const runtimeProfile = state.configuredProfiles.get('default');
      const now = Date.now();
      state.runSessions.set('run-idle', {
        runId: 'run-idle',
        profileName: 'default',
        browserEndpoint: 'http://127.0.0.1:9222',
        runtimeProfile,
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome-idle', browserPort: 9222, startedAt: now - 1_000 },
        activeTargetId: 'idle-tab',
        activeTargetUrl: 'https://idle.example',
        createdAt: now - 21 * 60 * 1000,
        lastTouchedAt: now - 21 * 60 * 1000,
      });
      state.targetOwners.set('idle-tab', 'run-idle');

      await expect(ctx.forProfile('default').ensureTabAvailable('run-idle', 'idle-tab')).rejects.toThrow(
        'run session is not initialized. Call CreateRunSession first.',
      );
      expect(state.runSessions.has('run-idle')).toBe(false);
      expect(state.targetOwners.has('idle-tab')).toBe(false);
    });

    it('evicts max-lifetime sessions even when recently touched', async () => {
      const { ctx, deps, state } = createContext({
        listPages: vi.fn(async () => []),
      }, {
        provider: 'browserless',
        browserPort: undefined,
        browserEndpoint: 'wss://browser.example.com?token=test-token',
        browserEndpointIsLoopback: false,
      });
      const runtimeProfile = state.configuredProfiles.get('default');
      const now = Date.now();
      state.runSessions.set('run-max', {
        runId: 'run-max',
        profileName: 'default',
        browserEndpoint: 'wss://browser.example.com?session=max',
        runtimeProfile,
        runtime: { provider: 'browserless', startedAt: now - 1_000 },
        activeTargetId: 'max-tab',
        activeTargetUrl: 'https://max.example',
        createdAt: now - (4 * 60 * 60 * 1000 + 1_000),
        lastTouchedAt: now - 1_000,
      });
      state.targetOwners.set('max-tab', 'run-max');

      await ctx.forProfile('default').ensureRunSession('run-fresh');
      await ctx.forProfile('default').ensureTabAvailable('run-fresh', undefined, { createNewTab: true });

      expect(state.runSessions.has('run-max')).toBe(false);
      expect(state.targetOwners.has('max-tab')).toBe(false);
      expect(deps.releaseBrowser).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'browserless' }),
        expect.objectContaining({ provider: 'browserless' }),
      );
    });

    it('does not resurrect a max-lifetime-evicted target', async () => {
      const { ctx, state } = createContext({
        listPages: vi.fn(async () => []),
      }, {
        provider: 'browserless',
        browserPort: undefined,
        browserEndpoint: 'wss://browser.example.com?token=test-token',
        browserEndpointIsLoopback: false,
      });
      const runtimeProfile = state.configuredProfiles.get('default');
      const now = Date.now();
      state.runSessions.set('run-max', {
        runId: 'run-max',
        profileName: 'default',
        browserEndpoint: 'wss://browser.example.com?session=max',
        runtimeProfile,
        runtime: { provider: 'browserless', startedAt: now - 1_000 },
        activeTargetId: 'max-tab',
        activeTargetUrl: 'https://max.example',
        createdAt: now - (4 * 60 * 60 * 1000 + 1_000),
        lastTouchedAt: now - 1_000,
      });
      state.targetOwners.set('max-tab', 'run-max');

      await expect(ctx.forProfile('default').ensureTabAvailable('run-max', 'max-tab')).rejects.toThrow(
        'run session is not initialized. Call CreateRunSession first.',
      );
      expect(state.runSessions.has('run-max')).toBe(false);
      expect(state.targetOwners.has('max-tab')).toBe(false);
    });

    it('closing one run does not disturb another run session', async () => {
      const { ctx, state } = createContext();
      const runtimeProfile = state.configuredProfiles.get('default');
      state.runSessions.set('run-a', {
        runId: 'run-a',
        profileName: 'default',
        browserEndpoint: 'http://127.0.0.1:9222',
        runtimeProfile,
        runtime: { provider: 'local', pid: 1, userDataDir: '/tmp/chrome-a', browserPort: 9222, startedAt: Date.now() },
        activeTargetId: 'tab-a',
        activeTargetUrl: 'https://a.example',
      });
      state.runSessions.set('run-b', {
        runId: 'run-b',
        profileName: 'default',
        browserEndpoint: 'http://127.0.0.1:9223',
        runtimeProfile: { ...runtimeProfile, browserPort: 9223, browserEndpoint: 'http://127.0.0.1:9223' },
        runtime: { provider: 'local', pid: 2, userDataDir: '/tmp/chrome-b', browserPort: 9223, startedAt: Date.now() },
        activeTargetId: 'tab-b',
        activeTargetUrl: 'https://b.example',
      });
      state.targetOwners.set('tab-a', 'run-a');
      state.targetOwners.set('tab-b', 'run-b');

      const closed = await ctx.forProfile('default').closeRunSession('run-a');
      expect(closed).toEqual({ targetId: 'tab-a', closed: true });

      expect(state.runSessions.has('run-a')).toBe(false);
      expect(state.targetOwners.has('tab-a')).toBe(false);
      expect(state.runSessions.has('run-b')).toBe(true);
      expect(state.targetOwners.get('tab-b')).toBe('run-b');
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
