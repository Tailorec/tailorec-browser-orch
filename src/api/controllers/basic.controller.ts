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
    const allocatorStatus = await this.browserContext.getBrowserlessAllocatorStatus();
    log.info('status request completed', {
      provider,
      active_profiles: state.profiles.size,
      configured_profiles: configuredProfiles.length,
      browserless_workers: allocatorStatus.workers.length,
      browserless_assigned_runs: allocatorStatus.totalAssignedRuns,
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
      browserless_allocator: {
        total_assigned_runs: allocatorStatus.totalAssignedRuns,
        max_total_sessions: allocatorStatus.maxTotalSessions,
        max_sessions_per_worker: allocatorStatus.maxSessionsPerWorker,
        workers: allocatorStatus.workers.map((worker) => ({
          task_id: worker.taskId,
          endpoint: redactBrowserEndpoint(worker.endpoint),
          assigned_run_ids: worker.assignedRunIds,
          created_at: worker.createdAt,
          last_assigned_at: worker.lastAssignedAt,
          max_sessions: worker.maxSessions,
          idle_since: worker.idleSince,
          ownership: {
            owner_scope: worker.ownership.ownerScope,
            owner_id: worker.ownership.ownerId,
          },
          unavailable_since: worker.unavailableSince,
          unavailable_reason: worker.unavailableReason,
        })),
      },
    });
  }
}
