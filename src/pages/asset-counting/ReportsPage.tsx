import React from 'react';
import Header from '../../components/ui/Header';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { ReportsSkeleton } from '../../components/ui/SkeletonLoader';
import { useAssetStore } from '../../store/assetStore';
import { useReportsInfiniteQuery } from '../../hooks/useAssetQuery';

export default function ReportsPage() {
  const selectedSession = useAssetStore((s) => s.selectedSession);
  const selectedFunction = useAssetStore((s) => s.selectedFunction);
  const goBack = useAssetStore((s) => s.goBack);

  // Fallback guard
  if (!selectedSession || !selectedFunction) {
    return (
      <div className="p-5 text-center text-slate-400">
        No group selected.
      </div>
    );
  }

  // Fetch reports using Infinite Query
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useReportsInfiniteQuery(selectedSession.id, selectedFunction.id);

  // Flatten reports list pages
  const reports = data?.pages.flatMap((page) => page.items) ?? [];
  const reportsTotal = data?.pages[0]?.total ?? 0;

  // Local scroll event handler for infinite loading pagination
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || isFetchingNextPage) return;

    const target = e.currentTarget;
    const scrollHeight = target.scrollHeight;
    const scrollTop = target.scrollTop;
    const clientHeight = target.clientHeight;

    // Trigger next page query when scrolled near bottom
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchNextPage();
    }
  };

  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-slate-50 h-screen overflow-y-auto flex flex-col box-border" onScroll={handleScroll}>
      {/* Header */}
      <Header
        title={`${selectedFunction.name} Assets`}
        onBack={goBack}
        onRefresh={refetch}
        refreshing={isLoading}
        backTitle="Back to Details"
      />

      <main className="flex-1 p-4">
        {/* Summary Banner */}
        <div className="bg-sky-600 rounded-2xl p-4 mb-4 text-white shadow-[0_4px_10px_rgba(2,132,199,0.15)]">
          <div className="text-[12px] font-semibold opacity-90 uppercase tracking-wider">Breakdown of Count Progress</div>
          <div className="text-[18px] font-bold mt-1">
            Showing {reports.length} of {reportsTotal} items
          </div>
        </div>

        {isLoading ? (
          <ReportsSkeleton />
        ) : error ? (
          <ErrorState message={(error as Error).message || 'Failed to load assets list'} onRetry={refetch} />
        ) : reports.length === 0 ? (
          <EmptyState message="No asset report items found." />
        ) : (
          <div className="flex flex-col gap-3 pb-6">
            {reports.map((report) => (
              <div key={report.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <div className="flex justify-between items-start gap-2 mb-2.5">
                  <h4 className="text-[15px] font-bold text-slate-900 m-0 flex-1">{report.asset_name}</h4>
                  <span
                    style={{
                      background: report.count_status ? '#dcfce7' : '#f1f5f9',
                      color: report.count_status ? '#16a34a' : '#475569',
                    }}
                    className="px-2.5 py-1 rounded-[20px] text-[11px] font-bold inline-flex items-center gap-[5px]"
                  >
                    <span
                      style={{
                        backgroundColor: report.count_status ? '#22c55e' : '#94a3b8',
                      }}
                      className="w-1.5 h-1.5 rounded-full"
                    />
                    {report.count_status ? 'Counted' : 'Uncounted'}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-md px-2 py-1 mb-3">
                  <span className="text-[10px] font-bold text-slate-500">TAG:</span>
                  <code className="font-mono text-[12px] font-semibold text-slate-900">{report.asset_tag}</code>
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-[14px] leading-relaxed">📍</span>
                    <span className="text-[12px] text-slate-600 leading-relaxed">
                      {report.location || 'No Location specified'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[14px] leading-relaxed">📊</span>
                    <span className="text-[12px] text-slate-600 leading-relaxed">
                      Quantity: <strong className="text-slate-900">{report.actual_quantity}</strong> /{' '}
                      {report.total_quantity}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Infinite scroll spinner */}
            {isFetchingNextPage && (
              <Spinner size="small" message="Loading more assets..." />
            )}

            {/* End of list */}
            {!hasNextPage && reports.length > 0 && (
              <div className="text-center text-[13px] font-semibold text-slate-400 py-4 pb-2">
                ✨ All {reportsTotal} assets loaded.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
