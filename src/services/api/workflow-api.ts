import type { WorkflowTaskPage } from '../../types/workflow';
import { getHeaders } from '../api-header';
import type {
  TaskInstanceData,
  BasicContactInfo,
  FileMetadata,
  ProcessFlowDetail,
  FnsRequestDetail,
  BudgetCode
} from '../../types/workflow-detail';
export type { BudgetCode };

/**
 * Fetch a paginated list of workflow tasks.
 */
export async function fetchWorkflowTasks(
  page: number = 0,
  size: number = 20,
  filter?: string,
  latest?: boolean,
  myRequest?: boolean,
  searchValue?: string,
): Promise<WorkflowTaskPage> {
  const url = `/services/central/api/name/task-page/list-paging/page/${page}/size/${size}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filter: filter ?? "AVAILABLE",
      latest: latest ?? true,
      myRequest: myRequest ?? false,
      ...(searchValue && { searchValue }),
    })
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
 * Claim a task.
 */
export async function claimTask(taskId: string): Promise<any> {
  const url = `/services/central/api/name/task-claim/exec`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: taskId })
  });
  if (!res.ok) throw new Error(`Claim task API error: ${res.status} ${res.statusText}`);

  return res.json();
}

/**
 * Unclaim a task.
 */
export async function unclaimTask(taskId: string): Promise<any> {
  const url = `/services/central/api/name/task-unclaim/exec`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: taskId })
  });
  if (!res.ok) throw new Error(`Unclaim task API error: ${res.status} ${res.statusText}`);

  return res.json();
}

/**
 * Fetch task instance data (API 1).
 */
export async function fetchTaskInstanceData(taskId: string): Promise<TaskInstanceData> {
  const url = `/services/workflow/api/v1/workflow/name/fetchInstanceData/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: taskId, type: 'task' }),
  });
  if (!res.ok) throw new Error(`Failed to fetch instance data: ${res.statusText}`);
  return res.json();
}


/**
 * Fetch process flow details (API 3).
 */
export async function fetchProcessFlowDetail(processInstanceId: string): Promise<ProcessFlowDetail> {
  const url = `/services/pro/api/name/detail-by-process-flow/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: processInstanceId }),
  });
  if (!res.ok) throw new Error(`Failed to fetch process flow details: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch basic contact info of employee (API 2).
 */
export async function fetchBasicContactInfo(username: string): Promise<BasicContactInfo> {
  const url = `/services/hrm/api/name/fetch-basic-contact-info/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: username }),
  });
  if (!res.ok) throw new Error(`Failed to fetch basic contact info: ${res.statusText}`);
  return res.json();
}

export async function fetchFilesMetadata(fileIds: string[]): Promise<FileMetadata[]> {
  const url = `/services/files/api/name/list-files-by-ids/list`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ list: fileIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch files metadata: ${res.statusText}`);
  return res.json();
}


export async function fetchBudgetCodesByDept(deptId: number, buId: number): Promise<BudgetCode[]> {
  const url = `/services/pro/api/name/list-budget-code-by-dept/list`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ deptId: deptId, buId: buId }),
  });
  if (!res.ok) throw new Error(`Failed to fetch budget codes: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function uploadFiles(files: File[]): Promise<{ fileId: string; publicUrl: string }[]> {
  const url = `/services/central/api/upload/multi`;
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const headers = { ...getHeaders() } as Record<string, string>;
  delete headers['Content-Type'];

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload files: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function saveBudgetReview(body: {
  taskId: string;
  actionName: string;
  payload: {
    id: number;
    items: any[];
    services: any[];
  };
  fileIds: string[];
  comment?: string;
}): Promise<any> {
  const url = `/services/pro/api/name/save-budget-review/exec`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to save budget review: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch FMA New Staff Request detail (FNS).
 */
export async function fetchFmaNewStaffRequestDetail(processInstanceId: string): Promise<FnsRequestDetail> {
  const url = `/services/hrm/api/name/fetch-item-fma-new-staff-request/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: processInstanceId }),
  });
  if (!res.ok) throw new Error(`Failed to fetch FNS request detail: ${res.statusText}`);
  return res.json();
}