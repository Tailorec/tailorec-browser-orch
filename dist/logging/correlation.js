"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorrelationId = getCorrelationId;
exports.runWithCorrelationId = runWithCorrelationId;
exports.generateCorrelationId = generateCorrelationId;
exports.extractCorrelationIdFromHeaders = extractCorrelationIdFromHeaders;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = require("node:crypto");
const store = new node_async_hooks_1.AsyncLocalStorage();
const correlationHeaderName = (process.env.CORRELATION_ID_HEADER || "x-correlation-id").toLowerCase();
function getCorrelationId() {
    return store.getStore()?.correlationId;
}
function runWithCorrelationId(correlationId, fn) {
    return store.run({ correlationId }, fn);
}
function generateCorrelationId() {
    return (0, node_crypto_1.randomUUID)();
}
function extractCorrelationIdFromHeaders(headers) {
    const direct = headers[correlationHeaderName];
    if (typeof direct === "string" && direct.trim()) {
        return direct.trim();
    }
    if (Array.isArray(direct) && direct.length && direct[0]?.trim()) {
        return direct[0].trim();
    }
    for (const key of ["x-correlation-id", "x-request-id", "x-trace-id"]) {
        const val = headers[key];
        if (typeof val === "string" && val.trim()) {
            return val.trim();
        }
        if (Array.isArray(val) && val.length && val[0]?.trim()) {
            return val[0].trim();
        }
    }
    return undefined;
}
