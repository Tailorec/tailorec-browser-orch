import { describe, expect, it } from 'vitest';
import { ActionValidationError, ActionValidator } from '../../api/validators/action.validator.js';

describe('ActionValidator', () => {
  const validator = new ActionValidator();

  it('coerces booleans and numbers for click actions', () => {
    expect(
      validator.validateClick({
        kind: 'click',
        ref: 'e1',
        doubleClick: 'true',
        timeoutMs: '2500',
      }),
    ).toEqual({
      kind: 'click',
      ref: 'e1',
      doubleClick: true,
      timeoutMs: 2500,
    });
  });

  it('requires one wait condition', () => {
    expect(() => validator.validateWait({ kind: 'wait' })).toThrow(ActionValidationError);
    expect(
      validator.validateWait({ kind: 'wait', loadState: 'networkidle', timeoutMs: '5000' }),
    ).toEqual({
      kind: 'wait',
      loadState: 'networkidle',
      timeoutMs: 5000,
    });
  });

  it('defaults file chooser paths to an empty array', () => {
    expect(validator.validateFileChooser({})).toEqual({ paths: [], timeoutMs: undefined });
  });
});
