/**
 * Port Utilities
 *
 * Network port management utilities.
 * Migrated from src/infra/ports.ts
 */

import { createServer, type Server } from "node:net";

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Ensure a port is available, throw if not
 */
export async function ensurePortAvailable(port: number): Promise<void> {
  const available = await isPortAvailable(port);
  if (!available) {
    throw new Error(`Port ${port} is already in use`);
  }
}

/**
 * Find a free port starting from the given port
 */
export async function findFreePort(startPort = 0): Promise<number> {
  if (startPort > 0) {
    if (await isPortAvailable(startPort)) {
      return startPort;
    }
  }

  // Try random port
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.once("listening", () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
    server.listen(0, "127.0.0.1");
  });
}
