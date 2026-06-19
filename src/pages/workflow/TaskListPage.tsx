import {
  useState,
  useRef,
  useCallback,
  useEffect
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Users,
  Ban,
  User,
  SendHorizontal,
  UserCheck,
  Search
} from 'lucide-react';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Header from '@/components/ui/Header';
import { TaskListSkeleton } from '@/components/ui/SkeletonLoader';
import { 
  Drawer, 
  DrawerContent, 
  DrawerTitle, 
  DrawerDescription 
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import TaskCard from '@/components/workflow/TaskCard';
import { useWorkflowStore } from '@/store/workflowStore';
import { useMiniAppStore } from '@/store/miniAppStore';
import { useWorkflowTasksInfiniteQuery } from '@/hooks/useWorkflowQuery';
import { claimTask } from '@/services/api/workflow-api';
import { useTranslation } from '@/hooks/useTranslation';
import type { WorkflowTask } from '@/types/workflow';

/* ── Loading Spinner ───────────────────────────────────────────────────── */

function LoadingMore({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex items-center justify-center py-5 gap-2">
      <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-[12px] text-slate-400 font-medium">{t('workflow.loading_more')}</span>
    </div>
  );
}

/* ── Page Component ────────────────────────────────────────────────────── */

export default function TaskListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ── Hooks & Store ────────────────────────────────────────────────────────
  const superApp = useMiniAppStore((s) => s.superApp);
  const searchQuery = useWorkflowStore((s) => s.searchQuery);
  const setSearchQuery = useWorkflowStore((s) => s.setSearchQuery);
  const setSelectedTask = useWorkflowStore((s) => s.setSelectedTask);

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWorkflowTasksInfiniteQuery();

  // ── Local State ──────────────────────────────────────────────────────────
  const [activeMenuTask, setActiveMenuTask] = useState<WorkflowTask | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Flatten all pages into a single task list
  const allTasks = data?.pages.flatMap((p) => p.items) || [];
  const total = data?.pages[0]?.total || 0;

  // API-side filtering: allTasks are already filtered by the API search value
  const filteredTasks = allTasks;

  // ── Claim / Unclaim Action ──────────────────────────────────────────────
  const handleClaimToggle = async (task: WorkflowTask) => {
    setIsClaiming(true);
    const actionLabel = task.claimed ? 'Unclaim' : 'Claim';
    try {
      await claimTask(task.taskId);
      superApp?.showToast(`Task ${actionLabel.toLowerCase()}ed successfully`);
      refetch();
    } catch (err: any) {
      console.error(`Failed to ${actionLabel.toLowerCase()} task:`, err);
      superApp?.showToast(`Failed to ${actionLabel.toLowerCase()} task: ${err.message || err}`);
    } finally {
      setIsClaiming(false);
      closeMenu();
    }
  };

  // ── Drawer Menu Actions ──────────────────────────────────────────────────
  const openMenu = (task: WorkflowTask) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveMenuTask(task);
    setIsDrawerOpen(true);
  };

  const closeMenu = () => {
    setIsDrawerOpen(false);
  };

  const handleTaskClick = (task: WorkflowTask) => {
    setSelectedTask(task);
    navigate(`/task/${task.taskId}`);
  };

  // Enable/disable pull-to-refresh depending on drawer state
  useEffect(() => {
    if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
      (superApp as any).setPullToRefreshEnabled(!isDrawerOpen);
    }
    return () => {
      if (superApp && typeof (superApp as any).setPullToRefreshEnabled === 'function') {
        (superApp as any).setPullToRefreshEnabled(true);
      }
    };
  }, [isDrawerOpen, superApp]);

  // ── Infinite Scroll Observer ─────────────────────────────────────────────
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: '200px',
      threshold: 0,
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-slate-100 h-full overflow-hidden flex flex-col box-border">
      {/* Header */}
      {superApp && (
        <Header
          title={t('workflow.title')}
          onBack={() => superApp.close()}
          backTitle="Close Mini App"
        />
      )}

      {/* Search Bar */}
      <div className="bg-white px-4 pt-3 pb-3 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          <Input
            type="text"
            placeholder={t('workflow.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 bg-slate-50 rounded-[10px] pl-9 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Task Count */}
      {!isLoading && !error && total > 0 && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-between shrink-0">
          <span className="text-[12px] text-slate-400 font-medium">
            {filteredTasks.length} / {total} {t('home.my_tasks')}
          </span>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-3 pt-1 overflow-y-auto">
        {isLoading ? (
          <TaskListSkeleton />
        ) : error ? (
          <ErrorState
            message={(error as Error).message || 'Failed to fetch tasks'}
            onRetry={refetch}
          />
        ) : filteredTasks.length === 0 ? (
          <EmptyState message={t('workflow.no_tasks')} />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onClick={() => handleTaskClick(task)}
                onEllipsisClick={() => openMenu(task)}
                t={t}
              />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading indicator */}
            {isFetchingNextPage && <LoadingMore t={t} />}

            {/* End of list */}
            {!hasNextPage && allTasks.length > 0 && (
              <div className="text-center py-4">
                <span className="text-[12px] text-slate-400 font-medium">{t('workflow.no_more_tasks')}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Drawer Menu */}
      <Drawer open={isDrawerOpen} onOpenChange={(open) => { if (!open) closeMenu(); }} onClose={() => setActiveMenuTask(null)}>
        <DrawerContent className="max-w-[480px] mx-auto pb-8">
          {activeMenuTask && (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  handleTaskClick(activeMenuTask);
                  closeMenu();
                }}
                className="flex items-center gap-3.5 w-full px-6 py-[13px] cursor-pointer"
              >
                <Eye size={18} className='text-gray-600' />
                <span className="text-[15px] font-medium">{t('workflow.detail')}</span>
              </button>

              <button
                type="button"
                onClick={() => { superApp?.showToast('Approvers'); closeMenu(); }}
                className="flex items-center gap-3.5 w-full px-6 py-[13px] cursor-pointer"
              >
                <Users size={18} className='text-gray-600' />
                <span className="text-[15px] font-medium">{t('workflow.approvers')}</span>
              </button>

              <button
                type="button"
                disabled={isClaiming}
                onClick={() => handleClaimToggle(activeMenuTask)}
                className="flex items-center gap-3.5 w-full px-6 py-[13px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activeMenuTask.claimed ? (
                  <>
                    <Ban size={18} className='text-gray-600' />
                    <span className="text-[15px] font-medium">{t('workflow.unclaim')}</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={18} className='text-gray-600' />
                    <span className="text-[15px] font-medium">{t('workflow.claim')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  superApp?.showToast('Assign');
                  closeMenu();
                }}
                className="flex items-center gap-3.5 w-full px-6 py-[13px] cursor-pointer"
              >
                <User size={18} className='text-gray-600' />
                <span className="text-[15px] font-medium">{t('workflow.assign')}</span>
              </button>

              {/* Separator */}
              <div className="h-[1px] bg-slate-100 my-1.5 mx-6" />

              {/* Dynamic Actions */}
              {(() => {
                const actions =
                  activeMenuTask.actions && activeMenuTask.actions.length > 0
                    ? activeMenuTask.actions
                    : [{ name: 'Complete', value: 'Completed' }];

                return actions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      superApp?.showToast(`Completed task: ${activeMenuTask.instanceInfo.businessKey}`);
                      closeMenu();
                    }}
                    className="flex items-center gap-3.5 w-full px-6 py-[13px] cursor-pointer"
                  >
                    <SendHorizontal size={18} className='text-gray-600' />
                    <span className="text-[15px] font-medium">{act.name}</span>
                  </button>
                ));
              })()}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}