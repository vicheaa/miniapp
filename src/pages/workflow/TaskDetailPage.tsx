import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '@/store/workflowStore';
import { useMiniAppStore } from '@/store/miniAppStore';
import { formatDateTimeCompact, formatCurrency } from '@/utils/format';
import { useTranslation } from '@/hooks/useTranslation';
import {
  User,
  SendHorizontal,
  FileText,
  Paperclip,
  Info,
  Calendar,
  Building2,
  AlertCircle,
  Mail,
  UserCheck,
  ChevronLeft,
  ChevronDown,
  Ban,
  Eye
} from 'lucide-react';
import {
  fetchTaskInstanceData,
  fetchProcessFlowDetail,
  fetchBasicContactInfo,
  fetchFilesMetadata,
  claimTask,
  unclaimTask,
  fetchWorkflowTasks,
  fetchBudgetCodesByDept,
  saveBudgetReview,
  uploadFiles,
  fetchFmaNewStaffRequestDetail,
  
} from '@/services/api/workflow-api';
import PurchaseRequisitionForm from './task/purchase-requisition';
import FmaNewStaffRequestForm from './task/fma-new-staff-request';
import { 
  BasicContactInfo, 
  FileMetadata, 
  ProcessFlowDetail, 
  TaskInstanceData,
  FnsRequestDetail,
  BudgetCode
} from '@/types/workflow-detail';

export default function TaskDetailPage() {
  const { t } = useTranslation();
  const superApp = useMiniAppStore((s) => s.superApp);
  const selectedTask = useWorkflowStore((s) => s.selectedTask);
  const setSelectedTask = useWorkflowStore((s) => s.setSelectedTask);
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();

  const queryClient = useQueryClient();
  const lastFetchedTaskIdRef = useRef<string | null>(null);
  const [isSyncingTask, setIsSyncingTask] = useState(false);

  // Sync / find task if not set or doesn't match taskId
  useEffect(() => {
    const syncTask = async () => {
      if (!taskId) return;
      if (selectedTask && selectedTask.taskId === taskId) return;

      // 1. Try to look up task in query cache
      const cacheData = queryClient.getQueryData<{ pages: { items: any[] }[] }>([
        'workflowTasks',
      ]);
      let foundTask = cacheData?.pages
        .flatMap((p) => p.items)
        .find((t) => t.taskId === taskId);

      // 2. If not found in cache (e.g. refresh), fetch first page of tasks from API
      if (!foundTask) {
        setIsSyncingTask(true);
        try {
          const pageData = await queryClient.fetchQuery({
            queryKey: ['workflowTasks'],
            queryFn: async () => {
              const res = await fetchWorkflowTasks(0, 10);
              return { pages: [res], pageParams: [0] };
            },
          });
          
          foundTask = pageData.pages
            .flatMap((p) => p.items)
            .find((t) => t.taskId === taskId);
        } catch (e) {
          console.error('[TaskDetailPage] Failed to fetch tasks fallback:', e);
        } finally {
          setIsSyncingTask(false);
        }
      }

      if (foundTask) {
        setSelectedTask(foundTask);
      }
    };

    syncTask();
  }, [taskId, selectedTask, queryClient, setSelectedTask]);
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaimToggle = async () => {
    if (!selectedTask) return;
    setIsClaiming(true);
    const actionLabel = selectedTask.claimed ? 'Unclaim' : 'Claim';
    try {
      if (selectedTask.claimed) {
        await unclaimTask(selectedTask.taskId);
      } else {
        await claimTask(selectedTask.taskId);
      }
      if (superApp) {
        superApp.showToast(`Task ${actionLabel.toLowerCase()}ed successfully`);
      } else {
        alert(`Task ${actionLabel.toLowerCase()}ed successfully`);
      }
      
      // Update selectedTask claimed state locally so the UI updates
      useWorkflowStore.setState({
        selectedTask: {
          ...selectedTask,
          claimed: !selectedTask.claimed
        }
      });
      
      // Invalidate the task list query cache so it refreshes in the background/on next render
      queryClient.invalidateQueries({ queryKey: ['workflowTasks'] });
      
      // Reload task details to get fresh backend state
      loadTaskDetails(true);
    } catch (err: any) {
      console.error(`Failed to ${actionLabel.toLowerCase()} task:`, err);
      if (superApp) {
        superApp.showToast(`Failed to ${actionLabel.toLowerCase()} task: ${err.message || err}`);
      } else {
        alert(`Failed to ${actionLabel.toLowerCase()} task: ${err.message || err}`);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instanceData, setInstanceData] = useState<TaskInstanceData | null>(null);
  const [processDetail, setProcessDetail] = useState<ProcessFlowDetail | null>(null);
  const [fnsDetail, setFnsDetail] = useState<FnsRequestDetail | null>(null);
  const [contactInfo, setContactInfo] = useState<BasicContactInfo | null>(null);
  const [filesMap, setFilesMap] = useState<Record<string, FileMetadata>>({});

  // Budget Review Modal States
  const [isBudgetReviewOpen, setIsBudgetReviewOpen] = useState(false);
  const [budgetCodes, setBudgetCodes] = useState<BudgetCode[]>([]);
  const [loadingBudgetCodes, setLoadingBudgetCodes] = useState(false);
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setReviewFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setReviewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Close, Reset, and Submit Handlers
  const handleCloseReview = () => {
    setIsBudgetReviewOpen(false);
    setReviewItems([]);
    setReviewComment('');
    setReviewFiles([]);
    setBudgetCodes([]);
  };

  const handleResetReview = () => {
    if (processDetail) {
      setReviewItems(
        (processDetail.items || []).map((item) => ({
          ...item,
          budgetCode: item.budgetCode || '',
        }))
      );
    }
    setReviewComment('');
    setReviewFiles([]);
  };

  const openBudgetReview = async () => {
    if (!selectedTask) return;
    
    setIsBudgetReviewOpen(true);
    setLoadingBudgetCodes(true);
    setReviewComment('');
    setReviewFiles([]);
    
    let currentDetail = processDetail;
    try {
      if (!currentDetail) {
        currentDetail = await fetchProcessFlowDetail(selectedTask.instanceInfo.processInstanceId);
        setProcessDetail(currentDetail);
      }
      
      setReviewItems(
        (currentDetail?.items || []).map((item) => ({
          ...item,
          budgetCode: item.budgetCode || '',
        }))
      );
      
      if (currentDetail?.deptId != null && currentDetail?.buId != null) {
        const codes = await fetchBudgetCodesByDept(currentDetail.deptId, currentDetail.buId);
        setBudgetCodes(codes || []);
      }
    } catch (err: any) {
      console.error('Failed to initialize budget review:', err);
      if (superApp) {
        superApp.showToast(`Failed to initialize budget review: ${err.message || err}`);
      }
    } finally {
      setLoadingBudgetCodes(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedTask || !processDetail) return;

    if (processDetail.budgetCodeRequired) {
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

    setIsSubmittingReview(true);
    try {
      let fileIds: string[] = [];
      if (reviewFiles.length > 0) {
        const uploadRes = await uploadFiles(reviewFiles);
        fileIds = uploadRes.map((f) => f.fileId);
      }

      const payload = {
        taskId: selectedTask.taskId,
        actionName: 'Completed',
        payload: {
          id: processDetail.id,
          items: reviewItems.map((item, idx) => ({
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
          services: processDetail.services || [],
        },
        fileIds,
        comment: reviewComment,
      };

      await saveBudgetReview(payload);

      if (superApp) {
        superApp.showToast('Budget review submitted successfully');
      } else {
        alert('Budget review submitted successfully');
      }

      setIsBudgetReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['workflowTasks'] });
      navigate('/');
    } catch (err: any) {
      console.error('Failed to submit budget review:', err);
      if (superApp) {
        superApp.showToast(`Failed to submit budget review: ${err.message || err}`);
      } else {
        alert(`Failed to submit budget review: ${err.message || err}`);
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // UI state
  const [isRequestInfoExpanded, setIsRequestInfoExpanded] = useState(true);
  const [isCurrentStateExpanded, setIsCurrentStateExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'data-form' | 'activities' | 'attachments'>('data-form');

  const hasAttachments = !!(instanceData?.attachmentFiles && instanceData.attachmentFiles.length > 0);

  useEffect(() => {
    if (!hasAttachments && activeTab === 'attachments') {
      setActiveTab('data-form');
    }
  }, [hasAttachments, activeTab]);

  // Fetch all details
  const loadTaskDetails = useCallback(async (force = false) => {
    if (!selectedTask) return;
    if (!force && lastFetchedTaskIdRef.current === selectedTask.taskId) return;

    lastFetchedTaskIdRef.current = selectedTask.taskId;
    setLoading(true);
    setError(null);
    setProcessDetail(null);
    setFnsDetail(null);

    let instData: TaskInstanceData | null = null;
    let flowDetail: ProcessFlowDetail | null = null;

    try {
      // Fetch task instance data (API 1)
      try {
        instData = await fetchTaskInstanceData(selectedTask.taskId);
        setInstanceData(instData);

        // Fetch file metadata for attachments
        if (instData?.attachmentFiles && instData.attachmentFiles.length > 0) {
          try {
            const fileIds = instData.attachmentFiles.map(f => f.fileId).filter(Boolean);
            if (fileIds.length > 0) {
              const filesData = await fetchFilesMetadata(fileIds);
              const newFilesMap: Record<string, FileMetadata> = {};
              filesData.forEach(file => {
                if (file.id) {
                  newFilesMap[file.id] = file;
                }
              });
              setFilesMap(newFilesMap);
            }
          } catch (filesErr) {
            console.error('[TaskDetailPage] Failed to fetch attachment files metadata:', filesErr);
          }
        }
      } catch (instErr: any) {
        console.error('[TaskDetailPage] Error loading task instance data:', instErr);
        setError(instErr?.message || 'Failed to load task instance data.');
        setLoading(false);
        return;
      }

      // Fetch process/form details
      const prefix = selectedTask.instanceInfo.businessKey?.split('-')[0]?.toUpperCase();
      if (prefix === 'FNS') {
        try {
          const fnsData = await fetchFmaNewStaffRequestDetail(selectedTask.instanceInfo.processInstanceId);
          setFnsDetail(fnsData);
        } catch (fnsErr: any) {
          console.error('[TaskDetailPage] Error loading FNS details:', fnsErr);
          setError(fnsErr?.message || 'Failed to load new staff request details.');
          setLoading(false);
          return;
        }
      } else {
        try {
          flowDetail = await fetchProcessFlowDetail(selectedTask.instanceInfo.processInstanceId);
          setProcessDetail(flowDetail);
        } catch (flowErr) {
          console.warn('[TaskDetailPage] Error loading process flow details (possibly not a PR task or API is down):', flowErr);
          // Do not set page-level error; allow other panels to render
        }
      }

      // Determine creator username to query contact info
      let creatorId = '';
      if (flowDetail?.createdBy) {
        creatorId = flowDetail.createdBy;
      } else if (instData?.processInstance?.startUserId) {
        creatorId = instData.processInstance.startUserId;
      } else if (instData?.requestor?.id) {
        creatorId = instData.requestor.id;
      }

      if (creatorId) {
        try {
          const contact = await fetchBasicContactInfo(creatorId);
          setContactInfo(contact);
        } catch (contactErr) {
          console.error('[TaskDetailPage] Failed to fetch contact info:', contactErr);
        }
      }
    } catch (err: any) {
      console.error('[TaskDetailPage] Unexpected error loading details:', err);
      setError(err?.message || 'Failed to load task details.');
    } finally {
      setLoading(false);
    }
  }, [selectedTask]);

  useEffect(() => {
    loadTaskDetails();
  }, [loadTaskDetails]);

  // Back button
  const handleBack = () => {
    navigate('/');
  };

  // Action Handlers
  const handleAction = (actionName: string) => {
    const isPR = selectedTask?.instanceInfo?.businessKey?.startsWith('PR');
    if (isPR && actionName === 'Complete') {
      openBudgetReview();
      return;
    }

    if (superApp) {
      superApp.showToast(`Action executed: ${actionName}`);
    } else {
      alert(`[Dev Mode] Action: ${actionName}`);
    }
  };

  // Helper to render the appropriate form based on business key prefix
  const renderDataFormContent = () => {
    if (!selectedTask) return null;

    const key = selectedTask.instanceInfo.businessKey || '';
    const prefix = key.split('-')[0]?.toUpperCase();

    switch (prefix) {
      case 'FNS':
        if (fnsDetail) {
          return <FmaNewStaffRequestForm fnsDetail={fnsDetail} />;
        }
        break;
      case 'PR':
        if (processDetail) {
          return <PurchaseRequisitionForm processDetail={processDetail} />;
        }
        break;
      default:
        break;
    }

    // Fallback if data is still loading or form type is unknown
    return (
      <div className="bg-white rounded-md p-8 text-center text-slate-400 text-[13px]">
        <FileText size={32} className="mx-auto text-slate-300 mb-2" />
        No form details available for this task.
      </div>
    );
  };

  // Show error if we finished syncing and still don't have a task
  if (!selectedTask && !isSyncingTask) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center text-slate-400">
        <Info size={40} className="mb-2 text-slate-300" />
        <p>{t('workflow.no_tasks')}</p>
        <button onClick={handleBack} className="mt-4 text-[13px] text-blue-600 font-semibold underline">
          {t('workflow.no_more_tasks')}
        </button>
      </div>
    );
  }

  const showContentLoading = !selectedTask || loading;

  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-gray-100 h-full overflow-hidden flex flex-col box-border relative">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0 sticky top-0 z-50">
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 active:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <ChevronLeft size={24} color='black' />
        </button>
        <div className="flex-1 min-w-0">
          {selectedTask ? (
            <>
              <div className='flex flex-col items-center'>
                <h1 className="font-semibold truncate">
                  {selectedTask.instanceInfo.businessKey || t('workflow.detail')}
                </h1>
                <p className="font-semibold truncate">
                  {selectedTask.instanceInfo.processName}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 py-0.5">
              <div className="skeleton-shimmer h-3.5 w-[45%] rounded mx-auto" />
              <div className="skeleton-shimmer h-2.5 w-[65%] rounded mx-auto" />
            </div>
          )}
        </div>
        {/* Spacer to balance back button on the left and keep title centered */}
        <div className="w-8 shrink-0" />
      </header>

      {/* ── Scrollable Body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-4 flex flex-col">
        {showContentLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <svg className="animate-spin h-7 w-7 text-slate-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[13px] text-slate-400 font-semibold">{t('global.loading')}</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-red-50 text-red-500 mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">{t('global.error')}</h3>
            <p className="text-[13px] text-slate-500 mb-4 px-4">{error}</p>
            <button
              onClick={() => loadTaskDetails() ?? loadTaskDetails(true)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-[13px] font-semibold hover:bg-slate-900 transition-all cursor-pointer"
            >
              {t('global.loading')}
            </button>
          </div>
        ) : (
          <div className="p-3.5 flex flex-col gap-3.5">
            {/* ── Request Info Collapsible Card ──────────────────────────────── */}
            <div className="overflow-hidden flex flex-col gap-2">
                {/* Request Info Box */}
                <div className="bg-white px-4 py-3 flex flex-col gap-3 text-[13px] rounded-md border border-slate-200/50">
                  <button
                    onClick={() => setIsRequestInfoExpanded(!isRequestInfoExpanded)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-[14px] font-bold text-slate-800">{t('workflow.request_info')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {processDetail?.processStatus || instanceData?.processInstance?.state || 'PENDING'}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 ${
                          isRequestInfoExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isRequestInfoExpanded && (
                    <div className="flex flex-col gap-3 pt-1 border-t border-slate-100/60 mt-1">
                      {/* Requester Info */}
                      <div className="flex gap-3">
                        <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-slate-400 font-medium block text-[11px]">{t('workflow.requested_by')}</span>
                          <span className="text-slate-800 font-semibold">
                            {(() => {
                              let nameStr = '—';
                              let titleStr = '';
                              
                              if (contactInfo) {
                                nameStr = `${contactInfo.empNo} ${contactInfo.lastName} ${contactInfo.firstName}`;
                                const empInfo = instanceData?.requestor?.employee;
                                if (empInfo?.jobTitle) {
                                  titleStr = ` - ${empInfo.jobTitle}`;
                                }
                              } else if (instanceData?.requestor) {
                                const req = instanceData.requestor;
                                const emp = req.employee;
                                if (emp) {
                                  nameStr = `${emp.empNo} ${emp.lastName} ${emp.firstName}`;
                                  titleStr = ` - ${emp.jobTitle}`;
                                } else {
                                  nameStr = req.name || req.id;
                                }
                              } else if (processDetail) {
                                nameStr = processDetail.createdBy;
                              }
                              
                              return `${nameStr}${titleStr}`;
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Contact Email */}
                      {(contactInfo?.mail || instanceData?.requestor?.email) && (
                        <div className="flex gap-3">
                          <Mail size={16} className="text-slate-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span className="text-slate-400 font-medium block text-[11px]">{t('workflow.contact')}</span>
                            <a 
                              href={`mailto:${contactInfo?.mail || instanceData?.requestor?.email}`} 
                              className="text-blue-600 font-medium hover:underline"
                            >
                              {contactInfo?.mail || instanceData?.requestor?.email}
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Org / Business Unit */}
                      <div className="flex gap-3">
                        <Building2 size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-slate-400 font-medium block text-[11px]">{t('workflow.org_info')}</span>
                          <span className="text-slate-800 font-semibold">
                            {instanceData?.requestor?.employee 
                              ? `${instanceData.requestor.employee.department}, ${instanceData.requestor.employee.buName}` 
                              : (processDetail?.buName || '—')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>    

                {/* Current State Box */}
                <div className="bg-white px-4 py-3 flex flex-col gap-3 text-[13px] rounded-md border border-slate-200/50">
                  <button
                    onClick={() => setIsCurrentStateExpanded(!isCurrentStateExpanded)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-[14px] font-bold text-slate-800">{t('workflow.current_state')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                        Active
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 ${
                          isCurrentStateExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isCurrentStateExpanded && (
                    <div className="flex flex-col gap-3 pt-1 border-t border-slate-100/60 mt-1">
                      {/* Task name / Assignee */}
                      <div className="flex gap-3">
                        <UserCheck size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="font-semibold text-slate-800 block">{selectedTask.taskName}</span>
                          <p className="text-slate-500 mt-0.5 text-[12px]">
                            {t('workflow.assigned_to')} <span className="font-semibold text-slate-800">{selectedTask.assigneeInfo?.name || selectedTask.assignee || '—'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Task Started Date */}
                      <div className="flex gap-3">
                        <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-slate-400 font-medium block text-[11px]">{t('workflow.task_started_date')}</span>
                          <span className="text-slate-700 font-semibold">
                            {formatDateTimeCompact(selectedTask.created)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>      
            </div>

            {/* ── Tabs Segmented Control ────────────────────────────────────── */}
            <div className="bg-white rounded-full p-1 flex">
              <button
                onClick={() => setActiveTab('data-form')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-full transition-all cursor-pointer ${
                  activeTab === 'data-form'
                    ? 'bg-[#063E89]/80 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 active:bg-slate-50'
                }`}
              >
                {t('workflow.data_form')}
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-full transition-all cursor-pointer ${
                  activeTab === 'activities'
                    ? 'bg-[#063E89]/80 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 active:bg-slate-50'
                }`}
              >
                {t('workflow.activities')}
              </button>
              <button
                disabled={!hasAttachments}
                onClick={() => setActiveTab('attachments')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-full transition-all cursor-pointer ${
                  !hasAttachments
                    ? 'text-slate-500 cursor-not-allowed opacity-50'
                    : activeTab === 'attachments'
                    ? 'bg-[#063E89]/80 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 active:bg-slate-50'
                }`}
              >
                {t('workflow.attachments')}
              </button>
            </div>

            {/* ── Data Form Tab Content ──────────────────────────────────────── */}
            {activeTab === 'data-form' && renderDataFormContent()}

            {/* ── Activities Tab Content (Timeline) ─────────────────────────── */}
            {activeTab === 'activities' && instanceData && (
              <div className="bg-white rounded-md p-4">
                <h3 className="text-[14px] font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
                  {t('workflow.workflow_timeline')}
                </h3>
                <div className="relative border-l border-slate-150 pl-5 ml-2.5 flex flex-col gap-6">
                  {instanceData.activities?.map((activity, idx) => (
                    <div key={activity.id || idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[27px] top-1.5 bg-white p-0.5 rounded-full z-10">
                        <span className="block w-2.5 h-2.5 rounded-full bg-slate-800 ring-[3px] ring-slate-100" />
                      </span>

                      {/* Header */}
                      <div className="flex items-baseline gap-2 text-[12px] justify-between">
                        <span className="font-semibold">
                          {activity.taskName}
                        </span>
                        <span className="ml-3 font-medium">
                          {formatDateTimeCompact(activity.actionDate)}
                        </span>
                      </div>

                      {/* Actor info */}
                      <p className="text-[12px] mt-0.5">
                        {activity.action} by <span className="font-semibold">{activity.actionBy}</span>
                      </p>

                      {/* Comment bubble */}
                      {activity.comment && (
                        <div className="mt-1.5 rounded-lg text-[12px] relative">
                          {activity.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Attachments Tab Content ─────────────────────────────────────── */}
            {activeTab === 'attachments' && instanceData && (
              <div className="bg-white rounded-md border border-slate-200/60 p-4 flex flex-col gap-3">
                <h3 className="text-[14px] font-bold text-slate-800 pb-2 border-b border-slate-100">
                  {t('workflow.attachments')}
                </h3>
                {instanceData.attachmentFiles && instanceData.attachmentFiles.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {instanceData.attachmentFiles.map((file, idx) => {
                      const fileMeta = filesMap[file.fileId];
                      const displayName = fileMeta?.fileName || 'File Attachment';
                      const displayType = fileMeta?.fileType ? ` · ${fileMeta.fileType.split('/')[1]?.toUpperCase() || fileMeta.fileType}` : '';
                      return (
                        <div
                          key={file.fileId || idx}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-150 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Paperclip size={16} className="text-slate-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span
                                // onClick={() => handlePreviewFile(file.fileId)}
                                className="text-[12px] font-semibold text-slate-700 block truncate hover:underline hover:text-blue-600 cursor-pointer"
                              >
                                {displayName}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                Source: {file.activity}{displayType} · ID: {file.fileId.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                          <button
                            // onClick={() => handlePreviewFile(file.fileId)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-md transition-colors cursor-pointer shrink-0"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-[13px]">
                    <Paperclip size={28} className="mx-auto text-slate-300 mb-1.5" />
                    {t('workflow.no_attachments')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky Action Bottom Bar ─────────────────────────────────────── */}
      {!loading && !error && selectedTask && (
        <div className="shrink-0 bg-white p-3 flex flex-col gap-3 z-50 shadow-md">
          {/* Total Requisition Amount Banner */}
          {processDetail?.totalAmount != null && (
            <div className="px-1 flex items-center justify-between">
              <span className="text-[14px] font-semibold">{t('workflow.total_requisition_amount')}</span>
              <span className="text-[18px] font-bold text-[#063E89]">
                ${formatCurrency(processDetail.totalAmount)}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              disabled={isClaiming}
              onClick={handleClaimToggle}
              className="flex-1 py-2 px-3 rounded-md border border-slate-200 text-slate-700 text-[13px] font-bold cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedTask.claimed ? t('workflow.unclaim') : t('workflow.claim')}
            </button>
            
            {(() => {
              const actions =
                selectedTask.actions && selectedTask.actions.length > 0
                  ? selectedTask.actions
                  : [{ name: 'Complete', value: 'Completed' }];

              return actions.map((act, idx) => {
                const isReject = act.name.toLowerCase() === 'reject';
                return (
                  <button
                    key={idx}
                    onClick={() => handleAction(act.name)}
                    className={
                      isReject
                        ? "flex-[2] py-2 px-3 rounded-md border border-red-500 bg-white text-red-500 text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1.5 text-center"
                        : "flex-[2] py-2 px-3 rounded-md bg-[#063E89] text-white text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1.5 text-center"
                    }
                  >
                    {isReject ? <Ban size={14} /> : <SendHorizontal size={14} />}
                    <span>{act.name}</span>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── Budget Review Modal ─────────────────────────────────────────── */}
      {isBudgetReviewOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 backdrop-blur-xs p-0">
          <div className="bg-white w-full max-w-[480px] rounded-t-[20px] shadow-2xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-250">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-[16px] font-bold text-slate-800">Budget Review</h2>
              <button
                onClick={handleCloseReview}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-650 active:bg-slate-50 rounded-full transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {loadingBudgetCodes ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                  <svg className="animate-spin h-6 w-6 text-slate-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-[12px] font-medium">Loading budget codes...</span>
                </div>
              ) : (
                <>
                  {/* Item card list for mobile */}
                  <div className="flex flex-col gap-3">
                    {reviewItems.map((item, idx) => (
                      <div key={item.id || idx} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex flex-col gap-2.5">
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
                              {item.qty} {item.uom} x ${formatCurrency(item.unitPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Description & Remarks */}
                        {item.description && (
                          <div className="text-[12px] text-slate-650 ml-7">
                            <span className="font-semibold text-slate-400">Description: </span>
                            {item.description}
                          </div>
                        )}
                        {item.remarks && (
                          <div className="text-[12px] text-slate-650 ml-7">
                            <span className="font-semibold text-slate-400">Remarks: </span>
                            {item.remarks}
                          </div>
                        )}

                        {/* Budget Code Selector */}
                        <div className="flex flex-col gap-1 mt-1 ml-7">
                          <label className="text-[11px] font-bold text-slate-400 uppercase">Budget Code</label>
                          <select
                            value={item.budgetCode || ''}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setReviewItems((prev) =>
                                prev.map((i, oIdx) => (oIdx === idx ? { ...i, budgetCode: newVal } : i))
                              );
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
                    <label className="text-[13px] font-bold text-slate-800">Comment</label>
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
                      <span className="text-[13px] font-bold text-slate-800">Attachments</span>
                      <span className="text-[11px] text-slate-450 font-medium">
                        {reviewFiles.length} file(s) chosen
                      </span>
                    </div>

                    {/* Add Files button */}
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-slate-700 text-[12px] font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer select-none">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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
                            <span className="truncate font-medium pr-4">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(fIdx)}
                              className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer animate-in fade-in duration-100"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
            <div className="flex items-center justify-between gap-2 px-4 py-4 border-t border-slate-100 bg-slate-50 rounded-b-[20px] shrink-0">
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
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
