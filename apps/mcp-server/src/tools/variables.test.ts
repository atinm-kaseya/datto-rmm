/**
 * Tests for variables Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  createAccountVariable,
  updateAccountVariable,
  deleteAccountVariable,
  createSiteVariable,
  updateSiteVariable,
  deleteSiteVariable,
  updateSiteProxy,
  deleteSiteProxy,
} from './variables.js';
import { createMockClient } from '../test-utils/mock-client.js';

function makeErrorClient() {
  return {
    ...createMockClient(),
    GET: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
    PUT: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
    POST: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
    DELETE: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
  } as any;
}

// ─── createAccountVariable ─────────────────────────────────────────────────────

describe('createAccountVariable', () => {
  it('creates account variable when no duplicate exists', async () => {
    // Default accountVariables has 'globalServer', not 'myVar'
    const client = createMockClient();
    const result = await createAccountVariable(client, { name: 'myVar', value: 'myValue' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns duplicate_detected when variable already exists', async () => {
    const client = createMockClient({
      accountVariables: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        variables: [{ id: 99, name: 'myVar', value: 'existingValue' }],
      },
    });
    const result = await createAccountVariable(client, { name: 'myVar', value: 'newValue' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('duplicate_detected');
    expect(body.code).toBe(409);
  });

  it('duplicate check is case-insensitive', async () => {
    const client = createMockClient({
      accountVariables: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        variables: [{ id: 99, name: 'MyVar', value: 'existingValue' }],
      },
    });
    const result = await createAccountVariable(client, { name: 'myvar', value: 'newValue' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('duplicate_detected');
  });

  it('returns error envelope when GET for duplicate check fails', async () => {
    const result = await createAccountVariable(makeErrorClient(), { name: 'myVar', value: 'val' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── updateAccountVariable ─────────────────────────────────────────────────────

describe('updateAccountVariable', () => {
  it('returns success on update', async () => {
    const client = createMockClient();
    const result = await updateAccountVariable(client, { variableId: 10, value: 'newValue' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await updateAccountVariable(makeErrorClient(), { variableId: 10, value: 'x' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── deleteAccountVariable ─────────────────────────────────────────────────────

describe('deleteAccountVariable', () => {
  it('returns success on delete', async () => {
    const client = createMockClient();
    const result = await deleteAccountVariable(client, { variableId: 10 });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await deleteAccountVariable(makeErrorClient(), { variableId: 10 });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── createSiteVariable ────────────────────────────────────────────────────────

describe('createSiteVariable', () => {
  it('creates site variable when no duplicate exists', async () => {
    // Use empty siteVariables so there is no existing 'newVar'
    const client = createMockClient({
      siteVariables: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        variables: [],
      },
    });
    const result = await createSiteVariable(client, {
      siteUid: 'site-1',
      name: 'newVar',
      value: 'newValue',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns duplicate_detected when site variable already exists', async () => {
    // Default siteVariables contains 'backupServer'
    const client = createMockClient();
    const result = await createSiteVariable(client, {
      siteUid: 'site-1',
      name: 'backupServer',
      value: 'newBackup',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('duplicate_detected');
    expect(body.code).toBe(409);
  });

  it('duplicate check is case-insensitive', async () => {
    const client = createMockClient();
    const result = await createSiteVariable(client, {
      siteUid: 'site-1',
      name: 'BACKUPSERVER',
      value: 'val',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('duplicate_detected');
  });

  it('returns error envelope when GET for duplicate check fails', async () => {
    const result = await createSiteVariable(makeErrorClient(), {
      siteUid: 'site-1',
      name: 'someVar',
      value: 'val',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── updateSiteVariable ────────────────────────────────────────────────────────

describe('updateSiteVariable', () => {
  it('returns success on update', async () => {
    const client = createMockClient();
    const result = await updateSiteVariable(client, {
      siteUid: 'site-1',
      variableId: 1,
      value: 'updatedBackup',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await updateSiteVariable(makeErrorClient(), {
      siteUid: 'site-1',
      variableId: 1,
      value: 'x',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── deleteSiteVariable ────────────────────────────────────────────────────────

describe('deleteSiteVariable', () => {
  it('returns success on delete', async () => {
    const client = createMockClient();
    const result = await deleteSiteVariable(client, { siteUid: 'site-1', variableId: 1 });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await deleteSiteVariable(makeErrorClient(), { siteUid: 'site-1', variableId: 1 });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── updateSiteProxy ───────────────────────────────────────────────────────────

describe('updateSiteProxy', () => {
  it('returns success when proxy is updated', async () => {
    const client = createMockClient();
    const result = await updateSiteProxy(client, {
      siteUid: 'site-1',
      type: 'http',
      host: '10.0.1.1',
      port: 8080,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('accepts optional username and password', async () => {
    const client = createMockClient();
    const result = await updateSiteProxy(client, {
      siteUid: 'site-1',
      type: 'socks5',
      host: '10.0.2.1',
      port: 1080,
      username: 'proxyuser',
      password: 'proxypass',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await updateSiteProxy(makeErrorClient(), {
      siteUid: 'site-1',
      type: 'http',
      host: '10.0.1.1',
      port: 8080,
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── deleteSiteProxy ───────────────────────────────────────────────────────────

describe('deleteSiteProxy', () => {
  it('returns success when proxy is deleted', async () => {
    const client = createMockClient();
    const result = await deleteSiteProxy(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await deleteSiteProxy(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
