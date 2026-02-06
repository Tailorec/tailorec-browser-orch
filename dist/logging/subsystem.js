"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubsystemLogger = createSubsystemLogger;
const tslog_1 = require("tslog");
function createSubsystemLogger(name) {
    return new tslog_1.Logger({ name });
}
