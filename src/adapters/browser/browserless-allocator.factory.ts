import type { AssignPublicIp } from '@aws-sdk/client-ecs';
import { EcsBrowserlessAllocatorAdapter } from './ecs-browserless-allocator.adapter.js';
import { InMemoryBrowserlessAllocatorAdapter } from './in-memory-browserless-allocator.adapter.js';
import type { IBrowserlessAllocator } from '../../core/ports/browserless-allocator.port.js';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseStringList(value: string | undefined, label: string): string[] {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
      throw new Error(`invalid ${label}`);
    }
    return parsed.map((entry) => entry.trim());
  } catch (error) {
    throw new Error(`failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseAssignPublicIp(value: string | undefined): AssignPublicIp {
  return value === 'ENABLED' ? 'ENABLED' : 'DISABLED';
}

export function createBrowserlessAllocatorFromEnv(): IBrowserlessAllocator {
  const maxSessionsPerWorker = parsePositiveInt(process.env.BROWSER_BROWSERLESS_SESSIONS_PER_WORKER, 5);
  const maxTotalSessions = parsePositiveInt(process.env.BROWSER_BROWSERLESS_MAX_TOTAL_SESSIONS, 20);
  const idleGraceMs = parsePositiveInt(process.env.BROWSER_BROWSERLESS_IDLE_GRACE_MS, 30_000);

  const cluster = process.env.BROWSER_BROWSERLESS_ECS_CLUSTER?.trim();
  const taskDefinition = process.env.BROWSER_BROWSERLESS_ECS_TASK_DEFINITION?.trim();
  const subnetList = process.env.BROWSER_BROWSERLESS_ECS_SUBNETS;
  const securityGroupList = process.env.BROWSER_BROWSERLESS_ECS_SECURITY_GROUPS;

  if (!cluster || !taskDefinition || !subnetList || !securityGroupList) {
    return new InMemoryBrowserlessAllocatorAdapter({
      maxSessionsPerWorker,
      maxTotalSessions,
      idleGraceMs,
    });
  }

  return new EcsBrowserlessAllocatorAdapter({
    cluster,
    taskDefinition,
    subnetIds: parseStringList(subnetList, 'BROWSER_BROWSERLESS_ECS_SUBNETS'),
    securityGroupIds: parseStringList(securityGroupList, 'BROWSER_BROWSERLESS_ECS_SECURITY_GROUPS'),
    assignPublicIp: parseAssignPublicIp(process.env.BROWSER_BROWSERLESS_ECS_ASSIGN_PUBLIC_IP),
    browserlessPort: parsePositiveInt(process.env.BROWSER_BROWSERLESS_PORT, 3000),
    browserlessToken: process.env.BROWSER_BROWSERLESS_TOKEN?.trim() || undefined,
    maxSessionsPerWorker,
    maxTotalSessions,
    idleGraceMs,
    region: process.env.AWS_REGION?.trim() || undefined,
  });
}
