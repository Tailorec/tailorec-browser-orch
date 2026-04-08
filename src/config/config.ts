import type {
  AppConfig,
  BrowserProvider,
  BrowserViewport,
  ResolvedBrowserProfile,
} from './config.types.js';
import { validateConfig } from './config.validators.js';
import { createSubsystemLogger } from '../adapters/logging/logger.adapter.js';

const log = createSubsystemLogger('config');

/**
 * Default application configuration
 */
const DEFAULT_CONFIG: AppConfig = {
  port: 4000,
  host: '0.0.0.0',
  browser: {
    enabled: true,
    headless: false,
    noSandbox: false,
    profiles: {
      default: {
        name: 'default',
        provider: 'local',
        cdpPort: 9222,
        driver: 'chrome',
        color: 'blue',
      },
    },
    evaluateEnabled: true,
    viewport: { width: 1280, height: 720 },
  },
  logging: {
    level: 'info',
    format: 'json',
    toFile: true,
    filePath: 'logs/app.log',
    maxBytes: 10 * 1024 * 1024,
    backupCount: 5,
  },
  security: {
    corsEnabled: false,
    rateLimitEnabled: false,
  },
  nodeEnv: 'development',
};

/**
 * Parse boolean from environment variable with fallback
 */
function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

/**
 * Parse viewport from environment variable (format: "WIDTHxHEIGHT")
 */
function parseViewportEnv(value: string | undefined, fallback: BrowserViewport): BrowserViewport {
  if (!value) return fallback;

  const match = value.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return fallback;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return fallback;
  }

  return { width: Math.floor(width), height: Math.floor(height) };
}

function parseBrowserProviderEnv(value: string | undefined, fallback: BrowserProvider): BrowserProvider {
  if (!value) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'browserless'
    ? 'browserless'
    : 'local';
}

/**
 * Get configured viewport from environment or default
 */
export function getConfiguredViewport(): BrowserViewport {
  return parseViewportEnv(process.env.BROWSER_VIEWPORT, DEFAULT_CONFIG.browser.viewport);
}

/**
 * Resolve browser profile configuration
 */
export function resolveProfile(
  config: AppConfig['browser'],
  name: string,
): ResolvedBrowserProfile | null {
  const profile = config.profiles[name];
  if (!profile) {
    log.warn('profile resolution failed', { profile: name });
    return null;
  }

  const browserEndpoint = profile.provider === 'local'
    ? `http://127.0.0.1:${profile.cdpPort}`
    : profile.browserEndpoint!;

  return {
    name,
    provider: profile.provider,
    browserPort: profile.cdpPort,
    browserEndpoint,
    browserEndpointIsLoopback:
      browserEndpoint.includes('127.0.0.1') || browserEndpoint.includes('localhost'),
    driver: profile.driver || 'chrome',
    color: profile.color || 'blue',
  };
}

/**
 * Load and validate application configuration
 */
export function loadConfig(): AppConfig {
  const provider = parseBrowserProviderEnv(process.env.BROWSER_PROVIDER, 'local');

  const rawConfig = {
    ...DEFAULT_CONFIG,
    port: Number(process.env.PORT) || 4000,
    browser: {
      ...DEFAULT_CONFIG.browser,
      profiles: {
        default: {
          name: 'default',
          provider,
          ...(provider === 'local'
            ? {
                cdpPort: Number(process.env.BROWSER_CDP_PORT) || 9222,
              }
            : {
                browserEndpoint: process.env.BROWSER_ENDPOINT,
              }),
          driver: DEFAULT_CONFIG.browser.profiles.default.driver,
          color: DEFAULT_CONFIG.browser.profiles.default.color,
        },
      },
      headless: parseBooleanEnv(
        process.env.BROWSER_HEADLESS ?? process.env.HEADLESS,
        DEFAULT_CONFIG.browser.headless,
      ),
      noSandbox: parseBooleanEnv(
        process.env.BROWSER_NO_SANDBOX ?? process.env.NO_SANDBOX,
        DEFAULT_CONFIG.browser.noSandbox ?? false,
      ),
      viewport: parseViewportEnv(
        process.env.BROWSER_VIEWPORT,
        DEFAULT_CONFIG.browser.viewport,
      ),
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      level: (process.env.LOG_LEVEL as any) ?? DEFAULT_CONFIG.logging.level,
      format: (
        process.env.LOG_FORMAT === 'console' || process.env.LOG_FORMAT === 'json'
          ? process.env.LOG_FORMAT
          : DEFAULT_CONFIG.logging.format
      ),
      toFile: parseBooleanEnv(process.env.LOG_TO_FILE, DEFAULT_CONFIG.logging.toFile),
      filePath: process.env.LOG_FILE_PATH || DEFAULT_CONFIG.logging.filePath,
      maxBytes: Number(process.env.LOG_MAX_BYTES) || DEFAULT_CONFIG.logging.maxBytes,
      backupCount: Number(process.env.LOG_BACKUP_COUNT) || DEFAULT_CONFIG.logging.backupCount,
    },
    nodeEnv: (process.env.NODE_ENV as any) ?? 'development',
  };

  const config = validateConfig(rawConfig);

  log.info('config loaded', {
    port: config.port,
    provider,
    headless: config.browser.headless,
    no_sandbox: config.browser.noSandbox ?? false,
    viewport: `${config.browser.viewport.width}x${config.browser.viewport.height}`,
    log_level: config.logging.level,
  });

  return config;
}
