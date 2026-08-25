import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useMiniAppStore } from '@/store/miniAppStore';
import { useBudgetReviewStore } from '@/store/budgetReviewStore';
import { workflowRepository } from '@/repositories/workflow.repository';
import { ProcessFlowDetail } from '@/types/workflow-detail';
import { AvailableUser } from '@/services/api/workflow-api';

interface UsePurchaseRequisitionProps {
  selectedTask: any;
  instanceData: any;
  detail: ProcessFlowDetail;
  isClaiming: boolean;
  handleClaimToggle: () => Promise<void>;
  onActionSuccess: () => void;
}

export function usePurchaseRequisition({
  selectedTask,
  instanceData,
  detail,
  onActionSuccess,
}: UsePurchaseRequisitionProps) {
  const { t } = useTranslation();
  const superApp = useMiniAppStore((s) => s.superApp);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isActivitiesExpanded, setIsActivitiesExpanded] = useState(false);
  const [currentAction, setCurrentAction] = useState('Completed');
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);

  // Comment action state
  const [isCommentOpen, setCommentOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingAvailableUsers, setLoadingAvailableUsers] = useState(false);
  const [assignToUser, setAssignToUser] = useState('');

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
    const isAnyDrawerOpen = isApprovalOpen || isBudgetReviewOpen || isCommentOpen;
    if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
      (superApp as any).setPullToRefreshEnabled(!isAnyDrawerOpen);
    }
    return () => {
      if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
        (superApp as any).setPullToRefreshEnabled(true);
      }
    };
  }, [isApprovalOpen, isBudgetReviewOpen, isCommentOpen, superApp]);

  // Reset window scroll when drawers are open to prevent keyboard from panning/scrolling the layout viewport
  useEffect(() => {
    const isAnyDrawerOpen = isApprovalOpen || isBudgetReviewOpen || isCommentOpen;
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
  }, [isApprovalOpen, isBudgetReviewOpen, isCommentOpen]);

  // Visual viewport height adjustments and input focus handling
  useEffect(() => {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const handleResize = () => {
      setVisualViewportHeight(vv ? vv.height : null);
    };
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    handleResize();

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT')
      ) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      }
    };
    window.addEventListener('focusin', handleFocusIn);

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      addReviewFiles(filesArray);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    removeReviewFile(index);
  };

  const handleCloseReview = () => {
    resetReviewStore();
  };

  const loadBudgetCodesForReview = async (currentDetail: ProcessFlowDetail) => {
    if (currentDetail?.deptId != null && currentDetail?.buId != null) {
      setLoadingBudgetCodes(true);
      try {
        const codes = await workflowRepository.fetchBudgetCodes(
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
      loadBudgetCodesForReview(detail);
    }
  };

  const openApprovalReview = (actionName: string) => {
    resetReviewStore();
    const act = selectedTask?.actions?.find(
      (a: any) =>
        a.name?.toLowerCase() === actionName.toLowerCase() ||
        a.value?.toLowerCase() === actionName.toLowerCase()
    );
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
        currentDetail = await workflowRepository.fetchProcessFlowDetail(
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
    if (!selectedTask || !detail || isSubmittingReview) return;

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
        const uploadRes = await workflowRepository.uploadFiles(reviewFiles);
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

      await workflowRepository.completeTask(payload);

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
    if (!selectedTask || isSubmittingReview) return;

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
        const uploadRes = await workflowRepository.uploadFiles(reviewFiles);
        fileIds = uploadRes.map((f) => f.fileId);
      }

      const actionLower = currentAction.toLowerCase();
      const isConsented = actionLower === 'consented';
      const isReject = actionLower === 'reject' || actionLower === 'rejected';
      const isSimpleAction = isConsented || isReject;

      const payloadType =
        selectedTask.payloadType ||
        (isSimpleAction ? 'requisition_omm_dmbo_1' : 'requisition_fin');

      const payloadData =
        isSimpleAction || !detail
          ? selectedTask.payloadData || {}
          : {
              id: detail.id,
              items:
                detail.items?.map((item) => ({
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
            };

      const payload = {
        action: currentAction,
        payloadType,
        taskId: selectedTask.taskId,
        payloadData,
        comment: reviewComment,
        uploadedFiles: fileIds,
        fetchCurrentTask: false,
      };

      await workflowRepository.completeTask(payload);

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

  const openCommentReview = async (actionName: string) => {
    resetReviewStore();
    setAssignToUser('');
    const act = selectedTask?.actions?.find(
      (a: any) =>
        a.name?.toLowerCase() === actionName.toLowerCase() ||
        a.value?.toLowerCase() === actionName.toLowerCase()
    );
    setCurrentAction(act?.value || actionName);
    setCommentOpen(true);

    const procInstId =
      selectedTask?.instanceInfo?.processInstanceId ||
      instanceData?.processInstance?.procInstId;

    if (procInstId) {
      setLoadingAvailableUsers(true);
      try {
        const users = await workflowRepository.fetchAvailableUsers(procInstId);
        setAvailableUsers(users || []);
      } catch (err: any) {
        console.error('Failed to load available users:', err);
        if (superApp) {
          superApp.showToast(`Failed to load available users: ${err.message || err}`);
        }
      } finally {
        setLoadingAvailableUsers(false);
      }
    }
  };

  const handleResetComment = () => {
    resetReviewStore();
    setAssignToUser('');
  };

  const handleSubmitComment = async () => {
    if (!selectedTask || isSubmittingReview) return;

    if (!assignToUser) {
      if (superApp) {
        superApp.showToast('Please select a user to assign to.');
      } else {
        alert('Please select a user to assign to.');
      }
      return;
    }

    if (!reviewComment.trim()) {
      if (superApp) {
        superApp.showToast('Please enter remarks.');
      } else {
        alert('Please enter remarks.');
      }
      return;
    }

    setSubmittingReview(true);
    try {
      let fileIds: string[] = [];
      if (reviewFiles.length > 0) {
        const uploadRes = await workflowRepository.uploadFiles(reviewFiles);
        fileIds = uploadRes.map((f) => f.fileId);
      }

      const payload = {
        action: currentAction || 'Comment',
        payloadType: selectedTask.payloadType || 'requisition_omm_dmbo_1',
        taskId: selectedTask.taskId,
        payloadData: {
          assignTo: assignToUser,
        },
        comment: reviewComment,
        uploadedFiles: fileIds,
        fetchCurrentTask: false,
      };

      await workflowRepository.completeTask(payload);

      if (superApp) {
        superApp.showToast('Comment submitted successfully');
      } else {
        alert('Comment submitted successfully');
      }

      resetReviewStore();
      setAssignToUser('');
      setCommentOpen(false);
      onActionSuccess();
      queryClient.invalidateQueries({ queryKey: ['workflowTasks'] });
      navigate('/');
    } catch (err: any) {
      console.error('Failed to submit comment:', err);
      if (superApp) {
        superApp.showToast(
          `Failed to submit comment: ${err.message || err}`
        );
      } else {
        alert(`Failed to submit comment: ${err.message || err}`);
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

    if (actionName.toLowerCase() === 'comment') {
      openCommentReview(actionName);
      return;
    }

    openApprovalReview(actionName);
  };

  const actions = selectedTask?.actions || [];

  return {
    t,
    actions,
    isActivitiesExpanded,
    setIsActivitiesExpanded,
    isApprovalOpen,
    setApprovalOpen,
    isBudgetReviewOpen,
    setBudgetReviewOpen,
    isCommentOpen,
    setCommentOpen,
    availableUsers,
    loadingAvailableUsers,
    assignToUser,
    setAssignToUser,
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
    handleResetComment,
    handleSubmitReview,
    handleSubmitApproval,
    handleSubmitComment,
    handleAction,
    updateReviewItemBudgetCode,
  };
}
