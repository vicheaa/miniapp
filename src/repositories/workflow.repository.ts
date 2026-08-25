import {
  fetchBudgetCodesByDept,
  fetchProcessFlowDetail,
  uploadFiles,
  completeTask,
  fetchAvailableUsers,
} from '@/services/api/workflow-api';
import { IWorkflowRepository } from './workflow-repository.interface';

export const workflowRepository: IWorkflowRepository = {
  fetchBudgetCodes: fetchBudgetCodesByDept,
  fetchProcessFlowDetail,
  uploadFiles,
  completeTask,
  fetchAvailableUsers,
};
