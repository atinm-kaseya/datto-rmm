use crate::error::{Error, Result};
use datto_api::Platform;

#[derive(Debug, Clone)]
pub struct Config {
    platform: Platform,
    api_key: String,
    api_secret: String,
}

impl Config {
    pub fn from_cli(
        platform: Option<String>,
        api_key: Option<String>,
        api_secret: Option<String>,
    ) -> Result<Self> {
        let platform_str = platform.ok_or_else(|| {
            Error::Config("DATTO_PLATFORM environment variable is required".to_string())
        })?;

        let api_key = api_key.ok_or_else(|| {
            Error::Config("DATTO_API_KEY environment variable is required".to_string())
        })?;

        let api_secret = api_secret.ok_or_else(|| {
            Error::Config("DATTO_API_SECRET environment variable is required".to_string())
        })?;

        let platform = platform_str.parse::<Platform>().map_err(|e| {
            Error::Config(format!("Invalid platform '{}': {}", platform_str, e))
        })?;

        Ok(Self {
            platform,
            api_key,
            api_secret,
        })
    }

    pub fn platform(&self) -> &Platform {
        &self.platform
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    pub fn api_secret(&self) -> &str {
        &self.api_secret
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_from_cli() {
        let config = Config::from_cli(
            Some("pinotage".to_string()),
            Some("test_key".to_string()),
            Some("test_secret".to_string()),
        )
        .unwrap();

        assert_eq!(config.platform().to_string(), "pinotage");
        assert_eq!(config.api_key(), "test_key");
        assert_eq!(config.api_secret(), "test_secret");
    }

    #[test]
    fn test_config_missing_platform() {
        let result = Config::from_cli(None, Some("key".into()), Some("secret".into()));
        assert!(result.is_err());
    }

    #[test]
    fn test_config_invalid_platform() {
        let result = Config::from_cli(
            Some("invalid".into()),
            Some("key".into()),
            Some("secret".into()),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_all_valid_platforms() {
        let platforms = [
            "pinotage", "merlot", "concord", "vidal", 
            "zinfandel", "syrah", "sandbox", "devb", "staging"
        ];
        
        for platform in platforms {
            let result = Config::from_cli(
                Some(platform.into()),
                Some("key".into()),
                Some("secret".into()),
            );
            assert!(result.is_ok(), "Platform {} should be valid", platform);
        }
    }
}
