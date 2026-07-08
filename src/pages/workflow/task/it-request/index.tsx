import { FileText } from 'lucide-react';

interface ItRequestFormProps {
  selectedTask: any;
  instanceData: any;
  detail: any;
}

export default function ItRequestForm({ selectedTask, detail }: ItRequestFormProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-white rounded-xl border border-slate-200/60 p-5 text-center text-slate-450 text-[13px] flex flex-col items-center justify-center min-h-[200px]">
        <FileText size={40} className="text-slate-350 mb-3" />
        <h4 className="font-bold text-slate-800 mb-1">IT Service Request</h4>
        <p className="text-slate-400 max-w-[280px]">
          Detail details are not fully configured yet for this request type.
        </p>
        {detail?.formNo && (
          <span className="mt-3 font-semibold px-2 py-1 bg-slate-50 border border-slate-100 rounded text-slate-650">
            Form Ref: {detail.formNo}
          </span>
        )}
      </div>
    </div>
  );
}
