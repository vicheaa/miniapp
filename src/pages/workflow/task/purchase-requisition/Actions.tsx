import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useMiniAppStore } from '@/store/miniAppStore';
import { useBudgetReviewStore } from '@/store/budgetReviewStore';
import { formatCurrency, formatDateTimeCompact } from '@/utils/format';
import {
  fetchBudgetCodesByDept,
  completeTask,
  uploadFiles,
  fetchProcessFlowDetail,
} from '@/services/api/workflow-api';
import { ProcessFlowDetail } from '@/types/workflow-detail';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';

interface PurchaseRequisitionActionsProps {
  selectedTask: any;
  instanceData: any;
  detail: ProcessFlowDetail;
  isClaiming: boolean;
  handleClaimToggle: () => Promise<void>;
  onActionSuccess: () => void;
}

export default function PurchaseRequisitionActions({
  selectedTask,
  instanceData,
  detail,
  isClaiming,
  handleClaimToggle,
  onActionSuccess,
}: PurchaseRequisitionActionsProps) {
  const { t } = useTranslation();
  const superApp = useMiniAppStore((s) => s.superApp);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isActivitiesExpanded, setIsActivitiesExpanded] = useState(false);
  const [currentAction, setCurrentAction] = useState('Completed');

  // Budget Review Modal States from Zustand Store
  const {
    isBudgetReviewOpen,
    isApprovalOpen,
    budgetCodes,
    loadingBudgetCodes,
    reviewItems,
    reviewComment,
    reviewFiles,
    isSubmittingReview,
    setBudgetReviewOpen,
    setApprovalOpen,
    setBudgetCodes,
    setLoadingBudgetCodes,
    setReviewItems,
    updateReviewItemBudgetCode,
    setReviewComment,
    addReviewFiles,
    removeReviewFile,
    setSubmittingReview,
    resetReviewStore,
  } = useBudgetReviewStore();

  // Disable pull-to-refresh in the superApp when any drawer is open
  useEffect(() => {
    const isAnyDrawerOpen = isApprovalOpen || isBudgetReviewOpen;
    if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
      (superApp as any).setPullToRefreshEnabled(!isAnyDrawerOpen);
    }
    return () => {
      if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
        (superApp as any).setPullToRefreshEnabled(true);
      }
    };
  }, [isApprovalOpen, isBudgetReviewOpen, superApp]);

  // Reset window scroll when drawers are open to prevent keyboard from panning/scrolling the layout viewport
  useEffect(() => {
    const isAnyDrawerOpen = isApprovalOpen || isBudgetReviewOpen;
    if (!isAnyDrawerOpen) return;

    const handleScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.scrollTo(0, 0);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isApprovalOpen, isBudgetReviewOpen]);

  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      setVisualViewportHeight(window.visualViewport ? window.visualViewport.height : null);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT')
      ) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      }
    };
    window.addEventListener('focusin', handleFocusIn);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      addReviewFiles(filesArray);
    }
  };

  const handleRemoveFile = (index: number) => {
    removeReviewFile(index);
  };

  const handleCloseReview = () => {
    resetReviewStore();
  };

  const handleResetReview = () => {
    if (detail) {
      resetReviewStore();
      setReviewItems(
        (detail.items || []).map((item) => ({
          ...item,
          budgetCode: item.budgetCode || '',
        }))
      );
      setBudgetReviewOpen(true);
      // Re-trigger budget codes load
      loadBudgetCodesForReview(detail);
    }
  };

  const handleResetApproval = () => {
    if (detail) {
      resetReviewStore();
      setReviewItems(
        (detail.items || []).map((item) => ({
          ...item,
          budgetCode: item.budgetCode || '',
        }))
      );
      setApprovalOpen(true);
      // Re-trigger budget codes load
      loadBudgetCodesForReview(detail);
    }
  };

  const loadBudgetCodesForReview = async (currentDetail: ProcessFlowDetail) => {
    if (currentDetail?.deptId != null && currentDetail?.buId != null) {
      setLoadingBudgetCodes(true);
      try {
        const codes = await fetchBudgetCodesByDept(
          currentDetail.deptId,
          currentDetail.buId
        );
        setBudgetCodes(codes || []);
      } catch (err: any) {
        console.error('Failed to load budget codes:', err);
      } finally {
        setLoadingBudgetCodes(false);
      }
    }
  };

  const openApprovalReview = (actionName: string) => {
    resetReviewStore();
    const act = selectedTask.actions?.find((a: any) => a.name === actionName);
    setCurrentAction(act?.value || actionName);
    setApprovalOpen(true);
  };

  const openBudgetReview = async () => {
    if (!selectedTask) return;

    resetReviewStore();
    setCurrentAction('Completed');
    setBudgetReviewOpen(true);
    setLoadingBudgetCodes(true);

    let currentDetail = detail;
    try {
      if (!currentDetail) {
        currentDetail = await fetchProcessFlowDetail(
          selectedTask.instanceInfo.processInstanceId
        );
      }

      setReviewItems(
        (currentDetail?.items || []).map((item) => ({
          ...item,
          budgetCode: item.budgetCode || '',
        }))
      );

      await loadBudgetCodesForReview(currentDetail);
    } catch (err: any) {
      console.error('Failed to initialize budget review:', err);
      if (superApp) {
        superApp.showToast(
          `Failed to initialize budget review: ${err.message || err}`
        );
      }
      setLoadingBudgetCodes(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedTask || !detail) return;

    if (detail.budgetCodeRequired) {
      const missingBudget = reviewItems.some((item) => !item.budgetCode);
      if (missingBudget) {
        if (superApp) {
          superApp.showToast('Please select a budget code for all items.');
        } else {
          alert('Please select a budget code for all items.');
        }
        return;
      }
    }

    setSubmittingReview(true);
    try {
      let fileIds: string[] = [];
      if (reviewFiles.length > 0) {
        const uploadRes = await uploadFiles(reviewFiles);
        fileIds = uploadRes.map((f) => f.fileId);
      }

      const payload = {
        action: 'Completed',
        payloadType: 'requisition_fin',
        taskId: selectedTask.taskId,
        payloadData: {
          id: detail.id,
          items: reviewItems.map((item) => ({
            id: item.id,
            key: item.key || String(item.id),
            seqNo: item.seqNo,
            itemId: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            description: item.description || '',
            qty: item.qty,
            unitPrice: item.unitPrice,
            uom: item.uom,
            amount: item.amount,
            budgetCode: item.budgetCode,
            remarks: item.remarks || '',
          })),
          services: detail.services || [],
        },
        comment: reviewComment,
        uploadedFiles: fileIds,
        fetchCurrentTask: false,
      };

      await completeTask(payload);

      if (superApp) {
        superApp.showToast('Budget review submitted successfully');
      } else {
        alert('Budget review submitted successfully');
      }

      resetReviewStore();
      onActionSuccess();
      queryClient.invalidateQueries({ queryKey: ['workflowTasks'] });
      navigate('/');
    } catch (err: any) {
      console.error('Failed to submit budget review:', err);
      if (superApp) {
        superApp.showToast(
          `Failed to submit budget review: ${err.message || err}`
        );
      } else {
        alert(`Failed to submit budget review: ${err.message || err}`);
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!selectedTask || !detail) return;

    if (!reviewComment.trim()) {
      if (superApp) {
        superApp.showToast('Please provide a comment.');
      } else {
        alert('Please provide a comment.');
      }
      return;
    }

    setSubmittingReview(true);
    try {
      let fileIds: string[] = [];
      if (reviewFiles.length > 0) {
        const uploadRes = await uploadFiles(reviewFiles);
        fileIds = uploadRes.map((f) => f.fileId);
      }

      const payload = {
        action: currentAction,
        payloadType: 'requisition_fin',
        taskId: selectedTask.taskId,
        payloadData: {
          id: detail.id,
          items: detail.items?.map((item) => ({
            id: item.id,
            key: String(item.id),
            seqNo: item.seqNo,
            itemId: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            description: item.description || '',
            qty: item.qty,
            unitPrice: item.unitPrice,
            uom: item.uom,
            amount: item.amount,
            budgetCode: item.budgetCode,
            remarks: item.remarks || '',
          })) || [],
          services: detail.services || [],
        },
        comment: reviewComment,
        uploadedFiles: fileIds,
        fetchCurrentTask: false,
      };

      await completeTask(payload);

      if (superApp) {
        superApp.showToast('Approval submitted successfully');
      } else {
        alert('Approval submitted successfully');
      }

      resetReviewStore();
      onActionSuccess();
      queryClient.invalidateQueries({ queryKey: ['workflowTasks'] });
      navigate('/');
    } catch (err: any) {
      console.error('Failed to submit approval:', err);
      if (superApp) {
        superApp.showToast(
          `Failed to submit approval: ${err.message || err}`
        );
      } else {
        alert(`Failed to submit approval: ${err.message || err}`);
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAction = (actionName: string) => {
    if (actionName === 'Complete') {
      openBudgetReview();
      return;
    }

    if (actionName === 'Approve') {
      openApprovalReview(actionName);
      return;
    }

    if (superApp) {
      superApp.showToast(`Action executed: ${actionName}`);
    } else {
      alert(`[Dev Mode] Action: ${actionName}`);
    }
  };

  const actions =
    selectedTask.actions && selectedTask.actions.length > 0
      ? selectedTask.actions
      : [{ name: 'Complete', value: 'Completed' }];

  return (
    <>
      <div className="shrink-0 bg-white p-3 flex flex-col gap-3 z-50 shadow-md">
        {/* Total Requisition Amount Banner */}
        {detail?.totalAmount != null && (
          <div className="px-1 flex items-center justify-between">
            <span className="text-[14px] font-semibold">
              {t('workflow.total_requisition_amount')}
            </span>
            <span className="text-[18px] font-bold text-[#063E89]">
              ${formatCurrency(detail.totalAmount)}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            disabled={isClaiming}
            onClick={handleClaimToggle}
            className="flex-1 py-2 px-2 rounded-sm border border-slate-200 text-slate-700 text-[12px] font-semibold cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed truncate"
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
                      ? 'flex-1 py-2 px-2 rounded-sm border border-red-500 bg-white text-red-500 text-[12px] font-semibold cursor-pointer text-center truncate'
                      : 'flex-1 py-2 px-2 rounded-sm bg-[#063E89] text-white text-[12px] font-semibold cursor-pointer text-center truncate'
                  }
                >
                  {act.name}
                </button>
              );
            })}
        </div>
      </div>

      {/* ── Approval Modal ──────────────────────────────────────────────── */}
      <Drawer open={isApprovalOpen} onOpenChange={setApprovalOpen}>
        <DrawerContent
          className="max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          style={visualViewportHeight ? { maxHeight: `${visualViewportHeight * 0.92}px` } : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <DrawerTitle className="text-[16px] font-bold text-slate-800">
              {selectedTask?.taskName || 'Fin Manager Approval'}
            </DrawerTitle>
            <button
              onClick={() => setApprovalOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-650 active:bg-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Activities Collapsible Card */}
            <div className="border border-slate-100 rounded-lg bg-white overflow-hidden">
              {/* Header Toggle */}
              <button
                onClick={() => setIsActivitiesExpanded(!isActivitiesExpanded)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${
                      isActivitiesExpanded ? '' : '-rotate-90'
                    }`}
                  />
                  <span className="text-[13px] font-semibold text-slate-700">
                    Workflow Timeline
                  </span>
                </div>
              </button>

              {/* List of activities */}
              {isActivitiesExpanded && (
                <div className="p-5 space-y-0 bg-white">
                  {instanceData?.activities &&
                  instanceData.activities.length > 0 ? (
                    instanceData.activities.map((activity: any, idx: number) => (
                      <div
                        key={activity.id || idx}
                        className="relative pl-6 pb-6 last:pb-1"
                      >
                        {/* Vertical line segment */}
                        {idx !== instanceData.activities.length - 1 && (
                          <div className="absolute left-[5px] top-3.5 bottom-0 w-[1px] bg-slate-200" />
                        )}
                        {/* Bullet */}
                        <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-[#1b2e4b] ring-4 ring-slate-100" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-bold text-slate-800">
                              {activity.taskName}
                            </span>
                            <span className="text-[11.5px] text-slate-500 shrink-0">
                              {formatDateTimeCompact(activity.actionDate)}
                            </span>
                          </div>
                          <span className="text-[12.5px] text-slate-500 mt-1 block">
                            {activity.action} by{' '}
                            <span className="font-semibold text-slate-700">
                              {activity.actionBy}
                            </span>
                          </span>
                          {activity.comment && (
                            <div className="text-[12.5px] text-slate-650 mt-1.5 leading-relaxed whitespace-pre-wrap">
                              {activity.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-[12px]">
                      No activities recorded.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comment input box */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-slate-800 flex items-center gap-0.5">
                <span className="text-red-500">*</span> Comment
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Please provide a clear justification for your decision. Include assessment of business need, impact, priority, and conditions for approval."
                className="w-full min-h-[100px] border border-slate-200 rounded-lg p-3 text-[13px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Files Attachment Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-800">
                  Attachments
                </span>
                <span className="text-[11px] text-slate-450 font-medium">
                  {reviewFiles.length} file(s) chosen
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-slate-700 text-[12px] font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer select-none">
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Add Files
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {reviewFiles.length > 0 && (
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {reviewFiles.map((file, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50 text-[12px] text-slate-650"
                    >
                      <span className="truncate font-medium pr-4">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(fIdx)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={() => setApprovalOpen(false)}
              className="flex-1 p-2 rounded-md border border-slate-200 bg-white text-slate-700 text-[12.5px] font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleResetApproval}
              className="flex-1 p-2 rounded-md border border-red-500 bg-white text-red-500 text-[12.5px] font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleSubmitApproval}
              className="flex-[1.5] p-2 rounded-md bg-[#063E89] text-white text-[12.5px] font-bold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 text-center"
            >
              {isSubmittingReview ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth={3}
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Submitting
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Budget Review Modal ─────────────────────────────────────────── */}
      <Drawer open={isBudgetReviewOpen} onOpenChange={setBudgetReviewOpen}>
        <DrawerContent
          className="max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          style={visualViewportHeight ? { maxHeight: `${visualViewportHeight * 0.92}px` } : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <DrawerTitle className="text-[16px] font-bold text-slate-800">
              Budget Review
            </DrawerTitle>
            <button
              onClick={handleCloseReview}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-650 active:bg-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loadingBudgetCodes ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                <svg
                  className="animate-spin h-6 w-6 text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-[12px] font-medium">
                  Loading budget codes...
                </span>
              </div>
            ) : (
              <>
                {/* Item card list for mobile */}
                <div className="flex flex-col gap-3">
                  {reviewItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex flex-col gap-2.5"
                    >
                      {/* Header: No, Name & Price */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="inline-flex items-center justify-center bg-slate-200 text-slate-700 font-bold text-[10px] w-5 h-5 rounded-full mr-2">
                            {idx + 1}
                          </span>
                          <span className="text-[13px] font-bold text-slate-800">
                            {item.itemName}
                          </span>
                          <span className="text-[10px] text-slate-450 font-semibold block mt-0.5 ml-7">
                            {item.itemCode}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[13px] font-extrabold text-slate-900 block">
                            ${formatCurrency(item.amount)}
                          </span>
                          <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
                            {item.qty} {item.uom} x $
                            {formatCurrency(item.unitPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Description & Remarks */}
                      {item.description && (
                        <div className="text-[12px] text-slate-650 ml-7">
                          <span className="font-semibold text-slate-400">
                            Description:{' '}
                          </span>
                          {item.description}
                        </div>
                      )}
                      {item.remarks && (
                        <div className="text-[12px] text-slate-650 ml-7">
                          <span className="font-semibold text-slate-400">
                            Remarks:{' '}
                          </span>
                          {item.remarks}
                        </div>
                      )}

                      {/* Budget Code Selector */}
                      <div className="flex flex-col gap-1 mt-1 ml-7">
                        <label className="text-[11px] font-bold text-slate-400 uppercase">
                          Budget Code
                        </label>
                        <select
                          value={item.budgetCode || ''}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            updateReviewItemBudgetCode(idx, newVal);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-[12.5px] font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Select budget code</option>
                          {budgetCodes.map((code) => (
                            <option key={code.id} value={code.code}>
                              {code.code} ({code.name})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comment Section */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-slate-800">
                    Comment
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Please provide a clear justification for your decision. Include assessment of business need, impact, priority, and conditions for approval."
                    className="w-full min-h-[100px] border border-slate-200 rounded-lg p-3 text-[13px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Files Attachment Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-800">
                      Attachments
                    </span>
                    <span className="text-[11px] text-slate-450 font-medium">
                      {reviewFiles.length} file(s) chosen
                    </span>
                  </div>

                  {/* Add Files button */}
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-slate-700 text-[12px] font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer select-none">
                      <svg
                        className="w-4 h-4 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      Add Files
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* List of files with delete option */}
                  {reviewFiles.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 mt-1">
                      {reviewFiles.map((file, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50 text-[12px] text-slate-650"
                        >
                          <span className="truncate font-medium pr-4">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(fIdx)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer animate-in fade-in duration-100"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleCloseReview}
              className="flex-1 p-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-[12.5px] font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleResetReview}
              className="flex-1 p-2 rounded-lg border border-red-200 bg-white text-red-500 text-[12.5px] font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={isSubmittingReview || loadingBudgetCodes}
              onClick={handleSubmitReview}
              className="flex-[1.5] p-2 rounded-lg bg-[#063E89] text-white text-[12.5px] font-bold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 text-center"
            >
              {isSubmittingReview ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Submitting
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
