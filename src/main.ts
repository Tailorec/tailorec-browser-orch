import { Router } from 'express';
import { createContainer } from './container/index.js';
import { loadConfig } from './config/config.js';
import { createSubsystemLogger, initializeLogging } from './adapters/logging/logger.adapter.js';
import { ExpressServerAdapter } from './adapters/http/express.server.adapter.js';

// Import Services
import { SessionService } from './core/services/session.service.js';
import { SnapshotService } from './core/services/snapshot.service.js';
import { InteractionService } from './core/services/interaction.service.js';
import { DiscoveryService } from './core/services/discovery.service.js';
import { NavigationService } from './core/services/navigation.service.js';

// Import Use Cases
import { StartSessionUseCase } from './core/use-cases/start-session.use-case.js';
import { TakeSnapshotUseCase } from './core/use-cases/take-snapshot.use-case.js';
import { ExecuteActionUseCase } from './core/use-cases/execute-action.use-case.js';
import { GenerateControlTokenUseCase } from './core/use-cases/generate-control-token.use-case.js';

// Import Controllers
import { BasicController } from './api/controllers/basic.controller.js';
import { SnapshotController } from './api/controllers/snapshot.controller.js';
import { SimpleActionController } from './api/controllers/simple-action.controller.js';
import { FormActionController } from './api/controllers/form-action.controller.js';
import { AdvancedActionController } from './api/controllers/advanced-action.controller.js';
import { ControlController } from './api/controllers/control.controller.js';
import { HooksController } from './api/controllers/hooks.controller.js';

// Import Routes
import { registerBasicRoutes } from './api/routes/basic.routes.js';
import { registerSnapshotRoutes } from './api/routes/snapshot.routes.js';
import { registerActionRoutes } from './api/routes/action.routes.js';
import { registerControlRoutes } from './api/routes/control.routes.js';
import { registerHooksRoutes } from './api/routes/hooks.routes.js';

// Import Middlewares
import { createMiddlewareRegistry, errorMiddleware } from './api/middlewares/index.js';

const log = createSubsystemLogger('main');

/**
 * Generate Control Token Use Case Implementation
 */
class GenerateControlTokenUseCaseImpl implements GenerateControlTokenUseCase {
  async execute(request: any): Promise<any> {
    return {
      token: `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      expiresIn: request.expiresIn ?? 3600,
    };
  }
}

/**
 * Main application entry point
 */
async function main() {
  try {
    log.info('Starting Tailorec Browser Service (Clean Architecture)...');

    // 1. Load configuration
    const config = loadConfig();
    initializeLogging({
      level: config.logging.level,
      format: config.logging.format,
      logToFile: config.logging.toFile,
      logFilePath: config.logging.filePath,
      logMaxBytes: config.logging.maxBytes,
      logBackupCount: config.logging.backupCount,
    });

    // 2. Create DI container
    const container = createContainer(config);

    // 3. Setup core services
    const sessionService = new SessionService(container.browserDriver, container.sessionStore);
    const snapshotService = new SnapshotService();
    const interactionService = new InteractionService();
    const discoveryService = new DiscoveryService();
    const navigationService = new NavigationService();

    // 4. Setup use cases
    const startSessionUseCase = new StartSessionUseCase(
      sessionService,
      navigationService,
      container.eventBus
    );
    const takeSnapshotUseCase = new TakeSnapshotUseCase(
      sessionService,
      snapshotService,
      container.eventBus
    );
    const executeActionUseCase = new ExecuteActionUseCase(
      sessionService,
      interactionService,
      discoveryService,
      container.eventBus
    );
    const generateControlTokenUseCase = new GenerateControlTokenUseCaseImpl();

    // 5. Setup controllers
    const basicController = new BasicController();
    const snapshotController = new SnapshotController(takeSnapshotUseCase);
    const simpleActionController = new SimpleActionController(executeActionUseCase);
    const formActionController = new FormActionController(executeActionUseCase);
    const advancedActionController = new AdvancedActionController();
    const controlController = new ControlController(generateControlTokenUseCase);
    const hooksController = new HooksController();

    // 6. Setup Middlewares
    const middleware = createMiddlewareRegistry();

    // 7. Setup Routes
    const router = Router();
    registerBasicRoutes(router, basicController, middleware);
    registerSnapshotRoutes(router, snapshotController, middleware);
    registerActionRoutes(router, simpleActionController, formActionController, advancedActionController, middleware);
    registerControlRoutes(router, controlController, middleware);
    registerHooksRoutes(router, hooksController, middleware);

    // 8. Start HTTP server
    const server = new ExpressServerAdapter();
    const app = server.getApp();
    
    app.use(router);
    app.use(errorMiddleware as any);

    const { port } = await server.start({
      port: config.port,
      host: config.host,
    });

    log.info(`Service ready on port ${port}`);

    // Handle shutdown
    process.on('SIGTERM', async () => {
      log.info('SIGTERM received, shutting down...');
      await server.stop();
      process.exit(0);
    });

  } catch (err) {
    log.exception('Fatal error during service startup', err);
    process.exit(1);
  }
}

// Start the application
main();
