import { useCallback, useEffect, useState } from "react";
import { CalendarRange, RotateCw } from "lucide-react";
import LoadingBar from "../../components/LoadingBar";
import { useInvoiceStore } from "./store/invoiceStore";
import InvoiceStatsCards from "./components/InvoiceStatsCards";
import InvoiceInsights from "./components/InvoiceInsights";
import InvoiceToolbar from "./components/InvoiceToolbar";
import InvoiceTable from "./components/InvoiceTable";
import InvoiceDrawer from "./components/InvoiceDrawer";
import Pagination from "../customer/components/Pagination";
import { RANGE_PRESET_LABELS, type RangePreset } from "../../types/invoice";
import { presetRange, todayYmd } from "./utils/invoiceMeta";

const time = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const PRESETS = Object.keys(RANGE_PRESET_LABELS) as RangePreset[];

/**
 * Trang Hoá đơn.
 * - Hoá đơn KHÔNG tạo ở đây: tự mở khi nhận phòng, cộng dịch vụ, chốt khi trả phòng (module Đặt phòng).
 * - Ở đây: xem, thu tạm ứng / thu nợ, huỷ phiếu thu nhập nhầm (quản lý), in / lưu PDF.
 * - Kỳ thống kê ở đầu trang chỉ đổi ô số liệu + biểu đồ; bảng lọc riêng bằng "Ngày lập".
 */
export default function InvoiceManagement() {
  const total = useInvoiceStore((s) => s.total);
  const totalPages = useInvoiceStore((s) => s.totalPages);
  const page = useInvoiceStore((s) => s.filters.page);
  const loading = useInvoiceStore((s) => s.loading);
  const statsLoading = useInvoiceStore((s) => s.statsLoading);
  const lastUpdated = useInvoiceStore((s) => s.lastUpdated);
  const setFilters = useInvoiceStore((s) => s.setFilters);
  const refresh = useInvoiceStore((s) => s.refresh);

  const [opened, setOpened] = useState<{ id: string; seq: number } | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(
    (id: string) => setOpened((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 })),
    [],
  );
  const closeDrawer = useCallback(() => setOpened(null), []);

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-gold-700">
            Vận hành
          </p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-tight text-navy-900">
            Hoá đơn
          </h1>
          <p className="mt-1 text-[13px] tabular-nums text-ink-secondary">
            {loading && !lastUpdated
              ? "Đang tải hoá đơn"
              : `Hoá đơn tự mở khi nhận phòng, cộng dần dịch vụ và chốt khi trả phòng${
                  lastUpdated ? `, cập nhật lúc ${time(lastUpdated)}` : ""
                }`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangePicker />
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || statsLoading}
            className="flex h-10 items-center gap-2 rounded-[10px] border border-line-input bg-white px-3.5 text-[13.5px] font-medium text-navy-700 hover:border-navy-700 disabled:opacity-50"
          >
            <RotateCw
              size={14}
              className={loading || statsLoading ? "animate-spin" : ""}
            />{" "}
            Làm mới
          </button>
        </div>
      </div>

      <InvoiceStatsCards />
      <InvoiceInsights />

      {/* ===== Danh sách ===== */}
      <section
        aria-label="Danh sách hoá đơn"
        className="overflow-hidden rounded-[16px] border border-line bg-white"
      >
        <InvoiceToolbar />

        <div className="relative">
          <LoadingBar active={loading} />
          <div
            className={`transition-opacity ${loading && lastUpdated ? "pointer-events-none opacity-50" : ""}`}
          >
            <InvoiceTable
              selectedId={opened?.id ?? null}
              onOpen={open}
            />
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line-soft px-[18px] py-3">
            <span className="text-[12.5px] tabular-nums text-ink-muted">
              Trang {page} trên {totalPages} · {total} hoá đơn
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

      <InvoiceDrawer
        opened={opened}
        onClose={closeDrawer}
        onChanged={() => void refresh()}
      />
    </div>
  );
}

/* ============================ Chọn kỳ thống kê ============================ */

/**
 * Hôm nay / 7 ngày / Tháng này / Tháng trước / Tuỳ chọn.
 * "Tuỳ chọn" hiện 2 ô ngày; chỉ gọi API khi đủ 2 ngày và từ <= đến.
 */
function RangePicker() {
  const range = useInvoiceStore((s) => s.range);
  const setRange = useInvoiceStore((s) => s.setRange);
  const [custom, setCustom] = useState(range);

  const pick = (preset: RangePreset) => {
    if (preset === "custom") {
      setCustom({ ...range, preset }); // mở 2 ô ngày, điền sẵn kỳ đang xem
      return;
    }
    const next = { preset, ...presetRange(preset) };
    setCustom(next);
    setRange(next);
  };

  const showCustom = custom.preset === "custom";
  const applyCustom = (patch: { from?: string; to?: string }) => {
    const next = { ...custom, ...patch };
    setCustom(next);
    if (next.from && next.to && next.from <= next.to) setRange(next);
  };

  const input =
    "h-8 rounded-[8px] border border-line-input bg-white px-2 text-[12.5px] tabular-nums text-ink focus:border-navy-700 focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCustom && (
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
          <input
            type="date"
            aria-label="Từ ngày"
            value={custom.from}
            max={custom.to || todayYmd()}
            onChange={(e) => applyCustom({ from: e.target.value })}
            className={input}
          />
          –
          <input
            type="date"
            aria-label="Đến ngày"
            value={custom.to}
            min={custom.from}
            max={todayYmd()}
            onChange={(e) => applyCustom({ to: e.target.value })}
            className={input}
          />
        </span>
      )}
      <div
        role="radiogroup"
        aria-label="Kỳ thống kê"
        className="flex rounded-[10px] border border-line bg-white p-[3px]"
      >
        {PRESETS.map((p) => {
          const on = custom.preset === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(p)}
              className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-[12.5px] transition-colors ${
                on
                  ? "bg-navy-700 font-medium text-white"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {p === "custom" && (
                <CalendarRange
                  size={13}
                  aria-hidden="true"
                />
              )}
              {RANGE_PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
