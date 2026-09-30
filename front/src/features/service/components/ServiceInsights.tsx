import { useServiceStore } from "../store/serviceStore";
import { formatAmount, formatQty } from "../utils/serviceMeta";

/**
 * 2 thẻ nhỏ dưới bảng giúp quản lý ra quyết định:
 *   - Doanh thu cao nhất 30 ngày (xếp theo tiền, vì 3 kg giặt và 3 suất massage không so được bằng số lượng)
 *   - Đang bán mà 30 ngày chưa ai dùng -> cân nhắc ngừng bán
 */
export default function ServiceInsights() {
  const stats = useServiceStore((s) => s.stats);
  if (!stats) return null;

  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      <section
        aria-label="Dịch vụ doanh thu cao nhất"
        className="rounded-[16px] border border-line bg-white px-5 py-4"
      >
        <h3 className="mb-2.5 flex items-center justify-between text-[13px] font-semibold text-ink">
          Doanh thu cao nhất{" "}
          <span className="text-[11.5px] font-normal text-ink-faint">30 ngày</span>
        </h3>
        {stats.top.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">
            Chưa có dịch vụ nào được dùng.
          </p>
        ) : (
          <ol className="grid gap-1.5">
            {stats.top.map((s, i) => (
              <li
                key={s.id}
                className="grid grid-cols-[18px_1fr_auto_100px] items-center gap-2 text-[13px]"
              >
                <span className="text-[11.5px] text-ink-faint">{i + 1}</span>
                <span className="truncate font-semibold text-ink">{s.name}</span>
                <span className="tabular-nums text-ink-muted">
                  {formatQty(s.usage_30d, s.unit)}
                </span>
                <span className="text-right tabular-nums text-ink">
                  {formatAmount(s.revenue_30d)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        aria-label="Dịch vụ chưa ai dùng"
        className="rounded-[16px] border border-line bg-white px-5 py-4"
      >
        <h3 className="mb-2.5 flex items-center justify-between text-[13px] font-semibold text-ink">
          Đang bán nhưng chưa ai dùng{" "}
          <span className="text-[11.5px] font-normal text-ink-faint">30 ngày</span>
        </h3>
        {stats.unused.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">
            Dịch vụ nào đang bán cũng có người dùng.
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {stats.unused.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between text-[13px]"
              >
                <span className="font-semibold text-ink">{s.name}</span>
                <span className="text-[12px] text-ink-faint">
                  cân nhắc ngừng bán
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
