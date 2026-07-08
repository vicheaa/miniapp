import { ChevronLeft } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backTitle?: string;
}

/** Back arrow SVG icon */

export default function Header({
  title,
  subtitle,
  onBack,
  backTitle = 'Back',
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-2 pt-3 pb-2 bg-white w-full sticky top-0 z-40">
      <button
        onClick={onBack}
        title={backTitle}
        className="p-0 shrink-0 border-none cursor-pointer flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 active:bg-gray-100"
      >
        <ChevronLeft />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden px-2">
        <h1 className="w-full text-center text-[18px] font-bold text-gray-900 truncate m-0">
          {title}
        </h1>
        {subtitle && (
          <span className="w-full text-center text-[12px] font-medium text-gray-500 mt-0.5 truncate">
            {subtitle}
          </span>
        )}
      </div>

      {/* Spacer to balance back button on the left and keep title centered */}
      <div className="w-10 shrink-0" />
    </header>
  );
}
