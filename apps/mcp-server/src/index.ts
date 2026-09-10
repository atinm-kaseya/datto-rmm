#!/usr/bin/env node

import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { loadConfig } from './config.js';
import { runServer } from './server.js';
import { initLogger, logger } from './utils/logger.js';
import type { Platform } from 'datto-rmm-api';
import type { ServerConfig } from './config.js';

async function main() {
  try {
    const config = loadConfig();

    if (config.logFilePath) {
      initLogger(config.logFilePath);
      logger.info('Datto RMM MCP Server starting...');
    }

    if (process.env['MCP_MODE'] === 'http' || process.env['HTTP_PORT']) {
      const { Redis } = await import('ioredis');
      const { SessionStore } = await import('./session/store.js');
      const { createHttpApp } = await import('./http.js');

      const redisCfg = config.http!.redis;
      const redis = new Redis({
        host: redisCfg.host,
        port: redisCfg.port,
        password: redisCfg.password,
        tls: redisCfg.tls ? {} : undefined,
      });

      const store = new SessionStore(redis);
      const app = createHttpApp(store, config.http!);
      app.listen(config.http!.port, '0.0.0.0', () => {
        console.log(`MCP HTTP server listening on :${config.http!.port}`);
      });
    } else {
      if (config.platform) {
        logger.info(`Platform: ${config.platform}`);
      }
      await runServer(config as ServerConfig & { apiKey: string; apiSecret: string; platform: Platform });
    }
  } catch (error) {
    console.error('Failed to start Datto RMM MCP server:', error);
    process.exit(1);
  }
}

main();
