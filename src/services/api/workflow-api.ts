import type { WorkflowTaskPage } from '../../types/workflow';
import { getHeaders } from '../api-header';
import type {
  TaskInstanceData,
  BasicContactInfo,
  FileMetadata,
  ProcessFlowDetail
} from '../../types/workflow-detail';

/**
 * Fetch a paginated list of workflow tasks.
 */
export async function fetchWorkflowTasks(
  token: string,
  page: number = 0,
  size: number = 20,
): Promise<WorkflowTaskPage> {
  const url = `/services/central/api/name/task-page/list-paging/page/${page}/size/${size}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({"filter": "AVAILABLE","latest": true,"myRequest": false})
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

  const result = await res.json();
  return {
    items: result.items || [],
    page: result.page ?? page,
    pageSize: result.pageSize ?? size,
    total: result.total ?? 0,
  };
}

/**
 * Claim or unclaim a task.
 */
export async function claimTask(token: string, taskId: string): Promise<any> {
  const url = `/services/central/api/name/task-claim/exec`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ id: taskId })
  });
  if (!res.ok) throw new Error(`Claim task API error: ${res.status} ${res.statusText}`);

  return res.json();
}

/**
 * Fetch task instance data (API 1).
 */
export async function fetchTaskInstanceData(token: string, taskId: string): Promise<TaskInstanceData> {
  const url = `/services/workflow/api/v1/workflow/name/fetchInstanceData/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ id: taskId, type: 'task' }),
  });
  if (!res.ok) throw new Error(`Failed to fetch instance data: ${res.statusText}`);
  return res.json();
}


/**
 * Fetch process flow details (API 3).
 */
export async function fetchProcessFlowDetail(token: string, processInstanceId: string): Promise<ProcessFlowDetail> {
  const url = `/services/pro/api/name/detail-by-process-flow/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ id: processInstanceId }),
  });
  if (!res.ok) throw new Error(`Failed to fetch process flow details: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch basic contact info of employee (API 2).
 */
export async function fetchBasicContactInfo(token: string, username: string): Promise<BasicContactInfo> {
  const url = `/services/hrm/api/name/fetch-basic-contact-info/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ id: username }),
  });
  if (!res.ok) throw new Error(`Failed to fetch basic contact info: ${res.statusText}`);
  return res.json();
}

export async function fetchFilesMetadata(token: string, fileIds: string[]): Promise<FileMetadata[]> {
  const url = `/services/files/api/name/list-files-by-ids/list`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ list: fileIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch files metadata: ${res.statusText}`);
  return res.json();
}