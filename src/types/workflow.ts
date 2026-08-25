/**
 * Domain models for the Workflow Task module.
 */

/** Action button available on a task. */
export interface TaskAction {
  name: string;
  value: string;
}

/** Employee record nested inside assignee info. */
export interface Employee {
  id: number;
  buId: number;
  buName: string;
  empNo: string;
  firstName: string;
  lastName: string;
  internalName: string;
  department: string;
  subDepartment: string | null;
  hod: string | null;
  jobTitle: string;
  reportTo: string;
}

/** Assignee info for a task. */
export interface AssigneeInfo {
  id: string;
  email: string;
  name: string;
  employeeList: Employee[];
  employee: Employee;
}

/** Workflow attribute in the instance info. */
export interface WorkflowAttr {
  id: number;
  recordId: number;
  name: string;
  intValue: number | null;
  decimalValue: number | null;
  stringValue: string | null;
}

/** Process instance info for a task. */
export interface InstanceInfo {
  requestor: string | null;
  submitter: string | null;
  processName: string;
  processInstanceId: string;
  submittedDate: string;
  processDefId: string;
  processDefKey: string;
  businessKey: string;
  instanceComment: string | null;
  workflowAttrs: WorkflowAttr[];
}

/** Workflow status object structure. */
export interface WorkflowStatusInfo {
  code?: string;
  name?: string;
  label?: string;
  color?: string;
  bgColor?: string;
  textColor?: string;
  [key: string]: any;
}

/** A single workflow task item. */
export interface WorkflowTask {
  taskId: string;
  taskDefKey: string;
  taskName: string;
  assignee: string;
  created: string;
  ended: string | null;
  due: string | null;
  followUp: string | null;
  description: string | null;
  owner: string;
  parentTaskId: string | null;
  formKey: string;
  actions: TaskAction[];
  claimed: boolean;
  completed: boolean;
  subTask: boolean;
  assigneeInfo: AssigneeInfo;
  createSubTask: boolean;
  authorized: boolean;
  instanceInfo: InstanceInfo;
  priority: number;
  subTasks: any[];
  subTaskName: string | null;
  workflowStatus?: string;
  taskAction?: string;
}

/** Paginated response from the task list API. */
export interface WorkflowTaskPage {
  items: WorkflowTask[];
  page: number;
  pageSize: number;
  total: number;
}
