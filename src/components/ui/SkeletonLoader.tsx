/**
 * Skeleton Loader for TaskListPage (Workflow pending tasks)
 */
export function TaskListSkeleton() {
  const cards = [1, 2, 3, 4, 5];
  return (
    <div className="flex flex-col gap-3">
      {cards.map((i) => (
        <div
          key={i}
          className="bg-white rounded-[14px] px-[18px] py-4 border border-slate-200/80"
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

