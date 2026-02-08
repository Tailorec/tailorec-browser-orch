"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_js_1 = require("./browser/server.js");
const subsystem_js_1 = require("./logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("main");
process.on("uncaughtException", (err) => {
    log.exception("Uncaught exception", err);
    process.exit(1);
});
process.on("unhandledRejection", (reason) => {
    log.exception("Unhandled promise rejection", reason);
    process.exit(1);
});
async function main() {
    try {
        log.info("Starting Tailorec Browser Service...");
        const state = await (0, server_js_1.startBrowserControlServerFromConfig)();
        if (state) {
            log.info(`Service ready on port ${state.port}`);
        }
        else {
            log.error("Failed to start browser service (disabled or config error)");
            process.exit(1);
        }
    }
    catch (err) {
        log.exception("Fatal error during service startup", err);
        process.exit(1);
    }
}
main();
