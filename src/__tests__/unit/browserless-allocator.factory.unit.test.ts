import { afterEach, describe, expect, it } from 'vitest';
import { createBrowserlessAllocatorFromEnv } from '../../adapters/browser/browserless-allocator.factory.js';
import { EcsBrowserlessAllocatorAdapter } from '../../adapters/browser/ecs-browserless-allocator.adapter.js';
import { InMemoryBrowserlessAllocatorAdapter } from '../../adapters/browser/in-memory-browserless-allocator.adapter.js';

describe('createBrowserlessAllocatorFromEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('falls back to the in-memory allocator when ECS env is absent', () => {
    delete process.env.BROWSER_BROWSERLESS_ECS_CLUSTER;
    delete process.env.BROWSER_BROWSERLESS_ECS_TASK_DEFINITION;
    delete process.env.BROWSER_BROWSERLESS_ECS_SUBNETS;
    delete process.env.BROWSER_BROWSERLESS_ECS_SECURITY_GROUPS;

    const allocator = createBrowserlessAllocatorFromEnv();

    expect(allocator).toBeInstanceOf(InMemoryBrowserlessAllocatorAdapter);
  });

  it('builds the ECS allocator when ECS env is present', () => {
    process.env.BROWSER_BROWSERLESS_ECS_CLUSTER = 'cluster-1';
    process.env.BROWSER_BROWSERLESS_ECS_TASK_DEFINITION =
      'arn:aws:ecs:us-east-1:123456789012:task-definition/tailorec-prod-browserless:7';
    process.env.BROWSER_BROWSERLESS_ECS_SUBNETS = JSON.stringify(['subnet-1', 'subnet-2']);
    process.env.BROWSER_BROWSERLESS_ECS_SECURITY_GROUPS = JSON.stringify(['sg-1']);
    process.env.BROWSER_BROWSERLESS_PORT = '3000';
    process.env.BROWSER_BROWSERLESS_ECS_ASSIGN_PUBLIC_IP = 'DISABLED';

    const allocator = createBrowserlessAllocatorFromEnv();

    expect(allocator).toBeInstanceOf(EcsBrowserlessAllocatorAdapter);
  });
});
