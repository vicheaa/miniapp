import type { FnsRequestDetail, FnsRequestItem } from '@/types/workflow-detail';
import { formatDateCompact } from '@/utils/format';
import { Check } from 'lucide-react';

interface FmaNewStaffRequestFormProps {
  fnsDetail: FnsRequestDetail;
}

export default function FmaNewStaffRequestForm({ fnsDetail }: FmaNewStaffRequestFormProps) {
  // Helper to filter items by category
  const getItemsByCategory = (category: string) => {
    return fnsDetail.items?.filter((item) => item.category === category) || [];
  };

  // Helper to render section item rows with checkbox and details
  const renderItemRows = (items: FnsRequestItem[], hasMultipleDashes = false) => {
    if (items.length === 0) {
      return (
        <div className="text-[12px] text-slate-400 py-2 text-center">
          No items requested in this category.
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0 gap-3"
          >
            {/* Checkbox and Name */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`w-5 h-5 rounded-[5px] flex items-center justify-center border shrink-0 transition-colors ${
                  item.checked
                    ? 'bg-[#063E89] border-[#063E89] text-white'
                    : 'border-slate-300 bg-white text-transparent'
                }`}
              >
                <Check size={13} strokeWidth={3} className="shrink-0" />
              </div>
              <span className={`text-[13px]  font-medium truncate ${item.checked ? 'text-slate-900 font-semibold' : ''}`}>
                {item.itemName}
              </span>
            </div>

            {/* Qty and Remarks columns aligned like the desktop layout */}
            <div className="flex items-center gap-4 text-[12px] text-slate-400 shrink-0 pr-1">
              {/* Optional size or itemType */}
              {hasMultipleDashes && (
                <span className="font-semibold text-slate-500">
                  {item.itemType || '-'}
                </span>
              )}
              {/* Remarks or single placeholder */}
              <span className="font-semibold text-slate-500">
                {item.remarks || '-'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
        {/* ── 1. Personal Details ────────────────────────────────────────── */}
        <div className="bg-white rounded-md border border-slate-200/60 p-3.5 flex flex-col gap-2.5 text-[12px]">
            <h3 className="font-bold text-[13.5px]">
                1. Personal Details (Completed by HR)
            </h3>
        
            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100/60">
                {/* Header Profile Section */}
                <div className="flex flex-col">
                    <div className="text-[14px] font-bold text-slate-800 flex flex-wrap items-baseline gap-1.5">
                        <span>{fnsDetail.empName || '—'}</span>
                        {fnsDetail.empLocalName && (
                            <span className="text-[12px] font-semibold text-slate-500 font-sans">
                                ({fnsDetail.empLocalName})
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] mt-1">
                        <span className="text-slate-400">Employee ID: </span> 
                        <strong className="font-semibold">{fnsDetail.empNo || '—'}</strong>
                        <span className="font-normal text-slate-200">|</span>
                        <span className="text-slate-400">Gender: </span>
                        <strong className="font-semibold capitalize">{fnsDetail.gender || '—'}</strong>
                    </div>
                </div>

                {/* Rest of Details in a Grid */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-dashed border-slate-100">
                    <div className="col-span-2">
                        <span className="text-slate-400 font-medium">Position: </span>
                        <span className="font-semibold">{fnsDetail.jobTitle || '—'}</span>
                    </div>

                    <div>
                        <span className="text-slate-400 font-medium">BU: </span>
                        <span className="font-semibold">{fnsDetail.bu || '—'}</span>
                    </div>

                    <div>
                        <span className="text-slate-400 font-medium">Function: </span>
                        <span className="font-semibold">{fnsDetail.department || '—'}</span>
                    </div>

                    <div>
                        <span className="text-slate-400 font-medium">Location: </span>
                        <span className="font-semibold">{fnsDetail.workplace || '—'}</span>
                    </div>

                    <div>
                        <span className="text-slate-400 font-medium">Joining Date: </span>
                        <span className="font-semibold">{formatDateCompact(fnsDetail.startingDate)}</span>
                    </div>
                </div>
            </div>
        </div>

    {/* ── 2. Workplace arrangement ─────────────────────────────────────── */}
    <div className="bg-white rounded-md border border-slate-200/60 p-4 flex flex-col gap-3">
        <h3 className="font-bold  text-[14px]">
            2. Workplace arrangement (Initiated by HR, reviewed by hired Function Manager)
        </h3>
        <div className="pt-1 border-t border-slate-100/60">
          {renderItemRows(getItemsByCategory('FMA_WORK_PLACE_ARRANGEMENT'), false)}
        </div>
    </div>

    {/* ── 3. Uniform ─────────────────────────────────────────────────── */}
    <div className="bg-white rounded-md border border-slate-200/60 p-4 flex flex-col gap-3">
        <h3 className="font-bold  text-[14px]">
            3. Uniform (Initiated by HR, reviewed by hired Function Manager)
        </h3>
        <div className="pt-1 border-t border-slate-100/60">
          {renderItemRows(getItemsByCategory('FMA_UNIFORM'), true)}
        </div>
      </div>

      {/* ── 4. Accessories ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-md border border-slate-200/60 flex flex-col">
        <div className="p-4 flex flex-col gap-3">
          <h3 className="font-bold  text-[14px]">
            4. Accessories (Initiated by HR, reviewed by hired Function Manager)
          </h3>
          <div className="pt-1 border-t border-slate-100/60">
            {renderItemRows(getItemsByCategory('FMA_ACCESSORY'), true)}
          </div>
        </div>
        
        {/* Phone & Email Banner */}
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-3 text-[12px] rounded-b-md">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Phone</span>
            <span className="font-semibold text-slate-700 text-[12.5px]">{fnsDetail.phoneNo || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Email</span>
            <span className="font-semibold text-slate-700 text-[12.5px] break-all">{fnsDetail.email || '-'}</span>
          </div>
        </div>
      </div>

      {/* ── 5. System car access/Gate Pass ─────────────────────────────── */}
      <div className="bg-white rounded-md border border-slate-200/60 flex flex-col">
        <div className="p-4 flex flex-col gap-3">
          <h3 className="font-bold  text-[14px]">
            5. System car access/Gate Pass (Initiated by HR, reviewed by hired Function Manager)
          </h3>
          <div className="pt-1 border-t border-slate-100/60">
            {renderItemRows(getItemsByCategory('FMA_ACCESS'), false)}
          </div>
        </div>

        {/* Vehicle Details Banner */}
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3.5 grid grid-cols-2 gap-x-4 gap-y-3 text-[12px] rounded-b-md">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Car Model</span>
            <span className="font-semibold text-slate-700 text-[12.5px]">{fnsDetail.carModal || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Color</span>
            <span className="font-semibold text-slate-700 text-[12.5px]">{fnsDetail.carColor || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Year</span>
            <span className="font-semibold text-slate-700 text-[12.5px]">{fnsDetail.year || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Plate Number</span>
            <span className="font-semibold text-slate-700 text-[12.5px]">{fnsDetail.plateNumber || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
