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
  cdpPort: number;
  cdpUrl: string;
  driver: 'chrome' | 'extension';
  color?: string;
};

/**
 * Resolved profile with computed values
 */
export type ResolvedProfile = {
  name: string;
  cdpPort: number;
  cdpUrl: string;
  cdpIsLoopback: boolean;
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
   * Get CDP URL
   */
  get cdpUrl(): string {
    return this.config.cdpUrl;
  }

  /**
   * Get CDP port
   */
  get cdpPort(): number {
    return this.config.cdpPort;
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
      cdpPort: this.config.cdpPort,
      cdpUrl: this.config.cdpUrl,
      cdpIsLoopback: this.isLoopback(),
      driver: this.config.driver,
      color: this.config.color ?? 'blue',
    };
  }

  /**
   * Check if CDP URL is loopback (localhost/127.0.0.1)
   */
  isLoopback(): boolean {
    const url = this.config.cdpUrl.toLowerCase();
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
