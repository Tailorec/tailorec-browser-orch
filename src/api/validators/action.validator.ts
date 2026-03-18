import { z } from 'zod';

/**
 * Base action schema with common fields
 * Extracted from src/browser/routes/agent.act.ts
 */
const BaseActionSchema = z.object({
  targetId: z.string().optional(),
  timeoutMs: z.number().optional(),
});

/**
 * Click action schema
 */
const ClickActionSchema = BaseActionSchema.extend({
  kind: z.literal('click'),
  ref: z.string(),
  doubleClick: z.boolean().default(false),
  button: z.enum(['left', 'right', 'middle']).optional(),
  modifiers: z.array(z.enum(['Alt', 'Control', 'Meta', 'Shift', 'ControlOrMeta'])).optional(),
});

/**
 * Type action schema
 */
const TypeActionSchema = BaseActionSchema.extend({
  kind: z.literal('type'),
  ref: z.string(),
  text: z.string(),
  submit: z.boolean().default(false),
  slowly: z.boolean().default(false),
});

/**
 * Press action schema
 */
const PressActionSchema = BaseActionSchema.extend({
  kind: z.literal('press'),
  key: z.string(),
  delayMs: z.number().optional(),
});

/**
 * Hover action schema
 */
const HoverActionSchema = BaseActionSchema.extend({
  kind: z.literal('hover'),
  ref: z.string(),
});

/**
 * Scroll into view action schema
 */
const ScrollIntoViewActionSchema = BaseActionSchema.extend({
  kind: z.literal('scrollIntoView'),
  ref: z.string(),
});

/**
 * Drag action schema
 */
const DragActionSchema = BaseActionSchema.extend({
  kind: z.literal('drag'),
  startRef: z.string(),
  endRef: z.string(),
});

/**
 * Select action schema
 */
const SelectActionSchema = BaseActionSchema.extend({
  kind: z.literal('select'),
  ref: z.string(),
  values: z.array(z.string()),
});

/**
 * Fill form field schema
 */
const BrowserFormFieldSchema = z.object({
  ref: z.string(),
  type: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

/**
 * Fill action schema
 */
const FillActionSchema = BaseActionSchema.extend({
  kind: z.literal('fill'),
  fields: z.array(BrowserFormFieldSchema),
});

/**
 * Resize action schema
 */
const ResizeActionSchema = BaseActionSchema.extend({
  kind: z.literal('resize'),
  width: z.number(),
  height: z.number(),
});

/**
 * Wait action schema
 */
const WaitActionSchema = BaseActionSchema.extend({
  kind: z.literal('wait'),
  timeMs: z.number().optional(),
  text: z.string().optional(),
  textGone: z.string().optional(),
  selector: z.string().optional(),
  url: z.string().optional(),
  loadState: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  fn: z.string().optional(),
});

/**
 * Evaluate action schema
 */
const EvaluateActionSchema = BaseActionSchema.extend({
  kind: z.literal('evaluate'),
  fn: z.string(),
  ref: z.string().optional(),
});

/**
 * Navigate action schema
 */
const NavigateActionSchema = BaseActionSchema.extend({
  kind: z.literal('navigate'),
  url: z.string().min(1),
});

/**
 * Close action schema
 */
const CloseActionSchema = BaseActionSchema.extend({
  kind: z.literal('close'),
});

/**
 * Query state action schema
 */
const QueryStateActionSchema = BaseActionSchema.extend({
  kind: z.literal('query_state'),
  ref: z.string().optional(),
  refs: z.array(z.string()).optional(),
});

/**
 * Discover dropdown action schema
 */
const DiscoverDropdownActionSchema = BaseActionSchema.extend({
  kind: z.literal('discover_dropdown'),
  ref: z.string(),
  searchText: z.string().optional(),
});

/**
 * Close dropdown action schema
 */
const CloseDropdownActionSchema = BaseActionSchema.extend({
  kind: z.literal('close_dropdown'),
  ref: z.string(),
});

/**
 * Detect blocker action schema
 */
const DetectBlockerActionSchema = BaseActionSchema.extend({
  kind: z.literal('detect_blocker'),
  ref: z.string(),
});

/**
 * Dismiss blocker action schema
 */
const DismissBlockerActionSchema = BaseActionSchema.extend({
  kind: z.literal('dismiss_blocker'),
  targetRef: z.string(),
  strategy: z.string().optional(),
  closeButtonRef: z.string().optional(),
});

/**
 * Combined action request schema using discriminated union
 */
export const ActionRequestSchema = z.discriminatedUnion('kind', [
  ClickActionSchema,
  TypeActionSchema,
  PressActionSchema,
  HoverActionSchema,
  ScrollIntoViewActionSchema,
  DragActionSchema,
  SelectActionSchema,
  FillActionSchema,
  ResizeActionSchema,
  WaitActionSchema,
  EvaluateActionSchema,
  NavigateActionSchema,
  CloseActionSchema,
  QueryStateActionSchema,
  DiscoverDropdownActionSchema,
  CloseDropdownActionSchema,
  DetectBlockerActionSchema,
  DismissBlockerActionSchema,
]);

export type ActionRequestDTO = z.infer<typeof ActionRequestSchema>;
export type ClickActionDTO = z.infer<typeof ClickActionSchema>;
export type TypeActionDTO = z.infer<typeof TypeActionSchema>;
export type PressActionDTO = z.infer<typeof PressActionSchema>;
export type HoverActionDTO = z.infer<typeof HoverActionSchema>;
export type FillActionDTO = z.infer<typeof FillActionSchema>;
export type NavigateActionDTO = z.infer<typeof NavigateActionSchema>;
export type WaitActionDTO = z.infer<typeof WaitActionSchema>;
export type ScrollIntoViewActionDTO = z.infer<typeof ScrollIntoViewActionSchema>;
export type DragActionDTO = z.infer<typeof DragActionSchema>;
export type SelectActionDTO = z.infer<typeof SelectActionSchema>;
export type ResizeActionDTO = z.infer<typeof ResizeActionSchema>;
export type EvaluateActionDTO = z.infer<typeof EvaluateActionSchema>;
export type QueryStateActionDTO = z.infer<typeof QueryStateActionSchema>;
export type DiscoverDropdownActionDTO = z.infer<typeof DiscoverDropdownActionSchema>;
export type CloseDropdownActionDTO = z.infer<typeof CloseDropdownActionSchema>;
export type DetectBlockerActionDTO = z.infer<typeof DetectBlockerActionSchema>;
export type DismissBlockerActionDTO = z.infer<typeof DismissBlockerActionSchema>;

/**
 * File chooser hook request schema
 */
export const FileChooserRequestSchema = z.object({
  targetId: z.string().optional(),
  ref: z.string().optional(),
  inputRef: z.string().optional(),
  element: z.string().optional(),
  paths: z.array(z.string()),
  timeoutMs: z.number().optional(),
});

export type FileChooserRequestDTO = z.infer<typeof FileChooserRequestSchema>;

/**
 * Dialog hook request schema
 */
export const DialogRequestSchema = z.object({
  targetId: z.string().optional(),
  accept: z.boolean(),
  promptText: z.string().optional(),
  timeoutMs: z.number().optional(),
});

export type DialogRequestDTO = z.infer<typeof DialogRequestSchema>;

/**
 * Download wait request schema
 */
export const DownloadWaitRequestSchema = z.object({
  targetId: z.string().optional(),
  path: z.string().optional(),
  timeoutMs: z.number().optional(),
});

export type DownloadWaitRequestDTO = z.infer<typeof DownloadWaitRequestSchema>;

/**
 * Download request schema
 */
export const DownloadRequestSchema = z.object({
  targetId: z.string().optional(),
  ref: z.string(),
  path: z.string(),
  timeoutMs: z.number().optional(),
});

export type DownloadRequestDTO = z.infer<typeof DownloadRequestSchema>;

/**
 * Action validation error
 */
export class ActionValidationError extends Error {
  constructor(
    public errors: Array<{ field: string; message: string }>,
  ) {
    super(`Action validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'ActionValidationError';
  }
}

/**
 * Action validator class
 * Validates action request payloads
 */
export class ActionValidator {
  /**
   * Validate click action
   */
  validateClick(payload: unknown): ClickActionDTO {
    return this.validate(payload, ClickActionSchema) as ClickActionDTO;
  }

  /**
   * Validate type action
   */
  validateType(payload: unknown): TypeActionDTO {
    return this.validate(payload, TypeActionSchema) as TypeActionDTO;
  }

  /**
   * Validate press action
   */
  validatePress(payload: unknown): PressActionDTO {
    return this.validate(payload, PressActionSchema);
  }

  /**
   * Validate hover action
   */
  validateHover(payload: unknown): HoverActionDTO {
    return this.validate(payload, HoverActionSchema);
  }

  /**
   * Validate fill action
   */
  validateFill(payload: unknown): FillActionDTO {
    return this.validate(payload, FillActionSchema);
  }

  /**
   * Validate navigate action
   */
  validateNavigate(payload: unknown): NavigateActionDTO {
    return this.validate(payload, NavigateActionSchema);
  }

  validateScrollIntoView(payload: unknown): ScrollIntoViewActionDTO {
    return this.validate(payload, ScrollIntoViewActionSchema);
  }

  validateDrag(payload: unknown): DragActionDTO {
    return this.validate(payload, DragActionSchema);
  }

  validateSelect(payload: unknown): SelectActionDTO {
    return this.validate(payload, SelectActionSchema);
  }

  validateResize(payload: unknown): ResizeActionDTO {
    return this.validate(payload, ResizeActionSchema);
  }

  /**
   * Validate wait action
   */
  validateWait(payload: unknown): WaitActionDTO {
    const parsed = this.validate(payload, WaitActionSchema);
    if (
      parsed.timeMs === undefined &&
      !parsed.text &&
      !parsed.textGone &&
      !parsed.selector &&
      !parsed.url &&
      !parsed.loadState &&
      !parsed.fn
    ) {
      throw new ActionValidationError([
        {
          field: 'root',
          message: 'wait requires at least one of: timeMs, text, textGone, selector, url, loadState, fn',
        },
      ]);
    }
    return parsed;
  }

  validateEvaluate(payload: unknown): EvaluateActionDTO {
    return this.validate(payload, EvaluateActionSchema);
  }

  validateQueryState(payload: unknown): QueryStateActionDTO {
    return this.validate(payload, QueryStateActionSchema);
  }

  validateDiscoverDropdown(payload: unknown): DiscoverDropdownActionDTO {
    return this.validate(payload, DiscoverDropdownActionSchema);
  }

  validateCloseDropdown(payload: unknown): CloseDropdownActionDTO {
    return this.validate(payload, CloseDropdownActionSchema);
  }

  validateDetectBlocker(payload: unknown): DetectBlockerActionDTO {
    return this.validate(payload, DetectBlockerActionSchema);
  }

  validateDismissBlocker(payload: unknown): DismissBlockerActionDTO {
    return this.validate(payload, DismissBlockerActionSchema);
  }

  /**
   * Validate generic action against schema
   */
  validate<T>(payload: unknown, schema: z.ZodSchema<T>): T {
    const result = schema.safeParse(payload);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.') || 'root',
        message: err.message,
      }));
      throw new ActionValidationError(errors);
    }

    return result.data;
  }

  /**
   * Validate file chooser request
   */
  validateFileChooser(payload: unknown): FileChooserRequestDTO {
    return this.validate(payload, FileChooserRequestSchema);
  }

  /**
   * Validate dialog request
   */
  validateDialog(payload: unknown): DialogRequestDTO {
    return this.validate(payload, DialogRequestSchema);
  }

  /**
   * Validate download wait request
   */
  validateDownloadWait(payload: unknown): DownloadWaitRequestDTO {
    return this.validate(payload, DownloadWaitRequestSchema);
  }

  /**
   * Validate download request
   */
  validateDownload(payload: unknown): DownloadRequestDTO {
    return this.validate(payload, DownloadRequestSchema);
  }
}
