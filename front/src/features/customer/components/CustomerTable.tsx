import { ChevronRight, Lock, Star } from "lucide-react";
import { useCustomerStore } from "../store/customerStore";
import {
  ID_TYPE_LABELS,
  REGULAR_MIN_STAYS,
  type CustomerListItem,
} from "../../../types/customer";
import {
  avatarColor,
  formatDate,
  formatDayMonth,
  formatPhone,
  initialsOf,
} from "../utils/format";

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Bảng dùng CSS grid thay vì <table>: dễ cố định độ rộng từng cột, và cả dòng là 1 nút bấm.
 * Khung ngoài overflow-x-auto + min-w: màn hình hẹp thì cuộn ngang, KHÔNG bóp chữ.
 */
const COLS =
  "grid-cols-[minmax(280px,2.2fr)_minmax(190px,1.3fr)_140px_76px_minmax(150px,1fr)_28px]";

export default function CustomerTable({ selectedId, onSelect }: Props) {
  const customers = useCustomerStore((s) => s.customers);
  const loading = useCustomerStore((s) => s.loading);
  const lastUpdated = useCustomerStore((s) => s.lastUpdated);

  if (loading && !lastUpdated) {
    return (
      <p className="py-16 text-center text-[13px] text-ink-muted">
        Đang tải danh sách khách
      </p>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-[14px] font-medium text-ink">Không có khách phù hợp</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          Thử từ khoá khác hoặc bỏ bớt bộ lọc.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[940px]">
        <div
          aria-hidden="true"
          className={`grid ${COLS} h-10 items-center gap-[18px] whitespace-nowrap border-b border-line px-[18px] text-[11px] font-semibold uppercase tracking-[.06em] text-ink-faint`}
        >
          <span>Khách</span>
          <span>Giấy tờ, quốc tịch</span>
          <span>Lần ở gần nhất</span>
          <span className="text-right">Số lần</span>
          <span>Lưu trú</span>
          <span />
        </div>

        {customers.map((c) => (
          <Row
            key={c.id}
            customer={c}
            selected={c.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  customer: c,
  selected,
  onSelect,
}: {
  customer: CustomerListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const color = avatarColor(c.id);
  const missingId = !c.id_card_last4 && c.stay_status !== "none";

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Mở hồ sơ ${c.full_name}`}
      onClick={() => onSelect(c.id)}
      className={`grid ${COLS} min-h-16 w-full items-center py-2.5 gap-[18px] border-b border-line-soft px-[18px] text-left transition-colors ${
        selected
          ? "bg-gold-50 shadow-[inset_3px_0_0_var(--color-gold-500)]"
          : "hover:bg-row-hover"
      }`}
    >
      {/* Khách */}
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ background: color.bg, color: color.fg }}
          aria-hidden="true"
        >
          {initialsOf(c.first_name, c.last_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink">
            {c.full_name}
          </span>
          {/* flex-wrap: nhiều nhãn thì xuống dòng TRONG ô, không tràn sang cột bên cạnh */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] tabular-nums text-ink-muted">
            <span className="whitespace-nowrap">
              {formatPhone(c.phone) || "Chưa có SĐT"}
            </span>
            {c.is_member && (
              <Badge className="bg-gold-50 text-gold-700">
                <Star
                  size={10}
                  fill="currentColor"
                  strokeWidth={0}
                />{" "}
                Thành viên
              </Badge>
            )}
            {c.stays >= REGULAR_MIN_STAYS && (
              <Badge className="bg-[#E4ECF6] text-navy-700">Khách quen</Badge>
            )}
            {c.account_active === false && (
              <Badge className="bg-[#F8E4DF] text-room-occupied">
                <Lock
                  size={10}
                  strokeWidth={2.2}
                />{" "}
                Đã khoá
              </Badge>
            )}
            {missingId && (
              <Badge className="bg-[#F8E4DF] text-room-occupied">
                Thiếu giấy tờ
              </Badge>
            )}
          </span>
        </span>
      </span>

      {/* Giấy tờ, quốc tịch */}
      <span className="min-w-0 whitespace-nowrap">
        <span
          className={`block text-[12.5px] tabular-nums ${c.id_type ? "text-ink" : "text-ink-faint"}`}
        >
          {c.id_type
            ? `${ID_TYPE_LABELS[c.id_type]}${c.id_card_last4 ? ` •••• ${c.id_card_last4}` : ""}`
            : "Chưa có giấy tờ"}
        </span>
        <span className="block text-[12px] text-ink-muted">
          {c.nationality ?? "—"}
        </span>
      </span>

      {/* Lần ở gần nhất */}
      <span
        className={`whitespace-nowrap text-[12.5px] tabular-nums ${c.last_stay_at ? "text-ink" : "text-ink-faint"}`}
      >
        {c.last_stay_at ? formatDate(c.last_stay_at) : "Chưa ở lần nào"}
      </span>

      {/* Số lần */}
      <span className="text-right text-[13.5px] font-semibold tabular-nums text-ink">
        {c.stays}
      </span>

      {/* Lưu trú */}
      <span>
        <StayPill customer={c} />
      </span>

      <ChevronRight
        size={15}
        className="text-ink-faint"
        aria-hidden="true"
      />
    </button>
  );
}

export function StayPill({ customer: c }: { customer: CustomerListItem }) {
  if (c.stay_status === "in_house") {
    return (
      <Pill color="var(--color-room-available)">
        Đang ở{c.current_rooms.length ? ` · ${c.current_rooms.join(", ")}` : ""}
      </Pill>
    );
  }
  if (c.stay_status === "arriving") {
    return (
      <Pill color="var(--color-navy-700)">
        Sắp đến{c.next_arrival ? ` · ${formatDayMonth(c.next_arrival)}` : ""}
      </Pill>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-ink-faint">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Không lưu trú
    </span>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium tabular-nums"
      style={{ color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 py-px text-[10.5px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}
