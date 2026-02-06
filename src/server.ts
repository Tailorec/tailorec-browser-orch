import { startBrowserControlServerFromConfig } from "./browser/server.js";
import { createSubsystemLogger } from "./logging/subsystem.js";

const log = createSubsystemLogger("main");

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
    log.error(`Fatal error: ${err}`);
    process.exit(1);
  }
}

main();
