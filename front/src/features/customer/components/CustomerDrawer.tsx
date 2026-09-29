import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarPlus,
  Eye,
  EyeOff,
  FileImage,
  Pencil,
  Star,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { customerApi } from "../../../api/customerApi";
import { errorMessage } from "../../../utils/errorMessage";
import {
  BOOKING_STATUS_LABELS,
  ID_TYPE_LABELS,
  REGULAR_MIN_STAYS,
  SOURCE_LABELS,
  type BookingStatus,
  type CustomerBooking,
  type CustomerDetail,
  type CustomerNote,
} from "../../../types/customer";
import {
  avatarColor,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatMoney,
  formatMoneyShort,
  formatMonthYear,
  formatNumber,
  formatPhone,
  initialsOf,
  maskIdCard,
} from "../utils/format";
import { StayPill } from "./CustomerTable";

interface Props {
  customerId: string | null;
  /** Tăng số này để ngăn tải lại dữ liệu (VD sau khi sửa hồ sơ) */
  version: number;
  onClose: () => void;
  onEdit: (customer: CustomerDetail) => void;
  /** Hồ sơ vừa đổi (thêm tài khoản...) -> trang cha tải lại danh sách */
  onChanged: () => void;
}

type Tab = "profile" | "bookings" | "notes";

/**
 * Ngăn trượt bên phải. Khung ngoài LUÔN được render để chạy hiệu ứng trượt vào / ra;
 * phần nội dung gắn key theo id khách -> đổi khách thì state bên trong (tab, form...) tự về mặc định.
 */
export default function CustomerDrawer({
  customerId,
  version,
  onClose,
  onEdit,
  onChanged,
}: Props) {
  const open = customerId !== null;

  // Esc để đóng
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      aria-label="Hồ sơ khách hàng"
      aria-hidden={!open}
      className={`fixed inset-y-0 right-0 z-40 flex w-[440px] max-w-full flex-col border-l border-line bg-white shadow-[-12px_0_40px_rgba(20,38,59,.18)] transition-transform duration-200 ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {customerId && (
        <DrawerBody
          key={`${customerId}-${version}`}
          customerId={customerId}
          onClose={onClose}
          onEdit={onEdit}
          onChanged={onChanged}
        />
      )}
    </aside>
  );
}

/* ============================ Nội dung ngăn ============================ */

function DrawerBody({
  customerId,
  onClose,
  onEdit,
  onChanged,
}: Omit<Props, "version" | "customerId"> & { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const navigate = useNavigate();

  // Tải 3 thứ song song. Cờ "cancelled": đóng ngăn / đổi khách khi request chưa về thì bỏ kết quả
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      customerApi.detail(customerId),
      customerApi.bookings(customerId),
      customerApi.notes(customerId),
    ])
      .then(([d, b, n]) => {
        if (cancelled) return;
        setCustomer(d);
        setBookings(b);
        setNotes(n);
      })
      .catch(
        (err) =>
          !cancelled && setError(errorMessage(err, "Không tải được hồ sơ khách")),
      );
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (error) {
    return (
      <div className="p-6">
        <CloseButton
          onClose={onClose}
          dark={false}
        />
        <p className="mt-10 text-center text-[13px] text-room-occupied">{error}</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="h-[200px] animate-pulse bg-navy-700" />
        <p className="py-10 text-center text-[13px] text-ink-muted">
          Đang tải hồ sơ
        </p>
      </div>
    );
  }

  const color = avatarColor(customer.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ===== Đầu ngăn (nền navy) ===== */}
      <header className="bg-navy-700 px-5 pb-4 pt-5 text-white">
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold ring-2 ring-gold-500"
            style={{ background: color.bg, color: color.fg }}
            aria-hidden="true"
          >
            {initialsOf(customer.first_name, customer.last_name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[22px] font-bold leading-tight">
              {customer.full_name}
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-on-navy-muted">
              <span className="tabular-nums">
                {formatPhone(customer.phone) || "Chưa có SĐT"}
              </span>
              {customer.email && (
                <span className="block truncate">{customer.email}</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {/* Sang màn Đặt phòng, tự mở hộp thoại tạo với khách này (BookingManagement đọc ?new=1&customer=) */}
            <button
              type="button"
              onClick={() =>
                navigate(`/admin/bookings?new=1&customer=${customer.id}`)
              }
              className="flex h-8 items-center gap-1.5 rounded-[8px] bg-gold-500 px-3 text-[12.5px] font-semibold text-navy-900 hover:brightness-95"
            >
              <CalendarPlus size={13} /> Đặt phòng
            </button>
            <button
              type="button"
              onClick={() => onEdit(customer)}
              className="flex h-8 items-center gap-1.5 rounded-[8px] border border-white/25 px-3 text-[12.5px] font-medium hover:bg-white/10"
            >
              <Pencil size={13} /> Sửa
            </button>
            <CloseButton
              onClose={onClose}
              dark
            />
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {customer.stay_status !== "none" && (
            <span className="rounded-full bg-white px-0.5">
              <StayPill customer={customer} />
            </span>
          )}
          {customer.is_member && customer.member_since && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gold-500 px-2.5 py-1 text-[11.5px] font-semibold text-navy-900">
              <Star
                size={11}
                fill="currentColor"
                strokeWidth={0}
              />
              Thành viên từ {formatMonthYear(customer.member_since)}
            </span>
          )}
          {customer.stays >= REGULAR_MIN_STAYS && (
            <span className="whitespace-nowrap rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] font-medium">
              Khách quen
            </span>
          )}
          {customer.account_active === false && (
            <span className="whitespace-nowrap rounded-full bg-[#F8E4DF] px-2.5 py-1 text-[11.5px] font-semibold text-room-occupied">
              Tài khoản đã khoá
            </span>
          )}
        </div>
      </header>

      {/* ===== 3 số liệu ===== */}
      <div className="grid grid-cols-3 border-b border-line">
        <Stat
          label="Số lần ở"
          value={formatNumber(customer.stays)}
        />
        <Stat
          label="Tổng đã trả"
          value={formatMoneyShort(customer.total_spent)}
          title={formatMoney(customer.total_spent)}
        />
        <Stat
          label="Điểm thưởng"
          value={formatNumber(customer.reward_points)}
          gold
        />
      </div>

      {/* ===== Tab ===== */}
      <div
        role="tablist"
        className="flex gap-5 border-b border-line px-5"
      >
        {(
          [
            ["profile", "Hồ sơ", undefined],
            ["bookings", "Đặt phòng", bookings.length],
            ["notes", "Ghi chú", notes.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px h-11 border-b-2 text-[13px] transition-colors ${
              tab === key
                ? "border-gold-500 font-semibold text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {label}
            {count !== undefined && (
              <span className="ml-1 font-normal tabular-nums text-ink-faint">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "profile" && (
          <ProfileTab
            customer={customer}
            bookings={bookings}
            notes={notes}
            onShowTab={setTab}
            onLinked={(email) => {
              setCustomer({
                ...customer,
                is_member: true,
                account_active: true,
                member_since: new Date().toISOString(),
                account: { id: "", email, is_active: true },
              });
              onChanged();
            }}
          />
        )}
        {tab === "bookings" && <BookingList bookings={bookings} />}
        {tab === "notes" && (
          <NotesTab
            customerId={customer.id}
            notes={notes}
            onChange={setNotes}
          />
        )}
      </div>
    </div>
  );
}

/* ============================ Tab Hồ sơ ============================ */

function ProfileTab({
  customer,
  bookings,
  notes,
  onShowTab,
  onLinked,
}: {
  customer: CustomerDetail;
  bookings: CustomerBooking[];
  notes: CustomerNote[];
  onShowTab: (tab: Tab) => void;
  onLinked: (email: string) => void;
}) {
  const [showId, setShowId] = useState(false);

  return (
    <>
      <Section title="Thông tin">
        <dl className="grid grid-cols-[104px_1fr] gap-y-2 text-[13px]">
          <dt className="text-ink-muted">Giấy tờ</dt>
          <dd className="tabular-nums text-ink">
            {customer.id_type && customer.id_card ? (
              <span className="inline-flex items-center gap-2">
                {ID_TYPE_LABELS[customer.id_type]}{" "}
                {showId ? customer.id_card : maskIdCard(customer.id_card)}
                <button
                  type="button"
                  onClick={() => setShowId((v) => !v)}
                  aria-label={showId ? "Ẩn số giấy tờ" : "Hiện số giấy tờ"}
                  className="text-ink-faint hover:text-navy-700"
                >
                  {showId ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </span>
            ) : (
              <span className="text-room-occupied">
                Chưa có, bổ sung khi nhận phòng
              </span>
            )}
          </dd>
          <dt className="text-ink-muted">Quốc tịch</dt>
          <dd className="text-ink">{customer.nationality ?? "—"}</dd>
          <dt className="text-ink-muted">Nguồn</dt>
          <dd className="text-ink">
            {SOURCE_LABELS[customer.source]}, {formatDate(customer.created_at)}
          </dd>
          <dt className="text-ink-muted">Tài khoản</dt>
          <dd className="text-ink">
            {customer.account ? (
              <>
                {customer.account.email}
                {!customer.account.is_active && (
                  <span className="ml-1.5 text-room-occupied">(đã khoá)</span>
                )}
              </>
            ) : (
              <span className="text-ink-faint">
                Khách vãng lai, chưa có tài khoản
              </span>
            )}
          </dd>
        </dl>
      </Section>

      {!customer.is_member && (
        <LinkAccountForm
          customer={customer}
          onLinked={onLinked}
        />
      )}

      <Section title="Ảnh giấy tờ">
        <div className="grid grid-cols-2 gap-2.5">
          <IdImage
            url={customer.id_card_img_url}
            label="Mặt trước"
          />
          <IdImage
            url={customer.id_card_img_back_url}
            label="Mặt sau"
          />
        </div>
      </Section>

      <Section
        title="Ghi chú nội bộ"
        action={
          notes.length > 0
            ? { label: `Xem cả ${notes.length}`, onClick: () => onShowTab("notes") }
            : undefined
        }
      >
        {notes.length === 0 ? (
          <button
            type="button"
            onClick={() => onShowTab("notes")}
            className="text-[12.5px] text-navy-700 hover:underline"
          >
            Thêm ghi chú đầu tiên
          </button>
        ) : (
          <NoteCard note={notes[0]} />
        )}
      </Section>

      <Section
        title="Đặt phòng gần đây"
        action={
          bookings.length > 3
            ? {
                label: `Xem cả ${bookings.length}`,
                onClick: () => onShowTab("bookings"),
              }
            : undefined
        }
      >
        <BookingList
          bookings={bookings.slice(0, 3)}
          compact
        />
      </Section>
    </>
  );
}

function LinkAccountForm({
  customer,
  onLinked,
}: {
  customer: CustomerDetail;
  onLinked: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(customer.email ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <div className="border-b border-line-soft px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-navy-700 hover:underline"
        >
          <UserPlus size={14} /> Tạo tài khoản thành viên cho khách
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await customerApi.linkAccount(customer.id, { email: email.trim(), password });
      toast.success(`Đã tạo tài khoản cho ${customer.full_name}`);
      onLinked(email.trim().toLowerCase());
    } catch (err) {
      toast.error(errorMessage(err, "Không tạo được tài khoản"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-b border-line-soft bg-cream-50 px-5 py-4"
    >
      <p className="mb-3 text-[13px] font-semibold text-ink">
        Tạo tài khoản thành viên
      </p>
      <div className="grid gap-2.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email đăng nhập"
          className="h-10 rounded-[10px] border border-line-input bg-white px-3 text-[13px] focus:border-navy-700 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu tạm (khách đổi sau)"
          autoComplete="new-password"
          className="h-10 rounded-[10px] border border-line-input bg-white px-3 text-[13px] focus:border-navy-700 focus:outline-none"
        />
        <p className="text-[11.5px] text-ink-faint">
          8–72 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 rounded-[9px] border border-line-input bg-white px-3.5 text-[12.5px]"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-9 rounded-[9px] bg-navy-700 px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Đang tạo" : "Tạo tài khoản"}
        </button>
      </div>
    </form>
  );
}

/* ============================ Tab Đặt phòng ============================ */

const BOOKING_COLOR: Record<BookingStatus, string> = {
  pending: "var(--color-room-cleaning)",
  confirmed: "var(--color-navy-700)",
  checked_in: "var(--color-room-available)",
  checked_out: "var(--color-room-maintenance)",
  cancelled: "var(--color-room-occupied)",
  no_show: "var(--color-room-inactive)",
};

function BookingList({
  bookings,
  compact = false,
}: {
  bookings: CustomerBooking[];
  compact?: boolean;
}) {
  if (bookings.length === 0) {
    return (
      <p
        className={`${compact ? "" : "px-5 py-8 text-center"} text-[12.5px] text-ink-faint`}
      >
        Chưa có lần đặt phòng nào.
      </p>
    );
  }

  return (
    <ul className={compact ? "" : "px-5 py-2"}>
      {bookings.map((b) => {
        const color = BOOKING_COLOR[b.status];
        const cancelled = b.status === "cancelled" || b.status === "no_show";
        return (
          <li
            key={b.id}
            className="flex items-start justify-between gap-3 border-b border-line-soft py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p
                className={`truncate text-[13px] font-semibold ${cancelled ? "text-ink-muted line-through" : "text-ink"}`}
              >
                {b.rooms.map((r) => `Phòng ${r.room_number}`).join(", ") ||
                  "Chưa xếp phòng"}
                <span className="ml-1.5 font-normal text-ink-muted">
                  {[...new Set(b.rooms.map((r) => r.room_type))].join(", ")}
                </span>
              </p>
              <p className="mt-0.5 text-[12px] tabular-nums text-ink-muted">
                {formatDayMonth(b.check_in_date)} – {formatDate(b.check_out_date)},{" "}
                {b.nights} đêm
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span
                className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  color,
                  background: `color-mix(in srgb, ${color} 10%, transparent)`,
                }}
              >
                {BOOKING_STATUS_LABELS[b.status]}
              </span>
              <p
                className={`mt-1 text-[12.5px] font-semibold tabular-nums ${cancelled ? "text-ink-faint" : "text-ink"}`}
              >
                {formatMoney(b.amount)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ============================ Tab Ghi chú ============================ */

const NOTE_MAX = 500;

function NotesTab({
  customerId,
  notes,
  onChange,
}: {
  customerId: string;
  notes: CustomerNote[];
  onChange: (notes: CustomerNote[]) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSaving(true);
    try {
      const note = await customerApi.addNote(customerId, content);
      onChange([note, ...notes]); // mới nhất lên đầu, không cần tải lại
      setText("");
      toast.success("Đã lưu ghi chú");
    } catch (err) {
      toast.error(errorMessage(err, "Không lưu được ghi chú"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (noteId: string) => {
    setConfirmId(null);
    try {
      await customerApi.deleteNote(customerId, noteId);
      onChange(notes.filter((n) => n.id !== noteId));
      toast.success("Đã xoá ghi chú");
    } catch (err) {
      // BE trả 403 nếu không phải người viết và không phải quản lý
      toast.error(errorMessage(err, "Không xoá được ghi chú"));
    }
  };

  return (
    <div className="px-5 py-4">
      <form onSubmit={add}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          placeholder="Ghi chú cho lễ tân ca sau: sở thích, yêu cầu đặc biệt..."
          className="w-full resize-none rounded-[10px] border border-line-input px-3 py-2.5 text-[13px] leading-relaxed focus:border-navy-700 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11.5px] tabular-nums text-ink-faint">
            {text.length}/{NOTE_MAX}
          </span>
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="h-9 rounded-[9px] bg-navy-700 px-4 text-[12.5px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu" : "Lưu ghi chú"}
          </button>
        </div>
      </form>

      <ul className="mt-4 grid gap-2.5">
        {notes.map((n) => (
          <li
            key={n.id}
            className="group relative"
          >
            <NoteCard note={n} />
            {confirmId === n.id ? (
              <div className="mt-1.5 flex items-center justify-end gap-2 text-[12px]">
                <span className="text-ink-secondary">Xoá ghi chú này?</span>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="font-semibold text-destructive"
                >
                  Xoá
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  className="text-ink-muted"
                >
                  Huỷ
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Xoá ghi chú"
                onClick={() => setConfirmId(n.id)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-ink-faint opacity-0 hover:bg-white hover:text-destructive focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {notes.length === 0 && (
        <p className="mt-6 text-center text-[12.5px] text-ink-faint">
          Chưa có ghi chú nào.
        </p>
      )}
    </div>
  );
}

/* ============================ Mảnh nhỏ dùng chung ============================ */

function NoteCard({ note }: { note: CustomerNote }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-cream-50 px-3.5 py-2.5 pr-10">
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink">
        {note.content}
      </p>
      <p className="mt-1.5 text-[11.5px] tabular-nums text-ink-faint">
        {note.author.full_name}, {formatDateTime(note.created_at)}
      </p>
    </div>
  );
}

function IdImage({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <div className="flex aspect-[1.6] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-input text-[11.5px] text-ink-faint">
        <FileImage
          size={16}
          strokeWidth={1.6}
        />
        Chưa có {label.toLowerCase()}
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative block aspect-[1.6] overflow-hidden rounded-[10px] border border-line bg-cream-50"
    >
      <img
        src={url}
        alt={`Ảnh giấy tờ ${label.toLowerCase()}`}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <span className="absolute bottom-1.5 left-1.5 rounded-[5px] bg-navy-900/70 px-1.5 py-0.5 text-[10.5px] text-white">
        {label}
      </span>
    </a>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line-soft px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[12.5px] text-navy-700 hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  title,
  gold = false,
}: {
  label: string;
  value: string;
  title?: string;
  gold?: boolean;
}) {
  return (
    <div
      className="border-r border-line px-5 py-3.5 last:border-r-0"
      title={title}
    >
      <p className="whitespace-nowrap text-[12px] text-ink-muted">{label}</p>
      <p
        className={`mt-1 whitespace-nowrap text-[20px] font-bold tabular-nums ${gold ? "text-gold-700" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function CloseButton({ onClose, dark }: { onClose: () => void; dark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Đóng hồ sơ"
      className={`flex h-8 w-8 items-center justify-center rounded-[8px] ${
        dark
          ? "bg-white/10 text-white hover:bg-white/20"
          : "ml-auto text-ink-muted hover:bg-segment"
      }`}
    >
      <X size={16} />
    </button>
  );
}
