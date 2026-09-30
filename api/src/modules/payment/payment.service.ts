import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { InvoiceDetailDto } from '../invoice/dto/invoice-response.dto';
import {
  fullName,
  loadInvoiceDetail,
  type Viewer,
} from '../invoice/invoice-detail';
import {
  activePaid,
  invoiceCode,
  invoiceStatusFor,
  isStaff,
  paymentError,
  remainingOf,
  voidError,
} from '../invoice/invoice.rules';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

type Db = Prisma.TransactionClient;

const TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 };

const NAME = { select: { first_name: true, last_name: true } } as const;

const PAYMENT_SELECT = {
  id: true,
  invoice_id: true,
  amount: true,
  payment_method: true,
  reference_number: true,
  note: true,
  paid_at: true,
  created_at: true,
  voided_at: true,
  void_reason: true,
  receiver: NAME,
  voider: NAME,
  invoice: {
    select: {
      status: true,
      final_amount: true,
      payments: { select: { amount: true, voided_at: true } },
      booking: {
        select: { code: true, customer: { select: { account_id: true } } },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

/**
 * Phiếu thu: thu thêm (tạm ứng / thu nợ) và huỷ phiếu nhập nhầm.
 *
 * Khuôn giống BookingActionsService: mở transaction, KHOÁ dòng booking rồi tới dòng hoá đơn
 * (SELECT ... FOR UPDATE, cùng thứ tự với trả phòng -> không deadlock), đọc lại số đã thu,
 * kiểm tra luật, ghi. 2 lễ tân cùng bấm thu nốt 500.000đ thì người sau phải đợi,
 * đọc lại thấy đã đủ -> báo "Hoá đơn đã thu đủ", không thu trùng.
 *
 * Mọi thay đổi xong đều trả về CHI TIẾT HOÁ ĐƠN mới nhất.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /* ============================================================
   *  THU TIỀN
   * ============================================================ */

  async create(
    dto: CreatePaymentDto,
    viewer: Viewer,
  ): Promise<InvoiceDetailDto> {
    const employeeId = await this.employeeIdOf(viewer.accountId);

    const receipt = await this.prisma.$transaction(async (tx) => {
      const { bookingStatus } = await this.lockInvoice(tx, dto.invoice_id);

      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: dto.invoice_id },
        select: {
          final_amount: true,
          payments: { select: { amount: true, voided_at: true } },
        },
      });
      const finalAmount = Number(invoice.final_amount);
      const paidBefore = activePaid(invoice.payments);

      const err = paymentError({
        bookingStatus,
        remaining: remainingOf(finalAmount, paidBefore),
        amount: dto.amount,
        method: dto.payment_method,
        reference: dto.reference_number,
      });
      if (err) throw new BadRequestException(err);

      const payment = await tx.payment.create({
        data: {
          invoice_id: dto.invoice_id,
          amount: dto.amount,
          payment_method: dto.payment_method,
          reference_number: dto.reference_number || null,
          note: dto.note || null,
          received_by: employeeId,
          paid_at: new Date(),
        },
        select: { paid_at: true },
      });

      const paid = paidBefore + dto.amount;
      const status = invoiceStatusFor(finalAmount, paid);
      await tx.invoice.update({
        where: { id: dto.invoice_id },
        data: { status },
      });

      return { paidAt: payment.paid_at, finalAmount, paid, status };
    }, TX_OPTIONS);

    const detail = await loadInvoiceDetail(
      this.prisma,
      { id: dto.invoice_id },
      viewer,
    );
    this.sendReceipt(detail, dto, receipt);
    return detail;
  }

  /* ============================================================
   *  HUỶ PHIẾU THU
   * ============================================================ */

  /**
   * Không xoá phiếu: đánh dấu đã huỷ + ai huỷ + lý do, rồi tính lại trạng thái hoá đơn.
   * Huỷ phiếu của khách đã trả phòng -> hoá đơn thành công nợ, thu lại bằng POST /payments.
   */
  async void(
    paymentId: string,
    reason: string,
    viewer: Viewer,
  ): Promise<InvoiceDetailDto> {
    const employeeId = await this.employeeIdOf(viewer.accountId);

    const found = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { invoice_id: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy phiếu thu');

    await this.prisma.$transaction(async (tx) => {
      await this.lockInvoice(tx, found.invoice_id);

      // Đọc lại SAU khi khoá: có thể người khác vừa huỷ xong
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { voided_at: true },
      });
      const err = voidError(payment, viewer.roles);
      if (err) throw new HttpException(err.message, err.status);

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          voided_at: new Date(),
          voided_by: employeeId,
          void_reason: reason,
        },
      });

      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: found.invoice_id },
        select: {
          final_amount: true,
          payments: { select: { amount: true, voided_at: true } },
        },
      });
      await tx.invoice.update({
        where: { id: found.invoice_id },
        data: {
          status: invoiceStatusFor(
            Number(invoice.final_amount),
            activePaid(invoice.payments),
          ),
        },
      });
    }, TX_OPTIONS);

    this.logger.log(`Huỷ phiếu thu ${paymentId}: ${reason}`);
    return loadInvoiceDetail(this.prisma, { id: found.invoice_id }, viewer);
  }

  /* ============================================================
   *  XEM
   * ============================================================ */

  async findOne(id: string, viewer: Viewer): Promise<PaymentResponseDto> {
    const row = await this.prisma.payment.findUnique({
      where: { id },
      select: PAYMENT_SELECT,
    });
    if (!row || !this.canView(row, viewer))
      throw new NotFoundException('Không tìm thấy phiếu thu');
    return this.toResponse(row, viewer);
  }

  async findByInvoice(
    invoiceId: string,
    viewer: Viewer,
  ): Promise<PaymentResponseDto[]> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        booking: { select: { customer: { select: { account_id: true } } } },
      },
    });
    if (
      !invoice ||
      (!isStaff(viewer.roles) &&
        invoice.booking.customer.account_id !== viewer.accountId)
    ) {
      throw new NotFoundException('Không tìm thấy hoá đơn');
    }

    const rows = await this.prisma.payment.findMany({
      where: { invoice_id: invoiceId },
      orderBy: { paid_at: 'asc' },
      select: PAYMENT_SELECT,
    });
    return rows.map((r) => this.toResponse(r, viewer));
  }

  /* ============================================================
   *  HELPER
   * ============================================================ */

  /** Khoá booking rồi khoá hoá đơn (cùng thứ tự với module Booking) */
  private async lockInvoice(tx: Db, invoiceId: string) {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { booking_id: true },
    });
    if (!inv) throw new NotFoundException('Không tìm thấy hoá đơn');

    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${inv.booking_id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId}::uuid FOR UPDATE`;

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: inv.booking_id },
      select: { status: true },
    });
    return { bookingStatus: booking.status };
  }

  /** Phiếu thu phải ghi được "nhân viên nào thu / huỷ" -> tài khoản phải có hồ sơ nhân viên */
  private async employeeIdOf(accountId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    if (!employee)
      throw new ForbiddenException(
        'Tài khoản này chưa gắn với hồ sơ nhân viên',
      );
    return employee.id;
  }

  private canView(row: PaymentRow, viewer: Viewer) {
    return (
      isStaff(viewer.roles) ||
      row.invoice.booking.customer.account_id === viewer.accountId
    );
  }

  private toResponse(r: PaymentRow, viewer: Viewer): PaymentResponseDto {
    const staff = (p: { first_name: string; last_name: string } | null) =>
      isStaff(viewer.roles) ? fullName(p) : null;
    const finalAmount = Number(r.invoice.final_amount);
    const totalPaid = activePaid(r.invoice.payments);

    return {
      id: r.id,
      invoice_id: r.invoice_id,
      invoice_code: invoiceCode(r.invoice.booking.code),
      amount: Number(r.amount),
      payment_method: r.payment_method,
      reference_number: r.reference_number,
      note: r.note,
      paid_at: r.paid_at,
      created_at: r.created_at,
      received_by: staff(r.receiver),
      voided_at: r.voided_at,
      voided_by: staff(r.voider),
      void_reason: r.void_reason,
      invoice_status: r.invoice.status,
      invoice_final_amount: finalAmount,
      total_paid: totalPaid,
      remaining: remainingOf(finalAmount, totalPaid),
    };
  }

  /** Gửi biên nhận cho khách có email. Gửi lỗi không làm hỏng việc thu tiền */
  private sendReceipt(
    detail: InvoiceDetailDto,
    dto: CreatePaymentDto,
    receipt: {
      paidAt: Date;
      finalAmount: number;
      paid: number;
      status: ReturnType<typeof invoiceStatusFor>;
    },
  ) {
    const email = detail.customer.email;
    if (!email) return;

    this.mailService
      .sendPaymentReceipt(email, {
        customerName: detail.customer.full_name,
        invoiceId: detail.id,
        bookingId: detail.booking.id,
        amount: dto.amount,
        paymentMethod: dto.payment_method,
        referenceNumber: dto.reference_number,
        paidAt: receipt.paidAt.toISOString(),
        totalAmount: detail.total_amount,
        totalPaid: receipt.paid,
        remaining: remainingOf(receipt.finalAmount, receipt.paid),
        status: receipt.status,
      })
      .catch((e: unknown) =>
        this.logger.warn(`Không gửi được biên nhận tới ${email}: ${String(e)}`),
      );
  }
}
