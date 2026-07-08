import type { ProcessFlowDetail } from '@/types/workflow-detail';
import { formatDateCompact, formatDateTimeCompact, formatCurrency } from '@/utils/format';
import { useTranslation } from '@/hooks/useTranslation';

interface PurchaseRequisitionFormProps {
  selectedTask: any;
  instanceData: any;
  detail: ProcessFlowDetail;
}

export default function PurchaseRequisitionForm({ detail: processDetail }: PurchaseRequisitionFormProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3.5">
      {/* Requisition Card */}
      <div className="bg-white rounded-xl border border-slate-200/60 p-3.5 flex flex-col gap-2.5 text-[13px]">
        {/* Title & Budget Badge */}
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-bold text-slate-900">{processDetail.formNo}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
            processDetail.budgetCodeRequired 
              ? 'bg-amber-50 text-amber-600 border-amber-100' 
              : 'bg-slate-50 text-slate-500 border-slate-100'
          }`}>
            Budget Code: {processDetail.budgetCodeRequired ? 'Required' : 'Not Required'}
          </span>
        </div>

        {/* Requester & Dept Info */}
        <div className="text-slate-650 font-bold flex items-center gap-1.5">
          <span>{processDetail.createdBy}</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>{processDetail.buName}</span>
        </div>

        {/* Timeline (Requested & Expected Date) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-slate-400 block text-[11px] font-medium">{t('workflow.created_date')}</span>
            <span className="text-slate-700 font-semibold">{formatDateTimeCompact(processDetail.createdDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-medium">{t('workflow.expected_date')}</span>
            <span className="text-slate-700 font-semibold">{formatDateCompact(processDetail.acquisitionDate)}</span>
          </div>
        </div>

        {/* Reason block */}
        {processDetail.reason && (
          <div className="">
            <span className="text-slate-400 font-medium">Reason: </span>
            <span className="font-semibold">{processDetail.reason}</span>
          </div>
        )}
      </div>

      {/* Items Section */}
      <div className="flex flex-col gap-2">
        <h4 className="font-bold">{t('workflow.items_list')}</h4>
        {processDetail.items?.map((item, idx) => (
          <div key={item.id || idx} className="bg-white rounded-md p-3 flex flex-col gap-2">
            {/* Header: Item Name & Subtotal */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[13px] font-bold text-slate-800 block truncate">
                  {item.itemName}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                  {item.itemCode}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[13px] font-bold text-slate-900 block">
                  ${formatCurrency(item.amount)}
                </span>
                <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
                  {item.qty} {item.uom} x ${formatCurrency(item.unitPrice)}
                </span>
              </div>
            </div>
            {item.description && (
              <div className="text-[12px]">
                <span className="font-semibold text-slate-400">Description: </span>
                <span className="font-normal">{item.description}</span>
              </div>
            )}

            {/* Optional Metadata Row (Budget Code, Description, Remarks) */}
            {(item.budgetCode || item.remarks) && (
              <div className="border-t border-slate-100 pt-2 flex flex-col gap-1 text-[12px] text-slate-500">
                {item.budgetCode && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-400">Budget:</span>
                    <span className="font-semibold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{item.budgetCode}</span>
                  </div>
                )}
                {item.remarks && (
                  <div className="text-slate-500">
                    <span className="font-semibold text-slate-400">Remarks: </span>
                    {item.remarks}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

      </div>
    </div>
  );
}
