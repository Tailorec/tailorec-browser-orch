import type { AppConfig, BrowserViewport } from './config.types.js';
import { validateConfig } from './config.validators.js';
import { createSubsystemLogger } from '../logging/subsystem.js';

const log = createSubsystemLogger('config');

/**
 * Default application configuration
 */
const DEFAULT_CONFIG: AppConfig = {
  port: 4000,
  host: '127.0.0.1',
  browser: {
    enabled: true,
    headless: false,
    profiles: {
      default: {
        name: 'default',
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

/**
 * Load and validate application configuration
 */
export function loadConfig(): AppConfig {
  const rawConfig = {
    ...DEFAULT_CONFIG,
    port: Number(process.env.PORT) || 4000,
    browser: {
      ...DEFAULT_CONFIG.browser,
      headless: parseBooleanEnv(
        process.env.BROWSER_HEADLESS ?? process.env.HEADLESS,
        DEFAULT_CONFIG.browser.headless,
      ),
      viewport: parseViewportEnv(
        process.env.BROWSER_VIEWPORT,
        DEFAULT_CONFIG.browser.viewport,
      ),
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      level: (process.env.LOG_LEVEL as any) ?? DEFAULT_CONFIG.logging.level,
      format: (process.env.LOG_FORMAT as any) ?? DEFAULT_CONFIG.logging.format,
      toFile: parseBooleanEnv(process.env.LOG_TO_FILE, DEFAULT_CONFIG.logging.toFile),
    },
    nodeEnv: (process.env.NODE_ENV as any) ?? 'development',
  };

  const config = validateConfig(rawConfig);

  log.info('config loaded', {
    port: config.port,
    headless: config.browser.headless,
    viewport: `${config.browser.viewport.width}x${config.browser.viewport.height}`,
    log_level: config.logging.level,
  });

  return config;
}
