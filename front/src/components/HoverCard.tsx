import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  content: ReactNode;
  children: ReactNode;
  width?: number;
  className?: string;
}

/** Khung chi tiết hiện khi rê chuột hoặc tab tới.
 *  Portal + tự lật lên khi thiếu chỗ phía dưới, giống menu ⋯ */
export default function HoverCard({
  content,
  children,
  width = 220,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Trễ 120ms mới mở — lướt chuột qua nhanh thì không bật lên loạn xạ
  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 120);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const r = triggerRef.current.getBoundingClientRect();
    const h = cardRef.current?.offsetHeight ?? 120;
    const up = window.innerHeight - r.bottom < h + 12;
    const centered = r.left + r.width / 2 - width / 2;

    setPos({
      top: up ? r.top - h - 8 : r.bottom + 8,
      left: Math.max(8, Math.min(centered, window.innerWidth - width - 8)),
    });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      ref={triggerRef}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 rounded ${className}`}
    >
      {children}

      {open &&
        createPortal(
          <div
            ref={cardRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width,
              visibility: pos ? "visible" : "hidden",
            }}
            className="z-50 bg-white border border-line rounded-lg p-3 shadow-[0_4px_12px_rgba(20,24,29,.10)] pointer-events-none"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
