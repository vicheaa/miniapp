import type { NCMRequestDetail } from '@/types/workflow-detail';
import { formatDateTimeCompact } from '@/utils/format';
import { useTranslation } from '@/hooks/useTranslation';

interface FmaNCMRequestFormProps {
  detail: NCMRequestDetail;
}

export default function FmaNCMRequestForm({ detail }: FmaNCMRequestFormProps) {
  const { t } = useTranslation();
  const requestFields = [
    { label: 'Group', value: detail.groupName },
    { label: 'Warehouse From', value: detail.warehouseFrom },
    { label: t('workflow.requested_by'), value: detail.requestedBy },
    { label: 'Requested Date', value: formatDateTimeCompact(detail.requestedDate) },
    { label: t('workflow.created_by'), value: detail.createdBy },
    { label: t('workflow.created_date'), value: formatDateTimeCompact(detail.createdDate) },
    { label: 'Posted Date', value: detail.postedDate ? formatDateTimeCompact(detail.postedDate) : null },
    { label: 'Delivery', value: detail.delivery },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex flex-col gap-3 text-[13px]">
        <h3 className="text-[16px] font-bold text-gray-900">{detail.formNo}</h3>
        <div className="grid grid-cols-2 gap-3">
          {requestFields.map(({ label, value }) => (
            <div key={label}>
              <span className="text-gray-400 block text-[11px] font-medium">{label}</span>
              <span className="text-gray-700 font-semibold break-words">{value || '—'}</span>
            </div>
          ))}
        </div>
        {detail.reason && (
          <div className="border-t border-gray-100 pt-2">
            <span className="text-gray-400 font-medium">Reason: </span>
            <span className="font-semibold whitespace-pre-wrap break-words">{detail.reason}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="font-bold">{t('workflow.items_list')}</h4>
        {detail.items.length === 0 && (
          <div className="bg-white rounded-md p-3 text-center text-[13px] text-gray-400">
            No items available.
          </div>
        )}
        {detail.items.map((item) => (
          <div key={item.id} className="bg-white rounded-md p-3 flex flex-col gap-2 text-[12px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[13px] font-bold text-gray-800 block break-words">{item.itemName}</span>
                <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">{item.itemCode}</span>
              </div>
              <span className="text-[13px] font-bold text-gray-900 shrink-0">{item.qty} {item.uom}</span>
            </div>
            {item.description && (
              <p className="whitespace-pre-wrap break-words">
                <span className="font-semibold text-gray-400">Description: </span>
                {item.description}
              </p>
            )}
            {(item.budgetCode || item.remarks || item.stockRemarks) && (
              <div className="border-t border-gray-100 pt-2 flex flex-col gap-1 text-gray-500">
                {item.budgetCode && (
                  <div>
                    <span className="font-semibold text-gray-400">Budget: </span>
                    <span className="font-semibold text-gray-700">{item.budgetCode}</span>
                  </div>
                )}
                {item.remarks && (
                  <p className="whitespace-pre-wrap break-words">
                    <span className="font-semibold text-gray-400">Remarks: </span>
                    {item.remarks}
                  </p>
                )}
                {item.stockRemarks && (
                  <p className="whitespace-pre-wrap break-words">
                    <span className="font-semibold text-gray-400">Stock Remarks: </span>
                    {item.stockRemarks}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
