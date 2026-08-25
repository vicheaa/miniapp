import type { TaskInstanceData } from '@/types/workflow-detail';
import type { WorkflowTask, AssigneeInfo, Employee } from '@/types/workflow';

/**
 * Maps TaskInstanceData (returned by fetchTaskInstanceData) to a WorkflowTask object.
 * Useful for restoring task state when accessing or refreshing TaskDetailPage directly.
 */
export function mapTaskInstanceDataToWorkflowTask(data: TaskInstanceData): WorkflowTask {
  const task = data.task || ({} as any);
  const proc = data.processInstance || ({} as any);
  const req = data.requestor || ({} as any);

  const assigneeEmp = task.assigneeInfo?.employee || ({} as any);

  const mappedAssigneeInfo: AssigneeInfo = task.assigneeInfo
    ? {
        id: task.assigneeInfo.id || task.assignee || '',
        email: task.assigneeInfo.email || '',
        name: task.assigneeInfo.name || task.assignee || '',
        employeeList: assigneeEmp.id ? [assigneeEmp] : [],
        employee: assigneeEmp as Employee,
      }
    : {
        id: task.assignee || '',
        email: '',
        name: task.assignee || '',
        employeeList: [],
        employee: {} as Employee,
      };

  return {
    taskId: task.taskId || proc.currTaskKey || '',
    taskDefKey: task.taskDefKey || proc.currTaskKey || '',
    taskName: task.taskName || proc.currTaskName || 'Workflow Task',
    assignee: task.assignee || '',
    created: task.created || proc.startTime || '',
    ended: task.ended || proc.endTime || null,
    due: task.due || null,
    followUp: task.followUp || null,
    description: task.description || null,
    owner: task.owner || '',
    parentTaskId: task.parentTaskId || null,
    formKey: task.formKey || '',
    actions: task.actions || [],
    claimed: !!task.claimed,
    completed: !!task.completed,
    subTask: !!task.subTask,
    workflowStatus: task.workflowStatus,
    assigneeInfo: mappedAssigneeInfo,
    createSubTask: false,
    authorized: true,
    instanceInfo: {
      requestor: req.name || req.email || proc.startUser || null,
      submitter: proc.startUser || req.name || null,
      processName: proc.procName || '',
      processInstanceId: proc.procInstId || '',
      submittedDate: proc.startTime || '',
      processDefId: proc.procDefId || '',
      processDefKey: proc.procDefKey || '',
      businessKey: proc.businessKey || '',
      instanceComment: null,
      workflowAttrs: [],
    },
    priority: 50,
    subTasks: [],
    subTaskName: null,
  };
}
