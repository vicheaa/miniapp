import React from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A reusable mobile-friendly bottom sheet component with smooth slide-up
 * and fade-in transitions, drag handle, and click-outside to dismiss.
 */
export default function BottomSheet({ isOpen, onClose, children }: BottomSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 backdrop-blur-[1px] z-[999] transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Bottom Sheet Card */}
      <div
        className={`fixed inset-x-0 bottom-0 w-full max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-[0_-10px_40px_rgba(0,0,0,0.12)] border-t border-slate-100 pb-8 pt-4 flex flex-col z-[1000] transition-transform duration-250 ease-out transform ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle/Indicator */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 shrink-0" />

        {children}
      </div>
    </>
  );
}
