import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { executeFileChooserUpload } from "./agent.act.js";

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

test("file chooser fails fast when resume download returns 403", async () => {
  const originalFetch = globalThis.fetch;
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

  await assert.rejects(
    executeFileChooserUpload({
      profileCtx: profileCtx as never,
      getPwModule: async () => pw as never,
      paths: ["https://files.example.com/resume.pdf"],
      ref: "e12",
    }),
    /file_download_failed:403/,
  );

  assert.equal(counts.ensureTab, 0, "must fail before tab lookup");
  assert.equal(counts.armUpload, 0, "must not arm chooser when download fails");
  assert.equal(counts.click, 0, "must not click when download fails");
  assert.equal(counts.setInputFiles, 0, "must not set input files when download fails");

  globalThis.fetch = originalFetch;
});

test("file chooser downloads remote file, uploads it, and cleans staged temp file", async () => {
  const originalFetch = globalThis.fetch;
  const counts = {
    ensureTab: 0,
    armUpload: 0,
    click: 0,
  };

  let stagedPathFromPw = "";

  globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })) as typeof fetch;

  const profileCtx = createProfileCtx(counts);
  const pw = {
    armFileUploadViaPlaywright: async (args: { paths: string[] }) => {
      counts.armUpload += 1;
      stagedPathFromPw = args.paths[0] ?? "";
      assert.ok(stagedPathFromPw.includes("openclaw-browser-upload-"));
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

  assert.equal(counts.ensureTab, 1);
  assert.equal(counts.armUpload, 1);
  assert.equal(counts.click, 1);
  assert.ok(stagedPathFromPw.endsWith(".pdf"), "staged file should preserve extension");

  await assert.rejects(fs.stat(stagedPathFromPw), /ENOENT/, "staged temp file should be deleted");

  globalThis.fetch = originalFetch;
});
