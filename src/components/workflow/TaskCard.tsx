import { WorkflowTask } from "@/types/workflow";
import { Ellipsis, CheckCircle2, Clock } from "lucide-react";
import { formatDateCompact } from "@/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";

function getTaskDetailRows(task: WorkflowTask, t: (k: string) => string): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  rows.push({
    label: t('workflow.requestor'),
    value: task.owner || '—',
  });

  rows.push({
    label: t('workflow.task_name'),
    value: task.taskName,
  });

  rows.push({
    label: t('workflow.assignee'),
    value: task.assigneeInfo?.name || task.assignee || '—',
  });

  rows.push({
    label: t('workflow.created_at'),
    value: formatDateCompact(task.created),
  });

  rows.push({
    label: t('workflow.status'),
    value: task.workflowStatus ?? '',
  })

  return rows;
}

export default function TaskCard({
  task,
  onClick,
  onEllipsisClick,
  t,
}: {
  task: WorkflowTask;
  onClick: () => void;
  onEllipsisClick: () => void;
  t: (k: string) => string;
}) {
  const rows = getTaskDetailRows(task, t);

  return (
    <div
      className="bg-white rounded-[14px] px-[18px] py-4 cursor-pointer hover:shadow-sm transition-all border border-gray-100/80"
      onClick={onClick}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className="pt-0.5 shrink-0">
            {task.completed ? (
              <span title="Completed" className="inline-flex">
                <CheckCircle2 size={18} className="text-emerald-500" />
              </span>
            ) : (
              <span title="Pending" className="inline-flex">
                <Clock size={18} className="text-amber-500" />
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-gray-900 text-[14px] truncate leading-tight">
              {task.instanceInfo.businessKey}
            </span>
            <span className="text-[12.5px] font-medium text-gray-500 truncate mt-0.5">
              {task.instanceInfo.processName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {/* {task.workflowStatus && <StatusBadge status={task.workflowStatus} />} */}
          {/* {task.taskAction && <StatusBadge status={task.taskAction?? 'Pending'} />} */}
          <StatusBadge status={task.taskAction?? 'Pending'} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEllipsisClick();
            }}
            className="flex items-center justify-center p-1.5 -mr-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <Ellipsis size={18} className="shrink-0" />
          </button>
        </div>
      </div>

      {/* Details List */}
      <div className="flex flex-col gap-[7px]">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] text-gray-400 font-medium shrink-0">{row.label}</span>
            <span className="text-[13px] font-medium text-gray-800 text-right truncate">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}