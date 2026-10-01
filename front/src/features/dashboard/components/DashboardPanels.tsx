/**
 * Các khung của trang Tổng quan. Mỗi khung nhận đúng phần số liệu nó cần (props),
 * không tự gọi API -> trang cha tải 1 lần, làm mới 1 lần.
 */
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarClock,
  CalendarPlus,
  Check,
  DoorOpen,
  Gauge,
  Inbox,
  LogIn,
  LogOut,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  DashboardGuest,
  DashboardOverview,
  GuestFlow,
} from "../../../types/dashboard";
import {
  formatMoney,
  formatMoneyShort,
  hhmm,
  percentChange,
  ROUTES,
  roomsLink,
} from "../utils/dashboardMeta";

/* ============================ Hàng KPI ============================ */

interface Kpi {
  label: string;
  icon: LucideIcon;
  tint: string;
  value: React.ReactNode;
  note: React.ReactNode;
  title?: string;
}

/** "↑ 12% so với hôm qua"; kỳ trước = 0 thì không so được */
function Change({
  now,
  before,
  label,
}: {
  now: number;
  before: number;
  label: string;
}) {
  const pct = percentChange(now, before);
  if (pct === null)
    return <>{before === 0 && now > 0 ? `${label} chưa có thu` : `bằng ${label}`}</>;
  return (
    <span
      style={{
        color:
          pct >= 0 ? "var(--color-room-available)" : "var(--color-room-occupied)",
      }}
    >
      {pct >= 0 ? "↑" : "↓"} {Math.abs(pct)}% so với {label}
    </span>
  );
}

/**
 * Quản lý: công suất, thực thu hôm nay / tháng, ADR, RevPAR, phòng trống.
 * Lễ tân: bỏ doanh thu tháng, ADR, RevPAR (chỉ số kinh doanh, không phục vụ vận hành ca).
 */
export function KpiRow({
  data: d,
  manager,
}: {
  data: DashboardOverview;
  manager: boolean;
}) {
  const sellable = d.rooms.total - d.rooms.inactive - d.rooms.maintenance;
  const cards: (Kpi | false)[] = [
    {
      label: "Công suất lúc này",
      icon: Gauge,
      tint: "var(--color-navy-600)",
      value: `${d.rooms.occupancy}%`,
      note: `${d.in_house_rooms} phòng có khách · ${d.in_house} đặt phòng`,
    },
    {
      label: "Thực thu hôm nay",
      icon: Wallet,
      tint: "var(--color-room-available)",
      value: formatMoneyShort(d.collected_today),
      title: formatMoney(d.collected_today),
      note: (
        <Change
          now={d.collected_today}
          before={d.collected_yesterday}
          label="hôm qua"
        />
      ),
    },
    manager && {
      label: "Thực thu tháng này",
      icon: TrendingUp,
      tint: "var(--color-shift-night)",
      value: formatMoneyShort(d.collected_month),
      title: "So với cùng số ngày của tháng trước",
      note: (
        <Change
          now={d.collected_month}
          before={d.collected_prev_month}
          label="tháng trước"
        />
      ),
    },
    manager && {
      label: "ADR đêm nay",
      icon: BedDouble,
      tint: "var(--color-gold-700)",
      value: d.rate_today.adr ? formatMoney(d.rate_today.adr) : "–",
      title: "ADR: giá phòng trung bình đã bán = tiền phòng / số phòng bán",
      note: `tháng này ${d.rate_month.adr ? formatMoney(d.rate_month.adr) : "–"}`,
    },
    manager && {
      label: "RevPAR đêm nay",
      icon: TrendingUp,
      tint: "var(--color-gold-700)",
      value: d.rate_today.revpar ? formatMoney(d.rate_today.revpar) : "–",
      title: "RevPAR: tiền phòng / số phòng đang kinh doanh (tính cả phòng trống)",
      note: `tháng này ${d.rate_month.revpar ? formatMoney(d.rate_month.revpar) : "–"}`,
    },
    {
      label: "Phòng trống",
      icon: DoorOpen,
      tint: "var(--color-room-available)",
      value: (
        <>
          {d.rooms.available}
          <span className="text-[14px] font-medium text-ink-faint">
            {" "}
            / {sellable}
          </span>
        </>
      ),
      note: d.rooms.reserved_today
        ? `${d.rooms.reserved_today} phòng giữ cho khách đến hôm nay`
        : "không giữ cho khách nào hôm nay",
    },
  ];

  const list = cards.filter((c): c is Kpi => !!c);
  return (
    <div
      className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${list.length > 3 ? "xl:grid-cols-6" : ""}`}
    >
      {list.map(({ label, icon: Icon, tint, value, note, title }) => (
        <div
          key={label}
          className="min-w-0 rounded-[16px] border border-line bg-white px-4 py-3.5"
          title={title}
        >
          <p className="flex items-center gap-2 text-[12.5px] text-ink-secondary">
            <Icon
              size={14}
              strokeWidth={1.9}
              style={{ color: tint }}
              aria-hidden="true"
            />
            <span className="truncate">{label}</span>
          </p>
          <p className="mt-1 truncate text-[22px] font-bold leading-tight tabular-nums text-ink">
            {value}
          </p>
          <p className="mt-2.5 truncate border-t border-line-soft pt-2 text-[11.5px] text-ink-faint">
            {note}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ============================ Khung chung ============================ */

function Panel({
  title,
  icon: Icon,
  badge,
  action,
  children,
  className = "",
}: {
  title: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  action?: { label: string; to: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-[16px] border border-line bg-white ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
        <h2 className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[13.5px] font-semibold text-ink">
          <Icon
            size={15}
            className="shrink-0 text-ink-faint"
            aria-hidden="true"
          />{" "}
          {title} {badge}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-navy-700 hover:underline"
          >
            {action.label} <ArrowRight size={13} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/* ============================ Check-in / Check-out hôm nay ============================ */

const ROOM_STATE: Record<
  DashboardGuest["room_state"],
  { label: string; color: string }
> = {
  ready: { label: "Phòng sẵn sàng", color: "var(--color-room-available)" },
  cleaning: { label: "Phòng chưa dọn", color: "var(--color-room-cleaning)" },
  occupied: { label: "Còn khách cũ", color: "var(--color-room-occupied)" },
  blocked: { label: "Phòng bảo trì", color: "var(--color-room-occupied)" },
};

export function GuestFlowPanel({
  kind,
  flow,
}: {
  kind: "in" | "out";
  flow: GuestFlow;
}) {
  const arriving = kind === "in";
  const hidden = flow.total - flow.items.length;

  return (
    <Panel
      title={arriving ? "Check-in hôm nay" : "Check-out hôm nay"}
      icon={arriving ? LogIn : LogOut}
      badge={
        <span className="rounded-full bg-segment px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-ink-secondary">
          {flow.done}/{flow.total} {arriving ? "đã nhận" : "đã trả"}
        </span>
      }
      action={{ label: "Đặt phòng", to: ROUTES.bookings }}
    >
      {flow.items.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12.5px] text-ink-faint">
          {arriving
            ? "Hôm nay không có khách đến."
            : "Hôm nay không có khách trả phòng."}
        </p>
      ) : (
        <ul className="px-2 py-1.5">
          {flow.items.map((g) => {
            const state = ROOM_STATE[g.room_state];
            return (
              <li
                key={g.booking_id}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    g.done
                      ? "bg-[#E2F1EA] text-room-available"
                      : g.overdue
                        ? "bg-[#F8E4DF] text-room-occupied"
                        : "bg-segment text-ink-muted"
                  }`}
                  aria-hidden="true"
                >
                  {g.done ? (
                    <Check
                      size={14}
                      strokeWidth={2.5}
                    />
                  ) : g.overdue ? (
                    <AlertTriangle size={13} />
                  ) : (
                    <CalendarClock size={13} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[13px] font-semibold ${g.done ? "text-ink-muted" : "text-ink"}`}
                  >
                    {g.customer_name}
                  </span>
                  <span className="block truncate text-[11.5px] tabular-nums text-ink-faint">
                    Phòng {g.rooms.join(", ")} · {g.nights} đêm
                    {arriving && !g.done && (
                      <span
                        style={{ color: state.color }}
                        className="font-medium"
                      >
                        {" "}
                        · {state.label}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={`whitespace-nowrap text-[11.5px] font-medium tabular-nums ${
                    g.done
                      ? "text-room-available"
                      : g.overdue
                        ? "text-room-occupied"
                        : "text-ink-muted"
                  }`}
                >
                  {g.done
                    ? `${arriving ? "Đã nhận" : "Đã trả"}${g.at ? ` ${hhmm(g.at)}` : ""}`
                    : g.overdue
                      ? arriving
                        ? "Trễ ngày đến"
                        : "Quá hạn trả"
                      : arriving
                        ? "Chờ đến"
                        : "Chờ trả"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-auto border-t border-line-soft px-5 py-2.5 text-[11.5px] text-ink-faint">
        {hidden > 0 && `và ${hidden} khách khác · `}
        {arriving ? "Nhận phòng từ 14:00" : "Trả phòng trước 12:00"}
      </p>
    </Panel>
  );
}

/* ============================ Cần xử lý ============================ */

type Level = "high" | "mid" | "ok";
const LEVEL: Record<Level, string> = {
  high: "var(--color-room-occupied)",
  mid: "var(--color-room-cleaning)",
  ok: "var(--color-room-available)",
};

/** Việc cần làm, xếp theo mức ưu tiên: đỏ (gấp) -> vàng (trong ca) -> xanh (thông tin tốt) */
export function AlertsPanel({ data: d }: { data: DashboardOverview }) {
  const a = d.alerts;
  const rows: {
    show: boolean;
    level: Level;
    icon: LucideIcon;
    count: number;
    text: string;
    to: string;
  }[] = [
    {
      show: a.pending_requests > 0,
      level: "high",
      icon: Inbox,
      count: a.pending_requests,
      text: "đặt phòng online chờ duyệt",
      to: ROUTES.bookings,
    },
    {
      show: a.not_ready_for_check_in > 0,
      level: "high",
      icon: BedDouble,
      count: a.not_ready_for_check_in,
      text: "khách sắp đến mà phòng chưa sẵn sàng",
      to: ROUTES.bookings,
    },
    {
      show: a.arrivals_overdue > 0,
      level: "high",
      icon: AlertTriangle,
      count: a.arrivals_overdue,
      text: 'khách trễ ngày đến, tự chuyển "Không đến" lúc 12:05',
      to: ROUTES.bookings,
    },
    {
      show: a.departures_overdue > 0,
      level: "high",
      icon: AlertTriangle,
      count: a.departures_overdue,
      text: "khách quá ngày trả phòng",
      to: ROUTES.bookings,
    },
    {
      show: a.debt_count > 0,
      level: "high",
      icon: Wallet,
      count: a.debt_count,
      text: `hoá đơn công nợ, còn thiếu ${formatMoney(a.debt_amount)}`,
      to: ROUTES.invoices,
    },
    {
      show: a.rooms_maintenance > 0,
      level: "high",
      icon: Wrench,
      count: a.rooms_maintenance,
      text: `phòng bảo trì: ${d.rooms.maintenance_rooms.join(", ")}`,
      to: roomsLink("maintenance"),
    },
    {
      show: a.rooms_cleaning > 0,
      level: "mid",
      icon: Sparkles,
      count: a.rooms_cleaning,
      text: `phòng chờ dọn: ${d.rooms.cleaning_rooms.join(", ")}`,
      to: roomsLink("cleaning"),
    },
    {
      show: a.ready_for_check_in > 0,
      level: "ok",
      icon: Check,
      count: a.ready_for_check_in,
      text: "phòng đã sẵn sàng cho khách đến hôm nay",
      to: ROUTES.bookings,
    },
  ];
  const visible = rows.filter((r) => r.show);
  const urgent = visible
    .filter((r) => r.level === "high")
    .reduce((s, r) => s + r.count, 0);

  return (
    <Panel
      title="Cần xử lý"
      icon={AlertTriangle}
      badge={
        urgent > 0 && (
          <span className="rounded-full bg-room-occupied px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {urgent}
          </span>
        )
      }
      className={urgent ? "border-[#E7C3BA]" : ""}
    >
      {visible.length === 0 ? (
        <p className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center text-[12.5px] text-ink-faint">
          <Check
            size={20}
            className="text-room-available"
            aria-hidden="true"
          />{" "}
          Không có việc tồn đọng.
        </p>
      ) : (
        <ul className="px-2 py-1.5">
          {visible.map(({ level, icon: Icon, count, text, to }) => (
            <li key={text}>
              <Link
                to={to}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-cream-50"
              >
                <span
                  className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-[8px] px-1.5 text-[12.5px] font-bold tabular-nums"
                  style={{
                    color: LEVEL[level],
                    background: `color-mix(in srgb, ${LEVEL[level]} 12%, white)`,
                  }}
                >
                  {count}
                </span>
                <Icon
                  size={14}
                  className="shrink-0 text-ink-faint"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">
                  {text}
                </span>
                <ArrowRight
                  size={14}
                  className="shrink-0 text-ink-faint"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ============================ Tình trạng phòng ============================ */

const ROOM_PARTS = [
  { key: "available", label: "Trống", color: "var(--color-room-available)" },
  { key: "occupied", label: "Có khách", color: "var(--color-room-occupied)" },
  { key: "cleaning", label: "Đang dọn", color: "var(--color-room-cleaning)" },
  { key: "maintenance", label: "Bảo trì", color: "var(--color-room-maintenance)" },
  {
    key: "inactive",
    label: "Ngừng kinh doanh",
    color: "var(--color-room-inactive)",
  },
] as const;

/** Mỗi trạng thái là 1 link sang trang Phòng, lọc sẵn trạng thái đó */
export function RoomStatusPanel({
  rooms: r,
}: {
  rooms: DashboardOverview["rooms"];
}) {
  return (
    <Panel
      title="Tình trạng phòng"
      icon={BedDouble}
      action={{ label: "Xem sơ đồ phòng", to: ROUTES.rooms }}
    >
      <div className="px-5 pt-4">
        <span
          className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          {ROOM_PARTS.filter((p) => r[p.key]).map((p) => (
            <span
              key={p.key}
              style={{
                width: `${(r[p.key] / Math.max(1, r.total)) * 100}%`,
                background: p.color,
              }}
            />
          ))}
        </span>
      </div>
      <ul className="px-2 py-2">
        {ROOM_PARTS.map((p) => (
          <li key={p.key}>
            <Link
              to={roomsLink(p.key)}
              className="flex items-center justify-between gap-3 rounded-[8px] px-3 py-1.5 text-[13px] hover:bg-cream-50"
            >
              <span className="flex items-center gap-2 text-ink-secondary">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: p.color }}
                  aria-hidden="true"
                />
                {p.label}
                {p.key === "available" && r.reserved_today > 0 && (
                  <span className="text-[11.5px] text-ink-faint">
                    · {r.reserved_today} giữ cho khách đến hôm nay
                  </span>
                )}
              </span>
              <b className="font-semibold tabular-nums text-ink">{r[p.key]}</b>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-auto border-t border-line-soft px-5 py-2.5 text-[11.5px] tabular-nums text-ink-faint">
        Tổng {r.total} phòng · bấm 1 trạng thái để xem danh sách
      </p>
    </Panel>
  );
}

/* ============================ Đặt phòng, nguồn, khách hàng ============================ */

function StatList({
  rows,
}: {
  rows: { label: string; value: React.ReactNode; color?: string }[];
}) {
  return (
    <ul className="grid gap-2 px-5 py-4 text-[13px]">
      {rows.map((x) => (
        <li
          key={x.label}
          className="flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2 text-ink-secondary">
            {x.color && (
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: x.color }}
                aria-hidden="true"
              />
            )}
            {x.label}
          </span>
          <b className="font-semibold tabular-nums text-ink">{x.value}</b>
        </li>
      ))}
    </ul>
  );
}

export function BookingsTodayPanel({ data: d }: { data: DashboardOverview }) {
  const b = d.bookings_today;
  return (
    <Panel
      title="Đặt phòng mới hôm nay"
      icon={CalendarPlus}
      badge={
        <span className="text-[12px] font-normal tabular-nums text-ink-faint">
          {b.total}
        </span>
      }
      action={{ label: "Xem", to: ROUTES.bookings }}
    >
      <StatList
        rows={[
          {
            label: "Đã xác nhận",
            value: b.confirmed,
            color: "var(--color-room-available)",
          },
          { label: "Chờ duyệt", value: b.pending, color: "var(--color-gold-500)" },
          {
            label: "Đã huỷ / từ chối",
            value: b.cancelled,
            color: "var(--color-room-inactive)",
          },
        ]}
      />
    </Panel>
  );
}

const CHANNEL_LABEL = {
  online: "Khách tự đặt online",
  walk_in: "Lễ tân tạo (tại quầy, điện thoại)",
};

/** Chỉ có 2 nguồn thật trong hệ thống; chưa kết nối OTA (Booking.com, Agoda) */
export function ChannelPanel({ data: d }: { data: DashboardOverview }) {
  const total = d.channels_month.reduce((s, c) => s + c.amount, 0);
  return (
    <Panel
      title="Thực thu theo nguồn đặt phòng"
      icon={TrendingUp}
    >
      <ul className="grid gap-3.5 px-5 py-4">
        {d.channels_month.map((c) => {
          const pct = total ? Math.round((c.amount / total) * 100) : 0;
          return (
            <li key={c.channel}>
              <p className="flex justify-between gap-3 text-[13px]">
                <span className="text-ink-secondary">
                  {CHANNEL_LABEL[c.channel]}
                </span>
                <b
                  className="font-semibold tabular-nums text-ink"
                  title={formatMoney(c.amount)}
                >
                  {formatMoneyShort(c.amount)}
                </b>
              </p>
              <span
                className="mt-1.5 block h-2 overflow-hidden rounded-full bg-segment"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-navy-700"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <p className="mt-1 text-[11px] tabular-nums text-ink-faint">
                {pct}% · {c.bookings} đặt phòng
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto border-t border-line-soft px-5 py-2.5 text-[11.5px] text-ink-faint">
        Tháng này, không tính phiếu đã huỷ
      </p>
    </Panel>
  );
}

export function GuestsPanel({ data: d }: { data: DashboardOverview }) {
  const g = d.guests;
  return (
    <Panel
      title="Khách hàng"
      icon={Users}
    >
      <StatList
        rows={[
          { label: "Đang lưu trú", value: `${g.in_house_guests} người` },
          { label: "Khách mới tháng này", value: g.new_this_month },
          { label: "Khách quay lại tháng này", value: g.returning_this_month },
          { label: "Thành viên", value: g.members },
        ]}
      />
    </Panel>
  );
}
