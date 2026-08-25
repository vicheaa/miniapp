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
  ChevronDown,
  Eye,
  Download,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Loader2,
  X,
} from 'lucide-react';
import {
  fetchTaskInstanceData,
  fetchProcessFlowDetail,
  fetchBasicContactInfo,
  fetchFilesMetadata,
  fetchFileBlob,
  claimTask,
  unclaimTask,
} from '@/services/api/workflow-api';
import { taskRegistry } from './task/registry';
import DefaultActions from './task/DefaultActions';
import Header from '@/components/ui/Header';
import StatusBadge from '@/components/ui/StatusBadge';
import { TaskDetailSkeleton } from '@/components/ui/SkeletonLoader';
import BpmnDiagramModal from '@/components/workflow/BpmnDiagramModal';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { 
  BasicContactInfo, 
  FileMetadata, 
  TaskInstanceData,
} from '@/types/workflow-detail';
import { mapTaskInstanceDataToWorkflowTask } from '@/utils/workflow-mapper';

function getFileCategory(fileName = '', fileType = '') {
  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();

  if (
    lowerType.startsWith('image/') ||
    lowerType.includes('image') ||
    lowerType.includes('jpeg') ||
    lowerType.includes('png') ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(lowerName)
  ) {
    return 'image';
  }
  if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (lowerType.includes('word') || lowerType.includes('officedocument.wordprocessingml') || /\.(doc|docx)$/.test(lowerName)) {
    return 'word';
  }
  if (lowerType.includes('excel') || lowerType.includes('officedocument.spreadsheetml') || lowerType.includes('csv') || /\.(xls|xlsx|csv)$/.test(lowerName)) {
    return 'excel';
  }
  if (lowerType.includes('presentation') || lowerType.includes('powerpoint') || /\.(ppt|pptx)$/.test(lowerName)) {
    return 'powerpoint';
  }
  if (lowerType.includes('zip') || lowerType.includes('rar') || lowerType.includes('tar') || /\.(zip|rar|7z|gz|tar)$/.test(lowerName)) {
    return 'archive';
  }
  return 'unknown';
}

function getFileIcon(category: string, size = 16) {
  switch (category) {
    case 'image':
      return <FileImage size={size} className="text-blue-500 shrink-0" />;
    case 'pdf':
      return <FileText size={size} className="text-red-500 shrink-0" />;
    case 'word':
      return <FileText size={size} className="text-blue-600 shrink-0" />;
    case 'excel':
      return <FileSpreadsheet size={size} className="text-emerald-600 shrink-0" />;
    case 'powerpoint':
      return <FileText size={size} className="text-amber-500 shrink-0" />;
    case 'archive':
      return <FileArchive size={size} className="text-purple-500 shrink-0" />;
    default:
      return <Paperclip size={size} className="text-gray-400 shrink-0" />;
  }
}

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

  useEffect(() => {
    const syncTask = async () => {
      if (!taskId) return;
      if (selectedTask && selectedTask.taskId === taskId) return;

      const cacheData = queryClient.getQueryData<{ pages: { items: any[] }[] }>([
        'workflowTasks',
      ]);
      let foundTask = cacheData?.pages
        .flatMap((p) => p.items)
        .find((t) => t.taskId === taskId);

      if (!foundTask) {
        setIsSyncingTask(true);
        try {
          const instData = await queryClient.fetchQuery({
            queryKey: ['taskInstanceData', taskId],
            queryFn: () => fetchTaskInstanceData(taskId),
          });

          if (instData && (instData.task || instData.processInstance)) {
            foundTask = mapTaskInstanceDataToWorkflowTask(instData);
          }
        } catch (e) {
          console.error('[TaskDetailPage] Failed to fetch task instance data for sync:', e);
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

  useEffect(() => {
    if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
      (superApp as any).setPullToRefreshEnabled(false);
    }
    return () => {
      if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
        (superApp as any).setPullToRefreshEnabled(true);
      }
    };
  }, [superApp]);

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
      
      useWorkflowStore.setState({
        selectedTask: {
          ...selectedTask,
          claimed: !selectedTask.claimed
        }
      });
      
      queryClient.invalidateQueries({ queryKey: ['workflowTasks'] });
      
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instanceData, setInstanceData] = useState<TaskInstanceData | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [contactInfo, setContactInfo] = useState<BasicContactInfo | null>(null);
  const [filesMap, setFilesMap] = useState<Record<string, FileMetadata>>({});

  const [loadingFilesMap, setLoadingFilesMap] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const [isRequestInfoExpanded, setIsRequestInfoExpanded] = useState(true);
  const [isCurrentStateExpanded, setIsCurrentStateExpanded] = useState(true);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'data-form' | 'activities' | 'attachments'>('data-form');

  const hasAttachments = !!(instanceData?.attachmentFiles && instanceData.attachmentFiles.length > 0);

  const loadAttachmentFiles = useCallback(async () => {
    if (!instanceData?.attachmentFiles || instanceData.attachmentFiles.length === 0) return;
    const fileIds = instanceData.attachmentFiles.map((f) => f.fileId).filter(Boolean);
    if (fileIds.length === 0) return;

    setLoadingFilesMap(true);
    try {
      const metadataList = await fetchFilesMetadata(fileIds);
      const map: Record<string, FileMetadata> = {};
      metadataList.forEach((item) => {
        if (item && item.id) {
          map[item.id] = item;
        }
      });
      setFilesMap((prev) => ({ ...prev, ...map }));
    } catch (err) {
      console.error('Failed to load attachment files metadata:', err);
    } finally {
      setLoadingFilesMap(false);
    }
  }, [instanceData]);

  useEffect(() => {
    if (activeTab === 'attachments') {
      loadAttachmentFiles();
    }
  }, [activeTab, loadAttachmentFiles]);

  useEffect(() => {
    if (!hasAttachments && activeTab === 'attachments') {
      setActiveTab('data-form');
    }
  }, [hasAttachments, activeTab]);

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    if (downloadingFileId) return;
    setDownloadingFileId(fileId);
    try {
      const fileMeta = filesMap[fileId];
      const blob = await fetchFileBlob(fileId, fileMeta);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if (superApp) {
        superApp.showToast(`Downloaded ${fileName}`);
      }
    } catch (err: any) {
      console.error('Failed to download file:', err);
      if (superApp) {
        superApp.showToast(`Download failed: ${err.message || err}`);
      } else {
        alert(`Download failed: ${err.message || err}`);
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handlePreviewFile = async (fileMeta: FileMetadata) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(fileMeta);
    setPreviewUrl(null);
    setPreviewError(null);

    const category = getFileCategory(fileMeta.fileName, fileMeta.fileType);
    if (category === 'image' || category === 'pdf') {
      setLoadingPreview(true);
      try {
        const blob = await fetchFileBlob(fileMeta.id, fileMeta);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (err: any) {
        console.error('Failed to fetch preview blob:', err);
        setPreviewError(err?.message || 'Failed to fetch image stream from server.');
      } finally {
        setLoadingPreview(false);
      }
    }
  };

  const closePreviewModal = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };
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
        if (force) {
          queryClient.invalidateQueries({ queryKey: ['taskInstanceData', selectedTask.taskId] });
        }
        instData = await queryClient.fetchQuery({
          queryKey: ['taskInstanceData', selectedTask.taskId],
          queryFn: () => fetchTaskInstanceData(selectedTask.taskId),
        });
        setInstanceData(instData);
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

  const handleBack = () => {
    navigate('/');
  };
  const renderDataFormContent = () => {
    if (!selectedTask) return null;

    const key = selectedTask.instanceInfo.businessKey || '';
    const prefix = key.split('-')[0]?.toUpperCase() || '';
    const taskConfig = taskRegistry[prefix];

    if (taskConfig && detail) {
      const FormComponent = taskConfig.Form;
      return <FormComponent selectedTask={selectedTask} instanceData={instanceData} detail={detail} />;
    }

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

      <Header
        title={selectedTask?.instanceInfo.businessKey || t('workflow.detail')}
        subtitle={selectedTask?.instanceInfo.processName || ''}
        onBack={handleBack}
        backTitle="Back"
      />

      <div className="flex-1 overflow-y-auto pb-4 flex flex-col">
        {showContentLoading ? (
          <TaskDetailSkeleton />
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
          <div className="p-3.5 flex flex-col gap-3.5 slide-up">
            <div className="overflow-hidden flex flex-col gap-2">
                <div className="bg-white px-4 py-3 flex flex-col gap-3 text-[13px] rounded-md border border-[rgba(229,231,235,0.5)]">
                  <button
                    onClick={() => setIsRequestInfoExpanded(!isRequestInfoExpanded)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-[14px] font-bold text-gray-800">{t('workflow.request_info')}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={instanceData?.task?.workflowStatus || selectedTask?.workflowStatus || detail?.processStatus || instanceData?.processInstance?.state || 'PENDING'} />
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
                      <StatusBadge status={(instanceData?.task?.completed ?? selectedTask?.completed) ? 'COMPLETED' : 'ACTIVE'} />
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

                      {/* View BPMN Diagram Button */}
                      <button
                        type="button"
                        onClick={() => setIsDiagramOpen(true)}
                        className="mt-1 flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg text-[13px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 transition-colors cursor-pointer border border-blue-100/80"
                      >
                        <Eye size={15} />
                        <span>{t('workflow.view_diagram')}</span>
                      </button>
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
            
            {/* Data render */}
            {activeTab === 'data-form' && renderDataFormContent()}
            
            {/* Activities render */}
            {activeTab === 'activities' && instanceData && (
              <div className="bg-white rounded-md p-4">
                <h3 className="text-[14px] font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  {t('workflow.workflow_timeline')}
                </h3>
                <div className="relative border-l border-gray-150 pl-5 ml-2.5 flex flex-col gap-6">
                  {instanceData.activities?.map((activity, idx) => (
                    <div key={activity.id || idx} className="relative">
                      <span className="absolute -left-[27px] top-1.5 bg-white p-0.5 rounded-full z-10">
                        <span className="block w-2.5 h-2.5 rounded-full bg-gray-800 ring-[3px] ring-gray-100" />
                      </span>

                      <div className="flex items-baseline gap-2 text-[12px] justify-between">
                        <span className="font-semibold">
                          {activity.taskName}
                        </span>
                        <span className="ml-3 font-medium">
                          {formatDateTimeCompact(activity.actionDate)}
                        </span>
                      </div>

                      <p className="text-[12px] mt-0.5">
                        {activity.action} by <span className="font-semibold">{activity.actionBy}</span>
                      </p>

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

            {/* Attachments tab */}
            {activeTab === 'attachments' && instanceData && (
              <div className="bg-white rounded-md border border-[rgba(229,231,235,0.6)] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h3 className="text-[14px] font-bold text-gray-800">
                    {t('workflow.attachments')}
                  </h3>
                  {instanceData.attachmentFiles && (
                    <span className="text-[11px] font-semibold text-gray-450">
                      {instanceData.attachmentFiles.length} file(s)
                    </span>
                  )}
                </div>

                {loadingFilesMap ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
                    <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
                    <span className="text-[12px] font-medium">Loading attachments info...</span>
                  </div>
                ) : instanceData.attachmentFiles && instanceData.attachmentFiles.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {instanceData.attachmentFiles.map((file, idx) => {
                      const fileMeta = filesMap[file.fileId];
                      const fileName = fileMeta?.fileName || `Attachment ${idx + 1}`;
                      const category = getFileCategory(fileName, fileMeta?.fileType || '');
                      const isDownloading = downloadingFileId === file.fileId;

                      return (
                        <div
                          key={file.fileId || idx}
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-150 bg-[rgba(249,250,251,0.6)] hover:bg-gray-50 transition-all gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg bg-gray-100/80 flex items-center justify-center shrink-0">
                              {getFileIcon(category, 18)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span
                                onClick={() => {
                                  if (fileMeta) {
                                    handlePreviewFile(fileMeta);
                                  } else {
                                    handleDownloadFile(file.fileId, fileName);
                                  }
                                }}
                                className="text-[12.5px] font-semibold text-gray-800 block truncate hover:underline hover:text-blue-600 cursor-pointer"
                              >
                                {fileName}
                              </span>
                              <span className="text-[10.5px] text-gray-450 truncate block mt-0.5">
                                {file.activity ? `Activity: ${file.activity} · ` : ''}
                                {category.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Preview button */}
                            {fileMeta && (category === 'image' || category === 'pdf') && (
                              <button
                                type="button"
                                onClick={() => handlePreviewFile(fileMeta)}
                                title="Preview file"
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye size={15} />
                              </button>
                            )}

                            {/* Download button */}
                            <button
                              type="button"
                              disabled={isDownloading}
                              onClick={() => handleDownloadFile(file.fileId, fileName)}
                              title="Download file"
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isDownloading ? (
                                <Loader2 size={15} className="animate-spin text-blue-600" />
                              ) : (
                                <Download size={15} />
                              )}
                            </button>
                          </div>
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

      {/* Action Bottom Bar */}
      {!loading && !error && selectedTask && !selectedTask.completed && !instanceData?.processInstance?.completed && (() => {
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

      {/* BPMN Diagram Modal */}
      <BpmnDiagramModal
        open={isDiagramOpen}
        onClose={() => setIsDiagramOpen(false)}
        procInstId={instanceData?.processInstance?.procInstId || selectedTask?.instanceInfo?.processInstanceId || null}
      />

      {/* File Preview Drawer */}
      {previewFile && (
        <Drawer open={!!previewFile} onOpenChange={(open) => !open && closePreviewModal()}>
          <DrawerContent
            className="max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
              <div className="min-w-0 pr-3">
                <DrawerTitle className="text-[15px] font-bold text-gray-800 truncate">
                  {previewFile.fileName}
                </DrawerTitle>
                <span className="text-[11px] text-gray-400 font-medium block mt-0.5 truncate">
                  {previewFile.fileType || getFileCategory(previewFile.fileName, previewFile.fileType).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewFile.id, previewFile.fileName)}
                  className="p-2 text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[12px] font-bold"
                >
                  <Download size={15} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={closePreviewModal}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-gray-50/50 min-h-[280px]">
              {loadingPreview ? (
                <div className="flex flex-col items-center gap-2 text-gray-400 py-12">
                  <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
                  <span className="text-[12px] font-medium">Loading preview...</span>
                </div>
              ) : previewUrl ? (
                getFileCategory(previewFile.fileName, previewFile.fileType) === 'image' ? (
                  <img
                    src={previewUrl}
                    alt={previewFile.fileName}
                    className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-sm"
                    onError={() => {
                      setPreviewError('Failed to display image. The image format might be invalid or restricted.');
                      setPreviewUrl(null);
                    }}
                  />
                ) : (
                  <iframe
                    src={previewUrl}
                    title={previewFile.fileName}
                    className="w-full h-[68vh] rounded-lg border border-gray-200"
                  />
                )
              ) : (
                <div className="text-center p-6 flex flex-col items-center gap-3 max-w-[340px] mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    {getFileIcon(getFileCategory(previewFile.fileName, previewFile.fileType), 28)}
                  </div>
                  <div>
                    <span className="text-[13.5px] font-bold text-gray-800 block">
                      {previewFile.fileName}
                    </span>
                    <span className="text-[11.5px] text-gray-500 block mt-1">
                      {previewError || `${getFileCategory(previewFile.fileName, previewFile.fileType).toUpperCase()} document`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(previewFile.id, previewFile.fileName)}
                    className="mt-1 px-4 py-2 bg-[#063E89] hover:opacity-90 active:scale-[0.98] text-white font-bold text-[12.5px] rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download size={15} />
                    Download File
                  </button>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
