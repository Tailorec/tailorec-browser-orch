import { afterEach, describe, expect, it } from 'vitest';
import { validateConfig } from '../../config/config.validators.js';
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
      provider: 'local',
      browserPort: 9222,
      browserEndpoint: 'http://127.0.0.1:9222',
    });
    expect(resolveProfile(config.browser, 'missing')).toBeNull();
  });

  it('loads browserless env overrides and resolves configured profiles', () => {
    process.env.BROWSER_PROVIDER = 'browserless';
    process.env.BROWSER_ENDPOINT = 'wss://browser.example.com?token=test-token';

    const config = loadConfig();

    expect(resolveProfile(config.browser, 'default')).toMatchObject({
      name: 'default',
      provider: 'browserless',
      browserPort: undefined,
      browserEndpoint: 'wss://browser.example.com?token=test-token',
    });
  });

  it('fails fast when browserless endpoint is missing', () => {
    process.env.BROWSER_PROVIDER = 'browserless';

    expect(() => loadConfig()).toThrow('browser.profiles.default.browserEndpoint');
  });

  it('fails fast when browser provider is invalid', () => {
    process.env.BROWSER_PROVIDER = 'browserles';

    expect(() => loadConfig()).toThrow("browser.profiles.default.provider");
  });

  it('rejects mixed providers across configured profiles', () => {
    expect(() => validateConfig({
      port: 4000,
      host: '127.0.0.1',
      browser: {
        enabled: true,
        headless: false,
        profiles: {
          local: {
            name: 'local',
            provider: 'local',
            cdpPort: 9222,
          },
          remote: {
            name: 'remote',
            provider: 'browserless',
            browserEndpoint: 'wss://browser.example.com?token=test-token',
          },
        },
        evaluateEnabled: true,
        viewport: { width: 1280, height: 720 },
      },
      logging: {
        level: 'info',
        format: 'json',
        toFile: false,
        filePath: 'logs/app.log',
        maxBytes: 1024,
        backupCount: 0,
      },
      security: {
        corsEnabled: false,
        rateLimitEnabled: false,
      },
      nodeEnv: 'test',
    })).toThrow('all configured profiles must use the same provider in v1');
  });
});
