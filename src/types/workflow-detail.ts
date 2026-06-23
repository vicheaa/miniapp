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

export interface FileMetadata {
  id: string;
  title: string | null;
  description: string | null;
  fileName: string;
  fileType: string;
  uri: string;
  createdDate: string;
  createdBy: string;
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

export interface BudgetCode {
  id: number;
  code: string;
  name: string;
  active: string;
  deptId: number;
  buId: number | null;
}

export interface FnsRequestItem {
  id: number;
  itemId: number;
  itemName: string;
  itemType: string | null;
  qty: number;
  checked: boolean;
  category: string;
  remarks: string | null;
}

export interface FnsRequestDetail {
  id: number;
  processInstId: string;
  formNo: string;
  requestedDate: string;
  requestedBy: string;
  requesterBuId: number;
  status: string;
  empNo: string;
  empName: string;
  gender: string;
  empLocalName: string;
  jobTitle: string;
  bu: string;
  department: string;
  workplace: string;
  startingDate: string;
  items: FnsRequestItem[];
  phoneNo: string | null;
  email: string | null;
  carModal: string | null;
  carColor: string | null;
  year: string | null;
  plateNumber: string | null;
}