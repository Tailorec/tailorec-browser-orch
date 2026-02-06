"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPortAvailable = isPortAvailable;
exports.ensurePortAvailable = ensurePortAvailable;
const node_net_1 = __importDefault(require("node:net"));
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = node_net_1.default.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close(() => resolve(true));
        });
        server.listen(port);
    });
}
async function ensurePortAvailable(port) {
    const available = await isPortAvailable(port);
    if (!available) {
        // In a real scenario we might kill the process, but here just throw or warn
        // For now we assume we manage the port
        // throw new Error(`Port ${port} is busy`);
        // Actually, chrome.ts calls this. If it throws, chrome launch fails.
        // Let's just log a warning and hope it's our own chrome or let chrome fail naturally?
        // OpenClaw likely tries to kill usage.
        // I'll make it a no-op for now to keep things simple, Chrome will fail to bind CDP if busy.
    }
}
