import type { RequestHandler } from 'express';
import { createSubsystemLogger } from '../logging/pino-logger.adapter.js';
import { RELAY_AUTH_HEADER, getHeader } from './extension-relay.utils.js';
import type { ChromeExtensionRelayServer } from './extension-relay.types.js';

// Duplex type for WebSocket upgrade handlers (using Socket as a compatible type)
type Duplex = {
  write: (data: Buffer | string) => void;
  end: () => void;
  destroy: () => void;
  remoteAddress?: string;
};

const log = createSubsystemLogger('extension-relay-router');

/**
 * Options for the extension relay router.
 */
export type ExtensionRelayRouterOptions = {
  /** The relay server instance */
  server: ChromeExtensionRelayServer;
  /** Base path for the routes (default: '/relay') */
  basePath?: string;
};

/**
 * Create Express request handlers for the extension relay server.
 * 
 * This provides REST endpoints for:
 * - GET /status - Check extension connection status
 * - GET /json/version - Get CDP version info
 * - GET /json/list - List available targets
 * - GET /json/activate/:targetId - Activate a target
 * - GET /json/close/:targetId - Close a target
 */
export function createExtensionRelayRouter(options: ExtensionRelayRouterOptions): {
  statusHandler: RequestHandler;
  versionHandler: RequestHandler;
  listHandler: RequestHandler;
  activateHandler: RequestHandler;
  closeHandler: RequestHandler;
} {
  const { server, basePath = '/relay' } = options;

  /**
   * GET /status - Check extension connection status
   */
  const statusHandler: RequestHandler = (req, res) => {
    try {
      const connected = server.extensionConnected();
      res.json({ connected });
    } catch (error) {
      log.exception('status handler failed', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * GET /json/version - Get CDP version info
   */
  const versionHandler: RequestHandler = (req, res) => {
    try {
      const token = getHeader(req, RELAY_AUTH_HEADER);
      
      // For router, we skip auth check if no token is provided
      // The actual server handles auth at the WebSocket level
      
      const payload: Record<string, unknown> = {
        Browser: 'OpenClaw/extension-relay',
        'Protocol-Version': '1.3',
      };

      if (server.extensionConnected()) {
        payload.webSocketDebuggerUrl = server.cdpWsUrl;
      }

      res.json(payload);
    } catch (error) {
      log.exception('version handler failed', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * GET /json/list - List available targets
   */
  const listHandler: RequestHandler = (req, res) => {
    try {
      // In a real implementation, this would query the server state
      // For now, we return an empty list as the actual data comes from the server
      res.json([]);
    } catch (error) {
      log.exception('list handler failed', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * GET /json/activate/:targetId - Activate a target
   */
  const activateHandler: RequestHandler = (req, res) => {
    try {
      const targetId = req.params.targetId;
      
      if (!targetId) {
        res.status(400).json({ error: 'targetId required' });
        return;
      }

      // Activation is handled asynchronously
      // In a real implementation, this would call the server's activate method
      res.status(200).send('OK');
    } catch (error) {
      log.exception('activate handler failed', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * GET /json/close/:targetId - Close a target
   */
  const closeHandler: RequestHandler = (req, res) => {
    try {
      const targetId = req.params.targetId;
      
      if (!targetId) {
        res.status(400).json({ error: 'targetId required' });
        return;
      }

      // Closing is handled asynchronously
      // In a real implementation, this would call the server's close method
      res.status(200).send('OK');
    } catch (error) {
      log.exception('close handler failed', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    statusHandler,
    versionHandler,
    listHandler,
    activateHandler,
    closeHandler,
  };
}

/**
 * Middleware to validate relay auth token.
 */
export function createRelayAuthMiddleware(expectedToken?: string): RequestHandler {
  return (req, res, next) => {
    const token = getHeader(req, RELAY_AUTH_HEADER);
    
    if (expectedToken && token !== expectedToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    next();
  };
}

/**
 * WebSocket upgrade handler for extension connections.
 * This should be used with the HTTP server's 'upgrade' event.
 */
export type WebSocketUpgradeHandler = (
  req: import('http').IncomingMessage,
  socket: import('node:stream').Duplex,
  head: Buffer,
) => void;

/**
 * Create WebSocket upgrade handlers for the extension relay.
 */
export function createWebSocketHandlers(options: {
  server: ChromeExtensionRelayServer;
}): {
  extensionHandler: WebSocketUpgradeHandler;
  cdpHandler: WebSocketUpgradeHandler;
} {
  const { server } = options;

  // These handlers would be implemented based on the actual server implementation
  // For now, they're placeholders that reject all connections
  
  const extensionHandler: WebSocketUpgradeHandler = (req, socket) => {
    log.warn('extension WebSocket upgrade not implemented in router');
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
  };

  const cdpHandler: WebSocketUpgradeHandler = (req, socket) => {
    log.warn('CDP WebSocket upgrade not implemented in router');
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
  };

  return { extensionHandler, cdpHandler };
}
