import type { Request, Response } from 'express';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { redactBrowserEndpoint } from '../../shared/utils/browser-endpoint.utils.js';
import type { BrowserRouteContext } from '../context/browser.context.js';

const log = createSubsystemLogger('basic-controller');

export class BasicController {
  constructor(private browserContext: BrowserRouteContext) {}

  async handleHealth(_req: Request, res: Response): Promise<void> {
    res.send('Tailorec Browser Service OK');
  }

  async handleStatus(_req: Request, res: Response): Promise<void> {
    const state = this.browserContext.state();
    const configuredProfiles = Array.from(state.configuredProfiles.values());
    const provider = configuredProfiles[0]?.provider ?? null;
    log.info('status request completed', {
      provider,
      active_profiles: state.profiles.size,
      configured_profiles: configuredProfiles.length,
    });
    res.json({
      ok: true,
      provider,
      profiles: Array.from(state.profiles.keys()),
      configured_profiles: configuredProfiles.map((profile) => ({
        name: profile.name,
        provider: profile.provider,
        browser_endpoint: redactBrowserEndpoint(profile.browserEndpoint),
      })),
    });
  }
}
