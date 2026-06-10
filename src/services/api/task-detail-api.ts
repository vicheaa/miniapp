export interface TaskInstanceData {
  requestor: {
    id: string;
    email: string;
    name: string;
    employee: {
      buId: number;
      hod: string;
      jobTitle: string;
      empNo: string;
      firstName: string;
      lastName: string;
      id: number;
      subDepartment: string | null;
      department: string;
      internalName: string;
      reportTo: string;
      buName: string;
    };
  };
  processInstance: {
    procInstId: string;
    procDefId: string;
    procDefKey: string;
    businessKey: string;
    startUserId: string;
    startUser: string;
    startTime: string;
    endTime: string | null;
    procName: string;
    state: string;
    tenant: string;
    currTaskKey: string | null;
    currTaskName: string | null;
    completed: boolean;
  };
  task: {
    taskId: string;
    taskDefKey: string;
    taskName: string;
    assignee: string;
    created: string;
    ended: string | null;
    due: string | null;
    followUp: string | null;
    description: string | null;
    owner: string | null;
    parentTaskId: string | null;
    formKey: string;
    actions: { name: string; value: string }[];
    claimed: boolean;
    completed: boolean;
    subTask: boolean;
    assigneeInfo: {
      id: string;
      email: string;
      name: string;
      employee: {
        buId: number;
        hod: string;
        jobTitle: string;
        empNo: string;
        firstName: string;
        lastName: string;
        id: number;
        subDepartment: string | null;
        department: string;
        internalName: string;
        reportTo: string;
        buName: string;
      };
    };
  };
  activities: {
    id: string;
    taskName: string;
    action: string;
    actionBy: string;
    actionDate: string;
    comment: string | null;
  }[];
  attachmentFiles: {
    fileId: string;
    activity: string;
  }[];
}

export interface BasicContactInfo {
  id: number;
  empNo: string;
  mail: string;
  internalName: string;
  firstName: string;
  lastName: string;
  contacts: any[];
  profileImageId: string | null;
}

export interface RequisitionItem {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  description: string;
  budgetCode: string;
  qty: number;
  unitPrice: number;
  amount: number;
  uom: string;
  remarks: string | null;
  seqNo: number;
  orderedQty: number;
  purchasedQty: number;
  quotations: any;
}

export interface ProcessFlowDetail {
  id: number;
  acquisitionDate: string;
  budgetCodeRequired: boolean;
  buId: number;
  buName: string;
  deptId: number;
  formNo: string;
  service: boolean;
  reason: string;
  remarks: string | null;
  processStatus: string;
  sapStatus: string | null;
  sapDocNo: string | null;
  postedDate: string | null;
  createdDate: string;
  createdBy: string;
  totalAmount: number;
  items: RequisitionItem[];
  services: any[];
  fileIds: any[];
}

const BASE_URL = '';

function getHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Fetch task instance data (API 1).
 */
export async function fetchTaskInstanceData(token: string, taskId: string): Promise<TaskInstanceData> {
  const url = `${BASE_URL}/services/workflow/api/v1/workflow/name/fetchInstanceData/find`;
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
  const url = `${BASE_URL}/services/pro/api/name/detail-by-process-flow/find`;
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
  const url = `${BASE_URL}/services/hrm/api/name/fetch-basic-contact-info/find`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ id: username }),
  });
  if (!res.ok) throw new Error(`Failed to fetch basic contact info: ${res.statusText}`);
  return res.json();
}
