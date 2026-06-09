interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  backTitle?: string;
}

/** Back arrow SVG icon */
function BackIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-900"
    >
      <polyline points="14 18 8 12 14 6" />
    </svg>
  );
}

/** Refresh arrow SVG icon */
function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-slate-900 ${spinning ? 'animate-spin' : ''}`}
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

export default function Header({
  title,
  subtitle,
  onBack,
  onRefresh,
  refreshing = false,
  backTitle = 'Back',
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-2 pt-3 pb-2 bg-white w-full sticky top-0 z-[100]">
      <button
        onClick={onBack}
        title={backTitle}
        className="p-0 shrink-0 border-none cursor-pointer flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 active:bg-slate-100"
      >
        <BackIcon />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden px-2">
        <h1 className="w-full text-center text-[18px] font-bold text-slate-900 truncate m-0">
          {title}
        </h1>
        {subtitle && (
          <span className="w-full text-center text-[12px] font-medium text-slate-500 mt-0.5 truncate">
            {subtitle}
          </span>
        )}
      </div>

      {onRefresh ? (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-0 shrink-0 bg-[#e9eeff] border-none cursor-pointer flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 active:bg-blue-100 disabled:opacity-50"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      ) : (
        <div className="w-10 shrink-0" />
      )}
    </header>
  );
}
