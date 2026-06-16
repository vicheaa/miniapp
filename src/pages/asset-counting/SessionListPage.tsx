import React from 'react';
import { formatDateCompact } from '../../utils/format';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Header from '../../components/ui/Header';
import { SessionListSkeleton } from '../../components/ui/SkeletonLoader';
import { useAssetStore } from '../../store/assetStore';
import { useSessionsQuery, useUserInfoQuery } from '../../hooks/useAssetQuery';

/* ── Status helpers ────────────────────────────────────────────────────── */

function getStatusLabel(status?: string): { label: string; color: string } {
  const s = (status || 'draft').toLowerCase();
  switch (s) {
    case 'progressing':
      return { label: 'PROGRESSING', color: '#e67e22' };
    case 'finished':
      return { label: 'FINISHED', color: '#27ae60' };
    default:
      return {
        label: (status || 'Draft').toUpperCase(),
        color: '#7f8c8d',
      };
  }
}

function getProgressBarColor(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'finished') return '#27ae60';
  return '#f0c040'; // amber/gold for progressing
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function SessionListPage() {
  const superApp = useAssetStore((s) => s.superApp);
  const statusFilter = useAssetStore((s) => s.statusFilter);
  const setStatusFilter = useAssetStore((s) => s.setStatusFilter);
  const searchQuery = useAssetStore((s) => s.searchQuery);
  const setSelectedSession = useAssetStore((s) => s.setSelectedSession);
  const setView = useAssetStore((s) => s.setView);

  // Fetch data using React Query
  const { data: sessions = [], isLoading, error, refetch } = useSessionsQuery();
  const { data: userInfo } = useUserInfoQuery();

  const tabs = [
    { key: 'ALL', label: 'All' },
    { key: 'PROGRESSING', label: 'Progressing' },
    { key: 'FINISHED', label: 'Finished' },
  ];

  // Filtering logic
  const filteredSessions = sessions.filter((s) => {
    const name = (s.session_name || '').toLowerCase();
    const idStr = String(s.id);
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || idStr.includes(query);

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && (s.status || '').toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-slate-50 h-screen overflow-y-auto flex flex-col box-border">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      {superApp && (
        <Header
          title="Asset Counting Session"
          onBack={() => superApp.close()}
          backTitle="Close Mini App"
        />
      )}

      {/* ── Welcome Banner ─────────────────────────────────────────────── */}
      {/* {userInfo?.name && (
        <div className="bg-white px-5 pt-4 pb-2 flex items-center justify-between border-b border-slate-100">
          <div>
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Welcome back</span>
            <h2 className="text-[18px] font-bold text-slate-800 mt-0.5">{userInfo.name}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 font-semibold text-[14px] border border-sky-100 uppercase">
            {userInfo.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
        </div>
      )} */}

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <nav className="flex bg-white px-4 border-b border-slate-100 sticky top-14 z-[99]">
        {tabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-1 relative py-3 bg-transparent border-none text-[15px] font-medium cursor-pointer transition-colors duration-200 text-center ${
                isActive ? 'text-slate-900 font-semibold' : 'text-slate-400'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-sm bg-sky-600" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 p-3">
        {isLoading ? (
          <SessionListSkeleton />
        ) : error ? (
          <ErrorState message={(error as Error).message || 'Failed to fetch sessions'} onRetry={refetch} />
        ) : filteredSessions.length === 0 ? (
          <EmptyState message="No asset counting sessions found." />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSessions.map((session) => {
              const statusInfo = getStatusLabel(session.status);
              const totalAssets = session.total_asset ?? 0;
              const counted = session.count_asset ?? 0;
              const remaining = session.remaining ?? totalAssets - counted;
              const pct = totalAssets > 0 ? Math.round((counted / totalAssets) * 100) : 0;
              const barColor = getProgressBarColor(session.status);

              return (
                <div
                  key={session.id}
                  className="bg-white rounded-[14px] p-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 cursor-pointer transition-shadow duration-200 hover:shadow-md"
                  onClick={() => {
                    setSelectedSession(session);
                    setView('detail');
                  }}
                >
                  {/* Row 1: Name + Status */}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[17px] font-bold text-slate-900">{session.session_name}</span>
                    <span
                      style={{ color: statusInfo.color }}
                      className="text-[12px] font-bold tracking-wide"
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Row 2: Stats */}
                  <div className="flex justify-between mb-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] text-slate-400 font-medium">Assets</span>
                      <span className="text-[17px] font-bold text-slate-900">{totalAssets.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] text-slate-400 font-medium">Counted</span>
                      <span className="text-[17px] font-bold text-green-600">
                        {counted.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] text-slate-400 font-medium">Remaining</span>
                      <span className="text-[17px] font-bold text-amber-600">
                        {remaining.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Progress bar */}
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: barColor,
                        }}
                        className="h-full rounded-sm transition-all duration-500 ease-out"
                      />
                    </div>
                    <span className="text-[13px] font-semibold text-slate-600 min-w-[30px] text-right">{pct}%</span>
                  </div>

                  {/* Row 4: Dates */}
                  <div className="flex justify-between gap-2">
                    <span className="text-[11px] text-slate-400 font-normal">
                      Created: {formatDateCompact(session.created_at)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Started: {formatDateCompact(session.started_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
