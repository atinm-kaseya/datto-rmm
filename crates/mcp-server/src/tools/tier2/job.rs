//! Tier 2: Job API tools

use crate::{tools::ToolHandler, utils::tool_helpers};
use datto_api::DattoClient;
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct JobUidParams {
    pub job_uid: String,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct JobOutputParams {
    pub job_uid: String,
    pub device_uid: String,
}

pub fn get_job_tool() -> Tool {
    tool_helpers::create_tool::<JobUidParams>(
        "get-job",
        "🔧 [Advanced] Get job information. Returns Job JSON with: uid, name, enabled boolean, schedule info, componentUids array, devices array, lastRunTime epoch. Format with ✅❌ for enabled status, convert epoch times, show component and device counts. Use 📅 for schedule, ⚙️ for components, 💻 for devices.",
    )
}

pub fn get_job_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: JobUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let job = client
                .get_job(&params.job_uid)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get job: {}", e)))?;

            let data = serde_json::to_value(&job)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present this job configuration clearly. Show job name prominently, display UID for reference. Show enabled status with checkmark or X mark. Display schedule information with a calendar icon. Show counts of components and target devices. Convert epoch timestamps (lastRunTime) to readable format. Organize into logical sections: configuration, schedule, components, and devices. Make enabled/disabled status immediately visible.",
                Some(vec!["job_overview", "status_indicators", "schedule_display", "component_device_counts", "timestamp_conversion"])
            ))
        })
    })
}

pub fn get_job_results_tool() -> Tool {
    tool_helpers::create_tool::<JobUidParams>(
        "get-job-results",
        "🔧 [Advanced] Get job execution results. Returns JobResults JSON with: overall status, componentResults array (each has status, startTime epoch, endTime epoch, exitCode, deviceName). Format with sections: **Status** ✅❌, **Summary** (success/failure counts, consider progress bar or pie chart), **Per-Device Table** (Device, Status ✅❌, Exit Code, Runtime in seconds/minutes). Highlight failures in red.",
    )
}

pub fn get_job_results_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: JobUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let results = client
                .get_job_results(&params.job_uid)
                .await
                .map_err(|e| crate::Error::Api(format!("Failed to get job results: {}", e)))?;

            let data = serde_json::to_value(&results)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                data,
                "Present these job execution results with a clear summary and per-device breakdown. Start with overall status using success/failure indicators. Create a summary showing total devices, success count, failure count - consider using a progress bar or percentage. Display a table with columns: Device Name, Status (checkmark for success, X for failure), Exit Code, Runtime (convert seconds to minutes if needed). Highlight failures in red to make them immediately visible. Calculate and show success rate percentage.",
                Some(vec!["execution_summary", "success_failure_counts", "per_device_table", "failure_highlighting", "progress_visualization"])
            ))
        })
    })
}

// Additional job tools
pub fn get_job_components_tool() -> Tool {
    tool_helpers::create_tool::<JobUidParams>(
        "get-job-components",
        "🔧 [Advanced] Get job components details. Returns JSON - format as list showing: Component Name, UID, Order/Sequence, Type, Parameters (if any). Present in execution order.",
    )
}

pub fn get_job_components_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: JobUidParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let data = client.get_job_components(&params.job_uid).await
                .map_err(|e| crate::Error::Api(format!("Failed to get job components: {}", e)))?;

            let json_data = serde_json::to_value(&data)
                .map_err(|e| crate::Error::Internal(format!("Serialization failed: {}", e)))?;

            Ok(tool_helpers::instructed_result(
                json_data,
                "Present this list of job components in execution order. For each component show: component name prominently, UID for reference, execution order/sequence number, component type, and any parameters if present. Display as an ordered list to make the execution sequence clear. Use numbers or step indicators to emphasize the order.",
                Some(vec!["ordered_list", "execution_sequence", "component_details", "parameter_display"])
            ))
        })
    })
}

pub fn get_job_stdout_tool() -> Tool {
    tool_helpers::create_tool::<JobOutputParams>(
        "get-job-stdout",
        "🔧 [Advanced] Get job standard output",
    )
}

pub fn get_job_stdout_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: JobOutputParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let stdout = client.get_job_stdout(&params.job_uid, &params.device_uid).await
                .map_err(|e| crate::Error::Api(format!("Failed to get job stdout: {}", e)))?;

            let result_data = serde_json::json!({
                "job_uid": &params.job_uid,
                "device_uid": &params.device_uid,
                "output_type": "stdout",
                "content": stdout
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this job's standard output. Show job UID and device UID as context headers. Display the stdout content in a code block for proper formatting and readability. If the output is empty, note that clearly. Keep formatting clean and monospaced for technical output.",
                Some(vec!["code_block", "context_headers", "stdout_display"])
            ))
        })
    })
}

pub fn get_job_stderr_tool() -> Tool {
    tool_helpers::create_tool::<JobOutputParams>(
        "get-job-stderr",
        "🔧 [Advanced] Get job standard error",
    )
}

pub fn get_job_stderr_handler() -> ToolHandler {
    Box::new(|client: Arc<DattoClient>, args: Value| {
        Box::pin(async move {
            let params: JobOutputParams = serde_json::from_value(args)
                .map_err(|e| crate::Error::InvalidInput(format!("Invalid parameters: {}", e)))?;

            let stderr = client.get_job_stderr(&params.job_uid, &params.device_uid).await
                .map_err(|e| crate::Error::Api(format!("Failed to get job stderr: {}", e)))?;

            let result_data = serde_json::json!({
                "job_uid": &params.job_uid,
                "device_uid": &params.device_uid,
                "output_type": "stderr",
                "content": stderr
            });

            Ok(tool_helpers::instructed_result(
                result_data,
                "Present this job's standard error output. Show job UID and device UID as context headers. Display the stderr content in a code block with error highlighting (use red or warning colors if possible). If stderr is empty, that's a good sign - note 'No errors' clearly. Make any error messages stand out for quick identification.",
                Some(vec!["code_block", "error_highlighting", "context_headers", "stderr_display"])
            ))
        })
    })
}
