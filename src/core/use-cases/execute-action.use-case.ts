/**
 * Execute action use case
 * Worktree A stub - to be implemented
 */

export type ActionKind =
  | 'click'
  | 'type'
  | 'press'
  | 'hover'
  | 'scrollIntoView'
  | 'drag'
  | 'select'
  | 'fill'
  | 'resize'
  | 'wait'
  | 'evaluate'
  | 'navigate'
  | 'close'
  | 'query_state'
  | 'discover_dropdown'
  | 'close_dropdown'
  | 'detect_blocker'
  | 'dismiss_blocker';

export interface BaseAction {
  kind: ActionKind;
  targetId?: string;
  timeoutMs?: number;
}

export interface ClickAction extends BaseAction {
  kind: 'click';
  ref: string;
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
}

export interface TypeAction extends BaseAction {
  kind: 'type';
  ref: string;
  text: string;
  submit?: boolean;
  slowly?: boolean;
}

export interface NavigateAction extends BaseAction {
  kind: 'navigate';
  url: string;
}

export interface PressAction extends BaseAction {
  kind: 'press';
  key: string;
  delayMs?: number;
}

export interface HoverAction extends BaseAction {
  kind: 'hover';
  ref: string;
}

export interface BrowserFormField {
  ref: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'password' | 'checkbox' | 'radio' | string;
  value?: string | number | boolean;
}

export interface FillAction extends BaseAction {
  kind: 'fill';
  fields: BrowserFormField[];
}

export interface WaitAction extends BaseAction {
  kind: 'wait';
  timeMs?: number;
  text?: string;
  textGone?: string;
  selector?: string;
  url?: string;
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  fn?: string;
}

export interface ResizeAction extends BaseAction {
  kind: 'resize';
  width: number;
  height: number;
}

export interface DragAction extends BaseAction {
  kind: 'drag';
  startRef: string;
  endRef: string;
}

export interface SelectAction extends BaseAction {
  kind: 'select';
  ref: string;
  values: string[];
}

export type Action =
  | ClickAction
  | TypeAction
  | NavigateAction
  | PressAction
  | HoverAction
  | FillAction
  | WaitAction
  | ResizeAction
  | DragAction
  | SelectAction;

export interface ExecuteActionRequest {
  action: Action;
  targetId?: string;
}

export interface ExecuteActionResponse {
  targetId: string;
  url: string;
  results?: Array<{ matched: boolean; ref: string }>;
  allMatched?: boolean;
  mismatched?: Array<{ ref: string; requested?: string; actual?: string; warning?: string }>;
}

export interface ExecuteActionUseCase {
  execute(request: ExecuteActionRequest): Promise<ExecuteActionResponse>;
}
