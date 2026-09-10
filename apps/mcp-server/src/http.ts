import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createDattoClient, OAuthTokenManager, getTokenEndpoint } from 'datto-rmm-api';
import { SessionStore } from './session/store.js';
import { createMcpServer } from './server.js';
import { parsePlatform } from './config.js';
import type { HttpConfig } from './config.js';

export function createHttpApp(store: SessionStore, cfg: HttpConfig): express.Application {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.post('/mcp', async (req, res) => {
    const apiKey    = req.headers['x-datto-api-key']    as string | undefined;
    const apiSecret = req.headers['x-datto-api-secret'] as string | undefined;
    const platform  = (req.headers['x-datto-platform'] as string | undefined) ?? cfg.defaultPlatform;

    if (!apiKey || !apiSecret) {
      res.status(401).json({ error: 'X-Datto-API-Key and X-Datto-API-Secret headers required' });
      return;
    }

    const sessionId    = (req.headers['mcp-session-id'] as string | undefined) ?? randomUUID();
    const sessionState = (await store.getSession(sessionId)) ?? { loadedGroups: [], platform };

    const credHash  = createHash('sha256').update(`${apiKey}:${apiSecret}`).digest('hex');
    let cachedToken = await store.getToken(credHash);

    if (!cachedToken || Date.now() >= cachedToken.expiresAt - 5 * 60 * 1000) {
      const parsedPlatform = parsePlatform(platform);
      const mgr = new OAuthTokenManager({ apiKey, apiSecret }, getTokenEndpoint(parsedPlatform));
      const accessToken = await mgr.refreshToken();
      cachedToken = { accessToken, expiresAt: mgr.getExpiresAt() };
      await store.saveToken(credHash, cachedToken);
    }

    const resolvedToken = cachedToken;

    const client = createDattoClient({
      platform: parsePlatform(platform),
      auth: { getToken: async () => resolvedToken.accessToken },
    });

    const { server, getLoadedGroups } = createMcpServer(client, new Set(sessionState.loadedGroups));

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.setHeader('Mcp-Session-Id', sessionId);

    await server.connect(transport);
    try {
      await transport.handleRequest(req, res, req.body);
    } finally {
      await store.saveSession(sessionId, {
        loadedGroups: [...getLoadedGroups()],
        platform,
      });
      await server.close();
    }
  });

  return app;
}
