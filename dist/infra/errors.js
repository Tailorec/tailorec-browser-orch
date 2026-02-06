"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatErrorMessage = formatErrorMessage;
function formatErrorMessage(err) {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}
