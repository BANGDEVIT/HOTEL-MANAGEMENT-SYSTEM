import { ChevronRight, Star } from "lucide-react";
import { useBookingStore } from "../store/bookingStore";
import {
  BOOKING_TYPE_LABELS,
  type BookingAction,
  type BookingListItem,
} from "../../../types/booking";
import {
  avatarColor,
  formatAmount,
  formatGuests,
  formatPhone,
  formatRange,
  initialsOfFullName,
  overdueDays,
  todayYmd,
} from "../utils/format";
import { Badge, StatusPill } from "./ui";

interface Props {
  selectedId: string | null;
  /** Mở drawer. intent = mở drawer xong tự bật hộp thoại của thao tác này */
  onOpen: (id: string, intent?: BookingAction) => void;
}

/** Header và dòng dùng CHUNG 1 hằng số cột */
const COLS =
  "grid-cols-[minmax(240px,2fr)_minmax(110px,.9fr)_minmax(170px,1.3fr)_136px_minmax(96px,.8fr)_112px_20px]";

/**
 * Nút nhanh trên dòng: đoán theo trạng thái + ngày để lễ tân khỏi mở drawer.
 * Chỉ là GỢI Ý: bấm vào thì drawer tải chi tiết, và chỉ bật hộp thoại khi
 * allowed_actions của BE có thao tác đó (BE mới là nơi quyết định).
 */
function quickAction(
  b: BookingListItem,
  today: string,
): { action: BookingAction; label: string } | null {
  if (b.status === "pending" && b.check_in_date >= today)
    return { action: "confirm", label: "Duyệt" };
  if (
    b.status === "confirmed" &&
    b.check_in_date <= today &&
    today < b.check_out_date
  ) {
    return { action: "check_in", label: "Nhận phòng" };
  }
  if (b.status === "checked_in" && b.check_out_date <= today)
    return { action: "check_out", label: "Trả phòng" };
  return null;
}

export default function BookingTable({ selectedId, onOpen }: Props) {
  const bookings = useBookingStore((s) => s.bookings);
  const loading = useBookingStore((s) => s.loading);
  const lastUpdated = useBookingStore((s) => s.lastUpdated);
  const search = useBookingStore((s) => s.filters.search);

  if (loading && !lastUpdated) {
    return (
      <p className="py-16 text-center text-[13px] text-ink-muted">
        Đang tải danh sách đặt phòng
      </p>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-[14px] font-medium text-ink">Không có đặt phòng nào</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          {search
            ? "Thử từ khoá khác hoặc bỏ bớt bộ lọc."
            : "Tab này hiện đang trống."}
        </p>
      </div>
    );
  }

  const today = todayYmd();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div
          aria-hidden="true"
          className={`grid ${COLS} h-10 items-center gap-[14px] whitespace-nowrap border-b border-line px-[18px] text-[11px] font-semibold uppercase tracking-[.06em] text-ink-faint`}
        >
          <span>Khách · Mã</span>
          <span>Phòng</span>
          <span>Ngày ở · Số khách</span>
          <span>Trạng thái</span>
          <span className="text-right">Số tiền</span>
          <span />
          <span />
        </div>

        {bookings.map((b) => (
          <Row
            key={b.id}
            booking={b}
            selected={b.id === selectedId}
            quick={quickAction(b, today)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Dòng có 2 chỗ bấm (mở drawer + nút nhanh) nên KHÔNG thể là 1 <button> lớn
 * (button lồng button là HTML sai). Dùng "stretched link": nút mở drawer phủ cả dòng
 * bằng ::after, nút nhanh nằm trên (relative z-10).
 */
function Row({
  booking: b,
  selected,
  quick,
  onOpen,
}: {
  booking: BookingListItem;
  selected: boolean;
  quick: { action: BookingAction; label: string } | null;
  onOpen: Props["onOpen"];
}) {
  const color = avatarColor(b.customer.id);
  const late = b.is_overdue ? overdueDays(b) : 0;
  const ended = b.status === "cancelled" || b.status === "no_show";

  return (
    <div
      className={`relative grid ${COLS} min-h-16 items-center gap-[14px] border-b border-line-soft px-[18px] py-2.5 transition-colors ${
        selected
          ? "bg-gold-50 shadow-[inset_3px_0_0_var(--color-gold-500)]"
          : "hover:bg-row-hover"
      }`}
    >
      {/* Khách · Mã */}
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ background: color.bg, color: color.fg }}
          aria-hidden="true"
        >
          {initialsOfFullName(b.customer.full_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onOpen(b.id)}
              className="truncate text-left text-[13.5px] font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-navy-700"
            >
              {b.customer.full_name}
            </button>
            {b.customer.is_member && (
              <Badge className="bg-gold-50 text-gold-700">
                <Star
                  size={10}
                  fill="currentColor"
                  strokeWidth={0}
                />{" "}
                Thành viên
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12px] tabular-nums text-ink-muted">
            <span className="font-mono text-[11.5px]">{b.code}</span>
            {b.customer.phone && ` · ${formatPhone(b.customer.phone)}`}
          </span>
        </span>
      </span>

      {/* Phòng */}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold tabular-nums text-ink">
          {b.room?.room_number ?? "—"}
        </span>
        <span className="block truncate text-[12px] text-ink-muted">
          {b.room?.room_type ?? "Chưa xếp phòng"}
        </span>
      </span>

      {/* Ngày ở · Số khách */}
      <span className="min-w-0">
        <span
          className={`flex items-center gap-1.5 text-[13px] tabular-nums ${ended ? "text-ink-faint line-through" : "text-ink"}`}
        >
          <span className="whitespace-nowrap">
            {formatRange(b.check_in_date, b.check_out_date)}
          </span>
          {late > 0 && (
            <Badge className="bg-[#F8E4DF] font-semibold text-room-occupied no-underline">
              Trễ {late} ngày
            </Badge>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[12px] tabular-nums text-ink-muted">
          {b.nights} đêm · {formatGuests(b.adults, b.children)}
          <span className="rounded-[4px] border border-line px-1 text-[10.5px] text-ink-faint">
            {BOOKING_TYPE_LABELS[b.booking_type]}
          </span>
        </span>
      </span>

      {/* Trạng thái */}
      <span>
        <StatusPill status={b.status} />
      </span>

      {/* Số tiền */}
      <span
        className={`text-right text-[13.5px] font-semibold tabular-nums ${ended ? "text-ink-faint" : "text-ink"}`}
      >
        {formatAmount(b.amount)}
      </span>

      {/* Nút nhanh */}
      <span className="relative z-10 flex justify-end">
        {quick && (
          <button
            type="button"
            onClick={() => onOpen(b.id, quick.action)}
            className={`h-8 whitespace-nowrap rounded-[8px] px-3 text-[12.5px] font-semibold transition-colors ${
              quick.action === "confirm"
                ? "border border-navy-700 bg-white text-navy-700 hover:bg-navy-700 hover:text-white"
                : "bg-gold-500 text-navy-900 hover:brightness-95"
            }`}
          >
            {quick.label}
          </button>
        )}
      </span>

      <ChevronRight
        size={15}
        className="text-ink-faint"
        aria-hidden="true"
      />
    </div>
  );
}
