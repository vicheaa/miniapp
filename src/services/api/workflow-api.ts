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
  statuses?: string[],
  buKeys?: string[],
): Promise<WorkflowTaskPage> {
  const url = `/services/central/api/name/task-page/list-paging/page/${page}/size/${size}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filter: filter ?? "AVAILABLE",
      latest: latest ?? true,
      myRequest: myRequest ?? false,
      buKeys: buKeys && buKeys.length > 0 ? buKeys : ["PR"],
      status: statuses ?? [],
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

/**
 * Fetch binary blob content for a file by its ID or metadata.
 */
export async function fetchFileBlob(fileId: string, fileMeta?: FileMetadata): Promise<Blob> {
  // If fileMeta has a direct web URL (http:// or https:// or data: or blob:)
  if (
    fileMeta?.uri &&
    (fileMeta.uri.startsWith('http://') ||
      fileMeta.uri.startsWith('https://') ||
      fileMeta.uri.startsWith('data:') ||
      fileMeta.uri.startsWith('blob:'))
  ) {
    const res = await fetch(fileMeta.uri);
    if (res.ok) return await res.blob();
  }

  // Primary endpoint: GET /services/files/api/file/${fileId}
  const primaryUrl = `/services/files/api/file/${fileId}`;
  try {
    const res = await fetch(primaryUrl, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') || contentType.includes('image/') || contentType.includes('pdf')) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          return blob;
        }
      }
    }
  } catch (err) {
    console.warn(`Primary fetch failed for ${primaryUrl}:`, err);
  }

  // Fallbacks
  const attempts: { url: string; method: 'GET' | 'POST'; body: any }[] = [
    { url: `/services/files/api/name/get-file-by-id/find`, method: 'POST', body: { id: fileId } },
    { url: `/services/files/api/name/download-file-by-id/find`, method: 'POST', body: { id: fileId } },
    { url: `/services/files/api/name/download-file/find`, method: 'POST', body: { id: fileId } },
    { url: `/services/central/api/upload/file/${fileId}`, method: 'GET', body: null },
  ];

  for (const ep of attempts) {
    try {
      const options: RequestInit = {
        method: ep.method,
        headers: getHeaders(),
      };
      if (ep.body) {
        options.body = JSON.stringify(ep.body);
      }
      const res = await fetch(ep.url, options);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json') || contentType.includes('image/') || contentType.includes('pdf')) {
          const blob = await res.blob();
          if (blob && blob.size > 0) {
            return blob;
          }
        }
      }
    } catch (err) {
      // Continue
    }
  }

  throw new Error(`Unable to fetch file binary content for ID: ${fileId}`);
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

export async function completeTask(body: {
  action: string;
  payloadType: string;
  taskId: string;
  payloadData: {
    id: number;
    items: any[];
    services: any[];
  };
  comment: string;
  uploadedFiles: string[];
  fetchCurrentTask?: boolean;
}): Promise<any> {
  const url = `/services/workflow/api/v1/workflow/name/completeTask/exec`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to complete task: ${res.status} ${res.statusText}`);
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

export interface BpmnTaskItem {
  taskId: string;
  taskDefKey: string;
  isActive: boolean;
}

export interface BpmnDiagramResponse {
  id: string;
  bpmn20Xml: string;
  status: string;
  processDef: any;
  taskList: BpmnTaskItem[];
}

/**
 * Fetch BPMN diagram XML and task status list for a process instance.
 */
export async function fetchBpmnDiagram(procInstId: string): Promise<BpmnDiagramResponse> {
  const url = `/services/workflow/api/v1/workflow/name/fetchDiagram/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: procInstId }),
  });
  if (!res.ok) throw new Error(`Failed to fetch BPMN diagram: ${res.status} ${res.statusText}`);
  return res.json();
}

export interface TaskUserDestination {
  startedDate: string;
  endedDate: string | null;
  lastName: string;
  firstName: string;
  empNo: string;
  userId: string;
}

/**
 * Fetch list of destination users / assignees for a task in the process instance.
 */
export async function fetchTaskUserDestList(taskId: string): Promise<TaskUserDestination[]> {
  const url = `/services/workflow/api/v1/workflow/name/userDestList/list`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id: taskId }),
  });
  if (!res.ok) throw new Error(`Failed to fetch user destination list: ${res.status} ${res.statusText}`);
  return res.json();
}

export interface AvailableUser {
  id: string;
  name: string;
  type: string;
  code: string;
  integratedId: string | null;
  description: string;
  email: string;
}

/**
 * Fetch list of available users for a task process instance.
 */
export async function fetchAvailableUsers(procInstId: string): Promise<AvailableUser[]> {
  const url = `/services/workflow/api/v1/workflow/name/list-available-users-task/list`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ procInstId }),
  });
  if (!res.ok) throw new Error(`Failed to fetch available users: ${res.status} ${res.statusText}`);
  return res.json();
}