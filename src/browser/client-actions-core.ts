export type BrowserFormField = {
  ref: string;
  type: string;
  value?: string | number | boolean;
};

export type BrowserActRequest =
  | {
      kind: "click";
      ref: string;
      targetId?: string;
      doubleClick?: boolean;
      button?: string;
      modifiers?: string[];
      timeoutMs?: number;
    }
  | {
      kind: "type";
      ref: string;
      text: string;
      targetId?: string;
      submit?: boolean;
      slowly?: boolean;
      timeoutMs?: number;
    }
  | { kind: "press"; key: string; targetId?: string; delayMs?: number }
  | { kind: "hover"; ref: string; targetId?: string; timeoutMs?: number }
  | {
      kind: "scrollIntoView";
      ref: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: "drag";
      startRef: string;
      endRef: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: "select";
      ref: string;
      values: string[];
      targetId?: string;
      timeoutMs?: number;
    }
  | {
      kind: "fill";
      fields: BrowserFormField[];
      targetId?: string;
      timeoutMs?: number;
    }
  | { kind: "resize"; width: number; height: number; targetId?: string }
  | {
      kind: "wait";
      timeMs?: number;
      text?: string;
      textGone?: string;
      selector?: string;
      url?: string;
      loadState?: "load" | "domcontentloaded" | "networkidle";
      fn?: string;
      targetId?: string;
      timeoutMs?: number;
    }
  | { kind: "evaluate"; fn: string; ref?: string; targetId?: string }
  | { kind: "close"; targetId?: string };

export type BrowserActResponse = {
  ok: true;
  targetId: string;
  url?: string;
  result?: unknown;
};

export type BrowserDownloadPayload = {
  url: string;
  suggestedFilename: string;
  path: string;
};
