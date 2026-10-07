import {
  activePaid,
  belowPaidError,
  dailySeries,
  invoiceActions,
  invoiceCode,
  invoiceStatusFor,
  isDebt,
  monthToDate,
  paymentError,
  previousRange,
  remainingOf,
  searchTokenToBookingCode,
  vnDayRange,
  vnYmd,
  voidError,
} from './invoice.rules';

const MANAGER = ['manager'];
const STAFF = ['staff'];
const CUSTOMER = ['customer'];

describe('activePaid', () => {
  it('bỏ qua phiếu đã huỷ', () => {
    const payments = [
      { amount: 500_000, voided_at: null },
      { amount: 300_000, voided_at: new Date() },
      { amount: 200_000, voided_at: null },
    ];
    expect(activePaid(payments)).toBe(700_000);
  });

  it('đọc được Decimal của Prisma (có toString)', () => {
    const decimal = { toString: () => '1250000' };
    expect(activePaid([{ amount: decimal, voided_at: null }])).toBe(1_250_000);
  });

  it('không có phiếu nào -> 0', () => {
    expect(activePaid([])).toBe(0);
  });
});

describe('invoiceStatusFor', () => {
  it.each([
    [1_000_000, 0, 'unpaid'],
    [1_000_000, 400_000, 'partially_paid'],
    [1_000_000, 1_000_000, 'paid'],
    [0, 0, 'paid'], // giảm giá 100%
  ] as const)('phải trả %i, đã thu %i -> %s', (final, paid, status) => {
    expect(invoiceStatusFor(final, paid)).toBe(status);
  });
});

describe('remainingOf / isDebt', () => {
  it('không bao giờ âm', () => {
    expect(remainingOf(500_000, 700_000)).toBe(0);
    expect(remainingOf(500_000, 200_000)).toBe(300_000);
  });

  it('chỉ là công nợ khi đã trả phòng mà còn thiếu', () => {
    expect(isDebt('checked_out', 100_000)).toBe(true);
    expect(isDebt('checked_out', 0)).toBe(false);
    expect(isDebt('checked_in', 100_000)).toBe(false); // đang ở: chưa tới lúc thu
  });
});

describe('belowPaidError', () => {
  it('tổng mới >= đã thu -> được', () => {
    expect(belowPaidError(1_000_000, 1_000_000)).toBeNull();
    expect(belowPaidError(1_200_000, 500_000)).toBeNull();
  });

  it('giảm giá làm tổng thấp hơn số đã thu -> chặn, báo rõ số tiền', () => {
    const err = belowPaidError(800_000, 1_000_000);
    expect(err).toContain('1.000.000đ');
    expect(err).toContain('800.000đ');
  });
});

describe('invoiceCode / searchTokenToBookingCode', () => {
  it('lấy từ mã booking', () => {
    expect(invoiceCode('BK-260929-0012')).toBe('HD-260929-0012');
  });

  it('gõ số hoá đơn thì tìm theo mã booking, không phân biệt hoa thường', () => {
    expect(searchTokenToBookingCode('HD-260929')).toBe('BK-260929');
    expect(searchTokenToBookingCode('hd260929')).toBe('BK-260929');
    expect(searchTokenToBookingCode('Khoa')).toBe('Khoa');
  });
});

describe('paymentError', () => {
  const ok = {
    bookingStatus: 'checked_in' as const,
    remaining: 2_000_000,
    amount: 500_000,
    method: 'cash' as const,
  };

  it('tạm ứng khi đang ở -> được', () => {
    expect(paymentError(ok)).toBeNull();
  });

  it('thu nợ sau khi trả phòng -> được', () => {
    expect(paymentError({ ...ok, bookingStatus: 'checked_out' })).toBeNull();
  });

  it('thu đúng bằng số còn lại -> được', () => {
    expect(paymentError({ ...ok, amount: 2_000_000 })).toBeNull();
  });

  it.each(['pending', 'confirmed', 'cancelled', 'no_show'] as const)(
    'booking %s -> không thu',
    (status) => {
      expect(paymentError({ ...ok, bookingStatus: status })).toMatch(
        /Chỉ thu tiền/,
      );
    },
  );

  it('hoá đơn đã đủ -> không thu thêm', () => {
    expect(paymentError({ ...ok, remaining: 0 })).toBe('Hoá đơn đã thu đủ');
  });

  it('vượt số còn lại -> chặn', () => {
    expect(paymentError({ ...ok, amount: 2_500_000 })).toMatch(/vượt quá/);
  });

  it('số lẻ hoặc quá nhỏ -> chặn', () => {
    expect(paymentError({ ...ok, amount: 500 })).toMatch(/tối thiểu/);
    expect(paymentError({ ...ok, amount: 1500.5 })).toMatch(/tối thiểu/);
  });

  it('chuyển khoản / ví thiếu mã giao dịch -> chặn; thẻ và tiền mặt thì không bắt buộc', () => {
    expect(paymentError({ ...ok, method: 'bank_transfer' })).toMatch(
      /mã giao dịch/,
    );
    expect(
      paymentError({ ...ok, method: 'e_wallet', reference: '   ' }),
    ).toMatch(/mã giao dịch/);
    expect(
      paymentError({ ...ok, method: 'e_wallet', reference: 'MOMO123' }),
    ).toBeNull();
    expect(paymentError({ ...ok, method: 'credit_card' })).toBeNull();
  });
});

describe('voidError', () => {
  it('quản lý huỷ phiếu còn hiệu lực -> được', () => {
    expect(voidError({ voided_at: null }, MANAGER)).toBeNull();
    expect(voidError({ voided_at: null }, ['admin'])).toBeNull();
  });

  it('lễ tân -> 403', () => {
    expect(voidError({ voided_at: null }, STAFF)?.status).toBe(403);
  });

  it('phiếu đã huỷ -> 400', () => {
    expect(voidError({ voided_at: new Date() }, MANAGER)?.status).toBe(400);
  });
});

describe('invoiceActions', () => {
  const open = {
    bookingStatus: 'checked_in' as const,
    remaining: 1_000_000,
    activePayments: 1,
  };

  it('lễ tân: thu tiền + in, không huỷ phiếu', () => {
    expect(invoiceActions(open, STAFF)).toEqual(['collect', 'print']);
  });

  it('quản lý: đủ cả 3', () => {
    expect(invoiceActions(open, MANAGER)).toEqual([
      'collect',
      'void_payment',
      'print',
    ]);
  });

  it('đã thu đủ -> không còn nút thu tiền', () => {
    expect(invoiceActions({ ...open, remaining: 0 }, MANAGER)).toEqual([
      'void_payment',
      'print',
    ]);
  });

  it('chưa có phiếu thu nào -> không có huỷ phiếu', () => {
    expect(invoiceActions({ ...open, activePayments: 0 }, MANAGER)).toEqual([
      'collect',
      'print',
    ]);
  });

  it('công nợ sau trả phòng -> vẫn thu được', () => {
    expect(
      invoiceActions({ ...open, bookingStatus: 'checked_out' }, STAFF),
    ).toContain('collect');
  });

  it('khách chỉ in được', () => {
    expect(invoiceActions(open, CUSTOMER)).toEqual(['print']);
  });
});

describe('khoảng ngày thống kê', () => {
  it('tháng này = mùng 1 tới hôm nay', () => {
    expect(monthToDate('2026-09-30')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('kỳ trước cùng số ngày, liền trước', () => {
    expect(previousRange('2026-09-01', '2026-09-30')).toEqual({
      from: '2026-08-02',
      to: '2026-08-31',
    });
    expect(previousRange('2026-09-30', '2026-09-30')).toEqual({
      from: '2026-09-29',
      to: '2026-09-29',
    });
  });

  it('lọc theo giờ VN: 30/9 bắt đầu 17:00 UTC ngày 29/9', () => {
    const r = vnDayRange('2026-09-30', '2026-09-30');
    expect(r.gte.toISOString()).toBe('2026-09-29T17:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('23:30 UTC ngày 29/9 là 06:30 sáng 30/9 giờ VN', () => {
    expect(vnYmd(new Date('2026-09-29T23:30:00Z'))).toBe('2026-09-30');
  });

  it('dailySeries: đủ mọi ngày, cộng dồn cùng ngày', () => {
    const rows = [
      { at: new Date('2026-09-28T03:00:00Z'), amount: 100 },
      { at: new Date('2026-09-28T10:00:00Z'), amount: 50 },
      { at: new Date('2026-09-29T20:00:00Z'), amount: 70 }, // 03:00 ngày 30 giờ VN
    ];
    expect(dailySeries('2026-09-28', '2026-09-30', rows)).toEqual([
      { date: '2026-09-28', amount: 150 },
      { date: '2026-09-29', amount: 0 },
      { date: '2026-09-30', amount: 70 },
    ]);
  });
});
