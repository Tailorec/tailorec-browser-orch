/**
 * Mock implementations for WebSocket (ws) module.
 * Used for unit testing WebSocket operations without real connections.
 */

import { EventEmitter } from "node:events";

/**
 * Mock WebSocket states.
 */
export const WebSocket = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

/**
 * Mock WebSocket class for testing.
 */
export class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  private urlValue: string;
  private protocolValue = "";
  private extensionsValue = "";
  private readyStateValue = WebSocket.CONNECTING;
  private bufferedAmountValue = 0;

  CONNECTING = WebSocket.CONNECTING;
  OPEN = WebSocket.OPEN;
  CLOSING = WebSocket.CLOSING;
  CLOSED = WebSocket.CLOSED;

  constructor(url: string, protocols?: string | string[], options?: any) {
    super();

    this.urlValue = url;
    this.protocolValue = typeof protocols === "string" ? protocols : protocols?.[0] ?? "";

    // Simulate connection
    setTimeout(() => {
      this.readyStateValue = WebSocket.OPEN;
      this.emit("open");
      this.emit("connection", this);
    }, 10);
  }

  get readyState(): number {
    return this.readyStateValue;
  }

  get url(): string {
    return this.urlValue;
  }

  get protocol(): string {
    return this.protocolValue;
  }

  get extensions(): string {
    return this.extensionsValue;
  }

  get bufferedAmount(): number {
    return this.bufferedAmountValue;
  }

  /**
   * Sends data through the WebSocket.
   */
  send(data: string | Buffer | ArrayBuffer | Uint8Array): void {
    if (this.readyStateValue !== WebSocket.OPEN) {
      const error = new Error("WebSocket is not open");
      (error as any).code = "WS_ERR_NOT_OPEN";
      this.emit("error", error);
      return;
    }

    setTimeout(() => {
      let bufferData: Buffer;
      if (typeof data === "string") {
        bufferData = Buffer.from(data);
      } else if (data instanceof Buffer) {
        bufferData = data;
      } else if (data instanceof ArrayBuffer) {
        bufferData = Buffer.from(data);
      } else {
        bufferData = Buffer.from(data as Uint8Array);
      }
      this.emit("message", {
        data: bufferData,
        type: "message",
        target: this,
      });
    }, 5);
  }

  /**
   * Closes the WebSocket connection.
   */
  close(code?: number, reason?: string): void {
    if (this.readyStateValue === WebSocket.CLOSED || this.readyStateValue === WebSocket.CLOSING) {
      return;
    }

    this.readyStateValue = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyStateValue = WebSocket.CLOSED;
      this.emit("close", code ?? 1000, reason ?? Buffer.alloc(0));
    }, 10);
  }

  /**
   * Terminates the WebSocket connection.
   */
  terminate(): void {
    if (this.readyStateValue === WebSocket.CLOSED) {
      return;
    }

    this.readyStateValue = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyStateValue = WebSocket.CLOSED;
      this.emit("close", 1006, Buffer.from("terminated"));
      this.emit("unexpected-close");
    }, 5);
  }

  /**
   * Pings the server.
   */
  ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void {
    if (this.readyStateValue !== WebSocket.OPEN) {
      cb?.(new Error("WebSocket is not open"));
      return;
    }
    setTimeout(() => {
      this.emit("ping", data ?? Buffer.alloc(0));
      cb?.(null as any);
    }, 5);
  }

  /**
   * Pongs the server.
   */
  pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void {
    if (this.readyStateValue !== WebSocket.OPEN) {
      cb?.(new Error("WebSocket is not open"));
      return;
    }
    setTimeout(() => {
      this.emit("pong", data ?? Buffer.alloc(0));
      cb?.(null as any);
    }, 5);
  }

  /**
   * Simulates receiving a message.
   */
  simulateMessage(data: string | Buffer): void {
    if (this.readyStateValue !== WebSocket.OPEN) {
      return;
    }
    setTimeout(() => {
      this.emit("message", {
        data: typeof data === "string" ? data : Buffer.from(data),
        type: "message",
        target: this,
        isTrusted: true,
      });
    }, 5);
  }

  /**
   * Simulates connection error.
   */
  simulateError(error: Error): void {
    this.emit("error", error);
  }

  /**
   * Simulates connection close.
   */
  simulateClose(code: number, reason?: string): void {
    this.readyStateValue = WebSocket.CLOSED;
    this.emit("close", code, Buffer.from(reason ?? ""));
  }
}

/**
 * Mock WebSocket Server class for testing.
 */
export class MockWebSocketServer extends EventEmitter {
  private portValue: number;
  private hostValue = "127.0.0.1";
  private listeningValue = false;
  private clientsList: MockWebSocket[] = [];

  constructor(config?: { port?: number; host?: string; path?: string; noServer?: boolean; [key: string]: any }, connectionListener?: (client: MockWebSocket, request: any) => void) {
    super();

    this.portValue = config?.port ?? 8080;
    if (config?.host) {
      this.hostValue = config.host;
    }

    if (!config?.noServer) {
      setTimeout(() => {
        this.listeningValue = true;
        this.emit("listening");
      }, 10);
    }

    if (connectionListener) {
      this.on("connection", connectionListener);
    }
  }

  get port(): number {
    return this.portValue;
  }

  get host(): string {
    return this.hostValue;
  }

  get address(): { address: string; family: string; port: number } {
    return {
      address: this.hostValue,
      family: "IPv4",
      port: this.portValue,
    };
  }

  /**
   * Closes the server.
   */
  close(callback?: (err?: Error) => void): void {
    this.listeningValue = false;
    for (const client of this.clientsList) {
      client.close(1001, "server closing");
    }
    this.clientsList = [];
    this.emit("close");
    callback?.();
  }

  /**
   * Handles upgrade requests.
   */
  handleUpgrade(
    request: any,
    socket: any,
    head: Buffer,
    callback: (client: MockWebSocket, request: any) => void,
  ): void {
    const client = new MockWebSocket(`ws://${this.hostValue}:${this.portValue}`);
    this.clients.push(client);
    this.emit("connection", client, request);
    callback(client, request);
  }

  /**
   * Checks if a client should be handled.
   */
  shouldHandle(request: any): boolean {
    return true;
  }

  /**
   * Gets all connected clients.
   */
  get clients(): MockWebSocket[] {
    return this.clientsList;
  }

  /**
   * Broadcasts a message to all clients.
   */
  broadcast(data: string | Buffer): void {
    for (const client of this.clientsList) {
      if (client.readyState === WebSocket.OPEN) {
        client.simulateMessage(data);
      }
    }
  }

  /**
   * Gets the number of connected clients.
   */
  get clientsCount(): number {
    return this.clientsList.filter((c) => c.readyState === WebSocket.OPEN).length;
  }
}

/**
 * Creates a mock WebSocket client for testing.
 */
export function createMockWebSocket(url: string, protocols?: string | string[]): MockWebSocket {
  return new MockWebSocket(url, protocols);
}

/**
 * Creates a mock WebSocket server for testing.
 */
export function createMockWebSocketServer(
  config?: { port?: number; host?: string; path?: string; noServer?: boolean },
  connectionListener?: (client: MockWebSocket, request: any) => void,
): MockWebSocketServer {
  return new MockWebSocketServer(config, connectionListener);
}

/**
 * Simulates a WebSocket handshake.
 */
export async function simulateWebSocketHandshake(
  server: MockWebSocketServer,
  clientUrl?: string,
): Promise<{ client: MockWebSocket; serverClient: MockWebSocket }> {
  return new Promise((resolve) => {
    const client = new MockWebSocket(clientUrl ?? `ws://127.0.0.1:${server.port}`);

    server.once("connection", (serverClient) => {
      resolve({ client, serverClient });
    });
  });
}

/**
 * Mock ws module.
 */
export const ws = {
  WebSocket: MockWebSocket,
  WebSocketServer: MockWebSocketServer,

  // State constants
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED,

  // Convenience functions
  createWebSocket: createMockWebSocket,
  createWebSocketServer: createMockWebSocketServer,
  simulateHandshake: simulateWebSocketHandshake,
};

export default ws;
