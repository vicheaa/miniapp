import RequestErrorNotice from '../../components/ui/RequestErrorNotice';

export default function OrdersError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RequestErrorNotice error={error} retry={retry} />;
}
