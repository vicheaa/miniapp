import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkflowStore } from '../../store/workflowStore';
import { formatDateCompact } from '../../utils/format';
import { useTranslation } from '../../hooks/useTranslation';
import {
  User,
  SendHorizontal,
  FileText,
  Paperclip,
  Info,
  Calendar,
  Building2,
  AlertCircle,
  Download,
  Mail,
  UserCheck,
  ChevronLeft
} from 'lucide-react';
import {
  fetchTaskInstanceData,
  fetchProcessFlowDetail,
  fetchBasicContactInfo,
  fetchFilesMetadata,
  type TaskInstanceData,
  type ProcessFlowDetail,
  type BasicContactInfo,
  type FileMetadata
} from '../../services/api/task-detail-api';
import { claimTask } from '../../services/api/workflow-api';
import PdfPreviewModal from '../../components/workflow/PdfPreviewModal';

export default function TaskDetailPage() {
  const { t } = useTranslation();
  const superApp = useWorkflowStore((s) => s.superApp);
  const selectedTask = useWorkflowStore((s) => s.selectedTask);
  const authToken = useWorkflowStore((s) => s.authToken);
  const setView = useWorkflowStore((s) => s.setView);

  const queryClient = useQueryClient();
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaimToggle = async () => {
    if (!selectedTask || !authToken) return;
    setIsClaiming(true);
    const actionLabel = selectedTask.claimed ? 'Unclaim' : 'Claim';
    try {
      await claimTask(authToken, selectedTask.taskId);
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
      loadTaskDetails();
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
  const [contactInfo, setContactInfo] = useState<BasicContactInfo | null>(null);
  const [filesMap, setFilesMap] = useState<Record<string, FileMetadata>>({});
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string } | null>(null);

  // UI state
  const [isRequestInfoExpanded, setIsRequestInfoExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'data-form' | 'activities' | 'attachments'>('data-form');

  // Fetch all details
  const loadTaskDetails = useCallback(async () => {
    if (!selectedTask || !authToken) return;
    setLoading(true);
    setError(null);

    let instData: TaskInstanceData | null = null;
    let flowDetail: ProcessFlowDetail | null = null;

    try {
      // Fetch task instance data (API 1)
      try {
        instData = await fetchTaskInstanceData(authToken, selectedTask.taskId);
        setInstanceData(instData);

        // Fetch file metadata for attachments
        if (instData?.attachmentFiles && instData.attachmentFiles.length > 0) {
          try {
            const fileIds = instData.attachmentFiles.map(f => f.fileId).filter(Boolean);
            if (fileIds.length > 0) {
              const filesData = await fetchFilesMetadata(authToken, fileIds);
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

      // Fetch process details (API 3)
      try {
        flowDetail = await fetchProcessFlowDetail(authToken, selectedTask.instanceInfo.processInstanceId);
        setProcessDetail(flowDetail);
      } catch (flowErr) {
        console.warn('[TaskDetailPage] Error loading process flow details (possibly not a PR task or API is down):', flowErr);
        // Do not set page-level error; allow other panels to render
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
          const contact = await fetchBasicContactInfo(authToken, creatorId);
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
  }, [selectedTask, authToken]);

  useEffect(() => {
    loadTaskDetails();
  }, [loadTaskDetails]);

  // Back button
  const handleBack = () => {
    setView('task-list');
  };

  // Action Handlers
  const handleAction = (actionName: string) => {
    if (superApp) {
      superApp.showToast(`Action executed: ${actionName}`);
    } else {
      alert(`[Dev Mode] Action: ${actionName}`);
    }
  };

  const handlePreviewFile = async (fileId: string) => {
    if (!authToken) return;

    try {
      if (superApp) {
        superApp.showToast('Fetching file preview...');
      }

      let blob: Blob;

      try {
        if (authToken === 'mock-dev-token-value') {
          throw new Error('Using mock token');
        }

        const response = await fetch(`/services/files/api/name/view-file/find`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ id: fileId })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('[TaskDetailPage] File preview API error response body:', errText);
          throw new Error(`Server returned ${response.status} ${response.statusText}: ${errText}`);
        }
        blob = await response.blob();
      } catch (networkErr: any) {
        console.warn('[TaskDetailPage] Real file preview failed, falling back to mock PDF:', networkErr);
        if (superApp) {
          superApp.showToast('Preview offline/unauthorized, loading mock PDF...');
        }
        const response = await fetch(`data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXQogICAgIC9Db250ZW50cyA0IDAgUgogICAgIC9SZXNvdXJjZXMgPDwKICAgICAgICAvRm9udCA8PAogICAgICAgICAgIC9GMSA1IDAgUgogICAgICAgID4+CiAgICAgPj4KICA+PgplbmRvYmoKNCAwIG9iaagogIDw8IC9MZW5ndGggNTYgPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgogNzIgNzIwIFRkCiAoTW9jayBQREYgQXR0YWNobWVudCBQcmV2aWV3KSBUagogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCiAgPDwgL1R5cGUgL0ZvbnQKICAgICAvU3VidHlwZSAvVHlwZTEKICAgICAvQmFzZUZvbnQgL0hlbHZldGljYQogID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAyNDAgMDAwMDAgbiAKMDAwMDAwMDM0NiAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNgogICAgIC9Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCi0xCiUlRU9GCg==`);
        blob = await response.blob();
      }

      const fileMeta = filesMap[fileId];
      const mimeType = fileMeta?.fileType || 'application/pdf';
      const typedBlob = new Blob([blob], { type: mimeType });
      const objectUrl = URL.createObjectURL(typedBlob);

      setPreviewPdf({
        url: objectUrl,
        title: fileMeta?.fileName || 'PDF Preview'
      });
    } catch (err: any) {
      console.error('[TaskDetailPage] Preview file error:', err);
      if (superApp) {
        superApp.showToast(`Failed to preview file: ${err?.message || err}`);
      } else {
        alert(`Failed to preview file: ${err?.message || err}`);
      }
    }
  };

  if (!selectedTask) {
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

  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-slate-50 h-screen overflow-hidden flex flex-col box-border relative">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0 sticky top-0 z-50">
        <button
          onClick={handleBack}
          className="p-1 -ml-1 text-slate-500 hover:text-slate-900 active:bg-slate-50 rounded-lg transition-colors cursor-pointer"
        >
          <ChevronLeft size={24} color='black' />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-bold text-slate-900 truncate">
            {selectedTask.instanceInfo.businessKey || t('workflow.detail')}
          </h1>
          <p className="text-[11px] text-slate-400 font-medium truncate">
            {selectedTask.instanceInfo.processName}
          </p>
        </div>
      </header>

      {/* ── Scrollable Body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="animate-spin h-7 w-7 text-slate-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[13px] text-slate-400 font-semibold">{t('workflow.loading_more')}</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-red-50 text-red-500 mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">{t('global.error')}</h3>
            <p className="text-[13px] text-slate-500 mb-4 px-4">{error}</p>
            <button
              onClick={loadTaskDetails}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-[13px] font-semibold hover:bg-slate-900 transition-all cursor-pointer"
            >
              {t('global.loading')}
            </button>
          </div>
        ) : (
          <div className="p-3.5 flex flex-col gap-3.5">
            {/* ── Request Info Collapsible Card ──────────────────────────────── */}
            <div className="overflow-hidden">
              
                <div className="bg-white px-4 pb-4 border-t border-slate-100/60 pt-3 flex flex-col gap-3 text-[13px] rounded-sm">
                  <button
                    onClick={() => setIsRequestInfoExpanded(!isRequestInfoExpanded)}
                    className="w-full flex items-center justify-between text-left "
                  >
                    <span className="text-[14px] font-bold text-slate-800">{t('workflow.request_info')}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100">
                      {processDetail?.processStatus || instanceData?.processInstance?.state || 'PENDING'}
                    </span>
                  </button>
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

                <div className='bg-white px-4 pb-4 border-t border-slate-100/60 pt-3 flex flex-col gap-3 text-[13px] my-2 rounded-sm'>
                  <button
                    onClick={() => setIsRequestInfoExpanded(!isRequestInfoExpanded)}
                    className="w-full flex items-center justify-between text-left "
                  >
                    <span className="text-[14px] font-bold text-slate-800">{t('workflow.current_state')}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 bg-blue-50 text-blue-600 border border-blue-100">
                        Active
                      </span>
                  </button>
                  {/* Task name / Assignee */}
                  <div className="flex gap-3">
                    <UserCheck size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <span className="font-semibold">{selectedTask.taskName}</span>
                      <p className="text-slate-800">
                        {t('workflow.assigned_to')} <span className="font-semibold">{selectedTask.assigneeInfo?.name || selectedTask.assignee || '—'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Task Started Date */}
                  <div className="flex gap-3">
                    <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <span className="text-slate-400 font-medium block text-[11px]">{t('workflow.task_started_date')}</span>
                      <span className="text-slate-700 font-semibold">
                        {formatDateCompact(selectedTask.created)}
                      </span>
                    </div>
                  </div>

                </div>      
            </div>

            {/* ── Tabs Segmented Control ────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-1 flex">
              <button
                onClick={() => setActiveTab('data-form')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'data-form'
                    ? 'bg-[#063E89] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 active:bg-slate-50'
                }`}
              >
                {t('workflow.data_form')}
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'activities'
                    ? 'bg-[#063E89] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 active:bg-slate-50'
                }`}
              >
                {t('workflow.activities')}
              </button>
              <button
                onClick={() => setActiveTab('attachments')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'attachments'
                    ? 'bg-[#063E89] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 active:bg-slate-50'
                }`}
              >
                {t('workflow.attachments')}
              </button>
            </div>

            {/* ── Data Form Tab Content ──────────────────────────────────────── */}
            {activeTab === 'data-form' && (
              processDetail ? (
                <div className="flex flex-col gap-3.5">
                  {/* Requisition Card */}
                  <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col gap-3">
                    <h3 className="text-[14px] font-bold text-slate-800 pb-2 border-b border-slate-100">
                      {t('workflow.requisition_info')}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
                      <div>
                        <span className="text-slate-400 block font-medium">{t('workflow.from_no')}</span>
                        <span className="text-slate-800 font-bold">{processDetail.formNo}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">{t('workflow.expected_date')}</span>
                        <span className="text-slate-800 font-semibold">{formatDateCompact(processDetail.acquisitionDate)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block font-medium">{t('workflow.reason')}</span>
                        <span className="text-slate-800 font-medium">{processDetail.reason || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">{t('workflow.bu')}</span>
                        <span className="text-slate-800 font-semibold">{processDetail.buName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">{t('workflow.created_by')}</span>
                        <span className="text-slate-800 font-semibold">{processDetail.createdBy}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">{t('workflow.budget_code_required')}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 font-bold mt-0.5">
                          {processDetail.budgetCodeRequired ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">{t('workflow.created_date')}</span>
                        <span className="text-slate-800 font-semibold">{formatDateCompact(processDetail.createdDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Items Section */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[13px] font-bold text-slate-500 px-1">{t('workflow.items_list')}</h4>
                    {processDetail.items?.map((item, idx) => (
                      <div key={item.id || idx} className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                          <span className="text-[13px] font-bold text-slate-800 truncate">
                            {item.itemName}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                            {item.itemCode}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-[12px] text-slate-600">
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('workflow.quantity_uom')}</span>
                            <span className="font-semibold text-slate-800">{item.qty} {item.uom}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('workflow.unit_price')}</span>
                            <span className="font-semibold text-slate-800">${item.unitPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('workflow.budget_code')}</span>
                            <span className="font-semibold text-slate-800">{item.budgetCode || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('workflow.subtotal')}</span>
                            <span className="font-bold text-slate-900">${item.amount.toFixed(2)}</span>
                          </div>
                          {item.description && (
                            <div className="col-span-2">
                              <span className="text-slate-400 block text-[11px]">{t('workflow.description')}</span>
                              <span className="text-slate-700 italic">{item.description}</span>
                            </div>
                          )}
                          {item.remarks && (
                            <div className="col-span-2">
                              <span className="text-slate-400 block text-[11px]">{t('workflow.remarks')}</span>
                              <span className="text-slate-700">{item.remarks}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Summary amount banner */}
                    <div className="bg-[#063E89] rounded-xl p-4 mt-1.5 flex items-center justify-between shadow-sm">
                      <span className="text-[13px] font-bold text-slate-300">{t('workflow.total_requisition_amount')}</span>
                      <span className="text-[16px] font-black text-white">
                        ${processDetail.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200/60 p-8 text-center text-slate-400 text-[13px] shadow-sm">
                  <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                  No form details available for this task.
                </div>
              )
            )}

            {/* ── Activities Tab Content (Timeline) ─────────────────────────── */}
            {activeTab === 'activities' && instanceData && (
              <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm">
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
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-extrabold text-slate-800">
                          {activity.taskName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatDateCompact(activity.actionDate)}
                        </span>
                      </div>

                      {/* Actor info */}
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        {activity.action} by <span className="font-semibold text-slate-700">{activity.actionBy}</span>
                      </p>

                      {/* Comment bubble */}
                      {activity.comment && (
                        <div className="mt-1.5 bg-slate-50 rounded-lg px-3 py-2 text-[12px] text-slate-600 border border-slate-100 italic relative">
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
              <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col gap-3">
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
                                onClick={() => handlePreviewFile(file.fileId)}
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
                            onClick={() => handlePreviewFile(file.fileId)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-md transition-colors cursor-pointer shrink-0"
                          >
                            <Download size={14} />
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
        <div className="absolute bottom-0 inset-x-0 bg-white p-4 flex gap-3 z-50 max-w-[480px] mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
          <button
            disabled={isClaiming}
            onClick={handleClaimToggle}
            className="flex-1 py-3 px-4 rounded-[12px] border border-slate-200 text-slate-700 text-[13px] font-bold hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedTask.claimed ? t('workflow.unclaim') : t('workflow.claim')}
          </button>
          
          {(() => {
            const actions =
              selectedTask.actions && selectedTask.actions.length > 0
                ? selectedTask.actions
                : [{ name: 'Complete', value: 'Completed' }];

            return actions.map((act, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(act.name)}
                className="flex-[2] py-3 px-4 rounded-[12px] bg-[#063E89] text-white text-[13px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center"
              >
                <SendHorizontal size={14} />
                <span>{act.name}</span>
              </button>
            ));
          })()}
        </div>
      )}

      {/* ── PDF Preview Modal Overlay ────────────────────────────────────── */}
      {previewPdf && (
        <PdfPreviewModal
          url={previewPdf.url}
          title={previewPdf.title}
          onClose={() => {
            URL.revokeObjectURL(previewPdf.url); // Free memory
            setPreviewPdf(null);
          }}
        />
      )}
    </div>
  );
}
