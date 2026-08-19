import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HooksController } from "../../api/controllers/hooks.controller.js";
import {
  resolveUploadPaths,
  stageUploadFromUrl,
} from "../../api/controllers/controller-runtime.utils.js";
import { createBrowserContextMock, createMockReq, createMockRes } from "../helpers/test-helpers.js";

const { armFileUpload } = vi.hoisted(() => ({
  armFileUpload: vi.fn(),
}));

vi.mock("../../adapters/playwright/playwright.downloads.adapter.js", () => ({
  armFileUpload,
  armDialog: vi.fn(),
  waitForDownload: vi.fn(),
  download: vi.fn(),
}));

describe("unit: upload staging + file chooser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.BROWSER_UPLOAD_MAX_BYTES;
    delete process.env.BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS;
    delete process.env.BROWSER_KEEP_STAGED_UPLOADS;
  });

  it("fails fast when resume download returns 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));

    await expect(
      stageUploadFromUrl("https://files.example.com/resume.pdf"),
    ).rejects.toThrow(/file_download_failed:403/);
  });

  it("rejects when content-length exceeds configured max bytes", async () => {
    process.env.BROWSER_UPLOAD_MAX_BYTES = "262144";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "content-length": "300000" },
          }),
      ),
    );

    await expect(stageUploadFromUrl("https://files.example.com/large.pdf")).rejects.toThrow(
      /file_download_too_large:300000/,
    );
  });

  it("resolves mixed local+remote paths and stages remote file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })),
    );

    const localPath = path.resolve("upload-resume", "already-local.txt");
    const result = await resolveUploadPaths(["https://files.example.com/resume.pdf", localPath]);

    expect(result.resolved).toHaveLength(2);
    expect(result.staged).toHaveLength(1);
    expect(result.resolved[1]).toBe(localPath);
    expect(result.staged[0]?.endsWith(".pdf")).toBe(true);

    await fs.unlink(result.staged[0] as string).catch(() => undefined);
  });

  it("uses setInputFiles path when inputRef is provided", async () => {
    const { browserContext } = createBrowserContextMock();
    const setInputFiles = vi.fn(async () => undefined);
    const controller = new HooksController(
      {
        getPage: vi.fn(async () => ({ locator: vi.fn() })),
        refLocator: vi.fn(() => ({ setInputFiles })),
      } as any,
      browserContext as any,
    );

    const req = createMockReq({
      body: { run_id: "run-1", inputRef: "e-file", paths: ["/tmp/resume.pdf"] },
    });
    const res = createMockRes();

    await controller.handleFileChooser(req, res);

    expect(res.statusCode).toBe(200);
    expect(setInputFiles).toHaveBeenCalledWith(["/tmp/resume.pdf"]);
    expect(armFileUpload).not.toHaveBeenCalled();
  });

  it("downloads remote file, uploads it, and cleans staged temp file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })),
    );

    const { resolved, staged } = await resolveUploadPaths(["https://files.example.com/resume.pdf"]);
    let stagedPathFromPw = "";
    await armFileUpload({
      paths: resolved,
      timeoutMs: 8000,
      isActive: () => true,
    });
    stagedPathFromPw = resolved[0] ?? "";

    expect(staged).toHaveLength(1);
    expect(stagedPathFromPw.endsWith(".pdf")).toBe(true);
    await Promise.all(staged.map((file) => fs.unlink(file).catch(() => undefined)));
    await expect(fs.stat(stagedPathFromPw)).rejects.toThrow(/ENOENT/);
  });
});
