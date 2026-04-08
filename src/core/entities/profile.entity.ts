/**
 * Profile Entity
 * 
 * Represents a browser profile configuration for CDP connections.
 * Extracted from: src/browser/profiles.types.ts (inferred from usage)
 */

/**
 * Profile configuration input
 */
export type ProfileConfig = {
  name: string;
  provider: 'local' | 'browserless';
  browserPort?: number;
  browserEndpoint: string;
  driver: 'chrome' | 'extension';
  color?: string;
};

/**
 * Resolved profile with computed values
 */
export type ResolvedProfile = {
  name: string;
  provider: 'local' | 'browserless';
  browserPort?: number;
  browserEndpoint: string;
  browserEndpointIsLoopback: boolean;
  driver: 'chrome' | 'extension';
  color: string;
};

/**
 * Profile Entity
 * 
 * Encapsulates browser profile configuration and provides resolution logic.
 */
export class Profile {
  constructor(
    public readonly config: ProfileConfig,
  ) {}

  /**
   * Get profile name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get browser endpoint
   */
  get browserEndpoint(): string {
    return this.config.browserEndpoint;
  }

  /**
   * Get browser port
   */
  get browserPort(): number | undefined {
    return this.config.browserPort;
  }

  /**
   * Get driver type
   */
  get driver(): 'chrome' | 'extension' {
    return this.config.driver;
  }

  /**
   * Resolve profile with computed values
   */
  resolve(): ResolvedProfile {
    return {
      name: this.config.name,
      provider: this.config.provider,
      browserPort: this.config.browserPort,
      browserEndpoint: this.config.browserEndpoint,
      browserEndpointIsLoopback: this.isLoopback(),
      driver: this.config.driver,
      color: this.config.color ?? 'blue',
    };
  }

  /**
   * Check if browser endpoint is loopback (localhost/127.0.0.1)
   */
  isLoopback(): boolean {
    const url = this.config.browserEndpoint.toLowerCase();
    return url.includes('127.0.0.1') || url.includes('localhost');
  }

  /**
   * Update profile configuration
   */
  updateConfig(updates: Partial<ProfileConfig>): Profile {
    return new Profile({
      ...this.config,
      ...updates,
    });
  }
}
