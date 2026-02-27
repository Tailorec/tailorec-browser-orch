/**
 * Response factories for creating API response objects.
 */

import { generateRef, generateTimestamp, generateBase64, generateTargetId } from "./test-data.factory.js";

/**
 * Creates a success response payload.
 */
export function createSuccessResponse<T = unknown>(data?: T, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    success: true,
    ...(data ?? {}),
    ...(extra ?? {}),
  };
}

/**
 * Creates an error response payload.
 */
export function createErrorResponse(options?: {
  error?: string;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    success: false,
    error: options?.error ?? "Unknown error",
    message: options?.message,
    code: options?.code,
    details: options?.details,
  };
}

/**
 * Creates a snapshot response payload.
 */
export function createSnapshotResponse(options?: {
  snapshot?: string;
  refs?: Array<{ ref: string; role: string; name?: string }>;
  incremental?: string;
  truncated?: boolean;
  targetId?: string;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    snapshot: options?.snapshot ?? "<html><body><button>Click me</button></body></html>",
    refs: options?.refs ?? [
      { ref: generateRef("d", 1), role: "button", name: "Click me" },
    ],
    incremental: options?.incremental,
    truncated: options?.truncated ?? false,
    targetId: options?.targetId,
    durationMs: options?.durationMs ?? 100,
  };
}

/**
 * Creates an act response payload.
 */
export function createActResponse(options?: {
  success?: boolean;
  results?: Record<string, unknown>;
  warnings?: string[];
  durationMs?: number;
  ref?: string;
}): Record<string, unknown> {
  return {
    success: options?.success ?? true,
    results: options?.results ?? {},
    warnings: options?.warnings ?? [],
    durationMs: options?.durationMs ?? 50,
    ref: options?.ref,
  };
}

/**
 * Creates a click action response payload.
 */
export function createClickResponse(options?: {
  ref?: string;
  durationMs?: number;
  button?: string;
}): Record<string, unknown> {
  return {
    success: true,
    action: "click",
    ref: options?.ref ?? generateRef("d"),
    durationMs: options?.durationMs ?? 50,
    button: options?.button ?? "left",
  };
}

/**
 * Creates a type action response payload.
 */
export function createTypeResponse(options?: {
  ref?: string;
  durationMs?: number;
  text?: string;
  submitted?: boolean;
}): Record<string, unknown> {
  return {
    success: true,
    action: "type",
    ref: options?.ref ?? generateRef("d"),
    durationMs: options?.durationMs ?? 100,
    text: options?.text ?? "test input",
    submitted: options?.submitted ?? false,
  };
}

/**
 * Creates a fill action response payload.
 */
export function createFillResponse(options?: {
  ref?: string;
  durationMs?: number;
  value?: string;
  strategy?: string;
  actualValue?: string;
  matched?: boolean;
}): Record<string, unknown> {
  return {
    success: true,
    action: "fill",
    ref: options?.ref ?? generateRef("d"),
    durationMs: options?.durationMs ?? 100,
    value: options?.value ?? "test value",
    strategy: options?.strategy ?? "fill",
    actualValue: options?.actualValue ?? "test value",
    matched: options?.matched ?? true,
  };
}

/**
 * Creates a form fill response payload.
 */
export function createFormFillResponse(options?: {
  results?: Array<{ ref: string; success: boolean; matched?: boolean; warning?: string }>;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    action: "fill_form",
    results: options?.results ?? [
      { ref: generateRef("d", 1), success: true, matched: true },
      { ref: generateRef("d", 2), success: true, matched: true },
    ],
    durationMs: options?.durationMs ?? 200,
  };
}

/**
 * Creates a screenshot response payload.
 */
export function createScreenshotResponse(options?: {
  image?: string;
  type?: "png" | "jpeg";
  width?: number;
  height?: number;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    image: options?.image ?? generateBase64(1000),
    type: options?.type ?? "png",
    width: options?.width ?? 1280,
    height: options?.height ?? 720,
    durationMs: options?.durationMs ?? 500,
  };
}

/**
 * Creates a labeled screenshot response payload.
 */
export function createLabeledScreenshotResponse(options?: {
  image?: string;
  snapshot?: string;
  refs?: Array<{ ref: string; role: string; name?: string }>;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    image: options?.image ?? generateBase64(1000),
    snapshot: options?.snapshot ?? "<html><body></body></html>",
    refs: options?.refs ?? [],
    durationMs: options?.durationMs ?? 600,
  };
}

/**
 * Creates a download response payload.
 */
export function createDownloadResponse(options?: {
  downloads?: Array<{
    url: string;
    suggestedFilename: string;
    state: "completed" | "in_progress" | "canceled";
    receivedBytes: number;
    totalBytes: number;
  }>;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    downloads: options?.downloads ?? [
      {
        url: "https://example.test/file.pdf",
        suggestedFilename: "file.pdf",
        state: "completed" as const,
        receivedBytes: 1024,
        totalBytes: 1024,
      },
    ],
    durationMs: options?.durationMs ?? 1000,
  };
}

/**
 * Creates a file chooser response payload.
 */
export function createFileChooserResponse(options?: {
  accepted: boolean;
  paths?: string[];
  canceled?: boolean;
}): Record<string, unknown> {
  return {
    accepted: options?.accepted ?? true,
    paths: options?.paths ?? [],
    canceled: options?.canceled ?? false,
  };
}

/**
 * Creates a dialog response payload.
 */
export function createDialogResponse(options?: {
  handled: boolean;
  type?: "alert" | "confirm" | "prompt" | "beforeunload";
  message?: string;
  defaultValue?: string;
}): Record<string, unknown> {
  return {
    handled: options?.handled ?? true,
    type: options?.type ?? "alert",
    message: options?.message ?? "Test dialog",
    defaultValue: options?.defaultValue,
  };
}

/**
 * Creates a control response payload.
 */
export function createControlResponse(options?: {
  action?: "start" | "stop";
  profile?: string;
  port?: number;
  cdpUrl?: string;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    action: options?.action ?? "start",
    profile: options?.profile ?? "default",
    port: options?.port ?? 9222,
    cdpUrl: options?.cdpUrl ?? "http://127.0.0.1:9222",
    durationMs: options?.durationMs ?? 2000,
  };
}

/**
 * Creates a status response payload.
 */
export function createStatusResponse(options?: {
  status?: string;
  version?: string;
  port?: number;
  profiles?: string[];
  browserConnected?: boolean;
}): Record<string, unknown> {
  return {
    status: options?.status ?? "ok",
    version: options?.version ?? "1.0.0",
    port: options?.port ?? 4000,
    profiles: options?.profiles ?? ["default"],
    browserConnected: options?.browserConnected ?? true,
  };
}

/**
 * Creates a query state response payload.
 */
export function createQueryStateResponse(options?: {
  ref?: string;
  states?: Record<string, boolean>;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    ref: options?.ref ?? generateRef("d"),
    states: options?.states ?? {
      visible: true,
      enabled: true,
      editable: true,
      hidden: false,
      disabled: false,
      readonly: false,
    },
    durationMs: options?.durationMs ?? 50,
  };
}

/**
 * Creates a discover dropdown response payload.
 */
export function createDiscoverDropdownResponse(options?: {
  ref?: string;
  options?: Array<{ value: string; label: string; index: number }>;
  selected?: string;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    ref: options?.ref ?? generateRef("d"),
    options: options?.options ?? [
      { value: "1", label: "Option 1", index: 0 },
      { value: "2", label: "Option 2", index: 1 },
      { value: "3", label: "Option 3", index: 2 },
    ],
    selected: options?.selected,
    durationMs: options?.durationMs ?? 100,
  };
}

/**
 * Creates a close dropdown response payload.
 */
export function createCloseDropdownResponse(options?: {
  ref?: string;
  success?: boolean;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: options?.success ?? true,
    ref: options?.ref ?? generateRef("d"),
    durationMs: options?.durationMs ?? 50,
  };
}

/**
 * Creates a detect blocker response payload.
 */
export function createDetectBlockerResponse(options?: {
  detected: boolean;
  type?: string;
  ref?: string;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    detected: options?.detected ?? false,
    type: options?.type,
    ref: options?.ref,
    durationMs: options?.durationMs ?? 50,
  };
}

/**
 * Creates a dismiss blocker response payload.
 */
export function createDismissBlockerResponse(options?: {
  success?: boolean;
  dismissed?: boolean;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: options?.success ?? true,
    dismissed: options?.dismissed ?? true,
    durationMs: options?.durationMs ?? 100,
  };
}

/**
 * Creates a wait response payload.
 */
export function createWaitResponse(options?: {
  condition?: string;
  durationMs?: number;
  waitedMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    condition: options?.condition ?? "timeout",
    durationMs: options?.durationMs ?? 1000,
    waitedMs: options?.waitedMs ?? 1000,
  };
}

/**
 * Creates a navigate response payload.
 */
export function createNavigateResponse(options?: {
  url?: string;
  title?: string;
  durationMs?: number;
  redirected?: boolean;
}): Record<string, unknown> {
  return {
    success: true,
    url: options?.url ?? "https://example.test",
    title: options?.title ?? "Example Domain",
    durationMs: options?.durationMs ?? 1500,
    redirected: options?.redirected ?? false,
  };
}

/**
 * Creates an evaluate response payload.
 */
export function createEvaluateResponse(options?: {
  result?: unknown;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    result: options?.result ?? "test result",
    durationMs: options?.durationMs ?? 50,
  };
}

/**
 * Creates a hover response payload.
 */
export function createHoverResponse(options?: {
  ref?: string;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    action: "hover",
    ref: options?.ref ?? generateRef("d"),
    durationMs: options?.durationMs ?? 50,
  };
}

/**
 * Creates a drag response payload.
 */
export function createDragResponse(options?: {
  ref?: string;
  targetX?: number;
  targetY?: number;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    action: "drag",
    ref: options?.ref ?? generateRef("d"),
    targetX: options?.targetX ?? 100,
    targetY: options?.targetY ?? 100,
    durationMs: options?.durationMs ?? 100,
  };
}

/**
 * Creates a select option response payload.
 */
export function createSelectOptionResponse(options?: {
  ref?: string;
  value?: string;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    action: "select_option",
    ref: options?.ref ?? generateRef("d"),
    value: options?.value ?? "option1",
    durationMs: options?.durationMs ?? 50,
  };
}

/**
 * Creates a press key response payload.
 */
export function createPressKeyResponse(options?: {
  key?: string;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    action: "press",
    key: options?.key ?? "Enter",
    durationMs: options?.durationMs ?? 50,
  };
}

/**
 * Creates a scroll response payload.
 */
export function createScrollResponse(options?: {
  ref?: string;
  deltaX?: number;
  deltaY?: number;
  durationMs?: number;
}): Record<string, unknown> {
  return {
    success: true,
    action: "scroll",
    ref: options?.ref,
    deltaX: options?.deltaX ?? 0,
    deltaY: options?.deltaY ?? 100,
    durationMs: options?.durationMs ?? 50,
  };
}
