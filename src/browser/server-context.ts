import type { Server } from "node:http";
import type { ResolvedBrowserConfig, ResolvedBrowserProfile } from "./config.js";
import { resolveProfile } from "./config.js";
import { launchOpenClawChrome, stopOpenClawChrome, type RunningChrome } from "./chrome.js";
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
           // If targetId is provided, verify it exists. If not, verify we have at least one tab or create one.
           // This logic was partly in server.ts in OpenClaw or implied.
           // We need to ensure the browser is running first.
           
           let running = s.profiles.get(name);
           if (!running || !running.chrome) {
             // Start browser on demand?
             // OpenClaw starts browsers on startup for enabled profiles, or on demand?
             // Let's implement on-demand start if not running.
             const chrome = await launchOpenClawChrome(s.resolved, resolvedProfile);
             running = { name, config: resolvedProfile, chrome };
             s.profiles.set(name, running);
           }
           
           if (targetId) {
             // Validate it exists
             // We can use listPagesViaPlaywright
             const pages = await listPagesViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl });
             const found = pages.find(p => p.targetId === targetId);
             if (found) {
               await focusPageByTargetIdViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl, targetId });
               return { targetId, url: found.url };
             }
             throw new Error(`Target ${targetId} not found`);
           }
           
           // No targetId, check for any page
           const pages = await listPagesViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl });
           if (pages.length > 0) {
             const first = pages[0];
             await focusPageByTargetIdViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl, targetId: first.targetId });
             return { targetId: first.targetId, url: first.url };
           }
           
           // Create new page
           const created = await createPageViaPlaywright({ cdpUrl: resolvedProfile.cdpUrl, url: "about:blank" });
           return { targetId: created.targetId, url: created.url };
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
      return null;
    }
  };
}
