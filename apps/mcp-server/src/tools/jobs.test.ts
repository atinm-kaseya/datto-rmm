/**
 * Tests for jobs Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  getJob,
  getJobComponents,
  getJobResults,
  getJobStdout,
  getJobStderr,
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

// ─── getJobResults ─────────────────────────────────────────────────────────────

describe('getJobResults', () => {
  it('returns job results for a device', async () => {
    const client = createMockClient();
    const result = await getJobResults(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.jobUid).toBe('job-1');
    expect(body.data.status).toBe('completed');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getJobResults(makeErrorClient(), { jobUid: 'job-1', deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getJobStdout ──────────────────────────────────────────────────────────────

describe('getJobStdout', () => {
  it('returns stdout entries with count', async () => {
    const client = createMockClient();
    const result = await getJobStdout(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(1);
    expect(body.data[0].output).toBe('Job completed successfully');
  });

  it('handles empty stdout', async () => {
    const client = createMockClient({ jobStdout: [] });
    const result = await getJobStdout(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getJobStdout(makeErrorClient(), { jobUid: 'job-1', deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getJobStderr ──────────────────────────────────────────────────────────────

describe('getJobStderr', () => {
  it('returns stderr entries with count', async () => {
    const client = createMockClient();
    const result = await getJobStderr(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(1);
  });

  it('handles empty stderr', async () => {
    const client = createMockClient({ jobStderr: [] });
    const result = await getJobStderr(client, { jobUid: 'job-1', deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getJobStderr(makeErrorClient(), { jobUid: 'job-1', deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
