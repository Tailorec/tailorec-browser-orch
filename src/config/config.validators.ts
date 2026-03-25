import { z } from 'zod';
import type { AppConfig } from './config.types.js';

/**
 * Zod schema for browser profile configuration
 */
const BrowserProfileSchema = z.object({
  name: z.string().min(1),
  cdpPort: z.number().min(1024).max(65535).optional(),
  cdpUrl: z.string().url().optional(),
  driver: z.enum(['chrome', 'extension']).optional().default('chrome'),
  color: z.string().optional(),
});

/**
 * Zod schema for browser configuration
 */
const BrowserConfigSchema = z.object({
  enabled: z.boolean().default(true),
  headless: z.boolean().default(false),
  noSandbox: z.boolean().optional(),
  profiles: z.record(z.string(), BrowserProfileSchema),
  evaluateEnabled: z.boolean().default(true),
  viewport: z.object({
    width: z.number().min(100).max(7680),
    height: z.number().min(100).max(4320),
  }),
});

/**
 * Zod schema for logging configuration
 */
const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'console']).default('json'),
  toFile: z.boolean().default(true),
  filePath: z.string().default('logs/app.log'),
  maxBytes: z.number().min(1024).default(10 * 1024 * 1024),
  backupCount: z.number().min(0).max(100).default(5),
});

/**
 * Zod schema for security configuration
 */
const SecurityConfigSchema = z.object({
  corsEnabled: z.boolean().default(false),
  rateLimitEnabled: z.boolean().default(false),
});

/**
 * Zod schema for main application configuration
 */
const AppConfigSchema = z.object({
  // Server
  port: z.number().min(1).max(65535),
  host: z.string().default('127.0.0.1'),

  // Browser
  browser: BrowserConfigSchema,

  // Logging
  logging: LoggingConfigSchema,

  // Security
  security: SecurityConfigSchema,

  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validate raw configuration object
 * @throws Error if validation fails
 */
export function validateConfig(raw: unknown): AppConfig {
  const result = AppConfigSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.') || 'root',
      message: err.message,
    }));
    throw new Error(
      `Config validation failed: ${errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join(', ')}`,
    );
  }

  return result.data as AppConfig;
}

/**
 * Parse Zod validation error to field errors
 */
export function parseZodError(zodError: z.ZodError): Array<{ field: string; message: string }> {
  return zodError.errors.map(err => ({
    field: err.path.join('.') || 'root',
    message: err.message,
  }));
}
