import type { BookingStatus } from '@prisma/client';
import {
  actionError,
  addDays,
  allowedActions,
  autoCloseAction,
  invoiceTotals,
  pointsFor,
  validateIdCard,
  bookingCode,
  findConflict,
  isValidYmd,
  MAX_NIGHTS,
  nightsBetween,
  quoteStay,
  rangesOverlap,
  todayYmd,
  validateDates,
  validateGuests,
} from './booking.rules';

const TODAY = '2026-09-29';

describe('Ngày tháng', () => {
  it('todayYmd tính theo giờ VN, không theo giờ máy', () => {
    // 18:30 UTC ngày 29 = 01:30 sáng ngày 30 ở VN
    expect(todayYmd(new Date('2026-09-29T18:30:00Z'))).toBe('2026-09-30');
    expect(todayYmd(new Date('2026-09-29T16:59:00Z'))).toBe('2026-09-29');
  });

  it('nightsBetween và addDays qua cuối tháng, cuối năm', () => {
    expect(nightsBetween('2026-09-29', '2026-10-02')).toBe(3);
    expect(nightsBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('isValidYmd loại ngày không có thật', () => {
    expect(isValidYmd('2026-09-29')).toBe(true);
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('2026-9-29')).toBe(false);
    expect(isValidYmd('abc')).toBe(false);
  });
});

describe('rangesOverlap: khoảng nửa mở [in, out)', () => {
  const a = { checkIn: '2026-10-05', checkOut: '2026-10-08' };

  it.each([
    ['trả phòng đúng ngày khách sau nhận', '2026-10-08', '2026-10-10', false],
    ['nhận phòng đúng ngày khách trước trả', '2026-10-02', '2026-10-05', false],
    ['nằm hẳn bên trong', '2026-10-06', '2026-10-07', true],
    ['bao trùm bên ngoài', '2026-10-01', '2026-10-20', true],
    ['chồng đầu', '2026-10-03', '2026-10-06', true],
    ['chồng cuối', '2026-10-07', '2026-10-09', true],
    ['trùng khít', '2026-10-05', '2026-10-08', true],
    ['cách xa', '2026-11-01', '2026-11-03', false],
  ])('%s', (_label, checkIn, checkOut, expected) => {
    const b = { checkIn, checkOut };
    expect(rangesOverlap(a, b)).toBe(expected);
    expect(rangesOverlap(b, a)).toBe(expected); // đổi chỗ vẫn cùng kết quả
  });
});

describe('findConflict: chỉ booking đang giữ phòng mới chặn', () => {
  const range = { checkIn: '2026-10-05', checkOut: '2026-10-08' };
  const at = (status: BookingStatus) => ({
    checkIn: '2026-10-06',
    checkOut: '2026-10-07',
    status,
  });

  it.each<BookingStatus>(['pending', 'confirmed', 'checked_in'])(
    '%s -> chặn',
    (status) => {
      expect(findConflict(range, [at(status)])).toBeDefined();
    },
  );

  it.each<BookingStatus>(['cancelled', 'no_show', 'checked_out'])(
    '%s -> không chặn',
    (status) => {
      expect(findConflict(range, [at(status)])).toBeUndefined();
    },
  );

  it('bỏ qua booking đã huỷ, bắt được booking thật phía sau', () => {
    const hit = {
      checkIn: '2026-10-07',
      checkOut: '2026-10-09',
      status: 'confirmed' as const,
    };
    expect(findConflict(range, [at('cancelled'), hit])).toBe(hit);
  });
});

describe('validateDates', () => {
  const ok = (checkIn: string, checkOut: string) =>
    validateDates({ checkIn, checkOut }, TODAY);

  it('hợp lệ: nhận hôm nay, 1 đêm', () =>
    expect(ok(TODAY, '2026-09-30')).toBeNull());
  it('nhận phòng hôm qua', () =>
    expect(ok('2026-09-28', '2026-09-30')).toMatch(/quá khứ/));
  it('trả trước hoặc bằng ngày nhận', () => {
    expect(ok('2026-10-02', '2026-10-02')).toMatch(/sau ngày nhận/);
    expect(ok('2026-10-02', '2026-10-01')).toMatch(/sau ngày nhận/);
  });
  it(`tối đa ${MAX_NIGHTS} đêm`, () => {
    expect(ok('2026-10-01', addDays('2026-10-01', MAX_NIGHTS))).toBeNull();
    expect(ok('2026-10-01', addDays('2026-10-01', MAX_NIGHTS + 1))).toMatch(
      /tối đa/,
    );
  });
  it('đặt trước quá 365 ngày', () =>
    expect(ok('2027-10-01', '2027-10-02')).toMatch(/đặt trước/));
  it('ngày sai định dạng', () =>
    expect(ok('2026-02-30', '2026-03-02')).toMatch(/không hợp lệ/));
});

describe('validateGuests', () => {
  it('đủ chỗ', () =>
    expect(validateGuests({ adults: 2, children: 1 }, 3)).toBeNull());
  it('vượt sức chứa', () =>
    expect(validateGuests({ adults: 2, children: 2 }, 3)).toMatch(/tối đa 3/));
  it('không có người lớn', () =>
    expect(validateGuests({ adults: 0, children: 2 }, 4)).toMatch(/người lớn/));
});

describe('quoteStay & bookingCode', () => {
  it('tiền phòng = số đêm x giá', () => {
    expect(quoteStay(700_000, '2026-10-01', '2026-10-04')).toEqual({
      nights: 3,
      price_per_night: 700_000,
      room_total: 2_100_000,
    });
  });

  it('mã theo ngày VN, đệm 4 số, không cắt số lớn', () => {
    const lateNightUtc = new Date('2026-09-29T18:00:00Z'); // 01:00 ngày 30 ở VN
    expect(bookingCode(lateNightUtc, 12)).toBe('BK-260930-0012');
    expect(bookingCode(lateNightUtc, 12345n)).toBe('BK-260930-12345');
  });
});

describe('allowedActions', () => {
  const staff = ['staff'];
  const manager = ['manager'];
  const customer = ['customer'];
  const b = (
    status: BookingStatus,
    checkIn = TODAY,
    checkOut = '2026-10-01',
  ) => ({ status, checkIn, checkOut });

  it('pending: nhân viên duyệt/từ chối, khách tự huỷ', () => {
    expect(allowedActions(b('pending'), staff, TODAY)).toEqual([
      'confirm',
      'reject',
    ]);
    expect(allowedActions(b('pending'), customer, TODAY)).toEqual(['cancel']);
  });

  it('confirmed đến hôm nay: staff nhận phòng nhưng KHÔNG được huỷ', () => {
    expect(allowedActions(b('confirmed'), staff, TODAY)).toEqual(['check_in']);
    expect(allowedActions(b('confirmed'), manager, TODAY)).toEqual([
      'check_in',
      'cancel',
    ]);
  });

  it('confirmed ngày mai: chưa cho nhận sớm', () => {
    expect(allowedActions(b('confirmed', '2026-09-30'), staff, TODAY)).toEqual(
      [],
    );
  });

  it('confirmed quá ngày nhận: nhận trễ hoặc đánh dấu không đến', () => {
    expect(allowedActions(b('confirmed', '2026-09-28'), staff, TODAY)).toEqual([
      'check_in',
      'mark_no_show',
    ]);
    // đã tới ngày trả thì không nhận phòng được nữa
    expect(
      allowedActions(b('confirmed', '2026-09-27', TODAY), staff, TODAY),
    ).toEqual(['mark_no_show']);
  });

  it('checked_in: thêm dịch vụ và trả phòng', () => {
    expect(allowedActions(b('checked_in'), staff, TODAY)).toEqual([
      'add_service',
      'check_out',
    ]);
    expect(allowedActions(b('checked_in'), customer, TODAY)).toEqual([]);
  });

  it.each<BookingStatus>(['checked_out', 'cancelled', 'no_show'])(
    '%s: không còn hành động',
    (status) => {
      expect(allowedActions(b(status), manager, TODAY)).toEqual([]);
    },
  );
});

describe('Bước 3: quyền & luật thao tác', () => {
  const b = (
    status: BookingStatus,
    checkIn = TODAY,
    checkOut = '2026-10-01',
  ) => ({ status, checkIn, checkOut });

  it('pending đã qua ngày nhận: chỉ còn từ chối, không duyệt được', () => {
    expect(
      allowedActions(b('pending', '2026-09-28'), ['staff'], TODAY),
    ).toEqual(['reject']);
    expect(
      actionError(b('pending', '2026-09-28'), ['staff'], TODAY, 'confirm'),
    ).toEqual({
      status: 400,
      message: 'Không thể xác nhận: đã qua ngày nhận phòng',
    });
  });

  it('checked_in: chỉ quản lý được giảm giá', () => {
    expect(allowedActions(b('checked_in'), ['manager'], TODAY)).toEqual([
      'add_service',
      'set_discount',
      'check_out',
    ]);
    expect(
      actionError(b('checked_in'), ['staff'], TODAY, 'set_discount')?.status,
    ).toBe(403);
  });

  it('403 khi sai quyền, 400 khi sai trạng thái / ngày', () => {
    expect(
      actionError(b('confirmed'), ['staff'], TODAY, 'cancel')?.status,
    ).toBe(403);
    expect(
      actionError(b('confirmed'), ['customer'], TODAY, 'cancel')?.status,
    ).toBe(403);
    expect(actionError(b('pending'), ['staff'], TODAY, 'cancel')?.status).toBe(
      403,
    ); // staff phải dùng "từ chối"
    expect(actionError(b('cancelled'), ['admin'], TODAY, 'check_in')).toEqual({
      status: 400,
      message: 'Không thể nhận phòng: booking đang ở trạng thái "Đã huỷ"',
    });
    expect(
      actionError(b('confirmed', '2026-09-30'), ['staff'], TODAY, 'check_in')
        ?.message,
    ).toMatch(/chưa tới ngày/);
    expect(
      actionError(b('confirmed'), ['staff'], TODAY, 'check_in'),
    ).toBeNull();
  });

  it('validateIdCard', () => {
    expect(validateIdCard('cccd', '079203001234')).toBeNull();
    expect(validateIdCard('cccd', '07920300123')).toMatch(/12 chữ số/);
    expect(validateIdCard('passport', 'C1234567')).toBeNull();
    expect(validateIdCard('passport', 'ab')).toMatch(/hộ chiếu/);
    expect(validateIdCard(null, '079203001234')).toMatch(/Chọn loại/);
    expect(validateIdCard('cccd', null)).toMatch(/Cần số giấy tờ/);
  });

  it('điểm thưởng: 10.000đ = 1 điểm, làm tròn xuống', () => {
    expect(pointsFor(1_757_000)).toBe(175);
    expect(pointsFor(9_999)).toBe(0);
    expect(pointsFor(0)).toBe(0);
  });

  it('hoá đơn không âm khi giảm giá lớn hơn tổng', () => {
    expect(invoiceTotals(1_400_000, 450_000, 93_000)).toEqual({
      total_amount: 1_850_000,
      discount: 93_000,
      final_amount: 1_757_000,
    });
    expect(invoiceTotals(100, 0, 500).final_amount).toBe(0);
  });

  it('cron: pending quá hạn -> expire, confirmed quá hạn -> no_show, còn lại bỏ qua', () => {
    expect(autoCloseAction('pending', '2026-09-28', TODAY)).toBe('expire');
    expect(autoCloseAction('confirmed', '2026-09-28', TODAY)).toBe('no_show');
    expect(autoCloseAction('confirmed', TODAY, TODAY)).toBeNull(); // hôm nay vẫn còn chờ khách
    expect(autoCloseAction('checked_in', '2026-09-20', TODAY)).toBeNull();
  });
});
