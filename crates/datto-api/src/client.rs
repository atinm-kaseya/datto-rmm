//! Datto RMM API Client implementation.

use crate::mcp_headers::McpCallHeaders;
use crate::platforms::Platform;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client as HttpClient;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// OAuth 2.0 credentials for the Datto RMM API.
///
/// These should be your REST API user credentials from User Profile → API Settings.
/// The password grant flow uses `public-client:public` as the client credentials,
/// with your API key/secret as the username/password.
#[derive(Debug, Clone)]
pub struct Credentials {
    /// API Key (username for password grant)
    pub api_key: String,
    /// API Secret (password for password grant)
    pub api_secret: String,
}

/// OAuth token state.
struct TokenState {
    access_token: String,
    expires_at: Instant,
}

/// Datto RMM API client.
///
/// This client handles authentication and provides access to the generated API methods.
///
/// # Example
///
/// ```no_run
/// use datto_api::{DattoClient, Platform, Credentials};
///
/// #[tokio::main]
/// async fn main() -> Result<(), datto_api::Error> {
///     let client = DattoClient::new(
///         Platform::Merlot,
///         Credentials {
///             api_key: "your-api-key".into(),
///             api_secret: "your-api-secret".into(),
///         },
///     ).await?;
///
///     // Use the client...
///     Ok(())
/// }
/// ```
pub struct DattoClient {
    http_client: HttpClient,
    credentials: Credentials,
    platform: Platform,
    base_url: String,
    token_endpoint: String,
    token_state: Arc<RwLock<Option<TokenState>>>,
    /// Serialises concurrent token refreshes so only one HTTP call goes out at a time.
    refresh_lock: Arc<tokio::sync::Mutex<()>>,
}

impl DattoClient {
    /// Create a new Datto RMM API client targeting the platform's default URL.
    pub async fn new(platform: Platform, credentials: Credentials) -> Result<Self, Error> {
        Self::new_with_base_url(platform, credentials, None).await
    }

    /// Create a client with an explicit base URL override.
    ///
    /// Use this to route traffic through a proxy (e.g., the AEM API) instead of
    /// hitting the DRMM centrastage.net endpoint directly.
    ///
    /// The OAuth token endpoint always targets the platform's real auth server regardless
    /// of the base_url override — the proxy does not handle token issuance.
    pub async fn new_with_base_url(
        platform: Platform,
        credentials: Credentials,
        base_url: Option<String>,
    ) -> Result<Self, Error> {
        let http_client = HttpClient::builder()
            .timeout(Duration::from_secs(30))
            // Evict idle connections after 55 s — comfortably below Tomcat's default
            // 60 s keep-alive so we never try to reuse a connection the server has closed.
            .pool_idle_timeout(Duration::from_secs(55))
            .build()
            .map_err(Error::HttpClient)?;

        let base_url = base_url.unwrap_or_else(|| platform.base_url().to_string());
        // Always use the platform's real auth server, even when API calls are proxied.
        let token_endpoint = platform.token_endpoint();

        let client = Self {
            http_client,
            credentials,
            platform,
            base_url,
            token_endpoint,
            token_state: Arc::new(RwLock::new(None)),
            refresh_lock: Arc::new(tokio::sync::Mutex::new(())),
        };

        // Pre-fetch initial token
        client.ensure_token().await?;

        Ok(client)
    }

    /// Get the platform this client is connected to.
    pub fn platform(&self) -> Platform {
        self.platform
    }

    /// Get the base URL for API requests.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Ensure we have a valid access token.
    ///
    /// Returns the token if valid, refreshes if expired.
    /// Concurrent callers that all see an expired token serialize behind `refresh_lock`
    /// so only one HTTP call goes out; the rest re-check after the winner finishes.
    pub async fn ensure_token(&self) -> Result<String, Error> {
        let buffer = Duration::from_secs(5 * 60);

        // Fast path: token is valid, no lock needed.
        {
            let state = self.token_state.read().await;
            if let Some(ref ts) = *state {
                if ts.expires_at > Instant::now() + buffer {
                    return Ok(ts.access_token.clone());
                }
            }
        }

        // Slow path: serialize concurrent refreshes.
        let _guard = self.refresh_lock.lock().await;

        // Re-check now that we hold the mutex — another waiter may have refreshed already.
        {
            let state = self.token_state.read().await;
            if let Some(ref ts) = *state {
                if ts.expires_at > Instant::now() + buffer {
                    return Ok(ts.access_token.clone());
                }
            }
        }

        self.refresh_token().await
    }

    /// Force a token refresh.
    async fn refresh_token(&self) -> Result<String, Error> {
        info!(token_endpoint = %self.token_endpoint, "Fetching OAuth token");

        let client_auth = BASE64.encode("public-client:public");

        let body = format!(
            "grant_type=password&username={}&password={}",
            urlencoding::encode(&self.credentials.api_key),
            urlencoding::encode(&self.credentials.api_secret)
        );

        let response = self
            .http_client
            .post(&self.token_endpoint)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Authorization", format!("Basic {}", client_auth))
            .body(body)
            .send()
            .await
            .map_err(Error::HttpClient)?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            warn!(status = %status, "OAuth token request failed");
            return Err(Error::Auth(format!(
                "OAuth token request failed: {} - {}",
                status, body
            )));
        }

        #[derive(serde::Deserialize)]
        struct TokenResponse {
            access_token: String,
            expires_in: u64,
        }

        let token_response: TokenResponse = response.json().await.map_err(Error::HttpClient)?;

        info!(expires_in_secs = token_response.expires_in, "OAuth token obtained");

        let token_state = TokenState {
            access_token: token_response.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(token_response.expires_in),
        };

        {
            let mut state = self.token_state.write().await;
            *state = Some(token_state);
        }

        Ok(token_response.access_token)
    }

    /// Force a token refresh, ignoring the cached state. Used on 401 retry.
    async fn force_refresh_token(&self) -> Result<String, Error> {
        self.refresh_token().await
    }

    /// Get the HTTP client for making custom requests.
    ///
    /// Note: You'll need to add the Authorization header yourself.
    pub fn http_client(&self) -> &HttpClient {
        &self.http_client
    }

    /// Make an authenticated GET request.
    ///
    /// Automatically adds the Authorization header with a valid access token.
    pub async fn get<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);
        debug!(method = "GET", %url);

        let response = self
            .http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            self.http_client
                .get(&url)
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await
                .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response
            .json::<T>()
            .await
            .map_err(Error::HttpClient)
    }

    /// Make an authenticated GET request with query parameters.
    pub async fn get_with_query<T: serde::de::DeserializeOwned, Q: serde::Serialize>(
        &self,
        path: &str,
        query: &Q,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);
        debug!(method = "GET", %url);

        let response = self
            .http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .query(query)
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            self.http_client
                .get(&url)
                .header("Authorization", format!("Bearer {}", token))
                .query(query)
                .send()
                .await
                .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body_text = response.text().await.map_err(Error::HttpClient)?;
        serde_json::from_str::<T>(&body_text).map_err(|e| {
            let sample = if body_text.len() > 500 {
                format!("{}...", &body_text[..500])
            } else {
                body_text.clone()
            };
            Error::Parse(format!(
                "Failed to parse response: {}\nResponse body: {}",
                e, sample
            ))
        })
    }

    /// Make an authenticated POST request.
    pub async fn post<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);
        debug!(method = "POST", %url);

        let response = self
            .http_client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(body)
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            self.http_client
                .post(&url)
                .header("Authorization", format!("Bearer {}", token))
                .json(body)
                .send()
                .await
                .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response
            .json::<T>()
            .await
            .map_err(Error::HttpClient)
    }

    /// Make an authenticated PUT request.
    pub async fn put<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);
        debug!(method = "PUT", %url);

        let response = self
            .http_client
            .put(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(body)
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            self.http_client
                .put(&url)
                .header("Authorization", format!("Bearer {}", token))
                .json(body)
                .send()
                .await
                .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response
            .json::<T>()
            .await
            .map_err(Error::HttpClient)
    }

    /// Make an authenticated PATCH request.
    pub async fn patch<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);
        debug!(method = "PATCH", %url);

        let response = self
            .http_client
            .patch(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(body)
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            self.http_client
                .patch(&url)
                .header("Authorization", format!("Bearer {}", token))
                .json(body)
                .send()
                .await
                .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response
            .json::<T>()
            .await
            .map_err(Error::HttpClient)
    }

    /// Make an authenticated DELETE request.
    pub async fn delete<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);
        debug!(method = "DELETE", %url);

        let response = self
            .http_client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            self.http_client
                .delete(&url)
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await
                .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response
            .json::<T>()
            .await
            .map_err(Error::HttpClient)
    }

    // ------------------------------------------------------------------
    // MCP-aware variants — identical to the base primitives but also
    // attach the five X-Datto-Mcp-* context headers on every request.
    // ------------------------------------------------------------------

    pub async fn get_with_mcp<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        mcp: &McpCallHeaders,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);

        let response = mcp
            .apply_to(
                self.http_client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", token)),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            mcp.apply_to(
                self.http_client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", token)),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response.json::<T>().await.map_err(Error::HttpClient)
    }

    pub async fn get_with_query_with_mcp<T: serde::de::DeserializeOwned, Q: serde::Serialize>(
        &self,
        path: &str,
        query: &Q,
        mcp: &McpCallHeaders,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);

        let response = mcp
            .apply_to(
                self.http_client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .query(query),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            mcp.apply_to(
                self.http_client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .query(query),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body_text = response.text().await.map_err(Error::HttpClient)?;
        serde_json::from_str::<T>(&body_text).map_err(|e| {
            let sample = if body_text.len() > 500 {
                format!("{}...", &body_text[..500])
            } else {
                body_text.clone()
            };
            Error::Parse(format!(
                "Failed to parse response: {}\nResponse body: {}",
                e, sample
            ))
        })
    }

    pub async fn post_with_mcp<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
        mcp: &McpCallHeaders,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);

        let response = mcp
            .apply_to(
                self.http_client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .json(body),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            mcp.apply_to(
                self.http_client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .json(body),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response.json::<T>().await.map_err(Error::HttpClient)
    }

    pub async fn put_with_mcp<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
        mcp: &McpCallHeaders,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);

        let response = mcp
            .apply_to(
                self.http_client
                    .put(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .json(body),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            mcp.apply_to(
                self.http_client
                    .put(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .json(body),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response.json::<T>().await.map_err(Error::HttpClient)
    }

    pub async fn patch_with_mcp<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
        mcp: &McpCallHeaders,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);

        let response = mcp
            .apply_to(
                self.http_client
                    .patch(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .json(body),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            mcp.apply_to(
                self.http_client
                    .patch(&url)
                    .header("Authorization", format!("Bearer {}", token))
                    .json(body),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response.json::<T>().await.map_err(Error::HttpClient)
    }

    pub async fn delete_with_mcp<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        mcp: &McpCallHeaders,
    ) -> Result<T, Error> {
        let token = self.ensure_token().await?;
        let url = format!("{}{}", self.base_url, path);

        let response = mcp
            .apply_to(
                self.http_client
                    .delete(&url)
                    .header("Authorization", format!("Bearer {}", token)),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = self.force_refresh_token().await?;
            mcp.apply_to(
                self.http_client
                    .delete(&url)
                    .header("Authorization", format!("Bearer {}", token)),
            )
            .send()
            .await
            .map_err(Error::HttpClient)?
        } else {
            response
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        response.json::<T>().await.map_err(Error::HttpClient)
    }
}

/// Errors that can occur when using the Datto RMM API client.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// HTTP client error
    #[error("HTTP client error: {0}")]
    HttpClient(#[from] reqwest::Error),

    /// Authentication error
    #[error("Authentication failed: {0}")]
    Auth(String),

    /// API error response
    #[error("API error: {status} - {message}")]
    Api {
        /// HTTP status code
        status: u16,
        /// Error message
        message: String,
    },

    /// JSON parsing error
    #[error("Failed to parse response: {0}")]
    Parse(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credentials_creation() {
        let creds = Credentials {
            api_key: "test-key".to_string(),
            api_secret: "test-secret".to_string(),
        };
        assert_eq!(creds.api_key, "test-key");
        assert_eq!(creds.api_secret, "test-secret");
    }

    #[test]
    fn test_credentials_clone() {
        let creds1 = Credentials {
            api_key: "key".to_string(),
            api_secret: "secret".to_string(),
        };
        let creds2 = creds1.clone();
        assert_eq!(creds1.api_key, creds2.api_key);
        assert_eq!(creds1.api_secret, creds2.api_secret);
    }

    #[test]
    fn test_error_display_http_client() {
        // We can't easily create a reqwest::Error, so test the other variants
        let err = Error::Auth("invalid credentials".to_string());
        assert_eq!(err.to_string(), "Authentication failed: invalid credentials");
    }

    #[test]
    fn test_error_display_api() {
        let err = Error::Api {
            status: 404,
            message: "Not found".to_string(),
        };
        assert_eq!(err.to_string(), "API error: 404 - Not found");
    }

    #[test]
    fn test_error_debug() {
        let err = Error::Auth("test".to_string());
        let debug_str = format!("{:?}", err);
        assert!(debug_str.contains("Auth"));
        assert!(debug_str.contains("test"));
    }

    #[test]
    fn token_endpoint_is_always_platform_auth_server() {
        // When base_url is overridden (e.g. to aem-api proxy), the token endpoint
        // must still point to the platform's real auth server, not the proxy.
        // We verify this by checking that Platform::token_endpoint() is used directly.
        let pinotage_token_ep = Platform::Pinotage.token_endpoint();
        let sandbox_token_ep = Platform::Sandbox.token_endpoint();

        assert_eq!(
            pinotage_token_ep,
            "https://pinotage-api.centrastage.net/auth/oauth/token"
        );
        assert_eq!(
            sandbox_token_ep,
            "https://sandbox-api.centrastage.net/auth/oauth/token"
        );
        // Neither should contain a proxy/aem-api hostname
        assert!(!pinotage_token_ep.contains("aem-api"));
        assert!(!sandbox_token_ep.contains("aem-api"));
    }
}
