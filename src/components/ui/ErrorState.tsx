interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center p-10 px-4 bg-white rounded-2xl border border-red-100 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
      <p className="text-[14px] text-red-500 mb-3 font-medium">{message}</p>
      {onRetry && (
        <button
          className="px-5 py-2 bg-sky-600 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer shadow-[0_4px_6px_-1px_rgba(2,132,199,0.2)] transition-colors duration-200 hover:bg-sky-700 active:bg-sky-800"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
