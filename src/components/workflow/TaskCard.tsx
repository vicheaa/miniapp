import { WorkflowTask } from "@/types/workflow";
import { Ellipsis } from "lucide-react";
import { formatDateCompact, formatCurrency } from "@/utils/format";

/**
 * Build dynamic detail rows based on the businessKey prefix / process type.
 * Returns an array of { label, value } pairs to render in the card.
 */
function getTaskDetailRows(task: WorkflowTask, t: (k: string) => string): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const key = task.instanceInfo.businessKey || '';
  const prefix = key.split('-')[0]?.toUpperCase();

  // --- Dynamic rows based on process / businessKey prefix ---

  // Purchase Requisition → show Total Amount from workflowAttrs
  if (prefix === 'PR') {
    const amountAttr = task.instanceInfo.workflowAttrs?.find((a) => a.name === 'amount');
    if (amountAttr?.decimalValue != null) {
      rows.push({
        label: t('workflow.total_amount'),
        value: `$${formatCurrency(amountAttr.decimalValue)}`,
      });
    }
  }

  // Always show Requestor
  rows.push({
    label: t('workflow.requestor'),
    value: task.owner || '—',
  });

  // Always show Task Name
  rows.push({
    label: t('workflow.task_name'),
    value: task.taskName,
  });

  // Always show Assignee
  rows.push({
    label: t('workflow.assignee'),
    value: task.assigneeInfo?.name || task.assignee || '—',
  });

  // Always show Created At
  rows.push({
    label: t('workflow.created_at'),
    value: formatDateCompact(task.created),
  });

  return rows;
}

/* ── Task Card ─────────────────────────────────────────────────────────── */

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
      className="bg-white rounded-[14px] px-[18px] py-4 cursor-pointer"
      onClick={onClick}
    >
      {/* Title: BusinessKey · Process Name */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="font-bold text-slate-900 shrink-0">
          {task.instanceInfo.businessKey}
        </span>
        <span className="font-medium">·</span>
        <span className="font-semibold truncate">
          {task.instanceInfo.processName}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEllipsisClick();
          }}
          className="ml-auto self-center flex items-center justify-center p-1.5 -m-1.5 rounded-full hover:text-slate-600 hover:bg-slate-100/50 active:bg-slate-100 transition-colors"
        >
          <Ellipsis size={18} className="shrink-0" />
        </button>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col gap-[7px]">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] text-gray-400 font-medium shrink-0">{row.label}</span>
            <span className="text-[13px] font-medium text-right truncate">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}