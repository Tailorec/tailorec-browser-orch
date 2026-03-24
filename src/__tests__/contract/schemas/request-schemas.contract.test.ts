import { describe, expect, it } from 'vitest';
import {
  ActionRequestSchema,
  DialogRequestSchema,
  DownloadRequestSchema,
  FileChooserRequestSchema,
} from '../../../api/validators/action.validator.js';

describe('request schemas contract', () => {
  it('accepts valid current action requests', () => {
    expect(
      ActionRequestSchema.parse({
        kind: 'click',
        ref: 'e1',
        button: 'left',
        modifiers: ['Alt'],
      }),
    ).toEqual({
      kind: 'click',
      ref: 'e1',
      doubleClick: false,
      button: 'left',
      modifiers: ['Alt'],
    });

    expect(FileChooserRequestSchema.parse({ paths: ['a.txt'] }).paths).toEqual(['a.txt']);
    expect(DialogRequestSchema.parse({ accept: true }).accept).toBe(true);
    expect(DownloadRequestSchema.parse({ ref: 'e1', path: '/tmp/file.pdf' }).path).toBe('/tmp/file.pdf');
  });

  it('rejects invalid discriminated action payloads', () => {
    expect(() => ActionRequestSchema.parse({ kind: 'click' })).toThrow();
    expect(() => ActionRequestSchema.parse({ kind: 'resize', width: 'bad', height: 10 })).toThrow();
  });
});
