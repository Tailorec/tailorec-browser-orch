/**
 * Browser Actions Type Definitions
 * 
 * Type definitions for browser action requests and responses.
 * Extracted from: src/browser/client-actions-core.ts and client-actions-types.ts
 */

/**
 * Browser form field for fill actions
 */
export type BrowserFormField = {
  ref: string;
  type: string;
  value?: string | number | boolean;
};

/**
 * Browser action request union type
 */
export type BrowserActRequest =
  | {
      kind: 'click';
      ref: string;
      targetId?: string;
      doubleClick?: boolean;
      button?: 'left' | 'right' | 'middle';
      modifiers?: Array<'Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift'>;
      timeoutMs?: number;
    }
  | {
      kind: 'type';
      ref: string;
      text: string;
      targetId?: string;
      submit?: boolean;
      slowly?: boolean;
      timeoutMs?: number;
    }
  | {
      kind: 'press';
      key: string;
      targetId?: string;
      delayMs?: number;
    }
  | {
      kind: 'hover';
      ref: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'scrollIntoView';
      ref: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'drag';
      startRef: string;
      endRef: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'select';
      ref: string;
      values: string[];
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'fill';
      fields: BrowserFormField[];
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'resize';
      width: number;
      height: number;
      targetId?: string;
    }
  | {
      kind: 'wait';
      timeMs?: number;
      text?: string;
      textGone?: string;
      selector?: string;
      url?: string;
      loadState?: 'load' | 'domcontentloaded' | 'networkidle';
      fn?: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'evaluate';
      fn: string;
      ref?: string;
      targetId?: string;
    }
  | {
      kind: 'close';
      targetId?: string;
    }
  | {
      kind: 'file_upload';
      ref?: string;
      inputRef?: string;
      element?: string;
      paths: string[];
      targetId?: string;
      timeoutMs?: number;
      keepStagedFiles?: boolean;
    }
  | {
      kind: 'dialog';
      accept: boolean;
      promptText?: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'download';
      ref: string;
      path: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: 'screenshot';
      targetId?: string;
      fullPage?: boolean;
      format?: 'png' | 'jpeg';
      quality?: number;
    };

/**
 * Browser action response
 */
export type BrowserActResponse = {
  ok: true;
  targetId: string;
  url?: string;
  result?: unknown;
};

/**
 * Download payload
 */
export type BrowserDownloadPayload = {
  url: string;
  suggestedFilename: string;
  path: string;
};

/**
 * File upload payload
 */
export type BrowserFileUploadPayload = {
  ref?: string;
  inputRef?: string;
  element?: string;
  paths: string[];
  timeoutMs?: number;
};

/**
 * Dialog payload
 */
export type BrowserDialogPayload = {
  accept: boolean;
  promptText?: string;
  timeoutMs?: number;
};

/**
 * Wait options
 */
export type BrowserWaitOptions = {
  timeMs?: number;
  text?: string;
  textGone?: string;
  selector?: string;
  url?: string;
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  fn?: string;
  timeoutMs?: number;
};

/**
 * Screenshot options
 */
export type BrowserScreenshotOptions = {
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  targetId?: string;
};

/**
 * Action execution result
 */
export type ActionResult = {
  success: boolean;
  targetId: string;
  url?: string;
  error?: string;
  result?: unknown;
};
