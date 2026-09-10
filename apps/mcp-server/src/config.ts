import { Platform } from 'datto-rmm-api';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
}

export interface HttpConfig {
  port: number;
  defaultPlatform: string;
  redis: RedisConfig;
}

/**
 * Configuration for the Datto RMM MCP server.
 */
export interface ServerConfig {
  apiKey?: string;
  apiSecret?: string;
  platform?: Platform;
  logFilePath?: string;
  http?: HttpConfig;
}

/**
 * Parse platform string to Platform enum value.
 */
export function parsePlatform(value: string | undefined): Platform {
  if (!value) {
    return Platform.MERLOT;
  }

  const normalized = value.toLowerCase();
  const platforms: Record<string, Platform> = {
    pinotage: Platform.PINOTAGE,
    merlot: Platform.MERLOT,
    concord: Platform.CONCORD,
    vidal: Platform.VIDAL,
    zinfandel: Platform.ZINFANDEL,
    syrah: Platform.SYRAH,
    sandbox: Platform.SANDBOX,
    devb: Platform.DEVB,
    staging: Platform.STAGING,
  };

  const platform = platforms[normalized];
  if (!platform) {
    const valid = Object.keys(platforms).join(', ');
    throw new Error(`Invalid platform "${value}". Valid platforms: ${valid}`);
  }

  return platform;
}

/**
 * Load configuration from environment variables.
 */
export function loadConfig(): ServerConfig {
  const isHttpMode = process.env['MCP_MODE'] === 'http' || !!process.env['HTTP_PORT'];
  const logFilePath = process.env['DATTO_LOG_FILE'];

  if (isHttpMode) {
    return {
      logFilePath,
      http: {
        port: parseInt(process.env['HTTP_PORT'] ?? '8080', 10),
        defaultPlatform: process.env['DATTO_PLATFORM'] ?? 'merlot',
        redis: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
          password: process.env['REDIS_PASSWORD'],
          tls: process.env['REDIS_TLS'] === 'true',
        },
      },
    };
  }

  const apiKey = process.env['DATTO_API_KEY'];
  const apiSecret = process.env['DATTO_API_SECRET'];

  if (!apiKey) {
    throw new Error('DATTO_API_KEY environment variable is required');
  }

  if (!apiSecret) {
    throw new Error('DATTO_API_SECRET environment variable is required');
  }

  return {
    apiKey,
    apiSecret,
    platform: parsePlatform(process.env['DATTO_PLATFORM']),
    logFilePath,
  };
}
