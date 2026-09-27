import type { WeekTally } from "../utils/schedule";

type Tone = "good" | "warn" | undefined;

const TONE_CLASS: Record<NonNullable<Tone>, string> = {
  good: "text-[#0E7C5A]",
  warn: "text-[#B4321F]",
};

export default function ShiftTally({ tally }: { tally: WeekTally }) {
  const cells: { label: string; value: number; tone?: Tone }[] = [
    { label: "Suất trực cần", value: tally.required },
    { label: "Đã có người", value: tally.filled, tone: "good" },
    {
      label: "Còn trống",
      value: tally.missing,
      tone: tally.missing ? "warn" : undefined,
    },
    { label: "Nhân viên trực", value: tally.staffCount },
    {
      label: "Ô ca đêm thiếu",
      value: tally.nightShortCells,
      tone: tally.nightShortCells ? "warn" : undefined,
    },
  ];

  return (
    <div className="flex border-b border-line overflow-x-auto">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`px-5 py-2.5 min-w-[132px] ${i < cells.length - 1 ? "border-r border-line-soft" : ""}`}
        >
          <div className="text-[11px] text-ink-muted">{c.label}</div>
          <div
            className={`text-[17px] font-semibold tabular-nums mt-px ${
              c.tone ? TONE_CLASS[c.tone] : "text-ink"
            }`}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
