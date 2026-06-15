import type { WorkflowTaskPage } from '../../types/workflow';

/* ── Helpers ───────────────────────────────────────────────────────────── */

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ── Public API ────────────────────────────────────────────────────────── */

/**
 * Fetch a paginated list of workflow tasks.
 */
export async function fetchWorkflowTasks(
  token: string,
  page: number = 0,
  size: number = 20,
): Promise<WorkflowTaskPage> {
  const url = `/services/central/api/name/task-page/list-paging/page/${page}/size/${size}`;
  console.log(`[WorkflowAPI] Fetching tasks page=${page} size=${size}…`);

  const res = await fetch(url, { method: 'POST', headers: authHeaders(token), body: JSON.stringify( {"filter":"AVAILABLE","latest":true,"myRequest":false}) });
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
  console.log(`[WorkflowAPI] Executing task-claim for id=${taskId}…`);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ id: taskId }),
  });
  if (!res.ok) throw new Error(`Claim task API error: ${res.status} ${res.statusText}`);

  return res.json();
}

