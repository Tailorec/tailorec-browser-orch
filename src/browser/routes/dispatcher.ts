// Renaming .js to .ts
import type { BrowserRouteContext } from "../server-context.js";
import type { BrowserRouteRegistrar } from "./types.js";

export function createBrowserRouteDispatcher(ctx: BrowserRouteContext) {
  return {
    dispatch: async (req: { method: string; path: string; query: any; body: any }) => {
      // Stub for client-fetch.ts - client side dispatch simulation
      return { status: 200, body: {} };
    }
  };
}
