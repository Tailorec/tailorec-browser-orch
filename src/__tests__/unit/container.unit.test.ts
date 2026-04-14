import { describe, expect, it } from 'vitest';
import { RemoteBrowserRuntimeAdapter } from '../../adapters/browser/remote.browser-runtime.adapter.js';
import { createContainer } from '../../container/container.js';
import type { AppConfig } from '../../config/config.types.js';

function createConfig(profiles: AppConfig['browser']['profiles']): AppConfig {
  return {
    port: 4000,
    host: '127.0.0.1',
    browser: {
      enabled: true,
      headless: false,
      noSandbox: false,
      profiles,
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
  };
}

describe('createContainer', () => {
  it('selects provider from configured profiles when default is absent', () => {
    const container = createContainer(createConfig({
      remote: {
        name: 'remote',
        provider: 'browserless',
        browserEndpoint: 'wss://browser.example.com?token=test-token',
      },
    }));

    expect(container.browserRuntime).toBeInstanceOf(RemoteBrowserRuntimeAdapter);
  });
});
