import { Ban, SendHorizontal } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useMiniAppStore } from '@/store/miniAppStore';
import { useWorkflowStore } from '@/store/workflowStore';

interface ItRequestActionsProps {
  selectedTask: any;
  instanceData: any;
  detail: any;
  isClaiming: boolean;
  handleClaimToggle: () => Promise<void>;
  onActionSuccess: () => void;
}

export default function ItRequestActions({
  selectedTask,
  isClaiming,
  handleClaimToggle,
}: ItRequestActionsProps) {
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
      <div className="flex flex-wrap gap-2">
        <button
          disabled={isClaiming}
          onClick={handleClaimToggle}
          className="flex-1 min-w-[80px] py-2 px-3 rounded-md border border-gray-200 text-gray-700 text-[13px] font-bold cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                    ? 'flex-1 min-w-[100px] py-2 px-3 rounded-md border border-red-500 bg-white text-red-500 text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1.5 text-center'
                    : 'flex-1 min-w-[100px] py-2 px-3 rounded-md bg-[#063E89] text-white text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1.5 text-center'
                }
              >
                {isReject ? <Ban size={14} /> : <SendHorizontal size={14} />}
                <span>{act.name}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
