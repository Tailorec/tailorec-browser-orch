/**
 * Chrome Profile Decoration Utilities
 * 
 * Handles profile decoration and cleanup for Chrome browser profiles.
 * Extracted from: src/browser/chrome.profile-decoration.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { createSubsystemLogger } from '../logging/pino-logger.adapter.js';

const log = createSubsystemLogger('chrome-profile-decoration');

/**
 * Profile decoration metadata
 */
type ProfileDecoration = {
  name: string;
  color: string;
  decoratedAt: number;
  version: number;
};

const DECORATION_VERSION = 1;
const DECORATION_FILE = 'openclaw-decoration.json';

/**
 * Check if profile has been decorated
 */
export function isProfileDecorated(
  userDataDir: string,
  profileName: string,
  color: string,
): boolean {
  try {
    const decorationPath = path.join(userDataDir, DECORATION_FILE);
    if (!fs.existsSync(decorationPath)) {
      return false;
    }

    const content = fs.readFileSync(decorationPath, 'utf-8');
    const decoration = JSON.parse(content) as ProfileDecoration;

    return (
      decoration.name === profileName &&
      decoration.color === color.toUpperCase() &&
      decoration.version === DECORATION_VERSION
    );
  } catch (err) {
    log.warn('decoration check failed', {
      userDataDir,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Decorate OpenClaw profile with branding and preferences
 */
export function decorateOpenClawProfile(
  userDataDir: string,
  opts: { name: string; color?: string },
): void {
  try {
    const color = (opts.color ?? 'blue').toUpperCase();

    // Write decoration metadata
    const decoration: ProfileDecoration = {
      name: opts.name,
      color,
      decoratedAt: Date.now(),
      version: DECORATION_VERSION,
    };

    const decorationPath = path.join(userDataDir, DECORATION_FILE);
    fs.writeFileSync(decorationPath, JSON.stringify(decoration, null, 2), 'utf-8');

    // Create preferences file if it doesn't exist
    const preferencesPath = path.join(userDataDir, 'Default', 'Preferences');
    if (fs.existsSync(preferencesPath)) {
      try {
        const content = fs.readFileSync(preferencesPath, 'utf-8');
        const preferences = JSON.parse(content);

        // Set OpenClaw-specific preferences
        preferences.openclaw = {
          profileName: opts.name,
          profileColor: color,
          decoratedAt: decoration.decoratedAt,
        };

        fs.writeFileSync(
          preferencesPath,
          JSON.stringify(preferences, null, 2),
          'utf-8',
        );

        log.info('profile decorated', {
          name: opts.name,
          color,
          userDataDir,
        });
      } catch (err) {
        log.warn('preferences update failed', {
          userDataDir,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    log.error('profile decoration failed', {
      userDataDir,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Ensure profile clean exit by removing lock files
 */
export function ensureProfileCleanExit(userDataDir: string): void {
  try {
    // Remove lock files that might prevent future launches
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SSPIActiveUserLock'];

    for (const file of lockFiles) {
      const lockPath = path.join(userDataDir, file);
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
          log.debug('lock file removed', { file, userDataDir });
        }
      } catch {
        // Ignore lock file removal errors
      }
    }

    // Update last clean exit timestamp
    const exitFile = path.join(userDataDir, 'last-clean-exit');
    fs.writeFileSync(exitFile, new Date().toISOString(), 'utf-8');
  } catch (err) {
    log.warn('profile clean exit failed', {
      userDataDir,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
