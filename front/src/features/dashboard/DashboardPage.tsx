import { useCallback, useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { dashboardApi } from "../../api/dashboardApi";
import { errorMessage } from "../../utils/errorMessage";
import type { DashboardOverview } from "../../types/dashboard";
import { useAuthStore } from "../auth/store/authStore";
import {
  AlertsPanel,
  BookingsTodayPanel,
  ChannelPanel,
  GuestFlowPanel,
  GuestsPanel,
  KpiRow,
  RoomStatusPanel,
} from "./components/DashboardPanels";
import { Forecast7dChart, Past7dChart } from "./components/DashboardCharts";
import { greeting, longDate } from "./utils/dashboardMeta";

/** Tự làm mới mỗi 2 phút: lễ tân để màn này mở cả ca */
const AUTO_REFRESH_MS = 120_000;
const MANAGER_ROLES = ["manager", "admin"];
/** Mảng rỗng cố định: selector Zustand không được trả mảng mới mỗi lần */
const NO_ROLES: string[] = [];
const time = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

/**
 * Trang Tổng quan: màn đầu tiên sau khi đăng nhập.
 * 1 request lấy hết số liệu; không cần store vì không trang nào khác dùng chung.
 * Lễ tân: ưu tiên vận hành ca (check-in/out, phòng, việc cần làm).
 * Quản lý: thêm chỉ số kinh doanh (doanh thu tháng, ADR, RevPAR, nguồn đặt phòng, khách hàng).
 */
export default function DashboardPage() {
  const roles = useAuthStore((s) => s.user?.roles) ?? NO_ROLES;
  const manager = roles.some((r) => MANAGER_ROLES.includes(r));
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    setLoading(true);
    try {
      setData(await dashboardApi.overview());
      setUpdatedAt(new Date());
    } catch (err) {
      if (!silent)
        toast.error(errorMessage(err, "Không tải được số liệu tổng quan"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Gọi lần đầu trong setTimeout: setState chạy sau effect, không đồng bộ trong effect
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(
      () => document.visibilityState === "visible" && void load(true),
      AUTO_REFRESH_MS,
    );
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-gold-700">
            {longDate()}
          </p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-tight text-navy-900">
            {greeting()}
          </h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {data
              ? `Tình hình khách sạn hôm nay${updatedAt ? `, cập nhật lúc ${time(updatedAt)} (tự làm mới mỗi 2 phút)` : ""}`
              : "Đang tải số liệu"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-10 items-center gap-2 rounded-[10px] border border-line-input bg-white px-3.5 text-[13.5px] font-medium text-navy-700 hover:border-navy-700 disabled:opacity-50"
        >
          <RotateCw
            size={14}
            className={loading ? "animate-spin" : ""}
          />{" "}
          Làm mới
        </button>
      </div>

      {!data ? (
        <p className="py-20 text-center text-[13px] text-ink-muted">
          {loading ? "Đang tải số liệu" : "Chưa có số liệu"}
        </p>
      ) : (
        <>
          <KpiRow
            data={data}
            manager={manager}
          />

          <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(300px,.85fr)]">
            <GuestFlowPanel
              kind="in"
              flow={data.arrivals}
            />
            <GuestFlowPanel
              kind="out"
              flow={data.departures}
            />
            <AlertsPanel data={data} />
          </div>

          <div className="grid gap-3.5 xl:grid-cols-[minmax(300px,.85fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <RoomStatusPanel rooms={data.rooms} />
            <Past7dChart data={data} />
            <Forecast7dChart data={data} />
          </div>

          <div
            className={`grid gap-3.5 ${manager ? "md:grid-cols-3" : "md:grid-cols-[minmax(0,420px)]"}`}
          >
            <BookingsTodayPanel data={data} />
            {manager && <ChannelPanel data={data} />}
            {manager && <GuestsPanel data={data} />}
          </div>
        </>
      )}
    </div>
  );
}
