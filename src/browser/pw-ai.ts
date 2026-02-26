export * from "./pw-session.js"; // Explicitly export everything from session to avoid missing exports
export {
  type BrowserConsoleMessage,
  closePageByTargetIdViaPlaywright,
  closePlaywrightBrowserConnection,
  createPageViaPlaywright,
  ensurePageState,
  focusPageByTargetIdViaPlaywright,
  getPageForTargetId,
  listPagesViaPlaywright,
  refLocator,
  type WithSnapshotForAI,
} from "./pw-session.js";

export {
  armDialogViaPlaywright,
  armFileUploadViaPlaywright,
  clickViaPlaywright,
  downloadViaPlaywright,
  dragViaPlaywright,
  evaluateViaPlaywright,
  fillFormViaPlaywright,
  getConsoleMessagesViaPlaywright,
  getNetworkRequestsViaPlaywright,
  getPageErrorsViaPlaywright,
  highlightViaPlaywright,
  hoverViaPlaywright,
  pressKeyViaPlaywright,
  queryElementStateViaPlaywright,
  queryElementStatesViaPlaywright,
  scrollIntoViewViaPlaywright,
  selectOptionViaPlaywright,
  setInputFilesViaPlaywright,
  screenshotWithLabelsViaPlaywright,
  takeScreenshotViaPlaywright,
  typeViaPlaywright,
  waitForDownloadViaPlaywright,
  waitForViaPlaywright,
  discoverDropdownOptionsViaPlaywright,
  closeDropdownViaPlaywright,
  detectBlockingElementViaPlaywright,
  dismissBlockerViaPlaywright,
} from "./pw-tools-core.js";

// Export snapshot functions explicitly if not in pw-tools-core.js index
export {
  snapshotAriaViaPlaywright,
  snapshotAiViaPlaywright,
  snapshotRoleViaPlaywright,
  snapshotDeltaViaPlaywright,
  navigateViaPlaywright,
  resizeViewportViaPlaywright,
  closePageViaPlaywright,
  pdfViaPlaywright
} from "./pw-tools-core.snapshot.js";
