import type { AuthConfig } from './middleware.js';

/**
 * OAuth 2.0 client credentials for Datto RMM API.
 */
export interface OAuthCredentials {
  /** API Key (client ID) */
  apiKey: string;
  /** API Secret (client secret) */
  apiSecret: string;
}

/**
 * OAuth token response from the Datto RMM API.
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Manages OAuth 2.0 access tokens for the Datto RMM API.
 *
 * ## Why there is no refresh flow
 *
 * The auth server (Security-service, Spring `@EnableAuthorizationServer`) does
 * support `refresh_token` — it is even the column default in
 * `securityservice.oauth_client_details`. But the client we authenticate as,
 * **`public-client`, is registered with `authorized_grant_types =
 * password,authorization_code` only**, so no refresh token is ever issued to
 * us. Every token is minted fresh from the API key/secret.
 *
 * Verified against `Security-service/etc/liquibase/changelog.xml`
 * ("Default public client"); `sha256("public")` matches the seeded
 * `client_secret`. That is seed data — confirm against a real environment
 * before relying on it, and revisit this class if `public-client` is ever
 * granted `refresh_token`.
 *
 * ## Token lifetime
 *
 * `public-client.access_token_validity` is **360000s — 100 hours**, not the
 * usual hour. Re-minting is therefore rare, and the old 5-minute pre-expiry
 * buffer was saving nothing (0.08% of a token's life).
 *
 * Features:
 * - Token caching for the full lifetime of the token
 * - Request deduplication for concurrent mint attempts
 *
 * Tokens are held until they actually expire; there is no proactive
 * re-minting. A token can therefore expire in flight, which the auth
 * middleware recovers from with a single 401 retry.
 *
 * @example
 * ```ts
 * const tokenManager = new OAuthTokenManager(
 *   { apiKey: 'xxx', apiSecret: 'yyy' },
 *   'https://merlot-api.centrastage.net/auth/oauth/token'
 * );
 *
 * const token = await tokenManager.getToken();
 * ```
 */
export class OAuthTokenManager {
  private token: string | null = null;
  private expiresAt = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly credentials: OAuthCredentials,
    private readonly tokenEndpoint: string,
  ) {}

  /**
   * Get a valid access token.
   *
   * Returns the cached token until it expires, then mints a new one.
   * Concurrent calls during a mint share the same promise.
   */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }

    // Deduplicate concurrent mint requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.mintToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Mint a new access token via the password grant, replacing any cached one.
   *
   * Not a refresh in the OAuth sense — `public-client` is not granted the
   * refresh_token flow, so there is never a refresh token to exchange.
   */
  async mintToken(): Promise<string> {
    // Use password grant with public-client credentials
    const clientAuth = btoa('public-client:public');

    const params = new URLSearchParams({
      grant_type: 'password',
      username: this.credentials.apiKey,
      password: this.credentials.apiSecret,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${clientAuth}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      // Classify as an auth failure, not a generic upstream error. The auth
      // server answers 400 (invalid_grant) for bad credentials, which would
      // otherwise surface to the caller as "api_error / retry later" — wrong
      // advice for the one failure retrying cannot fix.
      //
      // The response body is deliberately dropped: it adds nothing the caller
      // can act on and may name internal infrastructure.
      const authFailure = [400, 401, 403].includes(response.status);
      throw new Error(
        authFailure
          ? 'HTTP 401 OAuth token request rejected - check the API key and secret'
          : `HTTP ${response.status} OAuth token request failed`,
      );
    }

    const data = (await response.json()) as TokenResponse;
    this.token = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;

    return this.token;
  }

  /**
   * Clear the cached token.
   */
  clearToken(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  /**
   * Convert to an AuthConfig for use with createAuthMiddleware.
   */
  toAuthConfig(): AuthConfig {
    return {
      getToken: () => this.getToken(),
      // Lets the middleware recover from a token that expired in flight.
      invalidateToken: () => this.clearToken(),
    };
  }
}
