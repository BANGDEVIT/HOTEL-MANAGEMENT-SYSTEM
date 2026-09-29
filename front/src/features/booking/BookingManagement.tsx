import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Plus, RotateCw } from "lucide-react";
import LoadingBar from "../../components/LoadingBar";
import { useBookingStore } from "./store/bookingStore";
import BookingStatsCards from "./components/BookingStatsCards";
import BookingToolbar from "./components/BookingToolbar";
import BookingTable from "./components/BookingTable";
import BookingDrawer from "./components/BookingDrawer";
import CreateBookingDialog from "./components/CreateBookingDialog";
import Pagination from "../customer/components/Pagination";
import type { BookingAction, BookingDetail } from "../../types/booking";

const VN_TZ = "Asia/Ho_Chi_Minh";
const time = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const todayLabel = () =>
  new Date().toLocaleDateString("vi-VN", {
    timeZone: VN_TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Booking đang mở trong drawer.
 * seq tăng mỗi lần mở -> drawer (gắn key theo seq) luôn là bản MỚI: tải lại chi tiết,
 * và intent (thao tác từ nút nhanh) chỉ chạy đúng 1 lần.
 */
interface Opened {
  id: string;
  intent?: BookingAction;
  seq: number;
}

/**
 * Trang Đặt phòng.
 * - Store: danh sách, bộ lọc, số liệu.
 * - State của trang: booking đang mở, hộp thoại tạo đặt phòng.
 * - Mở trang với ?new=1&customer=<id> (từ hồ sơ khách) -> bật luôn hộp thoại tạo, điền sẵn khách.
 */
export default function BookingManagement() {
  const stats = useBookingStore((s) => s.stats);
  const total = useBookingStore((s) => s.total);
  const totalPages = useBookingStore((s) => s.totalPages);
  const page = useBookingStore((s) => s.filters.page);
  const loading = useBookingStore((s) => s.loading);
  const lastUpdated = useBookingStore((s) => s.lastUpdated);
  const setFilters = useBookingStore((s) => s.setFilters);
  const refresh = useBookingStore((s) => s.refresh);

  const [searchParams, setSearchParams] = useSearchParams();

  const [opened, setOpened] = useState<Opened | null>(null);
  // Khởi tạo lười từ URL: không cần useEffect + setState
  const [creating, setCreating] = useState<{ customerId?: string } | null>(() =>
    searchParams.get("new")
      ? { customerId: searchParams.get("customer") ?? undefined }
      : null,
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(
    (id: string, intent?: BookingAction) =>
      setOpened((prev) => ({ id, intent, seq: (prev?.seq ?? 0) + 1 })),
    [],
  );
  const closeDrawer = useCallback(() => setOpened(null), []);

  const closeCreate = () => {
    setCreating(null);
    if (searchParams.has("new")) setSearchParams({}, { replace: true }); // F5 không bật lại hộp thoại
  };

  const handleCreated = (booking: BookingDetail) => {
    closeCreate();
    void refresh();
    open(booking.id);
  };

  const overdue = (stats?.arrivals_overdue ?? 0) + (stats?.departures_overdue ?? 0);

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-gold-700">
            Vận hành · {todayLabel()}
          </p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-tight text-navy-900">
            Đặt phòng
          </h1>
          <p className="mt-1 text-[13px] tabular-nums text-ink-secondary">
            {loading && !lastUpdated
              ? "Đang tải đặt phòng"
              : `Đến, đi trong ngày, duyệt yêu cầu online và tạo đặt phòng tại quầy${
                  lastUpdated ? `, cập nhật lúc ${time(lastUpdated)}` : ""
                }`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-[10px] border border-line-input bg-white px-3.5 text-[13.5px] font-medium text-navy-700 hover:border-navy-700 disabled:opacity-50"
          >
            <RotateCw
              size={14}
              className={loading ? "animate-spin" : ""}
            />{" "}
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setCreating({})}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-navy-700 px-4 text-[14px] font-semibold text-white hover:bg-navy-hover"
          >
            <Plus
              size={15}
              strokeWidth={2}
            />{" "}
            Tạo đặt phòng
          </button>
        </div>
      </div>

      <BookingStatsCards />

      {overdue > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-gold-500/50 bg-gold-50 px-4 py-2.5 text-[12.5px] text-[#6E5616]"
        >
          <AlertTriangle
            size={15}
            className="shrink-0"
          />
          <span>
            {stats!.arrivals_overdue > 0 && (
              <>
                <b className="font-semibold">{stats!.arrivals_overdue} khách</b> lẽ
                ra đến từ hôm trước mà chưa nhận phòng, sẽ tự chuyển{" "}
                <b className="font-semibold">Không đến</b> lúc 12:05.{" "}
              </>
            )}
            {stats!.departures_overdue > 0 && (
              <>
                <b className="font-semibold">{stats!.departures_overdue} khách</b> đã
                quá ngày trả phòng.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() =>
              setFilters({
                tab: stats!.arrivals_overdue > 0 ? "arrivals" : "departures",
              })
            }
            className="ml-auto whitespace-nowrap font-medium underline underline-offset-2"
          >
            Xem ngay
          </button>
        </div>
      )}

      {/* ===== Danh sách ===== */}
      <section
        aria-label="Danh sách đặt phòng"
        className="overflow-hidden rounded-[16px] border border-line bg-white"
      >
        <BookingToolbar />

        <div className="relative">
          <LoadingBar active={loading} />
          <div
            className={`transition-opacity ${loading && lastUpdated ? "pointer-events-none opacity-50" : ""}`}
          >
            <BookingTable
              selectedId={opened?.id ?? null}
              onOpen={open}
            />
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line-soft px-[18px] py-3">
            <span className="text-[12.5px] tabular-nums text-ink-muted">
              Trang {page} trên {totalPages} · {total} đặt phòng
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              disabled={loading}
              onChange={(p) => setFilters({ page: p })}
            />
          </div>
        )}
      </section>

      <BookingDrawer
        opened={opened}
        onClose={closeDrawer}
        onChanged={() => void refresh()}
      />

      {creating && (
        <CreateBookingDialog
          initialCustomerId={creating.customerId}
          onClose={closeCreate}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
