import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useMiniAppStore } from '@/store/miniAppStore';
import { useBudgetReviewStore } from '@/store/budgetReviewStore';
import { workflowRepository } from '@/repositories/workflow.repository';
import { ProcessFlowDetail } from '@/types/workflow-detail';

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

  // Visual viewport height adjustments and input focus handling
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
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT')
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
        const uploadRes = await workflowRepository.uploadFiles(reviewFiles);
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

  return {
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
  };
}
