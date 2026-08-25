import { ProcessFlowDetail, BudgetCode } from '@/types/workflow-detail';
import { AvailableUser } from '@/services/api/workflow-api';

export type { AvailableUser };

export interface CompleteTaskPayload {
  action: string;
  payloadType: string;
  taskId: string;
  payloadData: Record<string, any>;
  comment: string;
  uploadedFiles: string[];
  fetchCurrentTask?: boolean;
}

export interface IWorkflowRepository {
  fetchBudgetCodes(deptId: number, buId: number): Promise<BudgetCode[]>;
  fetchProcessFlowDetail(processInstanceId: string): Promise<ProcessFlowDetail>;
  uploadFiles(files: File[]): Promise<{ fileId: string; publicUrl: string }[]>;
  completeTask(payload: CompleteTaskPayload): Promise<any>;
  fetchAvailableUsers(procInstId: string): Promise<AvailableUser[]>;
}
