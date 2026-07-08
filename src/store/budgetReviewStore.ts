import { create } from 'zustand';
import { BudgetCode } from '../types/workflow-detail';

interface BudgetReviewState {
  isBudgetReviewOpen: boolean;
  isApprovalOpen: boolean;
  budgetCodes: BudgetCode[];
  loadingBudgetCodes: boolean;
  reviewItems: any[];
  reviewComment: string;
  reviewFiles: File[];
  isSubmittingReview: boolean;

  setBudgetReviewOpen: (open: boolean) => void;
  setApprovalOpen: (open: boolean) => void;
  setBudgetCodes: (codes: BudgetCode[]) => void;
  setLoadingBudgetCodes: (loading: boolean) => void;
  setReviewItems: (items: any[]) => void;
  updateReviewItemBudgetCode: (index: number, budgetCode: string) => void;
  setReviewComment: (comment: string) => void;
  addReviewFiles: (files: File[]) => void;
  removeReviewFile: (index: number) => void;
  setSubmittingReview: (submitting: boolean) => void;
  resetReviewStore: () => void;
}

export const useBudgetReviewStore = create<BudgetReviewState>((set) => ({
  isBudgetReviewOpen: false,
  isApprovalOpen: false,
  budgetCodes: [],
  loadingBudgetCodes: false,
  reviewItems: [],
  reviewComment: '',
  reviewFiles: [],
  isSubmittingReview: false,

  setBudgetReviewOpen: (open) => set({ isBudgetReviewOpen: open }),
  setApprovalOpen: (open) => set({ isApprovalOpen: open }),
  setBudgetCodes: (codes) => set({ budgetCodes: codes }),
  setLoadingBudgetCodes: (loading) => set({ loadingBudgetCodes: loading }),
  setReviewItems: (items) => set({ reviewItems: items }),
  updateReviewItemBudgetCode: (index, budgetCode) =>
    set((state) => ({
      reviewItems: state.reviewItems.map((item, idx) =>
        idx === index ? { ...item, budgetCode } : item
      ),
    })),
  setReviewComment: (comment) => set({ reviewComment: comment }),
  addReviewFiles: (files) =>
    set((state) => ({ reviewFiles: [...state.reviewFiles, ...files] })),
  removeReviewFile: (index) =>
    set((state) => ({
      reviewFiles: state.reviewFiles.filter((_, idx) => idx !== index),
    })),
  setSubmittingReview: (submitting) => set({ isSubmittingReview: submitting }),
  resetReviewStore: () =>
    set({
      isBudgetReviewOpen: false,
      budgetCodes: [],
      loadingBudgetCodes: false,
      reviewItems: [],
      reviewComment: '',
      reviewFiles: [],
      isSubmittingReview: false,
    }),
}));
