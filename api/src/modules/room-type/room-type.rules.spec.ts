import {
  capacityError,
  minCapacity,
  normalizeName,
  occupancyPct,
  overlapNights,
} from './room-type.rules';

describe('overlapNights', () => {
  const WIN = ['2026-09-01', '2026-10-01'] as const; // 30 đêm của tháng 9

  it('nằm trọn trong cửa sổ', () => {
    expect(overlapNights('2026-09-10', '2026-09-13', ...WIN)).toBe(3);
  });

  it('bắt đầu trước cửa sổ -> chỉ tính phần trong cửa sổ', () => {
    expect(overlapNights('2026-08-30', '2026-09-02', ...WIN)).toBe(1);
  });

  it('kéo qua cuối cửa sổ', () => {
    expect(overlapNights('2026-09-29', '2026-10-03', ...WIN)).toBe(2);
  });

  it('trả phòng đúng ngày đầu cửa sổ -> 0 (khoảng nửa mở)', () => {
    expect(overlapNights('2026-08-28', '2026-09-01', ...WIN)).toBe(0);
  });

  it('hoàn toàn ngoài cửa sổ -> 0', () => {
    expect(overlapNights('2026-10-05', '2026-10-07', ...WIN)).toBe(0);
  });
});

describe('occupancyPct', () => {
  it('45 đêm bán / (3 phòng x 30 ngày) = 50%', () => {
    expect(occupancyPct(45, 3, 30)).toBe(50);
  });

  it('không có phòng kinh doanh -> 0, không chia cho 0', () => {
    expect(occupancyPct(10, 0, 30)).toBe(0);
  });

  it('không vượt 100%', () => {
    expect(occupancyPct(120, 3, 30)).toBe(100);
  });
});

describe('minCapacity', () => {
  it('không có booking -> 1', () => {
    expect(minCapacity([])).toBe(1);
  });

  it('booking 1 phòng 3 khách -> cần 3', () => {
    expect(minCapacity([{ guests: 3, roomsOfType: 1, otherCapacity: 0 }])).toBe(
      3,
    );
  });

  it('đoàn 2 phòng cùng loại 4 khách -> mỗi phòng 2', () => {
    expect(minCapacity([{ guests: 4, roomsOfType: 2, otherCapacity: 0 }])).toBe(
      2,
    );
  });

  it('đoàn 2 phòng cùng loại 5 khách -> làm tròn lên 3', () => {
    expect(minCapacity([{ guests: 5, roomsOfType: 2, otherCapacity: 0 }])).toBe(
      3,
    );
  });

  it('phòng khác loại gánh bớt khách', () => {
    // 1 phòng loại này + 1 phòng khác chứa 2, tổng 3 khách -> loại này chỉ cần 1
    expect(minCapacity([{ guests: 3, roomsOfType: 1, otherCapacity: 2 }])).toBe(
      1,
    );
  });

  it('lấy booking đòi nhiều nhất', () => {
    expect(
      minCapacity([
        { guests: 2, roomsOfType: 1, otherCapacity: 0 },
        { guests: 4, roomsOfType: 1, otherCapacity: 0 },
      ]),
    ).toBe(4);
  });
});

describe('capacityError', () => {
  it('đủ chỗ -> null', () => {
    expect(capacityError(3, 3)).toBeNull();
  });

  it('giảm dưới mức booking cần -> báo số cụ thể', () => {
    expect(capacityError(2, 3)).toContain('tối thiểu 3');
  });
});

describe('normalizeName', () => {
  it('không phân biệt hoa thường, gộp khoảng trắng', () => {
    expect(normalizeName('  Deluxe   Twin ')).toBe(
      normalizeName('deluxe twin'),
    );
  });
});
