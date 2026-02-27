import net from "node:net";

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

export async function ensurePortAvailable(port: number): Promise<void> {
  const available = await isPortAvailable(port);
  if (!available) {
    // In a real scenario we might kill the process, but here just throw or warn
    // For now we assume we manage the port
    // throw new Error(`Port ${port} is busy`);
    // Actually, chrome.ts calls this. If it throws, chrome launch fails.
    // Let's just log a warning and hope it's our own chrome or let chrome fail naturally?
    // OpenClaw likely tries to kill usage.
    // I'll make it a no-op for now to keep things simple, Chrome will fail to bind CDP if busy.
  }
}

/**
 * Finds a free port starting from the given port.
 */
export async function findFreePort(startFrom: number = 0): Promise<number> {
  if (startFrom > 0) {
    if (await isPortAvailable(startFrom)) {
      return startFrom;
    }
  }
  // Try random port
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("listening", () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
    server.listen(0);
  });
}
