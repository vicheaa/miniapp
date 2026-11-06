import React from 'react';
import PurchaseRequisitionForm from './purchase-requisition';
import PurchaseRequisitionActions from './purchase-requisition/Actions';
import FmaNewStaffRequestForm from './fma-new-staff-request';
import FmaNewStaffRequestActions from './fma-new-staff-request/Actions';
import ItRequestForm from './it-request';
import ItRequestActions from './it-request/Actions';
import FmaNCMRequestForm from './fma-ncm-request';
import FmaNCMRequestActions from './fma-ncm-request/Actions';
import {
  fetchProcessFlowDetail,
  fetchFmaNewStaffRequestDetail,
  fetchFmaNCMDetail,
} from '@/services/api/workflow-api';

export interface TaskTypeConfig {
  Form: React.ComponentType<{
    selectedTask: any;
    instanceData: any;
    detail: any;
  }>;
  Actions: React.ComponentType<{
    selectedTask: any;
    instanceData: any;
    detail: any;
    isClaiming: boolean;
    handleClaimToggle: () => Promise<void>;
    onActionSuccess: () => void;
  }>;
  fetchDetail?: (processInstanceId: string) => Promise<any>;
}

export const taskRegistry: Record<string, TaskTypeConfig> = {
  PR: {
    Form: PurchaseRequisitionForm,
    Actions: PurchaseRequisitionActions,
    fetchDetail: fetchProcessFlowDetail,
  },
  FNS: {
    Form: FmaNewStaffRequestForm,
    Actions: FmaNewStaffRequestActions,
    fetchDetail: fetchFmaNewStaffRequestDetail,
  },
  NCM: {
    Form: FmaNCMRequestForm,
    Actions: FmaNCMRequestActions,
    fetchDetail: fetchFmaNCMDetail,
  },
  IT: {
    Form: ItRequestForm,
    Actions: ItRequestActions,
    fetchDetail: fetchProcessFlowDetail,
  },
};
