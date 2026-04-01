#!/usr/bin/env node

import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the mcp-server directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { loadConfig } from './config.js';
import { runServer } from './server.js';
import { initLogger, logger } from './utils/logger.js';

async function main() {
  try {
    const config = loadConfig();

    // Initialize logger if log file is specified
    if (config.logFilePath) {
      initLogger(config.logFilePath);
      logger.info('Datto RMM MCP Server starting...');
      logger.info(`Platform: ${config.platform}`);
    }

    await runServer(config);
  } catch (error) {
    console.error('Failed to start Datto RMM MCP server:', error);
    process.exit(1);
  }
}

main();
