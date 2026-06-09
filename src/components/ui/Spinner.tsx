interface SpinnerProps {
  /** Optional message displayed below the spinner. */
  message?: string;
  /** Use 'small' for inline loading indicators. */
  size?: 'small' | 'default';
}

export default function Spinner({ message, size = 'default' }: SpinnerProps) {
  if (size === 'small') {
    return (
      <div className="flex items-center justify-center gap-2 py-4 pb-2">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin" />
        {message && <span className="text-[12px] text-slate-500">{message}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-[60px]">
      <div className="w-8 h-8 border-3 border-slate-300 border-t-sky-600 rounded-full animate-spin" />
      {message && <p className="mt-3 text-[14px] text-slate-500">{message}</p>}
    </div>
  );
}
