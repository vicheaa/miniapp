import type { ProcessFlowDetail } from '../../../../services/api/task-detail-api';
import { formatDateCompact } from '../../../../utils/format';
import { useTranslation } from '../../../../hooks/useTranslation';

interface PurchaseRequisitionFormProps {
  processDetail: ProcessFlowDetail;
}

export default function PurchaseRequisitionForm({ processDetail }: PurchaseRequisitionFormProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3.5">
      {/* Requisition Card */}
      <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col gap-3">
        <h3 className="text-[14px] font-bold text-slate-800 pb-2 border-b border-slate-100">
          {t('workflow.requisition_info')}
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
          <div>
            <span className="text-slate-400 block font-medium">{t('workflow.from_no')}</span>
            <span className="text-slate-800 font-bold">{processDetail.formNo}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">{t('workflow.expected_date')}</span>
            <span className="text-slate-800 font-semibold">{formatDateCompact(processDetail.acquisitionDate)}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-400 block font-medium">{t('workflow.reason')}</span>
            <span className="text-slate-800 font-medium">{processDetail.reason || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">{t('workflow.bu')}</span>
            <span className="text-slate-800 font-semibold">{processDetail.buName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">{t('workflow.created_by')}</span>
            <span className="text-slate-800 font-semibold">{processDetail.createdBy}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">{t('workflow.budget_code_required')}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 font-bold mt-0.5">
              {processDetail.budgetCodeRequired ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">{t('workflow.created_date')}</span>
            <span className="text-slate-800 font-semibold">{formatDateCompact(processDetail.createdDate)}</span>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="flex flex-col gap-2">
        <h4 className="text-[13px] font-bold text-slate-500 px-1">{t('workflow.items_list')}</h4>
        {processDetail.items?.map((item, idx) => (
          <div key={item.id || idx} className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-50">
              <span className="text-[13px] font-bold text-slate-800 truncate">
                {item.itemName}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                {item.itemCode}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-[12px] text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">{t('workflow.quantity_uom')}</span>
                <span className="font-semibold text-slate-800">{item.qty} {item.uom}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">{t('workflow.unit_price')}</span>
                <span className="font-semibold text-slate-800">${item.unitPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">{t('workflow.budget_code')}</span>
                <span className="font-semibold text-slate-800">{item.budgetCode || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">{t('workflow.subtotal')}</span>
                <span className="font-bold text-slate-900">${item.amount.toFixed(2)}</span>
              </div>
              {item.description && (
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">{t('workflow.description')}</span>
                  <span className="text-slate-700 italic">{item.description}</span>
                </div>
              )}
              {item.remarks && (
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">{t('workflow.remarks')}</span>
                  <span className="text-slate-700">{item.remarks}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Summary amount banner */}
        <div className="bg-[#063E89] rounded-xl p-4 mt-1.5 flex items-center justify-between shadow-sm">
          <span className="text-[13px] font-bold text-slate-300">{t('workflow.total_requisition_amount')}</span>
          <span className="text-[16px] font-black text-white">
            ${processDetail.totalAmount.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
