import type { BrowserServerState, createBrowserRouteContext } from "./server-context.js";
import { registerBrowserRoutes } from "./routes/index.js";
import express from "express";

export interface BrowserControlService {
  app: express.Express;
  start: (port: number) => Promise<void>;
  stop: () => Promise<void>;
}

export function createBrowserControlContext() {
  // Stub for client-fetch.ts which is unused in server mode but TS might complain
  return {} as any;
}

export async function startBrowserControlServiceFromConfig(): Promise<boolean> {
  // Stub for client-fetch.ts
  return true;
}
