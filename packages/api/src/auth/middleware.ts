import type { Middleware } from 'openapi-fetch';

/**
 * Configuration for authentication middleware.
 */
export interface AuthConfig {
  /** Function to retrieve the current access token */
  getToken: () => Promise<string>;
  /**
   * Discard the cached token so the next getToken() mints a fresh one.
   * Without it a 401 cannot be recovered from — the same expired token would
   * simply be replayed.
   */
  invalidateToken?: () => void;
  /** Optional callback when a token is replaced */
  onTokenRefresh?: (newToken: string) => void;
  /** Optional callback on authentication failure */
  onAuthError?: (error: Error) => void;
}

/**
 * Creates an authentication middleware for openapi-fetch.
 *
 * This middleware:
 * - Injects the Bearer token into each request
 * - Retries **once** on a 401 with a freshly minted token
 *
 * ## Why the retry exists
 *
 * Tokens are cached until their actual expiry — there is no proactive
 * re-minting — so a token that is valid when the request is built can expire
 * before the API validates it. Without this retry that race surfaces to the
 * caller as `auth_error` / "Check API credentials", which is both a failure
 * and a misleading diagnosis: the credentials are fine.
 *
 * The window is small in practice (`public-client` access tokens last 100
 * hours), but the recovery is cheap and the failure it prevents is confusing.
 *
 * @example
 * ```ts
 * const authMiddleware = createAuthMiddleware({
 *   getToken: () => tokenManager.getToken(),
 *   invalidateToken: () => tokenManager.clearToken(),
 * });
 * client.use(authMiddleware);
 * ```
 */
export function createAuthMiddleware(config: AuthConfig): Middleware {
  // Clone each request before it is sent, so a 401 can be replayed. A Request
  // that has already been dispatched has a consumed body and cannot be reused.
  const inFlight = new Map<string, Request>();

  return {
    async onRequest({ request, id }) {
      const token = await config.getToken();
      request.headers.set('Authorization', `Bearer ${token}`);
      inFlight.set(id, request.clone());
      return request;
    },

    async onResponse({ response, id }) {
      const original = inFlight.get(id);
      inFlight.delete(id);

      if (response.status !== 401) {
        return response;
      }

      // No way to replay, or no way to get a different token — report as-is.
      if (!original || !config.invalidateToken) {
        config.onAuthError?.(new Error('Authentication failed - token may be expired'));
        return response;
      }

      config.invalidateToken();
      const token = await config.getToken();
      config.onTokenRefresh?.(token);

      original.headers.set('Authorization', `Bearer ${token}`);
      const retried = await fetch(original);

      // A second 401 means the credentials really are wrong. Never loop.
      if (retried.status === 401) {
        config.onAuthError?.(new Error('Authentication failed - credentials rejected'));
      }
      return retried;
    },

    async onError({ id }) {
      inFlight.delete(id);
      return undefined;
    },
  };
}
