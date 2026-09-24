import HoverCard from "../../../components/HoverCard";
import type { Amenity } from "../../../types/roomType";
import { AMENITY_LABELS, sortAmenities } from "../../../types/roomType";

const VISIBLE = 3;
const CHIP =
  "h-6 px-2 inline-flex items-center rounded-md border border-[#E4E6E9] text-[12px] whitespace-nowrap";

export default function AmenityChips({ amenities }: { amenities: Amenity[] }) {
  if (amenities.length === 0) {
    return <span className="text-[12px] text-[#98A1AC]">Chưa chọn tiện nghi</span>;
  }

  const sorted = sortAmenities(amenities);
  const shown = sorted.slice(0, VISIBLE);
  const rest = sorted.slice(VISIBLE);

  return (
    <div className="flex items-center gap-[5px] min-w-0">
      {shown.map((a) => (
        <span
          key={a}
          className={`${CHIP} text-[#5C6672]`}
        >
          {AMENITY_LABELS[a]}
        </span>
      ))}

      {rest.length > 0 && (
        <HoverCard
          width={200}
          content={
            <div>
              <p className="text-[12px] font-medium text-[#14181D] mb-1.5 tabular-nums">
                Thêm {rest.length} tiện nghi
              </p>
              <div className="flex flex-wrap gap-1">
                {rest.map((a) => (
                  <span
                    key={a}
                    className={`${CHIP} text-[#5C6672]`}
                  >
                    {AMENITY_LABELS[a]}
                  </span>
                ))}
              </div>
            </div>
          }
        >
          <span
            className={`${CHIP} text-[#14181D] tabular-nums hover:border-[#CDD2D8] cursor-default`}
          >
            +{rest.length}
          </span>
        </HoverCard>
      )}
    </div>
  );
}
