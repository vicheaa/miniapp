/**
 * Skeleton Loaders for native-like loading experience.
 * 
 * - TaskListSkeleton: mirrors TaskListPage layout
 * - TaskDetailSkeleton: mirrors TaskDetailPage layout
 * - AppBootstrapSkeleton: full app skeleton during bridge init
 */

/* ── Task List Skeleton ─────────────────────────────────────────────── */

export function TaskListSkeleton() {
  const cards = [1, 2, 3, 4, 5];
  return (
    <div className="flex flex-col gap-3">
      {cards.map((i) => (
        <div
          key={i}
          className="bg-white rounded-[14px] px-[18px] py-4 border border-[rgba(229,231,235,0.8)] skeleton-stagger"
        >
          {/* Title: BusinessKey · Process Name */}
          <div className="flex items-center gap-2 mb-3">
            <div className="skeleton-shimmer h-4 w-[25%] rounded" />
            <div className="skeleton-shimmer h-3.5 w-[35%] rounded" />
          </div>

          {/* Detail rows */}
          <div className="flex flex-col gap-[7px]">
            {[1, 2, 3, 4].map((r) => (
              <div key={r} className="flex items-center justify-between">
                <div className="skeleton-shimmer h-3 w-[22%] rounded" />
                <div className="skeleton-shimmer h-3 w-[38%] rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Task Detail Skeleton ───────────────────────────────────────────── */

export function TaskDetailSkeleton() {
  return (
    <div className="p-3.5 flex flex-col gap-3.5 fade-in">
      {/* Request Info Card */}
      <div className="bg-white px-4 py-3 flex flex-col gap-3 rounded-md border border-[rgba(229,231,235,0.5)]">
        <div className="flex items-center justify-between">
          <div className="skeleton-shimmer h-4 w-[35%] rounded" />
          <div className="skeleton-shimmer h-5 w-[60px] rounded-full" />
        </div>
        <div className="border-t border-[rgba(243,244,246,0.6)] pt-3 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton-shimmer h-4 w-4 rounded shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="skeleton-shimmer h-2.5 w-[25%] rounded" />
                <div className="skeleton-shimmer h-3.5 w-[65%] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current State Card */}
      <div className="bg-white px-4 py-3 flex flex-col gap-3 rounded-md border border-[rgba(229,231,235,0.5)]">
        <div className="flex items-center justify-between">
          <div className="skeleton-shimmer h-4 w-[30%] rounded" />
          <div className="skeleton-shimmer h-5 w-[50px] rounded-full" />
        </div>
        <div className="border-t border-[rgba(243,244,246,0.6)] pt-3 flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton-shimmer h-4 w-4 rounded shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="skeleton-shimmer h-3 w-[50%] rounded" />
                <div className="skeleton-shimmer h-2.5 w-[40%] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white rounded-full p-1 flex">
        <div className="flex-1 py-2 flex justify-center">
          <div className="skeleton-shimmer h-3.5 w-[60%] rounded" />
        </div>
        <div className="flex-1 py-2 flex justify-center">
          <div className="skeleton-shimmer h-3.5 w-[55%] rounded" />
        </div>
        <div className="flex-1 py-2 flex justify-center">
          <div className="skeleton-shimmer h-3.5 w-[65%] rounded" />
        </div>
      </div>

      {/* Content area */}
      <div className="bg-white rounded-md p-4 flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="skeleton-shimmer h-3 w-[30%] rounded" />
            <div className="skeleton-shimmer h-3 w-[45%] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── App Bootstrap Skeleton (shown during bridge init) ──────────────── */

export function AppBootstrapSkeleton() {
  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-gray-100 h-screen overflow-hidden flex flex-col box-border bootstrap-skeleton">
      {/* Header skeleton */}
      <header className="flex items-center justify-between px-2 pt-3 pb-2 bg-white w-full">
        <div className="w-10 h-10 flex items-center justify-center">
          <div className="skeleton-shimmer h-5 w-5 rounded" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="skeleton-shimmer h-4 w-[30%] rounded" />
        </div>
        <div className="w-10" />
      </header>

      {/* Search bar skeleton */}
      <div className="bg-white px-4 pt-3 pb-3 border-b border-gray-100">
        <div className="skeleton-shimmer h-10 w-full rounded-[10px]" />
      </div>

      {/* Filter row skeleton */}
      <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
        <div className="skeleton-shimmer h-3 w-[25%] rounded" />
        <div className="skeleton-shimmer h-3.5 w-[22%] rounded" />
      </div>

      {/* Task cards skeleton */}
      <div className="flex-1 p-3 pt-1">
        <TaskListSkeleton />
      </div>
    </div>
  );
}
