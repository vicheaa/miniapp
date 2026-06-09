/**
 * Skeleton Loader for SessionListPage (List of counting sessions)
 */
export function SessionListSkeleton() {
  const cards = [1, 2, 3];
  return (
    <div className="flex flex-col gap-3">
      {cards.map((i) => (
        <div
          key={i}
          className="bg-white rounded-[14px] p-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100"
        >
          {/* Row 1: Session Name & Status */}
          <div className="flex justify-between items-center mb-4">
            <div className="skeleton-shimmer h-4.5 w-[45%] rounded-md" />
            <div className="skeleton-shimmer h-5 w-[25%] rounded-[10px]" />
          </div>

          {/* Row 2: Stats */}
          <div className="flex justify-between mb-3.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-col gap-1.5 w-[25%]">
                <div className="skeleton-shimmer h-2.5 w-[60%] rounded" />
                <div className="skeleton-shimmer h-4 w-full rounded" />
              </div>
            ))}
          </div>

          {/* Row 3: Progress Bar */}
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="skeleton-shimmer flex-1 h-1.5 rounded" />
            <div className="skeleton-shimmer h-3 w-[25px] rounded" />
          </div>

          {/* Row 4: Dates */}
          <div className="flex justify-between gap-2">
            <div className="skeleton-shimmer h-2.5 w-[40%] rounded" />
            <div className="skeleton-shimmer h-2.5 w-[40%] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Loader for SessionDetailPage (Functions breakdown list)
 */
export function SessionDetailSkeleton() {
  const items = [1, 2, 3];
  return (
    <div className="flex flex-col gap-3">
      {items.map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="skeleton-shimmer h-4.5 w-[40%] rounded-md" />
            <div className="skeleton-shimmer h-3.5 w-[25%] rounded" />
          </div>

          {/* Progress Bar Container */}
          <div className="h-2 bg-slate-50 rounded-md my-2.5">
            <div className="skeleton-shimmer h-full w-[45%] rounded-md" />
          </div>

          {/* Details footer */}
          <div className="flex justify-between">
            <div className="skeleton-shimmer h-2.5 w-[35%] rounded" />
            <div className="skeleton-shimmer h-2.5 w-[25%] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Loader for ReportsPage (Asset details list)
 */
export function ReportsSkeleton() {
  const cards = [1, 2, 3, 4];
  return (
    <div className="flex flex-col gap-3">
      {cards.map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
        >
          {/* Header */}
          <div className="flex justify-between items-start gap-2 mb-2.5">
            <div className="skeleton-shimmer h-4.5 w-[60%] rounded-md" />
            <div className="skeleton-shimmer h-[22px] w-[20%] rounded-[11px]" />
          </div>

          {/* Tag Code wrapper */}
          <div className="inline-flex gap-1.5 mb-3 w-[40%]">
            <div className="skeleton-shimmer h-[22px] w-full rounded-md" />
          </div>

          {/* Details section */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5">
            <div className="flex gap-2 items-center">
              <div className="text-[14px]">📍</div>
              <div className="skeleton-shimmer h-3 w-[50%] rounded" />
            </div>
            <div className="flex gap-2 items-center">
              <div className="text-[14px]">📊</div>
              <div className="skeleton-shimmer h-3 w-[40%] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
