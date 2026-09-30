import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  actionError,
  type BookingAction,
  invoiceTotals,
  nightsBetween,
  pointsFor,
  toDate,
  todayYmd,
  toYmd,
  validateIdCard,
} from './booking.rules';
import {
  activePaid,
  belowPaidError,
  invoiceStatusFor,
} from '../invoice/invoice.rules';
import {
  AddServiceDto,
  CheckInDto,
  CheckOutDto,
} from './dto/booking-action.dto';
import { HousekeepingResultDto } from './dto/booking-response.dto';

type Db = Prisma.TransactionClient;

/** Người đang thao tác: lấy từ token + hồ sơ nhân viên */
export interface Actor {
  accountId: string;
  roles: string[];
}

interface StaffActor extends Actor {
  employeeId: string;
}

/** Những field cần để kiểm tra luật trước mọi thao tác */
const ACTION_SELECT = {
  id: true,
  code: true,
  status: true,
  check_in_date: true,
  check_out_date: true,
  customer_id: true,
} satisfies Prisma.BookingSelect;

type ActionRow = Prisma.BookingGetPayload<{ select: typeof ACTION_SELECT }>;

const TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 };

/**
 * Mọi thao tác làm ĐỔI TRẠNG THÁI booking.
 *
 * Khuôn chung của 1 thao tác (xem lockBooking):
 *   1. Mở transaction, KHOÁ dòng booking (SELECT ... FOR UPDATE)
 *   2. Kiểm tra luật bằng actionError() -> cùng luật với nút FE đang hiện
 *   3. Ghi thay đổi
 * Khoá dòng booking nên 2 lễ tân bấm "nhận phòng" cùng lúc thì người sau
 * phải đợi, rồi thấy booking đã checked_in -> báo lỗi, không tạo 2 hoá đơn.
 *
 * Thứ tự khoá luôn là BOOKING rồi mới tới ROOM -> không bao giờ 2 transaction
 * giữ khoá ngược chiều nhau (deadlock).
 */
@Injectable()
export class BookingActionsService {
  private readonly logger = new Logger(BookingActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ============================================================
   *  DUYỆT / TỪ CHỐI / HUỶ / KHÔNG ĐẾN
   * ============================================================ */

  async confirm(id: string, actor: Actor): Promise<void> {
    const staff = await this.staffActor(actor);
    await this.prisma.$transaction(async (tx) => {
      await this.lockBooking(tx, id, staff, 'confirm');
      await tx.booking.update({
        where: { id },
        data: {
          status: 'confirmed',
          confirmed_by: staff.employeeId,
          confirmed_at: new Date(),
        },
      });
    }, TX_OPTIONS);
  }

  /** Nhân viên từ chối yêu cầu online (pending) */
  async reject(id: string, actor: Actor, reason: string): Promise<void> {
    await this.cancelAs(id, actor, 'reject', reason);
  }

  /** Quản lý huỷ booking đã xác nhận */
  async cancel(id: string, actor: Actor, reason: string): Promise<void> {
    await this.cancelAs(id, actor, 'cancel', reason);
  }

  /** Khách tự huỷ yêu cầu pending của mình */
  async cancelMine(
    id: string,
    accountId: string,
    reason?: string,
  ): Promise<void> {
    const customerId = await this.customerIdByAccount(accountId);
    await this.cancelAs(
      id,
      { accountId, roles: ['customer'] },
      'cancel',
      reason || null,
      customerId,
    );
  }

  private async cancelAs(
    id: string,
    actor: Actor,
    action: Extract<BookingAction, 'reject' | 'cancel'>,
    reason: string | null,
    ownerCustomerId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBooking(tx, id, actor, action, ownerCustomerId);
      await tx.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelled_by: actor.accountId, // Account: nhân viên hoặc chính khách
          cancelled_at: new Date(),
          cancel_reason: reason,
        },
      });
    }, TX_OPTIONS);
    await this.clearRoomCache(); // phòng được nhả ra
  }

  async markNoShow(id: string, actor: Actor): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBooking(tx, id, actor, 'mark_no_show');
      await tx.booking.update({ where: { id }, data: { status: 'no_show' } });
    }, TX_OPTIONS);
    await this.clearRoomCache();
  }

  /* ============================================================
   *  NHẬN PHÒNG
   * ============================================================ */

  async checkIn(id: string, actor: Actor, dto: CheckInDto): Promise<void> {
    const staff = await this.staffActor(actor);
    await this.prisma.$transaction(
      (tx) => this.checkInTx(tx, id, staff, dto),
      TX_OPTIONS,
    );
    await this.clearRoomCache();
  }

  /**
   * Phần lõi của nhận phòng, chạy TRONG transaction có sẵn.
   * Tách riêng để "Tạo và nhận phòng luôn" gọi chung transaction với bước tạo booking:
   * nhận phòng lỗi (thiếu giấy tờ, phòng chưa dọn) thì booking cũng không được tạo.
   */
  async checkInTx(
    tx: Db,
    id: string,
    staff: StaffActor,
    dto: CheckInDto,
  ): Promise<void> {
    const booking = await this.lockBooking(tx, id, staff, 'check_in');

    // 1. Giấy tờ: bắt buộc có số, ảnh không bắt buộc
    const customer = await tx.customer.findUniqueOrThrow({
      where: { id: booking.customer_id },
      select: { id: true, id_type: true, id_card: true },
    });
    const idType = dto.id_type ?? customer.id_type;
    const idCard = dto.id_card || customer.id_card;
    const idErr = validateIdCard(idType, idCard);
    if (idErr) throw new BadRequestException(idErr);

    if (idType !== customer.id_type || idCard !== customer.id_card) {
      const dup = await tx.customer.findFirst({
        where: { id_card: idCard, id: { not: customer.id } },
        select: { first_name: true, last_name: true },
      });
      if (dup) {
        throw new ConflictException(
          `Số giấy tờ này đã thuộc hồ sơ khách ${dup.last_name} ${dup.first_name}`,
        );
      }
      await tx.customer.update({
        where: { id: customer.id },
        data: { id_type: idType, id_card: idCard },
      });
    }

    // 2. Phòng phải trống và sạch. Khoá phòng SAU khi đã khoá booking
    const br = await this.bookingRoom(tx, id);
    await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${br.room_id}::uuid FOR UPDATE`;
    const room = await tx.room.findUniqueOrThrow({
      where: { id: br.room_id },
      select: { status: true, room_number: true },
    });
    if (room.status !== 'available') {
      const n = room.room_number;
      const msg: Record<Exclude<RoomStatus, 'available'>, string> = {
        cleaning: `Phòng ${n} đang chờ dọn. Dọn xong bấm "Đã dọn xong" rồi nhận phòng`,
        occupied: `Phòng ${n} vẫn còn khách chưa trả phòng`,
        maintenance: `Phòng ${n} đang bảo trì`,
        inactive: `Phòng ${n} đã ngừng kinh doanh`,
      };
      throw new ConflictException(msg[room.status]);
    }

    // 3. Booking -> checked_in
    const now = new Date();
    await tx.booking.update({
      where: { id },
      data: {
        status: 'checked_in',
        actual_check_in: now,
        checked_in_by: staff.employeeId,
      },
    });

    // 4. Mở hoá đơn: có tiền phòng ngay, dịch vụ cộng dần, chốt lúc trả phòng
    const nights = nightsBetween(
      toYmd(booking.check_in_date),
      toYmd(booking.check_out_date),
    );
    await tx.invoice.create({
      data: {
        booking_id: id,
        ...invoiceTotals(Number(br.price_per_night) * nights, 0, 0),
        status: 'unpaid',
        created_at: now,
      },
    });

    // 5. Phòng -> có khách
    await this.setRoomStatus(
      tx,
      br.room_id,
      room.status,
      'occupied',
      staff.accountId,
    );
  }

  /* ============================================================
   *  DỊCH VỤ & GIẢM GIÁ (khi khách đang ở)
   * ============================================================ */

  async addService(
    id: string,
    actor: Actor,
    dto: AddServiceDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBooking(tx, id, actor, 'add_service');

      const service = await tx.service.findUnique({
        where: { id: dto.service_id },
        select: { price: true, is_active: true, name: true },
      });
      if (!service) throw new NotFoundException('Không tìm thấy dịch vụ');
      if (!service.is_active)
        throw new BadRequestException(
          `Dịch vụ "${service.name}" đã ngừng cung cấp`,
        );

      const quantity = dto.quantity ?? 1;
      const unit = Number(service.price); // chốt giá lúc dùng
      await tx.bookingService.create({
        data: {
          booking_id: id,
          service_id: dto.service_id,
          quantity,
          unit_price: unit,
          total_price: unit * quantity,
          note: dto.note || null,
        },
      });
      await this.recalcInvoice(tx, id);
    }, TX_OPTIONS);
  }

  /** Nhập nhầm thì xoá. Chỉ xoá được khi khách còn ở, trả phòng rồi là đã chốt */
  async removeService(id: string, itemId: string, actor: Actor): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBooking(tx, id, actor, 'add_service');
      const { count } = await tx.bookingService.deleteMany({
        where: { id: itemId, booking_id: id },
      });
      if (!count)
        throw new NotFoundException('Không tìm thấy dịch vụ trong booking này');
      await this.recalcInvoice(tx, id);
    }, TX_OPTIONS);
  }

  async setDiscount(id: string, actor: Actor, discount: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBooking(tx, id, actor, 'set_discount');
      await this.recalcInvoice(tx, id, discount);
    }, TX_OPTIONS);
  }

  /* ============================================================
   *  TRẢ PHÒNG
   * ============================================================ */

  /**
   * Thu nốt số còn thiếu (trừ phần khách đã tạm ứng qua POST /payments), chốt hoá đơn,
   * cộng điểm cho thành viên, chuyển phòng sang "đang dọn".
   * Trả phòng sớm vẫn tính đủ số đêm đã đặt; phụ thu trả muộn nhập bằng dịch vụ.
   */
  async checkOut(
    id: string,
    actor: Actor,
    dto: CheckOutDto,
  ): Promise<{ points_earned: number }> {
    const staff = await this.staffActor(actor);

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await this.lockBooking(tx, id, staff, 'check_out');

      const br = await this.bookingRoom(tx, id);
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${br.room_id}::uuid FOR UPDATE`;

      // 1. Tính lại hoá đơn lần cuối, thu phần còn thiếu (đã trừ tiền tạm ứng, phiếu huỷ không tính)
      const totals = await this.recalcInvoice(tx, id);
      const due = totals.final_amount - totals.paid_amount;

      const now = new Date();
      if (due > 0) {
        await tx.payment.create({
          data: {
            invoice_id: totals.invoice_id,
            amount: due,
            payment_method: dto.payment_method,
            reference_number: dto.reference_number || null,
            note: dto.note || null,
            received_by: staff.employeeId,
            paid_at: now,
          },
        });
      }
      await tx.invoice.update({
        where: { id: totals.invoice_id },
        data: { status: 'paid' },
      });

      // 2. Booking -> checked_out
      await tx.booking.update({
        where: { id },
        data: {
          status: 'checked_out',
          actual_check_out: now,
          checked_out_by: staff.employeeId,
        },
      });

      // 3. Phòng -> đang dọn
      const room = await tx.room.findUniqueOrThrow({
        where: { id: br.room_id },
        select: { status: true },
      });
      await this.setRoomStatus(
        tx,
        br.room_id,
        room.status,
        'cleaning',
        staff.accountId,
      );

      // 4. Điểm thưởng: chỉ thành viên, tính trên số tiền thực trả
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: booking.customer_id },
        select: { account_id: true },
      });
      const points = customer.account_id ? pointsFor(totals.final_amount) : 0;
      if (points > 0) {
        await tx.customer.update({
          where: { id: booking.customer_id },
          data: { reward_points: { increment: points } }, // cộng trong DB, không đọc-rồi-ghi
        });
      }

      return { points_earned: points };
    }, TX_OPTIONS);

    await this.clearRoomCache();
    return result;
  }

  /* ============================================================
   *  CRON: tự huỷ pending quá hạn, đánh dấu không đến
   * ============================================================ */

  /**
   * Cùng luật với autoCloseAction() trong booking.rules (đã có unit test).
   * updateMany có điều kiện status trong WHERE: nếu lễ tân vừa nhận phòng xong
   * thì dòng đó không còn "confirmed" nữa -> cron tự bỏ qua, không ghi đè.
   */
  async runDailyHousekeeping(
    today = todayYmd(),
  ): Promise<HousekeepingResultDto> {
    const before = { check_in_date: { lt: toDate(today) } };

    const [expired, noShow] = await this.prisma.$transaction([
      this.prisma.booking.updateMany({
        where: { status: 'pending', ...before },
        data: {
          status: 'cancelled',
          cancelled_at: new Date(),
          cancel_reason:
            'Tự huỷ: khách sạn chưa xác nhận trước ngày nhận phòng',
        },
      }),
      this.prisma.booking.updateMany({
        where: { status: 'confirmed', ...before },
        data: { status: 'no_show' },
      }),
    ]);

    if (expired.count || noShow.count) await this.clearRoomCache();
    return { expired: expired.count, no_show: noShow.count };
  }

  /* ============================================================
   *  HELPER
   * ============================================================ */

  /**
   * Khoá dòng booking tới hết transaction rồi kiểm tra luật.
   * ownerCustomerId: khách chỉ thao tác được booking của chính mình (khác chủ -> 404).
   */
  private async lockBooking(
    tx: Db,
    id: string,
    actor: Actor,
    action: BookingAction,
    ownerCustomerId?: string,
  ): Promise<ActionRow> {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id}::uuid FOR UPDATE`;
    const booking = await tx.booking.findUnique({
      where: { id },
      select: ACTION_SELECT,
    });

    if (
      !booking ||
      (ownerCustomerId && booking.customer_id !== ownerCustomerId)
    ) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    const err = actionError(
      {
        status: booking.status,
        checkIn: toYmd(booking.check_in_date),
        checkOut: toYmd(booking.check_out_date),
      },
      actor.roles,
      todayYmd(),
      action,
    );
    if (err) throw new HttpException(err.message, err.status);

    return booking;
  }

  private async bookingRoom(tx: Db, bookingId: string) {
    const br = await tx.bookingRoom.findFirst({
      where: { booking_id: bookingId },
      select: { room_id: true, price_per_night: true },
    });
    if (!br) throw new BadRequestException('Booking chưa gắn phòng');
    return br;
  }

  /**
   * Tính lại hoá đơn từ đầu (phòng + mọi dịch vụ), không cộng dồn -> không bao giờ lệch.
   * Trạng thái hoá đơn cũng tính lại theo số đã thu (phiếu huỷ không tính).
   * Chặn mọi thay đổi làm tổng phải trả thấp hơn số khách đã tạm ứng.
   */
  private async recalcInvoice(tx: Db, bookingId: string, newDiscount?: number) {
    const b = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        check_in_date: true,
        check_out_date: true,
        booking_rooms: { select: { price_per_night: true } },
        booking_services: { select: { total_price: true } },
        invoices: {
          select: {
            id: true,
            discount: true,
            payments: { select: { amount: true, voided_at: true } },
          },
        },
      },
    });
    const invoice = b.invoices[0];
    if (!invoice)
      throw new BadRequestException(
        'Booking chưa có hoá đơn (chưa nhận phòng)',
      );

    const nights = nightsBetween(
      toYmd(b.check_in_date),
      toYmd(b.check_out_date),
    );
    const roomTotal = b.booking_rooms.reduce(
      (sum, r) => sum + Number(r.price_per_night) * nights,
      0,
    );
    const serviceTotal = b.booking_services.reduce(
      (sum, s) => sum + Number(s.total_price),
      0,
    );
    const totals = invoiceTotals(
      roomTotal,
      serviceTotal,
      newDiscount ?? Number(invoice.discount),
    );

    if (newDiscount !== undefined && newDiscount > totals.total_amount) {
      throw new BadRequestException(
        `Giảm giá không được lớn hơn tổng hoá đơn (${totals.total_amount.toLocaleString('vi-VN')}đ)`,
      );
    }
    const paid = activePaid(invoice.payments);
    const err = belowPaidError(totals.final_amount, paid);
    if (err) throw new BadRequestException(err);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { ...totals, status: invoiceStatusFor(totals.final_amount, paid) },
    });
    return { ...totals, invoice_id: invoice.id, paid_amount: paid };
  }

  /** Đổi trạng thái phòng + ghi lịch sử ai đổi, lúc nào */
  private async setRoomStatus(
    tx: Db,
    roomId: string,
    from: RoomStatus,
    to: RoomStatus,
    accountId: string,
  ) {
    await tx.room.update({ where: { id: roomId }, data: { status: to } });
    await tx.roomStatusHistory.create({
      data: {
        room_id: roomId,
        old_status: from,
        new_status: to,
        changed_by: accountId,
      },
    });
  }

  private clearRoomCache() {
    return this.redis.delByPattern('rooms:');
  }

  /** Thao tác cần ghi "nhân viên nào làm" -> tài khoản phải có hồ sơ nhân viên */
  async staffActor(actor: Actor): Promise<StaffActor> {
    return {
      ...actor,
      employeeId: (await this.employeeByAccount(actor.accountId)).id,
    };
  }

  async employeeByAccount(accountId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    // Tài khoản admin tạo tay có thể chưa có hồ sơ nhân viên -> không biết ghi ai là người làm
    if (!employee)
      throw new ForbiddenException(
        'Tài khoản này chưa gắn với hồ sơ nhân viên',
      );
    return employee;
  }

  async customerIdByAccount(accountId: string): Promise<string> {
    const c = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');
    return c.id;
  }
}
