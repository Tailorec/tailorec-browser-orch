import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  executeFileChooserUpload,
  resolveUploadPaths,
  stageUploadFromUrl,
} from "../../browser/routes/agent.act.js";
import {
  createProfileCtx,
  createUploadActionCounters,
} from "../helpers/upload-fixtures.js";

let originalFetch: typeof globalThis.fetch;

afterEach(async () => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
  delete process.env.BROWSER_UPLOAD_MAX_BYTES;
  delete process.env.BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS;
});

describe("unit: upload staging + file chooser", () => {
  it("fails fast when resume download returns 403", async () => {
    originalFetch = globalThis.fetch;
    const counts = createUploadActionCounters();

    globalThis.fetch = (async () => new Response("forbidden", { status: 403 })) as typeof fetch;

    const profileCtx = createProfileCtx(counts);
    const pw = {
      armFileUploadViaPlaywright: async () => {
        counts.armUpload += 1;
      },
      clickViaPlaywright: async () => {
        counts.click += 1;
      },
      setInputFilesViaPlaywright: async () => {
        counts.setInputFiles += 1;
      },
    };

    await expect(
      executeFileChooserUpload({
        profileCtx: profileCtx as never,
        getPwModule: async () => pw as never,
        paths: ["https://files.example.com/resume.pdf"],
        ref: "e12",
      }),
    ).rejects.toThrow(/file_download_failed:403/);

    expect(counts.ensureTab).toBe(0);
    expect(counts.armUpload).toBe(0);
    expect(counts.click).toBe(0);
    expect(counts.setInputFiles).toBe(0);
  });

  it("rejects when content-length exceeds configured max bytes", async () => {
    originalFetch = globalThis.fetch;
    process.env.BROWSER_UPLOAD_MAX_BYTES = "262144";

    globalThis.fetch =
      (async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-length": "300000" },
        })) as typeof fetch;

    await expect(stageUploadFromUrl("https://files.example.com/large.pdf")).rejects.toThrow(
      /file_download_too_large:300000/,
    );
  });

  it("resolves mixed local+remote paths and stages remote file", async () => {
    originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })) as typeof fetch;

    const localPath = path.resolve("upload-resume", "already-local.txt");
    const result = await resolveUploadPaths(["https://files.example.com/resume.pdf", localPath]);

    expect(result.resolved).toHaveLength(2);
    expect(result.staged).toHaveLength(1);
    expect(result.resolved[1]).toBe(localPath);
    expect(result.staged[0]?.endsWith(".pdf")).toBe(true);

    await fs.unlink(result.staged[0] as string);
  });

  it("uses setInputFiles path when inputRef is provided", async () => {
    originalFetch = globalThis.fetch;
    const counts = createUploadActionCounters();

    const profileCtx = createProfileCtx(counts);
    const pw = {
      armFileUploadViaPlaywright: async () => {
        counts.armUpload += 1;
      },
      clickViaPlaywright: async () => {
        counts.click += 1;
      },
      setInputFilesViaPlaywright: async () => {
        counts.setInputFiles += 1;
      },
    };

    await executeFileChooserUpload({
      profileCtx: profileCtx as never,
      getPwModule: async () => pw as never,
      inputRef: "e-file",
      paths: ["/tmp/resume.pdf"],
    });

    expect(counts.ensureTab).toBe(1);
    expect(counts.setInputFiles).toBe(1);
    expect(counts.armUpload).toBe(0);
    expect(counts.click).toBe(0);
  });

  it("downloads remote file, uploads it, and cleans staged temp file", async () => {
    originalFetch = globalThis.fetch;
    const counts = createUploadActionCounters();

    let stagedPathFromPw = "";

    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })) as typeof fetch;

    const profileCtx = createProfileCtx(counts);
    const pw = {
      armFileUploadViaPlaywright: async (args: { paths: string[] }) => {
        counts.armUpload += 1;
        stagedPathFromPw = args.paths[0] ?? "";
        expect(stagedPathFromPw.includes("openclaw-browser-upload-")).toBe(true);
      },
      clickViaPlaywright: async () => {
        counts.click += 1;
      },
      setInputFilesViaPlaywright: async () => {
        throw new Error("setInputFiles should not be called in this path");
      },
    };

    await executeFileChooserUpload({
      profileCtx: profileCtx as never,
      getPwModule: async () => pw as never,
      paths: ["https://files.example.com/resume.pdf"],
      ref: "e12",
    });

    expect(counts.ensureTab).toBe(1);
    expect(counts.armUpload).toBe(1);
    expect(counts.click).toBe(1);
    expect(stagedPathFromPw.endsWith(".pdf")).toBe(true);

    await expect(fs.stat(stagedPathFromPw)).rejects.toThrow(/ENOENT/);
  });
});
