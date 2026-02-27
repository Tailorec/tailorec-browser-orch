import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { executeFileChooserUpload } from "../../browser/routes/agent.act.js";

function createProfileCtx(counter: { ensureTab: number }) {
  return {
    profile: { cdpUrl: "http://127.0.0.1:9222" },
    ensureTabAvailable: async (_targetId?: string) => {
      counter.ensureTab += 1;
      return { targetId: "tab-1", url: "about:blank" };
    },
    stopRunningBrowser: async () => undefined,
  };
}

let originalFetch: typeof globalThis.fetch;

afterEach(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

describe("unit: executeFileChooserUpload", () => {
  it("fails fast when resume download returns 403", async () => {
    originalFetch = globalThis.fetch;

    const counts = {
      ensureTab: 0,
      armUpload: 0,
      click: 0,
      setInputFiles: 0,
    };

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

  it("downloads remote file, uploads it, and cleans staged temp file", async () => {
    originalFetch = globalThis.fetch;

    const counts = {
      ensureTab: 0,
      armUpload: 0,
      click: 0,
    };

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
