//! Custom serde deserializers for handling API quirks

use serde::{Deserialize, Deserializer};

/// Flexible timestamp deserializer that accepts both integer and string formats.
///
/// The Datto API sometimes returns timestamps as integers (milliseconds since epoch)
/// and sometimes as strings. This deserializer handles both cases.
pub fn deserialize_flexible_timestamp<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum FlexibleTimestamp {
        Integer(i64),
        String(String),
        Null,
    }

    match FlexibleTimestamp::deserialize(deserializer)? {
        FlexibleTimestamp::Integer(ts) => Ok(Some(ts)),
        FlexibleTimestamp::String(s) => {
            // Try to parse as integer first
            if let Ok(ts) = s.parse::<i64>() {
                Ok(Some(ts))
            } else {
                // Could add ISO date parsing here if needed
                Ok(None)
            }
        }
        FlexibleTimestamp::Null => Ok(None),
    }
}

/// Required timestamp deserializer (non-optional version)
pub fn deserialize_required_flexible_timestamp<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum FlexibleTimestamp {
        Integer(i64),
        String(String),
    }

    match FlexibleTimestamp::deserialize(deserializer)? {
        FlexibleTimestamp::Integer(ts) => Ok(ts),
        FlexibleTimestamp::String(s) => {
            s.parse::<i64>()
                .map_err(|_| serde::de::Error::custom("invalid timestamp string"))
        }
    }
}
