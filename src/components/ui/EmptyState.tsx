interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({
  message = 'No items found.',
}: EmptyStateProps) {
  return (
    <div className="text-center py-[60px] px-4">
      <p className="text-[14px] text-slate-500">{message}</p>
    </div>
  );
}
