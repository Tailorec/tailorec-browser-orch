/**
 * CDP command message type.
 */
export type CdpCommand = {
  id: number;
  method: string;
  params?: unknown;
  sessionId?: string;
};

/**
 * CDP response message type.
 */
export type CdpResponse = {
  id: number;
  result?: unknown;
  error?: { message: string };
  sessionId?: string;
};

/**
 * CDP event message type.
 */
export type CdpEvent = {
  method: string;
  params?: unknown;
  sessionId?: string;
};

/**
 * Extension forward command message.
 */
export type ExtensionForwardCommandMessage = {
  id: number;
  method: 'forwardCDPCommand';
  params: { method: string; params?: unknown; sessionId?: string };
};

/**
 * Extension response message.
 */
export type ExtensionResponseMessage = {
  id: number;
  result?: unknown;
  error?: string;
};

/**
 * Extension forward event message.
 */
export type ExtensionForwardEventMessage = {
  method: 'forwardCDPEvent';
  params: { method: string; params?: unknown; sessionId?: string };
};

/**
 * Extension ping message.
 */
export type ExtensionPingMessage = { method: 'ping' };

/**
 * Extension pong message.
 */
export type ExtensionPongMessage = { method: 'pong' };

/**
 * Extension message union type.
 */
export type ExtensionMessage =
  | ExtensionResponseMessage
  | ExtensionForwardEventMessage
  | ExtensionPongMessage;

/**
 * Target information.
 */
export type TargetInfo = {
  targetId: string;
  type?: string;
  title?: string;
  url?: string;
  attached?: boolean;
};

/**
 * Attached to target event.
 */
export type AttachedToTargetEvent = {
  sessionId: string;
  targetInfo: TargetInfo;
  waitingForDebugger?: boolean;
};

/**
 * Detached from target event.
 */
export type DetachedFromTargetEvent = {
  sessionId: string;
  targetId?: string;
};

/**
 * Connected target information.
 */
export type ConnectedTarget = {
  sessionId: string;
  targetId: string;
  targetInfo: TargetInfo;
};

/**
 * Chrome extension relay server instance.
 */
export type ChromeExtensionRelayServer = {
  host: string;
  port: number;
  baseUrl: string;
  cdpWsUrl: string;
  extensionConnected: () => boolean;
  stop: () => Promise<void>;
};

/**
 * Target list item for /json/list endpoint.
 */
export type TargetListItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  url: string;
  webSocketDebuggerUrl: string;
  devtoolsFrontendUrl: string;
};
