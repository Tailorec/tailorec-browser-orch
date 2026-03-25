import { afterEach, describe, expect, it } from 'vitest';
import { getConfiguredViewport, loadConfig, resolveProfile } from '../../config/config.js';

describe('config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses viewport from the environment', () => {
    process.env.BROWSER_VIEWPORT = '1440x900';
    expect(getConfiguredViewport()).toEqual({ width: 1440, height: 900 });

    process.env.BROWSER_VIEWPORT = 'bad';
    expect(getConfiguredViewport()).toEqual({ width: 1280, height: 720 });
  });

  it('loads env overrides and resolves configured profiles', () => {
    process.env.PORT = '4100';
    process.env.BROWSER_HEADLESS = 'true';
    process.env.BROWSER_NO_SANDBOX = '1';
    process.env.LOG_LEVEL = 'debug';

    const config = loadConfig();
    expect(config.port).toBe(4100);
    expect(config.browser.headless).toBe(true);
    expect(config.browser.noSandbox).toBe(true);
    expect(config.logging.level).toBe('debug');

    expect(resolveProfile(config.browser, 'default')).toMatchObject({
      name: 'default',
      cdpPort: 9222,
      cdpUrl: 'http://127.0.0.1:9222',
    });
    expect(resolveProfile(config.browser, 'missing')).toBeNull();
  });
});
