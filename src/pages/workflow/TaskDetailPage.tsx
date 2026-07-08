import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '@/store/workflowStore';
import { useMiniAppStore } from '@/store/miniAppStore';
import { formatDateTimeCompact } from '@/utils/format';
import { useTranslation } from '@/hooks/useTranslation';
import {
  User,
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
} from '@/services/api/workflow-api';
import { taskRegistry } from './task/registry';
import DefaultActions from './task/DefaultActions';
import { 
  BasicContactInfo, 
  FileMetadata, 
  TaskInstanceData,
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
  const [detail, setDetail] = useState<any>(null);
  const [contactInfo, setContactInfo] = useState<BasicContactInfo | null>(null);
  const [filesMap, setFilesMap] = useState<Record<string, FileMetadata>>({});

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
    setDetail(null);

    let instData: TaskInstanceData | null = null;
    let detailData: any = null;

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
      const prefix = selectedTask.instanceInfo.businessKey?.split('-')[0]?.toUpperCase() || '';
      const taskConfig = taskRegistry[prefix];
      try {
        if (taskConfig?.fetchDetail) {
          detailData = await taskConfig.fetchDetail(selectedTask.instanceInfo.processInstanceId);
        } else {
          detailData = await fetchProcessFlowDetail(selectedTask.instanceInfo.processInstanceId);
        }
        setDetail(detailData);
      } catch (detailErr: any) {
        console.warn('[TaskDetailPage] Error loading workflow details:', detailErr);
      }

      // Determine creator username to query contact info
      let creatorId = '';
      if (detailData?.createdBy) {
        creatorId = detailData.createdBy;
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

  // Helper to render the appropriate form based on business key prefix
  const renderDataFormContent = () => {
    if (!selectedTask) return null;

    const key = selectedTask.instanceInfo.businessKey || '';
    const prefix = key.split('-')[0]?.toUpperCase() || '';
    const taskConfig = taskRegistry[prefix];

    if (taskConfig && detail) {
      const FormComponent = taskConfig.Form;
      return <FormComponent selectedTask={selectedTask} instanceData={instanceData} detail={detail} />;
    }

    // Fallback if data is still loading or form type is unknown
    return (
      <div className="bg-white rounded-md p-8 text-center text-gray-400 text-[13px]">
        <FileText size={32} className="mx-auto text-gray-300 mb-2" />
        No form details available for this task.
      </div>
    );
  };

  // Show error if we finished syncing and still don't have a task
  if (!selectedTask && !isSyncingTask) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-center text-gray-400">
        <Info size={40} className="mb-2 text-gray-300" />
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
      <header className="bg-white px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 sticky top-0 z-50">
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-50 rounded-lg transition-colors cursor-pointer shrink-0"
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
            <svg className="animate-spin h-7 w-7 text-gray-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[13px] text-gray-400 font-semibold">{t('global.loading')}</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-red-50 text-red-500 mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-[15px] font-bold text-gray-800 mb-1">{t('global.error')}</h3>
            <p className="text-[13px] text-gray-500 mb-4 px-4">{error}</p>
            <button
              onClick={() => loadTaskDetails() ?? loadTaskDetails(true)}
              className="px-4 py-2 rounded-lg bg-gray-800 text-white text-[13px] font-semibold hover:bg-gray-900 transition-all cursor-pointer"
            >
              {t('global.loading')}
            </button>
          </div>
        ) : (
          <div className="p-3.5 flex flex-col gap-3.5">
            {/* ── Request Info Collapsible Card ──────────────────────────────── */}
            <div className="overflow-hidden flex flex-col gap-2">
                {/* Request Info Box */}
                <div className="bg-white px-4 py-3 flex flex-col gap-3 text-[13px] rounded-md border border-[rgba(229,231,235,0.5)]">
                  <button
                    onClick={() => setIsRequestInfoExpanded(!isRequestInfoExpanded)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-[14px] font-bold text-gray-800">{t('workflow.request_info')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {detail?.processStatus || instanceData?.processInstance?.state || 'PENDING'}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform duration-200 ${
                          isRequestInfoExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isRequestInfoExpanded && (
                    <div className="flex flex-col gap-3 pt-1 border-t border-[rgba(243,244,246,0.6)] mt-1">
                      {/* Requester Info */}
                      <div className="flex gap-3">
                        <User size={16} className="text-gray-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-gray-400 font-medium block text-[11px]">{t('workflow.requested_by')}</span>
                          <span className="text-gray-800 font-semibold">
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
                              } else if (detail) {
                                nameStr = detail.createdBy || '—';
                              }
                              
                              return `${nameStr}${titleStr}`;
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Contact Email */}
                      {(contactInfo?.mail || instanceData?.requestor?.email) && (
                        <div className="flex gap-3">
                          <Mail size={16} className="text-gray-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span className="text-gray-400 font-medium block text-[11px]">{t('workflow.contact')}</span>
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
                        <Building2 size={16} className="text-gray-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-gray-400 font-medium block text-[11px]">{t('workflow.org_info')}</span>
                          <span className="text-gray-800 font-semibold">
                            {instanceData?.requestor?.employee 
                              ? `${instanceData.requestor.employee.department}, ${instanceData.requestor.employee.buName}` 
                              : (detail?.buName || '—')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>    

                {/* Current State Box */}
                <div className="bg-white px-4 py-3 flex flex-col gap-3 text-[13px] rounded-md border border-[rgba(229,231,235,0.5)]">
                  <button
                    onClick={() => setIsCurrentStateExpanded(!isCurrentStateExpanded)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-[14px] font-bold text-gray-800">{t('workflow.current_state')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                        Active
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform duration-200 ${
                          isCurrentStateExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isCurrentStateExpanded && (
                    <div className="flex flex-col gap-3 pt-1 border-t border-[rgba(243,244,246,0.6)] mt-1">
                      {/* Task name / Assignee */}
                      <div className="flex gap-3">
                        <UserCheck size={16} className="text-gray-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="font-semibold text-gray-800 block">{selectedTask.taskName}</span>
                          <p className="text-gray-500 mt-0.5 text-[12px]">
                            {t('workflow.assigned_to')} <span className="font-semibold text-gray-800">{selectedTask.assigneeInfo?.name || selectedTask.assignee || '—'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Task Started Date */}
                      <div className="flex gap-3">
                        <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-gray-400 font-medium block text-[11px]">{t('workflow.task_started_date')}</span>
                          <span className="text-gray-700 font-semibold">
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
                    ? 'bg-[rgba(6,62,137,0.8)] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 active:bg-gray-50'
                }`}
              >
                {t('workflow.data_form')}
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-full transition-all cursor-pointer ${
                  activeTab === 'activities'
                    ? 'bg-[rgba(6,62,137,0.8)] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 active:bg-gray-50'
                }`}
              >
                {t('workflow.activities')}
              </button>
              <button
                disabled={!hasAttachments}
                onClick={() => setActiveTab('attachments')}
                className={`flex-1 text-center py-2 text-[13px] font-bold rounded-full transition-all cursor-pointer ${
                  !hasAttachments
                    ? 'text-gray-500 cursor-not-allowed opacity-50'
                    : activeTab === 'attachments'
                    ? 'bg-[rgba(6,62,137,0.8)] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 active:bg-gray-50'
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
                <h3 className="text-[14px] font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  {t('workflow.workflow_timeline')}
                </h3>
                <div className="relative border-l border-gray-150 pl-5 ml-2.5 flex flex-col gap-6">
                  {instanceData.activities?.map((activity, idx) => (
                    <div key={activity.id || idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[27px] top-1.5 bg-white p-0.5 rounded-full z-10">
                        <span className="block w-2.5 h-2.5 rounded-full bg-gray-800 ring-[3px] ring-gray-100" />
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
              <div className="bg-white rounded-md border border-[rgba(229,231,235,0.6)] p-4 flex flex-col gap-3">
                <h3 className="text-[14px] font-bold text-gray-800 pb-2 border-b border-gray-100">
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
                          className="flex items-center justify-between p-2.5 rounded-lg border border-gray-150 bg-[rgba(249,250,251,0.5)] hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Paperclip size={16} className="text-gray-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span
                                // onClick={() => handlePreviewFile(file.fileId)}
                                className="text-[12px] font-semibold text-gray-700 block truncate hover:underline hover:text-blue-600 cursor-pointer"
                              >
                                {displayName}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate block">
                                Source: {file.activity}{displayType} · ID: {file.fileId.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                          <button
                            // onClick={() => handlePreviewFile(file.fileId)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 rounded-md transition-colors cursor-pointer shrink-0"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-[13px]">
                    <Paperclip size={28} className="mx-auto text-gray-300 mb-1.5" />
                    {t('workflow.no_attachments')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky Action Bottom Bar ─────────────────────────────────────── */}
      {!loading && !error && selectedTask && (() => {
        const prefix = selectedTask.instanceInfo.businessKey?.split('-')[0]?.toUpperCase() || '';
        const taskConfig = taskRegistry[prefix];
        const ActionsComponent = taskConfig?.Actions || DefaultActions;
        return (
          <ActionsComponent
            selectedTask={selectedTask}
            instanceData={instanceData}
            detail={detail}
            isClaiming={isClaiming}
            handleClaimToggle={handleClaimToggle}
            onActionSuccess={() => loadTaskDetails(true)}
          />
        );
      })()}
    </div>
  );
}
