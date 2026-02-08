import type { Server } from "node:http";
import type { ResolvedBrowserConfig, ResolvedBrowserProfile } from "./config.js";
import { resolveProfile } from "./config.js";
import { isChromeReachable, launchOpenClawChrome, stopOpenClawChrome, type RunningChrome } from "./chrome.js";
import { createPageViaPlaywright, focusPageByTargetIdViaPlaywright, listPagesViaPlaywright, closePageByTargetIdViaPlaywright } from "./pw-session.js";

// Simplified config for standalone
export interface BrowserServerState {
  server: Server;
  port: number;
  resolved: ResolvedBrowserConfig;
  profiles: Map<string, RunningProfile>;
}

export interface RunningProfile {
  name: string;
  config: ResolvedBrowserProfile;
  chrome?: RunningChrome;
  // We can track connected pages here if needed
}

export interface ProfileContext {
  profile: ResolvedBrowserProfile;
  ensureTabAvailable(targetId?: string): Promise<{ targetId: string; url: string }>;
  stopRunningBrowser(): Promise<void>;
}

export interface BrowserRouteContext {
  state(): BrowserServerState;
  forProfile(name: string): ProfileContext;
  mapTabError(err: unknown): { status: number; message: string } | null;
}

function isConnectionRefusedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("ECONNREFUSED") || msg.includes("connectOverCDP");
}

export function createBrowserRouteContext(opts: {
  getState: () => BrowserServerState | null;
}): BrowserRouteContext {
  return {
    state() {
      const s = opts.getState();
      if (!s) throw new Error("Server not started");
      return s;
    },
    forProfile(name: string) {
      const s = opts.getState();
      if (!s) throw new Error("Server not started");
      
      const resolvedProfile = resolveProfile(s.resolved, name);
      if (!resolvedProfile) throw new Error(`Profile ${name} not found`);

      return {
        profile: resolvedProfile,
        async ensureTabAvailable(targetId?: string) {
          const ensureBrowserRunning = async () => {
            let running = s.profiles.get(name);
            const reachable = await isChromeReachable(resolvedProfile.cdpUrl, 500);

            if (running?.chrome && !reachable) {
              try {
                await stopOpenClawChrome(running.chrome);
              } catch {
                // ignore
              }
              running.chrome = undefined;
            }

            if (!running || !running.chrome) {
              const chrome = await launchOpenClawChrome(s.resolved, resolvedProfile);
              running = { name, config: resolvedProfile, chrome };
              s.profiles.set(name, running);
            }
          };

          const getOrCreateTab = async () => {
            if (targetId) {
              const pages = await listPagesViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl });
              const found = pages.find((p) => p.targetId === targetId);
              if (found) {
                await focusPageByTargetIdViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl, targetId });
                return { targetId, url: found.url };
              }
              throw new Error(`Target ${targetId} not found`);
            }

            const pages = await listPagesViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl });
            if (pages.length > 0) {
              const first = pages[0];
              await focusPageByTargetIdViaPlaywright({
                cdpUrl: resolvedProfile.cdpUrl,
                targetId: first.targetId,
              });
              return { targetId: first.targetId, url: first.url };
            }

            const created = await createPageViaPlaywright({
              cdpUrl: resolvedProfile.cdpUrl,
              url: "about:blank",
            });
            return { targetId: created.targetId, url: created.url };
          };

          await ensureBrowserRunning();

          try {
            return await getOrCreateTab();
          } catch (err) {
            if (!isConnectionRefusedError(err)) {
              throw err;
            }

            // One recovery attempt: restart browser and retry once.
            const running = s.profiles.get(name);
            if (running?.chrome) {
              try {
                await stopOpenClawChrome(running.chrome);
              } catch {
                // ignore
              }
              running.chrome = undefined;
            }

            await ensureBrowserRunning();
            return await getOrCreateTab();
          }
        },
        async stopRunningBrowser() {
          const running = s.profiles.get(name);
          if (running && running.chrome) {
            await stopOpenClawChrome(running.chrome);
            running.chrome = undefined;
          }
        }
      };
    },
    mapTabError(err: unknown) {
      // Simple error mapping
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("tab not found") || msg.includes("Target closed")) {
        return { status: 404, message: "Tab not found or closed" };
      }
      if (isConnectionRefusedError(err)) {
        return { status: 503, message: "Browser CDP unavailable. Retry in a few seconds." };
      }
      if (msg.includes("Timeout") || msg.includes("TimeoutError")) {
        return { status: 408, message: "Browser action timed out" };
      }
      return null;
    }
  };
}
