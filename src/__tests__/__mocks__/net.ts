/**
 * Mock implementations for Node.js net module.
 * Used for unit testing network operations without real network connections.
 */

import { EventEmitter } from "node:events";
import { Socket } from "node:net";

/**
 * Mock Socket class for testing.
 */
export class MockSocket extends EventEmitter {
  private connectedValue = false;
  private destroyedValue = false;
  private dataListeners: Array<(data: Buffer) => void> = [];

  connecting = false;
  remoteAddress = "127.0.0.1";
  remotePort = 8080;
  localAddress = "127.0.0.1";
  localPort = 12345;

  connect(port: number, host?: string, connectionListener?: () => void): this;
  connect(path: string, connectionListener?: () => void): this;
  connect(...args: any[]): this {
    const connectionListener = args.find((arg) => typeof arg === "function") as (() => void) | undefined;

    this.connecting = true;
    setTimeout(() => {
      this.connecting = false;
      this.connectedValue = true;
      this.emit("connect");
      this.emit("ready");
      connectionListener?.();
    }, 10);

    return this;
  }

  write(data: string | Buffer | Uint8Array, callback?: (err?: Error) => void): boolean {
    setTimeout(() => {
      this.emit("data", Buffer.from(data));
      callback?.();
    }, 5);
    return true;
  }

  end(data?: string | Buffer | Uint8Array): this {
    if (data) {
      this.write(data);
    }
    setTimeout(() => {
      this.connectedValue = false;
      this.emit("end");
      this.emit("close");
    }, 10);
    return this;
  }

  destroy(err?: Error): this {
    this.destroyedValue = true;
    this.connectedValue = false;
    this.emit("close", err);
    return this;
  }

  isConnected(): boolean {
    return this.connectedValue && !this.destroyedValue;
  }

  isDestroyed(): boolean {
    return this.destroyedValue;
  }

  setEncoding(encoding: string): this {
    return this;
  }

  pause(): this {
    return this;
  }

  resume(): this {
    return this;
  }

  setTimeout(timeout: number, callback?: () => void): this {
    if (callback) {
      this.once("timeout", callback);
    }
    return this;
  }

  setNoDelay(noDelay?: boolean): this {
    return this;
  }

  setKeepAlive(enable?: boolean, initialDelay?: number): this {
    return this;
  }

  address(): { address: string; family: string; port: number } | null {
    if (this.destroyedValue) {
      return null;
    }
    return {
      address: this.localAddress,
      family: "IPv4",
      port: this.localPort,
    };
  }

  bytesRead = 0;
  bytesReadValue(): number {
    return this.bytesRead;
  }

  bytesWritten = 0;
  bytesWrittenValue(): number {
    return this.bytesWritten;
  }

  remoteFamily = "IPv4";
  remoteHost = "127.0.0.1";
}

/**
 * Mock Server class for testing.
 */
export class MockServer extends EventEmitter {
  private listeningValue = false;
  private addressValue: { address: string; family: string; port: number } | null = null;
  private connections: MockSocket[] = [];

  listen(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): this;
  listen(port?: number, hostname?: string, listeningListener?: () => void): this;
  listen(port?: number, listeningListener?: () => void): this;
  listen(path?: string, listeningListener?: () => void): this;
  listen(...args: any[]): this {
    const port = typeof args[0] === "number" ? args[0] : 8080;
    const listeningListener = args.find((arg) => typeof arg === "function") as (() => void) | undefined;

    setTimeout(() => {
      this.listeningValue = true;
      this.addressValue = {
        address: "127.0.0.1",
        family: "IPv4",
        port,
      };
      this.emit("listening");
      listeningListener?.();
    }, 10);

    return this;
  }

  close(callback?: (err?: Error) => void): this {
    setTimeout(() => {
      this.listeningValue = false;
      this.addressValue = null;
      this.emit("close");
      callback?.();
    }, 10);
    return this;
  }

  address(): { address: string; family: string; port: number } | string | null {
    return this.addressValue;
  }

  isListening(): boolean {
    return this.listeningValue;
  }

  getConnection(callback: (err: Error | null, socket: MockSocket | null) => void): void {
    const socket = this.connections[0] ?? null;
    callback(null, socket);
  }

  getConnections(callback: (err: Error | null, count: number) => void): void {
    callback(null, this.connections.length);
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }

  maxConnections = 100;
  setTimeout(timeout: number, callback?: () => void): this {
    if (callback) {
      this.on("timeout", callback);
    }
    return this;
  }
}

/**
 * Creates a mock socket for testing.
 */
export function createMockSocket(options?: {
  connected?: boolean;
  remoteAddress?: string;
  remotePort?: number;
}): MockSocket {
  const socket = new MockSocket();
  if (options?.connected) {
    (socket as any).connectedValue = true;
  }
  if (options?.remoteAddress) {
    socket.remoteAddress = options.remoteAddress;
  }
  if (options?.remotePort) {
    socket.remotePort = options.remotePort;
  }
  return socket;
}

/**
 * Creates a mock server for testing.
 */
export function createMockServer(connectionListener?: (socket: MockSocket) => void): MockServer {
  const server = new MockServer();
  if (connectionListener) {
    server.on("connection", connectionListener);
  }
  return server;
}

/**
 * Mock net module.
 */
export const net = {
  Socket: MockSocket,
  Server: MockServer,

  createConnection: (port: number, host?: string, connectionListener?: () => void): MockSocket => {
    const socket = new MockSocket();
    socket.connect(port, host, connectionListener);
    return socket;
  },

  createServer: (connectionListener?: (socket: MockSocket) => void): MockServer => {
    return createMockServer(connectionListener);
  },

  connect: (port: number, host?: string, connectionListener?: () => void): MockSocket => {
    return net.createConnection(port, host, connectionListener);
  },

  isIP: (input: string): number => {
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input)) {
      return 4;
    }
    if (/^[0-9a-fA-F:]+$/.test(input) && input.includes(":")) {
      return 6;
    }
    return 0;
  },

  isIPv4: (input: string): boolean => net.isIP(input) === 4,
  isIPv6: (input: string): boolean => net.isIP(input) === 6,
};

export default net;
