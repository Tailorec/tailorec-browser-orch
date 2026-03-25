import fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveUploadPaths } from '../../api/controllers/controller-runtime.utils.js';

describe('upload staging utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps local paths and stages remote URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-length': '4' }),
        arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
      })),
    );

    const result = await resolveUploadPaths(['/tmp/local.txt', 'https://example.test/file.pdf']);

    expect(result.resolved[0]).toBe('/tmp/local.txt');
    expect(result.resolved[1]).toContain('openclaw-browser-upload-');
    expect(result.staged).toHaveLength(1);

    await Promise.all(result.staged.map((file) => fs.unlink(file).catch(() => undefined)));
  });
});
