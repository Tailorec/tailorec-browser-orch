"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfViaPlaywright = exports.closePageViaPlaywright = exports.resizeViewportViaPlaywright = exports.navigateViaPlaywright = exports.snapshotRoleViaPlaywright = exports.snapshotAiViaPlaywright = exports.snapshotAriaViaPlaywright = exports.waitForViaPlaywright = exports.waitForDownloadViaPlaywright = exports.typeViaPlaywright = exports.takeScreenshotViaPlaywright = exports.screenshotWithLabelsViaPlaywright = exports.setInputFilesViaPlaywright = exports.selectOptionViaPlaywright = exports.scrollIntoViewViaPlaywright = exports.pressKeyViaPlaywright = exports.hoverViaPlaywright = exports.highlightViaPlaywright = exports.getPageErrorsViaPlaywright = exports.getNetworkRequestsViaPlaywright = exports.getConsoleMessagesViaPlaywright = exports.fillFormViaPlaywright = exports.evaluateViaPlaywright = exports.dragViaPlaywright = exports.downloadViaPlaywright = exports.clickViaPlaywright = exports.armFileUploadViaPlaywright = exports.armDialogViaPlaywright = exports.refLocator = exports.listPagesViaPlaywright = exports.getPageForTargetId = exports.focusPageByTargetIdViaPlaywright = exports.ensurePageState = exports.createPageViaPlaywright = exports.closePlaywrightBrowserConnection = exports.closePageByTargetIdViaPlaywright = void 0;
__exportStar(require("./pw-session.js"), exports); // Explicitly export everything from session to avoid missing exports
var pw_session_js_1 = require("./pw-session.js");
Object.defineProperty(exports, "closePageByTargetIdViaPlaywright", { enumerable: true, get: function () { return pw_session_js_1.closePageByTargetIdViaPlaywright; } });
Object.defineProperty(exports, "closePlaywrightBrowserConnection", { enumerable: true, get: function () { return pw_session_js_1.closePlaywrightBrowserConnection; } });
Object.defineProperty(exports, "createPageViaPlaywright", { enumerable: true, get: function () { return pw_session_js_1.createPageViaPlaywright; } });
Object.defineProperty(exports, "ensurePageState", { enumerable: true, get: function () { return pw_session_js_1.ensurePageState; } });
Object.defineProperty(exports, "focusPageByTargetIdViaPlaywright", { enumerable: true, get: function () { return pw_session_js_1.focusPageByTargetIdViaPlaywright; } });
Object.defineProperty(exports, "getPageForTargetId", { enumerable: true, get: function () { return pw_session_js_1.getPageForTargetId; } });
Object.defineProperty(exports, "listPagesViaPlaywright", { enumerable: true, get: function () { return pw_session_js_1.listPagesViaPlaywright; } });
Object.defineProperty(exports, "refLocator", { enumerable: true, get: function () { return pw_session_js_1.refLocator; } });
var pw_tools_core_js_1 = require("./pw-tools-core.js");
Object.defineProperty(exports, "armDialogViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.armDialogViaPlaywright; } });
Object.defineProperty(exports, "armFileUploadViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.armFileUploadViaPlaywright; } });
Object.defineProperty(exports, "clickViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.clickViaPlaywright; } });
Object.defineProperty(exports, "downloadViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.downloadViaPlaywright; } });
Object.defineProperty(exports, "dragViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.dragViaPlaywright; } });
Object.defineProperty(exports, "evaluateViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.evaluateViaPlaywright; } });
Object.defineProperty(exports, "fillFormViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.fillFormViaPlaywright; } });
Object.defineProperty(exports, "getConsoleMessagesViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.getConsoleMessagesViaPlaywright; } });
Object.defineProperty(exports, "getNetworkRequestsViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.getNetworkRequestsViaPlaywright; } });
Object.defineProperty(exports, "getPageErrorsViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.getPageErrorsViaPlaywright; } });
Object.defineProperty(exports, "highlightViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.highlightViaPlaywright; } });
Object.defineProperty(exports, "hoverViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.hoverViaPlaywright; } });
Object.defineProperty(exports, "pressKeyViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.pressKeyViaPlaywright; } });
Object.defineProperty(exports, "scrollIntoViewViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.scrollIntoViewViaPlaywright; } });
Object.defineProperty(exports, "selectOptionViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.selectOptionViaPlaywright; } });
Object.defineProperty(exports, "setInputFilesViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.setInputFilesViaPlaywright; } });
Object.defineProperty(exports, "screenshotWithLabelsViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.screenshotWithLabelsViaPlaywright; } });
Object.defineProperty(exports, "takeScreenshotViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.takeScreenshotViaPlaywright; } });
Object.defineProperty(exports, "typeViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.typeViaPlaywright; } });
Object.defineProperty(exports, "waitForDownloadViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.waitForDownloadViaPlaywright; } });
Object.defineProperty(exports, "waitForViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_js_1.waitForViaPlaywright; } });
// Export snapshot functions explicitly if not in pw-tools-core.js index
var pw_tools_core_snapshot_js_1 = require("./pw-tools-core.snapshot.js");
Object.defineProperty(exports, "snapshotAriaViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_snapshot_js_1.snapshotAriaViaPlaywright; } });
Object.defineProperty(exports, "snapshotAiViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_snapshot_js_1.snapshotAiViaPlaywright; } });
Object.defineProperty(exports, "snapshotRoleViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_snapshot_js_1.snapshotRoleViaPlaywright; } });
Object.defineProperty(exports, "navigateViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_snapshot_js_1.navigateViaPlaywright; } });
Object.defineProperty(exports, "resizeViewportViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_snapshot_js_1.resizeViewportViaPlaywright; } });
Object.defineProperty(exports, "closePageViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_snapshot_js_1.closePageViaPlaywright; } });
Object.defineProperty(exports, "pdfViaPlaywright", { enumerable: true, get: function () { return pw_tools_core_snapshot_js_1.pdfViaPlaywright; } });
