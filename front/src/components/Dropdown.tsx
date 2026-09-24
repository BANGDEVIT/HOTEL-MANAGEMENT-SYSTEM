import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
}

export default function Dropdown({
  value,
  options,
  onChange,
  placeholder = "Chọn",
  className = "",
  align = "left",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-7 w-full pl-2.5 pr-2 flex items-center gap-1.5 rounded-md border
          text-[12px] bg-white transition-colors
          ${open ? "border-[#1B3A5C] ring-2 ring-[#1B3A5C]/10" : "border-[#E4E6E9] hover:border-[#CDD2D8]"}`}
      >
        <span
          className={`truncate ${selected ? "text-[#14181D]" : "text-[#98A1AC]"}`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          className={`ml-auto shrink-0 text-[#98A1AC] transition-transform duration-150
            ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-[calc(100%+4px)] z-30 min-w-full w-max max-w-[260px]
            bg-white border border-[#E4E6E9] rounded-lg overflow-hidden
            shadow-[0_4px_12px_rgba(20,24,29,.10)]
            ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full px-2.5 py-2 flex items-center gap-2 text-left text-[12px]
                  transition-colors ${isActive ? "bg-[#F5F6F7]" : "hover:bg-[#F5F6F7]"}`}
              >
                <span className="w-3.5 shrink-0">
                  {isActive && (
                    <Check
                      size={13}
                      strokeWidth={2.25}
                      className="text-[#1B3A5C]"
                    />
                  )}
                </span>
                <span
                  className={`truncate ${isActive ? "text-[#14181D] font-medium" : "text-[#14181D]"}`}
                >
                  {option.label}
                </span>
                {option.hint && (
                  <span className="ml-auto pl-3 text-[11px] text-[#98A1AC] tabular-nums shrink-0">
                    {option.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
