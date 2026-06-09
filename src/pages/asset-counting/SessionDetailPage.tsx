import React from 'react';
import Header from '../../components/ui/Header';
import EmptyState from '../../components/ui/EmptyState';
import { SessionDetailSkeleton } from '../../components/ui/SkeletonLoader';
import { useAssetStore } from '../../store/assetStore';
import { useFunctionInChargesQuery } from '../../hooks/useAssetQuery';

/* ── SVG Icons ─────────────────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400 mr-2.5 flex-shrink-0"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white mr-2 flex-shrink-0"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M3 17v2a2 2 0 0 0 2 2h2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function SessionDetailPage() {
  const selectedSession = useAssetStore((s) => s.selectedSession);
  const goBack = useAssetStore((s) => s.goBack);
  const setSelectedFunction = useAssetStore((s) => s.setSelectedFunction);
  const setView = useAssetStore((s) => s.setView);
  const superApp = useAssetStore((s) => s.superApp);

  const [searchQuery, setSearchQuery] = React.useState('');

  // Fallback guard
  if (!selectedSession) {
    return (
      <div className="p-5 text-center text-slate-400">
        No session selected.
      </div>
    );
  }

  // Fetch breakdown stats via React Query
  const { data: functionInCharges = [], isLoading: loading, error, refetch } = useFunctionInChargesQuery(selectedSession.id);

  // Search filter matching
  const filteredFunctions = functionInCharges.filter((fn) =>
    fn.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleScan = async () => {
    if (superApp) {
      superApp.hapticFeedback('medium');
      try {
        const result = await superApp.scanQR();
        if (result.success && result.code) {
          superApp.showToast(`Scanned: ${result.code}`);
        } else if (result.error) {
          superApp.showToast(`Scan failed: ${result.error}`);
        }
      } catch (err: any) {
        superApp.showToast(`Error: ${err.message}`);
      }
    }
  };

  return (
    <div className="font-sans max-w-[480px] mx-auto p-0 bg-slate-50 h-screen relative flex flex-col box-border">
      {/* Header with Subtitle matching Screenshot */}
      <Header
        title="Function In Charge"
        subtitle={selectedSession.session_name}
        onBack={goBack}
      />

      {/* Styled Search Bar matching screenshot */}
      <div className="px-4 pt-3 pb-1 bg-white">
        <div className="flex items-center bg-slate-100 rounded-xl px-3.5 py-2.5 border border-transparent focus-within:border-sky-500">
          <SearchIcon />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search function by name..."
            className="border-none bg-transparent outline-none flex-1 text-[15px] font-medium text-slate-900 font-inherit"
          />
        </div>
      </div>

      {/* Main Content scroll window */}
      <main className="flex-1 p-4 pb-22 overflow-y-auto">
        {loading ? (
          <SessionDetailSkeleton />
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex justify-between items-center gap-3">
            <span className="text-[13px] text-red-500">{(error as Error).message || 'Failed to fetch breakdown progress'}</span>
            <button className="px-4 py-1.5 bg-red-500 text-white border-none rounded-md text-[12px] font-semibold cursor-pointer active:bg-red-600" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : filteredFunctions.length === 0 ? (
          <EmptyState message="No functions in charge found." />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredFunctions.map((item) => {
              const pct = item.total_asset > 0 ? Math.round((item.count_asset / item.total_asset) * 100) : 0;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl px-5 py-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.01),0_2px_8px_rgba(0,0,0,0.02)] border border-slate-100 cursor-pointer active:scale-[0.98] transition-all duration-150"
                  onClick={() => {
                    setSelectedFunction(item);
                    setView('reports');
                  }}
                >
                  {/* Card Title (e.g. ICT, SAL) */}
                  <h3 className="text-[16px] font-bold text-slate-900 m-0 mb-4">{item.name}</h3>

                  {/* Columns stats row */}
                  <div className="flex justify-between mb-4">
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[12px] text-slate-400 font-medium">Assets</span>
                      <span className="text-[18px] font-bold text-slate-900">{item.total_asset.toLocaleString()}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[12px] text-slate-400 font-medium">Counted</span>
                      <span className="text-[18px] font-bold text-green-600">
                        {item.count_asset.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[12px] text-slate-400 font-medium">Remaining</span>
                      <span className="text-[18px] font-bold text-amber-600">
                        {item.remaining.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar with horizontal percentage alignment */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-50 rounded-sm overflow-hidden">
                      <div
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct === 100 ? '#22c55e' : '#e2e8f0',
                        }}
                        className="h-full rounded-sm transition-all duration-400 ease-out"
                      />
                    </div>
                    <span className="text-[13px] font-semibold text-slate-500 min-w-[32px] text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Scan Button at Bottom */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-slate-50 from-80% to-transparent flex justify-center pointer-events-none z-10"  onClick={handleScan}>
        <button className="pointer-events-auto flex items-center justify-center bg-[#0b3a82] text-white border-none rounded-full h-12 w-full max-w-[448px] shadow-[0_6px_16px_rgba(11,58,130,0.25)] text-[16px] font-bold cursor-pointer transition-transform duration-100 active:scale-95">
          <ScanIcon />
          <span>Scan</span>
        </button>
      </div>
    </div>
  );
}
