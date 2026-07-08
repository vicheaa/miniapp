import { ProcessFlowDetail, BudgetCode } from '@/types/workflow-detail';

export interface CompleteTaskPayload {
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
}

export interface IWorkflowRepository {
  fetchBudgetCodes(deptId: number, buId: number): Promise<BudgetCode[]>;
  fetchProcessFlowDetail(processInstanceId: string): Promise<ProcessFlowDetail>;
  uploadFiles(files: File[]): Promise<{ fileId: string; publicUrl: string }[]>;
  completeTask(payload: CompleteTaskPayload): Promise<any>;
}
