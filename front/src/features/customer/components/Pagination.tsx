interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Danh sách số trang có dấu "…": 1 … 4 5 6 … 42
 * Luôn hiện trang đầu, trang cuối và 1 trang mỗi bên trang hiện tại.
 */
function pageItems(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push("gap");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("gap");
  items.push(total);
  return items;
}

export default function Pagination({ page, totalPages, onChange, disabled }: Props) {
  if (totalPages <= 1) return null;

  const btn =
    "h-8 min-w-8 rounded-[8px] border px-2.5 text-[12.5px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav
      aria-label="Phân trang"
      className="flex items-center gap-1"
    >
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        className={`${btn} border-line bg-white text-ink hover:border-line-input`}
      >
        Trước
      </button>

      {pageItems(page, totalPages).map((p, i) =>
        p === "gap" ? (
          <span
            key={`gap-${i}`}
            className="px-1 text-[12.5px] text-ink-faint"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            disabled={disabled}
            aria-current={p === page ? "page" : undefined}
            onClick={() => p !== page && onChange(p)}
            className={`${btn} ${
              p === page
                ? "border-navy-700 bg-navy-700 font-semibold text-white"
                : "border-line bg-white text-ink hover:border-line-input"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={`${btn} border-line bg-white text-ink hover:border-line-input`}
      >
        Sau
      </button>
    </nav>
  );
}
