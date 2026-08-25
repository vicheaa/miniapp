import { useTranslation } from '@/hooks/useTranslation';
import { useMiniAppStore } from '@/store/miniAppStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { FnsRequestDetail } from '@/types/workflow-detail';

interface FmaNewStaffRequestActionsProps {
  selectedTask: any;
  instanceData: any;
  detail: FnsRequestDetail;
  isClaiming: boolean;
  handleClaimToggle: () => Promise<void>;
  onActionSuccess: () => void;
}

export default function FmaNewStaffRequestActions({
  selectedTask,
  isClaiming,
  handleClaimToggle,
}: FmaNewStaffRequestActionsProps) {
  const { t } = useTranslation();
  const superApp = useMiniAppStore((s) => s.superApp);
  const myRequest = useWorkflowStore((s) => s.myRequest);

  if (myRequest) return null;

  const handleAction = (actionName: string) => {
    if (superApp) {
      superApp.showToast(`Action executed: ${actionName}`);
    } else {
      alert(`[Dev Mode] Action: ${actionName}`);
    }
  };

  const actions = selectedTask?.actions || [];

  return (
    <div className="shrink-0 bg-white p-3 flex flex-col gap-3 z-50 shadow-md">
      <div className="flex gap-2">
        <button
          disabled={isClaiming}
          onClick={handleClaimToggle}
          className="flex-1 py-2 px-2 rounded-md border border-gray-200 text-gray-700 text-[12px] font-bold cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed truncate"
        >
          {selectedTask.claimed ? t('workflow.unclaim') : t('workflow.claim')}
        </button>

        {selectedTask.claimed &&
          actions.map((act: { name: string; value: string }, idx: number) => {
            const isReject = act.name.toLowerCase() === 'reject';
            return (
              <button
                key={idx}
                onClick={() => handleAction(act.name)}
                className={
                  isReject
                    ? 'flex-1 py-2 px-2 rounded-md border border-red-500 bg-white text-red-500 text-[12px] font-bold cursor-pointer text-center truncate'
                    : 'flex-1 py-2 px-2 rounded-md bg-[#063E89] text-white text-[12px] font-bold cursor-pointer text-center truncate'
                }
              >
                {act.name}
              </button>
            );
          })}
      </div>
    </div>
  );
}
