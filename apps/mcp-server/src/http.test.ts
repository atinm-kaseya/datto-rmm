import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { ISessionStore } from './session/types.js';
import type { HttpConfig } from './config.js';

vi.mock('datto-rmm-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('datto-rmm-api')>();
  return {
    ...actual,
    createDattoClient: vi.fn(() => ({})),
    OAuthTokenManager: vi.fn().mockImplementation(() => ({
      mintToken: vi.fn().mockResolvedValue('mock-access-token'),
    })),
    getTokenEndpoint: vi.fn().mockReturnValue('https://mock.token.endpoint'),
  };
});

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: vi.fn().mockImplementation((_req: unknown, res: any) => {
      res.status(200).json({ jsonrpc: '2.0', result: {} });
      return Promise.resolve();
    }),
  })),
}));

vi.mock('./server.js', () => ({
  createMcpServer: vi.fn().mockReturnValue({
    server: {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    },
    getLoadedGroups: vi.fn().mockReturnValue(new Set(['devices'])),
  }),
}));

beforeEach(() => { vi.clearAllMocks(); });

function makeStore(overrides: Partial<ISessionStore> = {}): ISessionStore {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    saveSession: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockResolvedValue(null),
    saveToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const cfg: HttpConfig = {
  port: 8080,
  defaultPlatform: 'merlot',
  redis: { host: 'localhost', port: 6379 },
};

async function makeApp(store: ISessionStore = makeStore()) {
  const { createHttpApp } = await import('./http.js');
  return createHttpApp(store, cfg);
}

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const app = await makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('POST /mcp', () => {
  it('returns 401 when API key headers are missing', async () => {
    const app = await makeApp();
    const res = await request(app).post('/mcp').send({});
    expect(res.status).toBe(401);
  });

  it('returns 401 when only API key is provided', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/mcp')
      .set('x-datto-api-key', 'mykey')
      .send({});
    expect(res.status).toBe(401);
  });

  it('sets Mcp-Session-Id header on successful request', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/mcp')
      .set('x-datto-api-key', 'mykey')
      .set('x-datto-api-secret', 'mysecret')
      .send({});
    expect(res.headers['mcp-session-id']).toBeDefined();
  });

  it('echoes back a provided Mcp-Session-Id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/mcp')
      .set('x-datto-api-key', 'mykey')
      .set('x-datto-api-secret', 'mysecret')
      .set('mcp-session-id', 'my-session')
      .send({});
    expect(res.headers['mcp-session-id']).toBe('my-session');
  });

  it('loads session state from store', async () => {
    const store = makeStore({
      getSession: vi.fn().mockResolvedValue({ loadedGroups: ['alerts'], platform: 'merlot' }),
    });
    const app = await makeApp(store);
    await request(app)
      .post('/mcp')
      .set('x-datto-api-key', 'mykey')
      .set('x-datto-api-secret', 'mysecret')
      .set('mcp-session-id', 'existing-session')
      .send({});
    expect(store.getSession).toHaveBeenCalledWith('existing-session');
  });

  it('saves updated session state after request', async () => {
    const store = makeStore();
    const app = await makeApp(store);
    await request(app)
      .post('/mcp')
      .set('x-datto-api-key', 'mykey')
      .set('x-datto-api-secret', 'mysecret')
      .send({});
    expect(store.saveSession).toHaveBeenCalled();
  });

  it('uses cached token from store without re-exchanging', async () => {
    const { OAuthTokenManager } = await import('datto-rmm-api');
    const cachedToken = { accessToken: 'cached-tok', expiresAt: Date.now() + 3600_000 };
    const store = makeStore({ getToken: vi.fn().mockResolvedValue(cachedToken) });
    const app = await makeApp(store);
    await request(app)
      .post('/mcp')
      .set('x-datto-api-key', 'mykey')
      .set('x-datto-api-secret', 'mysecret')
      .send({});
    expect(OAuthTokenManager).not.toHaveBeenCalled();
  });
});
