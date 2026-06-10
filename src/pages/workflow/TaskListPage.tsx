import { useState, useRef, useCallback, useEffect } from 'react';
import { formatDateCompact } from '../../utils/format';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Header from '../../components/ui/Header';
import { TaskListSkeleton } from '../../components/ui/SkeletonLoader';
import BottomSheet from '../../components/ui/BottomSheet';
import { useWorkflowStore } from '../../store/workflowStore';
import { useWorkflowTasksInfiniteQuery } from '../../hooks/useWorkflowQuery';
import type { WorkflowTask } from '../../types/workflow';
import { Ellipsis, Eye, Workflow, Users, Ban, User, SendHorizontal } from 'lucide-react';

/* ── Dynamic field helpers ─────────────────────────────────────────────── */

/**
 * Build dynamic detail rows based on the businessKey prefix / process type.
 * Returns an array of { label, value } pairs to render in the card.
 */
function getTaskDetailRows(task: WorkflowTask): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const key = task.instanceInfo.businessKey || '';
  const prefix = key.split('-')[0]?.toUpperCase();

  // --- Dynamic rows based on process / businessKey prefix ---

  // Purchase Requisition → show Total Amount from workflowAttrs
  if (prefix === 'PR') {
    const amountAttr = task.instanceInfo.workflowAttrs?.find((a) => a.name === 'amount');
    if (amountAttr?.decimalValue != null) {
      rows.push({
        label: 'Total Amount',
        value: `$${amountAttr.decimalValue.toFixed(2)}`,
      });
    }
  }

  // Always show Requestor
  rows.push({
    label: 'Requestor',
    value: task.owner || '—',
  });

  // Always show Task Name
  rows.push({
    label: 'Task Name',
    value: task.taskName,
  });

  // Always show Assignee
  rows.push({
    label: 'Assignee',
    value: task.assigneeInfo?.name || task.assignee || '—',
  });

  // Always show Created At
  rows.push({
    label: 'Created At',
    value: formatDateCompact(task.created),
  });

  return rows;
}

/* ── Task Card ─────────────────────────────────────────────────────────── */

function TaskCard({
  task,
  onClick,
  onEllipsisClick,
}: {
  task: WorkflowTask;
  onClick: () => void;
  onEllipsisClick: () => void;
}) {
  const rows = getTaskDetailRows(task);

  return (
    <div
      className="bg-white rounded-[14px] px-[18px] py-4 border border-slate-200/80 cursor-pointer transition-all duration-200 active:scale-[0.99] active:bg-slate-50"
      onClick={onClick}
    >
      {/* Title: BusinessKey · Process Name */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-[15px] font-bold text-slate-900 shrink-0">
          {task.instanceInfo.businessKey}
        </span>
        <span className="text-[13px] text-slate-400 font-medium">·</span>
        <span className="text-[13px] font-semibold text-slate-500 italic truncate">
          {task.instanceInfo.processName}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEllipsisClick();
          }}
          className="ml-auto self-center flex items-center justify-center p-1.5 -m-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 active:bg-slate-100 transition-colors"
        >
          <Ellipsis size={18} className="shrink-0" />
        </button>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col gap-[7px]">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] text-slate-400 font-medium shrink-0">{row.label}</span>
            <span className="text-[13px] text-slate-700 font-medium text-right truncate">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Filter Tabs ───────────────────────────────────────────────────────── */

type FilterKey = 'ALL' | 'HIGH_PRIORITY' | 'SUB_TASKS';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All Tasks' },
  { key: 'HIGH_PRIORITY', label: 'High Priority' },
  { key: 'SUB_TASKS', label: 'With Sub-tasks' },
];

/* ── Loading Spinner ───────────────────────────────────────────────────── */

function LoadingMore() {
  return (
    <div className="flex items-center justify-center py-5 gap-2">
      <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-[12px] text-slate-400 font-medium">Loading more…</span>
    </div>
  );
}

/* ── Page Component ────────────────────────────────────────────────────── */

export default function TaskListPage() {
  const superApp = useWorkflowStore((s) => s.superApp);
  const searchQuery = useWorkflowStore((s) => s.searchQuery);
  const setSearchQuery = useWorkflowStore((s) => s.setSearchQuery);
  const setSelectedTask = useWorkflowStore((s) => s.setSelectedTask);
  const setView = useWorkflowStore((s) => s.setView);

  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');

  /* ── Bottom Sheet State & Logic ────────────────────────────────────────── */
  const [activeMenuTask, setActiveMenuTask] = useState<WorkflowTask | null>(null);
  const [isAnimateOpen, setIsAnimateOpen] = useState(false);

  const openMenu = (task: WorkflowTask) => {
    setActiveMenuTask(task);
    setTimeout(() => {
      setIsAnimateOpen(true);
    }, 10);
  };

  const closeMenu = () => {
    setIsAnimateOpen(false);
    setTimeout(() => {
      setActiveMenuTask(null);
    }, 250);
  };

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWorkflowTasksInfiniteQuery();

  // Flatten all pages into a single task list
  const allTasks = data?.pages.flatMap((p) => p.items) || [];
  const total = data?.pages[0]?.total || 0;

  // Client-side search + filter
  const filteredTasks = allTasks.filter((t) => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        t.taskName.toLowerCase().includes(q) ||
        t.instanceInfo.businessKey.toLowerCase().includes(q) ||
        t.instanceInfo.processName.toLowerCase().includes(q) ||
        (t.assigneeInfo?.name || '').toLowerCase().includes(q) ||
        (t.owner || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // Filter tabs
    if (activeFilter === 'HIGH_PRIORITY') return t.priority > 50;
    if (activeFilter === 'SUB_TASKS') return t.subTasks.length > 0 || t.subTask;

    return true;
  });

  // ── Infinite scroll via IntersectionObserver ──────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

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
      rootMargin: '200px', // trigger 200px before reaching the bottom
      threshold: 0,
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [handleIntersect]);

  const handleTaskClick = (task: WorkflowTask) => {
    setSelectedTask(task);
    setView('task-detail');
  };

  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-slate-50 h-screen overflow-y-auto flex flex-col box-border">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      {superApp && (
        <Header
          title="Workflow"
          onBack={() => superApp.close()}
          onRefresh={() => refetch()}
          refreshing={isFetching && !isFetchingNextPage}
          backTitle="Close Mini App"
        />
      )}

      {/* ── Search Bar + Filter Tabs ──────────────────────────────────── */}
      <div className="bg-white px-4 pt-3 pb-3 border-b border-slate-100 sticky top-[52px] z-[99]">
        <div className="relative">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search tasks, keys, requestors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-[10px] pl-9 pr-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-3">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`shrink-0 px-4 py-[7px] rounded-full text-[13px] font-semibold border cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 active:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Task Count ──────────────────────────────────────────────────── */}
      {!isLoading && !error && total > 0 && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[12px] text-slate-400 font-medium">
            {filteredTasks.length} of {total} tasks
          </span>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 p-3 pt-1">
        {isLoading ? (
          <TaskListSkeleton />
        ) : error ? (
          <ErrorState
            message={(error as Error).message || 'Failed to fetch tasks'}
            onRetry={refetch}
          />
        ) : filteredTasks.length === 0 ? (
          <EmptyState message="No pending tasks found." />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onClick={() => handleTaskClick(task)}
                onEllipsisClick={() => openMenu(task)}
              />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading indicator */}
            {isFetchingNextPage && <LoadingMore />}

            {/* End of list */}
            {!hasNextPage && allTasks.length > 0 && (
              <div className="text-center py-4">
                <span className="text-[12px] text-slate-400 font-medium">No more tasks</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom Sheet Drawer Overlay ────────────────────────────────────── */}
      <BottomSheet isOpen={isAnimateOpen} onClose={closeMenu}>
        {activeMenuTask && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => {
                handleTaskClick(activeMenuTask);
                closeMenu();
              }}
              className="flex items-center gap-3.5 w-full px-6 py-[13px] text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100/80 transition-colors cursor-pointer"
            >
              <Eye size={18} className="text-slate-400 shrink-0" />
              <span className="text-[15px] font-medium">Detail</span>
            </button>

            <button
              type="button"
              onClick={() => {
                superApp?.showToast('View Diagram');
                closeMenu();
              }}
              className="flex items-center gap-3.5 w-full px-6 py-[13px] text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100/80 transition-colors cursor-pointer"
            >
              <Workflow size={18} className="text-slate-400 shrink-0" />
              <span className="text-[15px] font-medium">View Diagram</span>
            </button>

            <button
              type="button"
              onClick={() => {
                superApp?.showToast('Approvers');
                closeMenu();
              }}
              className="flex items-center gap-3.5 w-full px-6 py-[13px] text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100/80 transition-colors cursor-pointer"
            >
              <Users size={18} className="text-slate-400 shrink-0" />
              <span className="text-[15px] font-medium">Approvers</span>
            </button>

            <button
              type="button"
              onClick={() => {
                superApp?.showToast('Unclaim');
                closeMenu();
              }}
              className="flex items-center gap-3.5 w-full px-6 py-[13px] text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100/80 transition-colors cursor-pointer"
            >
              <Ban size={18} className="text-slate-400 shrink-0" />
              <span className="text-[15px] font-medium">Unclaim</span>
            </button>

            <button
              type="button"
              onClick={() => {
                superApp?.showToast('Assign');
                closeMenu();
              }}
              className="flex items-center gap-3.5 w-full px-6 py-[13px] text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100/80 transition-colors cursor-pointer"
            >
              <User size={18} className="text-slate-400 shrink-0" />
              <span className="text-[15px] font-medium">Assign</span>
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
                  className="flex items-center gap-3.5 w-full px-6 py-[13px] text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100/80 transition-colors cursor-pointer"
                >
                  <SendHorizontal size={18} className="text-slate-400 shrink-0" />
                  <span className="text-[15px] font-medium">{act.name}</span>
                </button>
              ));
            })()}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
