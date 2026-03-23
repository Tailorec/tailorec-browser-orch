/**
 * Request factories for creating API request payloads.
 */

import {
  generateRef,
  generateTargetId,
  generateCdpUrl,
  generateCorrelationId,
  generateEmail,
  generateUniqueString,
} from "../factories/test-data.factory.js";

/**
 * Creates a snapshot request payload.
 */
export function createSnapshotRequest(options?: {
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
  maxChars?: number;
  interactiveOnly?: boolean;
  compact?: boolean;
  maxDepth?: number;
}): Record<string, unknown> {
  return {
    targetId: options?.targetId ?? generateTargetId(),
    cdpUrl: options?.cdpUrl ?? generateCdpUrl(),
    timeoutMs: options?.timeoutMs ?? 5000,
    maxChars: options?.maxChars,
    interactiveOnly: options?.interactiveOnly ?? false,
    compact: options?.compact ?? false,
    maxDepth: options?.maxDepth,
  };
}

/**
 * Creates a click action request payload.
 */
export function createClickRequest(options?: {
  ref?: string;
  targetId?: string;
  cdpUrl?: string;
  doubleClick?: boolean;
  button?: "left" | "right" | "middle";
  modifiers?: Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift">;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "click",
    ref: options?.ref ?? generateRef("d"),
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    doubleClick: options?.doubleClick ?? false,
    button: options?.button ?? "left",
    modifiers: options?.modifiers,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a type action request payload.
 */
export function createTypeRequest(options?: {
  ref?: string;
  text?: string;
  targetId?: string;
  cdpUrl?: string;
  submit?: boolean;
  slowly?: boolean;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "type",
    ref: options?.ref ?? generateRef("d"),
    text: options?.text ?? "test input",
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    submit: options?.submit ?? false,
    slowly: options?.slowly ?? false,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a fill action request payload.
 */
export function createFillRequest(options?: {
  ref?: string;
  value?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "fill",
    ref: options?.ref ?? generateRef("d"),
    value: options?.value ?? "test value",
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a form fill request payload.
 */
export function createFormFillRequest(options?: {
  fields?: Array<{ ref?: string; value: string }>;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "fill_form",
    fields:
      options?.fields ?? [
        { ref: generateRef("d", 1), value: "John Doe" },
        { ref: generateRef("d", 2), value: generateEmail() },
        { ref: generateRef("d", 3), value: "Test Address" },
      ],
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 15000,
  };
}

/**
 * Creates a hover action request payload.
 */
export function createHoverRequest(options?: {
  ref?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "hover",
    ref: options?.ref ?? generateRef("d"),
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a drag action request payload.
 */
export function createDragRequest(options?: {
  ref?: string;
  targetX?: number;
  targetY?: number;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "drag",
    ref: options?.ref ?? generateRef("d"),
    targetX: options?.targetX ?? 100,
    targetY: options?.targetY ?? 100,
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a select option action request payload.
 */
export function createSelectOptionRequest(options?: {
  ref?: string;
  value?: string;
  label?: string;
  index?: number;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "select_option",
    ref: options?.ref ?? generateRef("d"),
    value: options?.value,
    label: options?.label,
    index: options?.index,
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a press key action request payload.
 */
export function createPressKeyRequest(options?: {
  key?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "press",
    key: options?.key ?? "Enter",
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a wait action request payload.
 */
export function createWaitRequest(options?: {
  timeMs?: number;
  condition?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "wait",
    timeMs: options?.timeMs,
    condition: options?.condition,
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 30000,
  };
}

/**
 * Creates a navigate action request payload.
 */
export function createNavigateRequest(options?: {
  url?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
}): Record<string, unknown> {
  return {
    action: "navigate",
    url: options?.url ?? "https://example.test",
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 30000,
    waitUntil: options?.waitUntil ?? "load",
  };
}

/**
 * Creates an evaluate action request payload.
 */
export function createEvaluateRequest(options?: {
  expression?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "evaluate",
    expression: options?.expression ?? "document.title",
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a screenshot request payload.
 */
export function createScreenshotRequest(options?: {
  targetId?: string;
  cdpUrl?: string;
  fullPage?: boolean;
  quality?: number;
  type?: "png" | "jpeg";
}): Record<string, unknown> {
  return {
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    fullPage: options?.fullPage ?? false,
    quality: options?.quality ?? 80,
    type: options?.type ?? "png",
  };
}

/**
 * Creates a labeled screenshot request payload.
 */
export function createLabeledScreenshotRequest(options?: {
  targetId?: string;
  cdpUrl?: string;
  maxChars?: number;
  interactiveOnly?: boolean;
}): Record<string, unknown> {
  return {
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    maxChars: options?.maxChars,
    interactiveOnly: options?.interactiveOnly ?? false,
  };
}

/**
 * Creates a download request payload.
 */
export function createDownloadRequest(options?: {
  ref?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    ref: options?.ref ?? generateRef("d"),
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 30000,
  };
}

/**
 * Creates a file chooser hook request payload.
 */
export function createFileChooserRequest(options?: {
  action: "set" | "cancel";
  paths?: string[];
  targetId?: string;
  cdpUrl?: string;
}): Record<string, unknown> {
  return {
    action: options?.action ?? "set",
    paths: options?.paths ?? ["/tmp/test.txt"],
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
  };
}

/**
 * Creates a dialog hook request payload.
 */
export function createDialogRequest(options?: {
  action: "accept" | "dismiss";
  promptText?: string;
  targetId?: string;
  cdpUrl?: string;
}): Record<string, unknown> {
  return {
    action: options?.action ?? "accept",
    promptText: options?.promptText,
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
  };
}

/**
 * Creates a control request payload.
 */
export function createControlRequest(options?: {
  action: "start" | "stop";
  profile?: string;
  headless?: boolean;
}): Record<string, unknown> {
  return {
    action: options?.action ?? "start",
    profile: options?.profile ?? "default",
    headless: options?.headless ?? true,
  };
}

/**
 * Creates a query state request payload.
 */
export function createQueryStateRequest(options?: {
  ref?: string;
  states?: string[];
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    ref: options?.ref ?? generateRef("d"),
    states: options?.states ?? ["visible", "enabled", "editable"],
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a discover dropdown request payload.
 */
export function createDiscoverDropdownRequest(options?: {
  ref?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    ref: options?.ref ?? generateRef("d"),
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a close dropdown request payload.
 */
export function createCloseDropdownRequest(options?: {
  ref?: string;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    ref: options?.ref ?? generateRef("d"),
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a detect blocker request payload.
 */
export function createDetectBlockerRequest(options?: {
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a dismiss blocker request payload.
 */
export function createDismissBlockerRequest(options?: {
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}

/**
 * Creates a scroll action request payload.
 */
export function createScrollRequest(options?: {
  ref?: string;
  deltaX?: number;
  deltaY?: number;
  targetId?: string;
  cdpUrl?: string;
  timeoutMs?: number;
}): Record<string, unknown> {
  return {
    action: "scroll",
    ref: options?.ref,
    deltaX: options?.deltaX ?? 0,
    deltaY: options?.deltaY ?? 100,
    targetId: options?.targetId,
    cdpUrl: options?.cdpUrl,
    timeoutMs: options?.timeoutMs ?? 8000,
  };
}
