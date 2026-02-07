import { startBrowserControlServerFromConfig } from "./browser/server.js";
import { createSubsystemLogger } from "./logging/subsystem.js";

const log = createSubsystemLogger("main");

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
    const state = await startBrowserControlServerFromConfig();
    if (state) {
      log.info(`Service ready on port ${state.port}`);
    } else {
      log.error("Failed to start browser service (disabled or config error)");
      process.exit(1);
    }
  } catch (err) {
    log.exception("Fatal error during service startup", err);
    process.exit(1);
  }
}

main();
