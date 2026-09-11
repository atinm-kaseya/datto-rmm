/**
 * Tests for jobs Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  getJob,
  getJobComponents,
  getJobStatus,
} from './jobs.js';
import { createMockClient } from '../test-utils/mock-client.js';

function makeErrorClient(status = 500) {
  return {
    ...createMockClient(),
    GET: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
  } as any;
}

// ─── getJob ────────────────────────────────────────────────────────────────────

describe('getJob', () => {
  it('returns job data on success', async () => {
    const client = createMockClient();
    const result = await getJob(client, { jobUid: 'job-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.jobUid).toBe('job-1');
    expect(body.data.status).toBe('completed');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getJob(makeErrorClient(), { jobUid: 'job-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getJobComponents ──────────────────────────────────────────────────────────

describe('getJobComponents', () => {
  it('returns job components with count', async () => {
    const client = createMockClient();
    const result = await getJobComponents(client, { jobUid: 'job-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(2);
    expect(body.data[0].componentUid).toBe('comp-1');
  });

  it('passes pagination args', async () => {
    const client = createMockClient();
    const result = await getJobComponents(client, { jobUid: 'job-1', page: 2, max: 50 });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getJobComponents(makeErrorClient(), { jobUid: 'job-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getJobStatus ──────────────────────────────────────────────────────────────

describe('getJobStatus', () => {
  it('returns job results with stdout when job is complete (Success)', async () => {
    const client = createMockClient();
    // Default mock: jobResults has jobDeploymentStatus='Success', jobStdout has one entry
    const result = await getJobStatus(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.jobUid).toBe('job-1');
    expect(body.data.jobDeploymentStatus).toBe('Success');
    expect(body.data.stdout).toBeDefined();
    expect(Array.isArray(body.data.stdout)).toBe(true);
    expect(body.data.stdout[0].output).toBe('Job completed successfully');
  });

  it('returns job results with stdout=null when job is not complete', async () => {
    const client = createMockClient({
      jobResults: {
        jobUid: 'job-1',
        deviceUid: 'device-1',
        jobDeploymentStatus: 'Running',
      } as any,
    });
    const result = await getJobStatus(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.jobDeploymentStatus).toBe('Running');
    expect(body.data.stdout).toBeNull();
  });

  it('returns job results with stdout=null when job failed', async () => {
    const client = createMockClient({
      jobResults: {
        jobUid: 'job-1',
        deviceUid: 'device-1',
        jobDeploymentStatus: 'Failure',
      } as any,
    });
    const result = await getJobStatus(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.stdout).toBeNull();
  });

  it('returns error envelope on API failure', async () => {
    const result = await getJobStatus(makeErrorClient(), { jobUid: 'job-1', deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
