import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Loader2, Trash2, Upload, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useTranslation } from '@/hooks/useTranslation';
import { useWorkflowStore } from '@/store/workflowStore';
import { useMiniAppStore } from '@/store/miniAppStore';
import { workflowRepository } from '@/repositories/workflow.repository';
import type { TaskAction, WorkflowTask } from '@/types/workflow';
import type { NCMRequestDetail, TaskInstanceData } from '@/types/workflow-detail';
import { formatDateTimeCompact } from '@/utils/format';

interface FmaNCMRequestActionsProps {
  selectedTask: WorkflowTask;
  instanceData: TaskInstanceData | null;
  detail: NCMRequestDetail | null;
  isClaiming: boolean;
  handleClaimToggle: () => Promise<void>;
  onActionSuccess: () => void;
}

export default function FmaNCMRequestActions({
  selectedTask,
  instanceData,
  isClaiming,
  handleClaimToggle,
  onActionSuccess,
}: FmaNCMRequestActionsProps) {
  const { t } = useTranslation();
  const myRequest = useWorkflowStore((s) => s.myRequest);
  const superApp = useMiniAppStore((s) => s.superApp);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentAction, setCurrentAction] = useState<TaskAction | null>(null);
  const [isActivitiesExpanded, setIsActivitiesExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport || !currentAction) return;
    const updateHeight = () => setViewportHeight(viewport.height);
    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    viewport.addEventListener('scroll', updateHeight);
    return () => {
      viewport.removeEventListener('resize', updateHeight);
      viewport.removeEventListener('scroll', updateHeight);
    };
  }, [currentAction]);

  const resetForm = () => {
    setComment('');
    setFiles([]);
    setSubmitError('');
  };

  const openAction = (action: TaskAction) => {
    resetForm();
    setIsActivitiesExpanded(false);
    setCurrentAction(action);
  };

  const closeAction = () => {
    if (submittingRef.current) return;
    setCurrentAction(null);
    resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentAction || submittingRef.current || !selectedTask.claimed || isClaiming) return;
    if (!comment.trim()) {
      setSubmitError('Please provide a comment.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const uploadedFiles = files.length ? await workflowRepository.uploadFiles(files) : [];
      await workflowRepository.completeTask({
        action: currentAction.value,
        payloadType: 'ncm_stock_request_function_approval',
        taskId: selectedTask.taskId,
        payloadData: {},
        comment,
        uploadedFiles: uploadedFiles.map((file) => file.fileId),
        fetchCurrentTask: false,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit NCM action. Please try again.');
      return;
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }

    closeAction();
    superApp?.showToast(`${currentAction.name} submitted successfully`);
    onActionSuccess();
    void queryClient.invalidateQueries({ queryKey: ['workflowTasks'] });
    navigate('/');
  };

  if (myRequest) return null;

  return (
    <>
      <div className="shrink-0 bg-white p-3 flex flex-col gap-3 z-50 shadow-md">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isClaiming}
            onClick={handleClaimToggle}
            className="flex-1 py-2.5 px-2 rounded-md border border-gray-200 text-gray-700 text-[12px] font-bold cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed truncate"
          >
            {selectedTask.claimed ? t('workflow.unclaim') : t('workflow.claim')}
          </button>
          {selectedTask.claimed && selectedTask.actions.map((action) => (
            <button
              key={action.value || action.name}
              type="button"
              disabled={isClaiming}
              onClick={() => openAction(action)}
              className={action.name.toLowerCase() === 'reject'
                ? 'flex-1 py-2.5 px-2 rounded-md border border-red-500 bg-white text-red-500 text-[12px] font-bold cursor-pointer text-center truncate disabled:opacity-50'
                : 'flex-1 py-2.5 px-2 rounded-md bg-[#063E89] text-white text-[12px] font-bold cursor-pointer text-center truncate disabled:opacity-50'}
            >
              {action.name}
            </button>
          ))}
        </div>
      </div>

      <Drawer open={!!currentAction} dismissible={!isSubmitting} onOpenChange={(open) => { if (!open) closeAction(); }}>
        <DrawerContent
          className="max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          style={viewportHeight ? { maxHeight: `${viewportHeight * 0.92}px` } : undefined}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <DrawerTitle className="text-[16px] font-bold">
              {selectedTask.taskName || currentAction?.name || 'Approval'}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              {currentAction?.name} this NCM request with a comment and optional attachments.
            </DrawerDescription>
            <button
              type="button"
              aria-label="Close action"
              disabled={isSubmitting}
              onClick={closeAction}
              className="w-8 h-8 flex items-center justify-center active:bg-gray-50 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="border border-gray-100 rounded-lg bg-white overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isActivitiesExpanded}
                  aria-controls="ncm-action-activities"
                  onClick={() => setIsActivitiesExpanded((expanded) => !expanded)}
                  className="w-full flex items-center justify-between p-3.5 bg-[rgba(249,250,251,0.5)] hover:bg-gray-50 transition-colors border-b border-gray-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isActivitiesExpanded ? '' : '-rotate-90'}`} />
                    <span className="text-[13px] font-semibold text-gray-700">Activities</span>
                  </span>
                </button>
                {isActivitiesExpanded && (
                  <div id="ncm-action-activities" className="p-5 space-y-0 bg-white">
                    {instanceData?.activities?.length ? instanceData.activities.map((activity, index) => (
                      <div key={activity.id || index} className="relative pl-6 pb-6 last:pb-1">
                        {index !== instanceData.activities.length - 1 && (
                          <div className="absolute left-[5px] top-3.5 bottom-0 w-[1px] bg-gray-200" />
                        )}
                        <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-[#1b2e4b] ring-4 ring-gray-100" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[13px] font-bold text-gray-800">{activity.taskName}</span>
                            <span className="text-[11.5px] text-gray-500">{formatDateTimeCompact(activity.actionDate)}</span>
                          </div>
                          <span className="text-[12.5px] text-gray-500 mt-1 block">
                            {activity.action} by <span className="font-semibold text-gray-700">{activity.actionBy}</span>
                          </span>
                          {activity.comment && (
                            <div className="text-[12.5px] text-gray-600 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{activity.comment}</div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-4 text-gray-400 text-[12px]">No activities recorded.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="ncm-action-comment" className="text-[13px] font-bold text-gray-800 flex items-center gap-0.5">
                  <span className="text-red-500" aria-hidden="true">*</span> Comment
                </label>
                <textarea
                  id="ncm-action-comment"
                  required
                  disabled={isSubmitting}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Please provide a clear justification for your decision. Include assessment of business need, impact, priority, and conditions for approval."
                  className="w-full min-h-[100px] border border-gray-200 rounded-lg p-3 text-[13px] leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-gray-800">Attachments</span>
                  <span className="text-[11px] text-gray-400 font-medium">{files.length} file(s) chosen</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border border-gray-200 text-gray-700 text-[12px] font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer select-none">
                    <Upload className="w-4 h-4 text-gray-500" /> Add Files
                    <input
                      type="file"
                      multiple
                      disabled={isSubmitting}
                      className="sr-only"
                      onChange={(event) => {
                        const chosenFiles = Array.from(event.target.files || []);
                        setFiles((previous) => [...previous, ...chosenFiles]);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50 text-[12px] text-gray-600 min-w-0">
                        <span className="truncate font-medium pr-4">{file.name}</span>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}
                          className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {submitError && <p role="alert" className="text-[13px] text-red-600">{submitError}</p>}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" disabled={isSubmitting} onClick={closeAction} className="flex-1 px-2 py-2.5 rounded-md border border-gray-200 bg-white text-gray-700 text-[12.5px] font-bold active:bg-gray-100 cursor-pointer text-center disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={isSubmitting} onClick={resetForm} className="flex-1 px-2 py-2.5 rounded-md border border-red-500 bg-white text-red-500 text-[12.5px] font-bold active:bg-gray-100 cursor-pointer text-center disabled:opacity-50">
                Reset
              </button>
              <button type="submit" disabled={isSubmitting} className="flex-[1.5] px-2 py-2.5 rounded-md bg-[#063E89] text-white text-[12.5px] font-bold shadow-sm active:scale-[0.98] cursor-pointer text-center flex items-center justify-center gap-1 disabled:opacity-50">
                {isSubmitting ? <><Loader2 className="animate-spin h-3.5 w-3.5" /> Submitting</> : 'Submit'}
              </button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
