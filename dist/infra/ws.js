"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawDataToString = rawDataToString;
const node_buffer_1 = require("node:buffer");
function rawDataToString(data, encoding = "utf8") {
    if (typeof data === "string") {
        return data;
    }
    if (node_buffer_1.Buffer.isBuffer(data)) {
        return data.toString(encoding);
    }
    if (Array.isArray(data)) {
        return node_buffer_1.Buffer.concat(data).toString(encoding);
    }
    if (data instanceof ArrayBuffer) {
        return node_buffer_1.Buffer.from(data).toString(encoding);
    }
    return node_buffer_1.Buffer.from(String(data)).toString(encoding);
}
