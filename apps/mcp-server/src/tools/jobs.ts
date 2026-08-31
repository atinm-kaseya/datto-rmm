import type { DattoClient } from 'datto-rmm-api';
import { normalizePagination } from '../utils/pagination.js';
import { handleResponse, successResponse, errorResponse, mapApiError, extractPageMeta, type ToolResult } from '../utils/response.js';
import type * as T from '../types.js';

/**
 * Get job by UID.
 */
export async function getJob(client: DattoClient, args: { jobUid: string }): Promise<ToolResult> {
  try {
    const response = await client.GET('/v2/job/{jobUid}', {
      params: {
        path: { jobUid: args.jobUid },
      },
    });
    const data = handleResponse<T.Job>(response);
    return successResponse({ data, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get job components.
 */
export async function getJobComponents(
  client: DattoClient,
  args: { jobUid: string; page?: number; max?: number }
): Promise<ToolResult> {
  try {
    const pagination = normalizePagination(args);

    const response = await client.GET('/v2/job/{jobUid}/components', {
      params: {
        path: { jobUid: args.jobUid },
        query: {
          page: pagination.page,
          max: pagination.max,
        },
      },
    });
    const page = handleResponse<T.JobComponentsPage>(response);
    const { count, next_page } = extractPageMeta(page);
    return successResponse({ data: page.jobComponents ?? [], count, next_page, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}

/**
 * Get job status for a device, including stdout if the job is complete.
 */
export async function getJobStatus(
  client: DattoClient,
  args: { jobUid: string; deviceUid: string }
): Promise<ToolResult> {
  try {
    const resultsResponse = await client.GET('/v2/job/{jobUid}/results/{deviceUid}', {
      params: {
        path: {
          jobUid: args.jobUid,
          deviceUid: args.deviceUid,
        },
      },
    });
    const results = handleResponse<T.JobResults>(resultsResponse);

    let stdoutData: T.JobStdData[] | null = null;
    if (results.jobDeploymentStatus === 'Success') {
      try {
        const stdoutResponse = await client.GET('/v2/job/{jobUid}/results/{deviceUid}/stdout', {
          params: {
            path: {
              jobUid: args.jobUid,
              deviceUid: args.deviceUid,
            },
          },
        });
        stdoutData = handleResponse<T.JobStdData[]>(stdoutResponse);
      } catch {
        stdoutData = null;
      }
    }

    return successResponse({ data: { ...results, stdout: stdoutData ?? null }, _enhanced: {} });
  } catch (err) {
    return errorResponse(mapApiError(err));
  }
}
