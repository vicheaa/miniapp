import { FileText } from 'lucide-react';

interface ItRequestFormProps {
  selectedTask: any;
  instanceData: any;
  detail: any;
}

export default function ItRequestForm({ selectedTask, detail }: ItRequestFormProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-white rounded-xl border border-[rgba(229,231,235,0.6)] p-5 text-center text-gray-450 text-[13px] flex flex-col items-center justify-center min-h-[200px]">
        <FileText size={40} className="text-gray-350 mb-3" />
        <h4 className="font-bold text-gray-800 mb-1">IT Service Request</h4>
        <p className="text-gray-400 max-w-[280px]">
          Detail details are not fully configured yet for this request type.
        </p>
        {detail?.formNo && (
          <span className="mt-3 font-semibold px-2 py-1 bg-gray-50 border border-gray-100 rounded text-gray-650">
            Form Ref: {detail.formNo}
          </span>
        )}
      </div>
    </div>
  );
}
