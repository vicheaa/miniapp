import { ChevronDown, X, Upload, Trash2, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateTimeCompact } from '@/utils/format';
import { ProcessFlowDetail } from '@/types/workflow-detail';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { usePurchaseRequisition } from './usePurchaseRequisition';

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
  const {
    t,
    actions,
    isActivitiesExpanded,
    setIsActivitiesExpanded,
    isApprovalOpen,
    setApprovalOpen,
    isBudgetReviewOpen,
    setBudgetReviewOpen,
    budgetCodes,
    loadingBudgetCodes,
    reviewItems,
    reviewComment,
    setReviewComment,
    reviewFiles,
    isSubmittingReview,
    visualViewportHeight,
    handleFileChange,
    handleRemoveFile,
    handleCloseReview,
    handleResetReview,
    handleResetApproval,
    handleSubmitReview,
    handleSubmitApproval,
    handleAction,
    updateReviewItemBudgetCode,
  } = usePurchaseRequisition({
    selectedTask,
    instanceData,
    detail,
    isClaiming,
    handleClaimToggle,
    onActionSuccess,
  });

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
            className="flex-1 py-2 px-2 rounded-md border border-gray-400 text-gray-700 text-[12px] font-semibold cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed truncate"
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
                      ? 'flex-1 py-2 px-2 rounded-md border border-red-500 bg-white text-red-500 text-[12px] font-semibold cursor-pointer text-center truncate'
                      : 'flex-1 py-2 px-2 rounded-md bg-[#063E89] text-white text-[12px] font-semibold cursor-pointer text-center truncate'
                  }
                >
                  {act.name}
                </button>
              );
            })}
        </div>
      </div>

      {/* Approval Modal */}
      <Drawer open={isApprovalOpen} onOpenChange={setApprovalOpen}>
        <DrawerContent
          className="max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          style={visualViewportHeight ? { maxHeight: `${visualViewportHeight * 0.92}px` } : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <DrawerTitle className="text-[16px] font-bold">
              {selectedTask?.taskName || 'Approval'}
            </DrawerTitle>
            <button
              onClick={() => setApprovalOpen(false)}
              className="w-8 h-8 flex items-center justify-center hover:text-gray-655 active:bg-gray-50 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Activities Collapsible Card */}
            <div className="border border-gray-100 rounded-lg bg-white overflow-hidden">
              {/* Header Toggle */}
              <button
                onClick={() => setIsActivitiesExpanded(!isActivitiesExpanded)}
                className="w-full flex items-center justify-between p-3.5 bg-[rgba(249,250,251,0.5)] hover:bg-gray-50 transition-colors border-b border-gray-100 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={16}
                    className={`text-gray-500 transition-transform duration-200 ${
                      isActivitiesExpanded ? '' : '-rotate-90'
                    }`}
                  />
                  <span className="text-[13px] font-semibold text-gray-700">
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
                          <div className="absolute left-[5px] top-3.5 bottom-0 w-[1px] bg-gray-200" />
                        )}
                        {/* Bullet */}
                        <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-[#1b2e4b] ring-4 ring-gray-100" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-bold text-gray-800">
                              {activity.taskName}
                            </span>
                            <span className="text-[11.5px] text-gray-500 shrink-0">
                              {formatDateTimeCompact(activity.actionDate)}
                            </span>
                          </div>
                          <span className="text-[12.5px] text-gray-500 mt-1 block">
                            {activity.action} by{' '}
                            <span className="font-semibold text-gray-700">
                              {activity.actionBy}
                            </span>
                          </span>
                          {activity.comment && (
                            <div className="text-[12.5px] text-gray-655 mt-1.5 leading-relaxed whitespace-pre-wrap">
                              {activity.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-[12px]">
                      No activities recorded.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comment input box */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-gray-800 flex items-center gap-0.5">
                <span className="text-red-500">*</span> Comment
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Please provide a clear justification for your decision. Include assessment of business need, impact, priority, and conditions for approval."
                className="w-full min-h-[100px] border border-gray-200 rounded-lg p-3 text-[13px] leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Files Attachment Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-gray-800">
                  Attachments
                </span>
                <span className="text-[11px] text-gray-450 font-medium">
                  {reviewFiles.length} file(s) chosen
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border border-gray-200 text-gray-700 text-[12px] font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer select-none">
                  <Upload className="w-4 h-4 text-gray-500" />
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
                      className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50 text-[12px] text-gray-650"
                    >
                      <span className="truncate font-medium pr-4">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(fIdx)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={() => setApprovalOpen(false)}
              className="flex-1 px-2 py-2.5 rounded-md border border-gray-200 bg-white text-gray-700 text-[12.5px] font-bold hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleResetApproval}
              className="flex-1 px-2 py-2.5 rounded-md border border-red-500 bg-white text-red-500 text-[12.5px] font-bold hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleSubmitApproval}
              className="flex-[1.5] px-2 py-2.5 rounded-md bg-[#063E89] text-white text-[12.5px] font-bold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 text-center"
            >
              {isSubmittingReview ? (
                <>
                  <Loader2 className="animate-spin h-3.5 w-3.5 text-white" />
                  Submitting
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Budget Review Modal */}
      <Drawer open={isBudgetReviewOpen} onOpenChange={setBudgetReviewOpen}>
        <DrawerContent
          className="max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          style={visualViewportHeight ? { maxHeight: `${visualViewportHeight * 0.92}px` } : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <DrawerTitle className="text-[16px] font-bold text-gray-800">
              Budget Review
            </DrawerTitle>
            <button
              onClick={handleCloseReview}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-655 active:bg-gray-50 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loadingBudgetCodes ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
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
                      className="bg-gray-50 border border-[rgba(229,231,235,0.6)] rounded-xl p-3.5 flex flex-col gap-2.5"
                    >
                      {/* Header: No, Name & Price */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="inline-flex items-center justify-center bg-gray-200 text-gray-700 font-bold text-[10px] w-5 h-5 rounded-full mr-2">
                            {idx + 1}
                          </span>
                          <span className="text-[13px] font-bold text-gray-800">
                            {item.itemName}
                          </span>
                          <span className="text-[10px] text-gray-450 font-semibold block mt-0.5 ml-7">
                            {item.itemCode}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[13px] font-extrabold text-gray-900 block">
                            ${formatCurrency(item.amount)}
                          </span>
                          <span className="text-[10.5px] text-gray-500 block font-medium mt-0.5">
                            {item.qty} {item.uom} x $
                            {formatCurrency(item.unitPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Description & Remarks */}
                      {item.description && (
                        <div className="text-[12px] text-gray-650 ml-7">
                          <span className="font-semibold text-gray-400">
                            Description:{' '}
                          </span>
                          {item.description}
                        </div>
                      )}
                      {item.remarks && (
                        <div className="text-[12px] text-gray-650 ml-7">
                          <span className="font-semibold text-gray-400">
                            Remarks:{' '}
                          </span>
                          {item.remarks}
                        </div>
                      )}

                      {/* Budget Code Selector */}
                      <div className="flex flex-col gap-1 mt-1 ml-7">
                        <label className="text-[11px] font-bold text-gray-400 uppercase">
                          Budget Code
                        </label>
                        <select
                          value={item.budgetCode || ''}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            updateReviewItemBudgetCode(idx, newVal);
                          }}
                          className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-[12.5px] font-semibold text-gray-850 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
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
                  <label className="text-[13px] font-bold text-gray-800">
                    Comment
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Please provide a clear justification for your decision. Include assessment of business need, impact, priority, and conditions for approval."
                    className="w-full min-h-[100px] border border-gray-200 rounded-lg p-3 text-[13px] leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Files Attachment Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-gray-800">
                      Attachments
                    </span>
                    <span className="text-[11px] text-gray-450 font-medium">
                      {reviewFiles.length} file(s) chosen
                    </span>
                  </div>

                  {/* Add Files button */}
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border border-gray-200 text-gray-700 text-[12px] font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer select-none">
                      <Upload className="w-4 h-4 text-gray-500" />
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
                          className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50 text-[12px] text-gray-650"
                        >
                          <span className="truncate font-medium pr-4">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(fIdx)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer animate-in fade-in duration-100"
                          >
                            <Trash2 className="w-4 h-4" />
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
          <div className="flex items-center justify-between gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleCloseReview}
              className="flex-1 p-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-[12.5px] font-bold hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={handleResetReview}
              className="flex-1 p-2 rounded-lg border border-red-200 bg-white text-red-500 text-[12.5px] font-bold hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
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
                  <Loader2 className="animate-spin h-3.5 w-3.5 text-white" />
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
