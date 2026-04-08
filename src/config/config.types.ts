/**
 * Log level for application logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log format for application logging
 */
export type LogFormat = 'json' | 'console';

/**
 * Browser viewport configuration
 */
export interface BrowserViewport {
  width: number;
  height: number;
}

/**
 * Supported browser providers
 */
export type BrowserProvider = 'local' | 'browserless';

/**
 * Browser profile configuration
 */
export interface BrowserProfileConfig {
  name: string;
  provider: BrowserProvider;
  cdpPort?: number;
  browserEndpoint?: string;
  driver?: 'chrome' | 'extension';
  color?: string;
}

/**
 * Browser configuration
 */
export interface BrowserConfig {
  enabled: boolean;
  headless: boolean;
  noSandbox?: boolean;
  profiles: Record<string, BrowserProfileConfig>;
  evaluateEnabled: boolean;
  viewport: BrowserViewport;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: LogLevel;
  format: LogFormat;
  toFile: boolean;
  filePath: string;
  maxBytes: number;
  backupCount: number;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  corsEnabled: boolean;
  rateLimitEnabled: boolean;
}

/**
 * Main application configuration
 */
export interface AppConfig {
  // Server
  port: number;
  host: string;

  // Browser
  browser: BrowserConfig;

  // Logging
  logging: LoggingConfig;

  // Security
  security: SecurityConfig;

  // Environment
  nodeEnv: 'development' | 'production' | 'test';
}

/**
 * Resolved browser profile with computed values
 */
export interface ResolvedBrowserProfile {
  name: string;
  provider: BrowserProvider;
  browserPort?: number;
  browserEndpoint: string;
  browserEndpointIsLoopback: boolean;
  driver: 'chrome' | 'extension';
  color: string;
}
