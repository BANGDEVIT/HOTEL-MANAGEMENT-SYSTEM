import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto, ServiceSort } from './dto/query-service.dto';
import {
  PaginatedServiceResponseDto,
  ServiceResponseDto,
  ServiceStatsDto,
  ServiceUsageItemDto,
} from './dto/service-response.dto';

const HOTEL_TZ = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86_400_000;
const CATEGORIES = Object.values(ServiceCategory);

const SERVICE_SELECT = {
  id: true,
  name: true,
  category: true,
  unit: true,
  price: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ServiceSelect;

type ServiceRow = Prisma.ServiceGetPayload<{ select: typeof SERVICE_SELECT }>;

interface Usage {
  usage30d: number;
  revenue30d: number;
  totalUses: number;
}
const NO_USAGE: Usage = { usage30d: 0, revenue30d: 0, totalUses: 0 };

/** Thứ tự mặc định của từng kiểu sắp xếp (khi FE không gửi order) */
const DEFAULT_ORDER: Record<ServiceSort, 'asc' | 'desc'> = {
  usage: 'desc', // dùng nhiều lên đầu
  name: 'asc',
  price: 'asc',
  created_at: 'desc',
};

/**
 * Quản lý danh mục dịch vụ.
 *
 * Thêm dịch vụ vào booking / xoá khỏi booking KHÔNG nằm ở đây mà ở BookingActionsService
 * (POST /bookings/:id/services): ở đó có khoá dòng booking và tính lại hoá đơn từ đầu.
 * Để 2 nơi cùng sửa hoá đơn thì sớm muộn sẽ lệch tiền.
 *
 * Không cache Redis: danh sách có số lượt dùng, mà lượt dùng đổi mỗi khi lễ tân thêm dịch vụ.
 * Bảng dịch vụ chỉ vài chục dòng nên query thẳng vẫn nhanh.
 */
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /* ============================================================
   *  DANH SÁCH
   * ============================================================ */

  async findAll(query: QueryServiceDto): Promise<PaginatedServiceResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status = 'all',
      sort = 'usage',
      order,
    } = query;

    const where: Prisma.ServiceWhereInput = {
      ...(category && { category }),
      ...(status !== 'all' && { is_active: status === 'active' }),
      ...(search?.trim() && {
        name: { contains: search.trim(), mode: 'insensitive' },
      }),
    };

    // Lấy HẾT dòng khớp rồi sắp xếp + phân trang trong bộ nhớ: sắp theo "lượt dùng" là số tính
    // từ bảng khác, Prisma không orderBy được. Bảng dịch vụ nhỏ (vài chục dòng) nên không sao.
    const rows = await this.prisma.service.findMany({
      where,
      select: SERVICE_SELECT,
    });
    const usage = await this.usageOf(rows.map((r) => r.id));
    const items = rows.map((r) => this.toDto(r, usage.get(r.id) ?? NO_USAGE));

    const dir = (order ?? DEFAULT_ORDER[sort]) === 'asc' ? 1 : -1;
    const byName = (a: ServiceResponseDto, b: ServiceResponseDto) =>
      a.name.localeCompare(b.name, 'vi');
    items.sort((a, b) => {
      const diff =
        sort === 'usage'
          ? a.usage_30d - b.usage_30d
          : sort === 'price'
            ? a.price - b.price
            : sort === 'created_at'
              ? a.created_at.getTime() - b.created_at.getTime()
              : byName(a, b);
      // Bằng nhau thì xếp theo tên -> thứ tự cố định, chuyển trang không nhảy dòng
      return diff !== 0 ? diff * dir : byName(a, b);
    });

    return {
      data: items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
      totalPages: Math.ceil(items.length / limit),
    };
  }

  async findOne(id: string): Promise<ServiceResponseDto> {
    const row = await this.prisma.service.findUnique({
      where: { id },
      select: SERVICE_SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy dịch vụ');
    const usage = await this.usageOf([id]);
    return this.toDto(row, usage.get(id) ?? NO_USAGE);
  }

  /* ============================================================
   *  THỐNG KÊ
   * ============================================================ */

  async getStats(): Promise<ServiceStatsDto> {
    const { thisMonth, lastMonth } = this.monthStarts();
    const since = new Date(Date.now() - 30 * DAY_MS);
    const revenue = (from: Date, to?: Date) =>
      this.prisma.bookingService.aggregate({
        where: { used_at: { gte: from, ...(to && { lt: to }) } },
        _sum: { total_price: true },
      });

    const [total, active, byCategory, thisRev, lastRev, uses30d, services] =
      await Promise.all([
        this.prisma.service.count(),
        this.prisma.service.count({ where: { is_active: true } }),
        this.prisma.service.groupBy({
          by: ['category'],
          _count: { _all: true },
        }),
        revenue(thisMonth),
        revenue(lastMonth, thisMonth),
        this.prisma.bookingService.count({
          where: { used_at: { gte: since } },
        }),
        this.prisma.service.findMany({
          select: { id: true, name: true, unit: true, is_active: true },
        }),
      ]);

    const usage = await this.usageOf(services.map((s) => s.id));
    const withUsage: (ServiceUsageItemDto & { is_active: boolean })[] =
      services.map((s) => {
        const u = usage.get(s.id) ?? NO_USAGE;
        return {
          id: s.id,
          name: s.name,
          unit: s.unit,
          is_active: s.is_active,
          usage_30d: u.usage30d,
          revenue_30d: u.revenue30d,
        };
      });
    const strip = ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      is_active: _ignored,
      ...rest
    }: (typeof withUsage)[number]): ServiceUsageItemDto => rest;

    return {
      total,
      active,
      // Nhóm nào chưa có dịch vụ vẫn trả 0 -> FE không phải kiểm tra undefined
      by_category: Object.fromEntries(
        CATEGORIES.map((c) => [
          c,
          byCategory.find((g) => g.category === c)?._count._all ?? 0,
        ]),
      ) as Record<ServiceCategory, number>,
      revenue_this_month: Number(thisRev._sum.total_price ?? 0),
      revenue_last_month: Number(lastRev._sum.total_price ?? 0),
      uses_30d: uses30d,
      // Top theo DOANH THU: 3 kg giặt ủi và 3 suất massage không so được bằng số lượng
      top: withUsage
        .filter((s) => s.usage_30d > 0)
        .sort((a, b) => b.revenue_30d - a.revenue_30d)
        .slice(0, 3)
        .map(strip),
      unused: withUsage
        .filter((s) => s.is_active && s.usage_30d === 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        .slice(0, 5)
        .map(strip),
    };
  }

  /* ============================================================
   *  THÊM / SỬA / BẬT TẮT / XOÁ
   * ============================================================ */

  async create(dto: CreateServiceDto): Promise<ServiceResponseDto> {
    await this.assertNameFree(dto.name);
    const row = await this.saveOrConflict(() =>
      this.prisma.service.create({ data: dto, select: SERVICE_SELECT }),
    );
    return this.toDto(row, NO_USAGE);
  }

  /** Đổi giá chỉ ảnh hưởng lần dùng sau: booking_services.unit_price đã chốt giá lúc dùng */
  async update(id: string, dto: UpdateServiceDto): Promise<ServiceResponseDto> {
    await this.ensureExists(id);
    if (dto.name) await this.assertNameFree(dto.name, id);

    await this.saveOrConflict(() =>
      this.prisma.service.update({ where: { id }, data: dto }),
    );
    return this.findOne(id);
  }

  async setActive(id: string, isActive: boolean): Promise<ServiceResponseDto> {
    await this.ensureExists(id);
    await this.prisma.service.update({
      where: { id },
      data: { is_active: isActive },
    });
    return this.findOne(id);
  }

  /**
   * Xoá HẲN, chỉ khi dịch vụ chưa từng được dùng (VD tạo nhầm).
   * Đã có trong hoá đơn thì xoá sẽ làm mất lịch sử -> báo 409, FE gợi ý "Ngừng bán".
   */
  async remove(id: string): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { name: true, _count: { select: { booking_services: true } } },
    });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ');

    const uses = service._count.booking_services;
    if (uses > 0) {
      throw new ConflictException(
        `Dịch vụ "${service.name}" đã được dùng ${uses} lần trong hoá đơn, chỉ có thể ngừng bán`,
      );
    }
    await this.prisma.service.delete({ where: { id } });
  }

  /* ============================================================
   *  HELPER
   * ============================================================ */

  /** Lượt dùng + doanh thu 30 ngày và tổng số lần dùng của nhiều dịch vụ, chỉ 2 query */
  private async usageOf(ids: string[]): Promise<Map<string, Usage>> {
    if (!ids.length) return new Map();
    const since = new Date(Date.now() - 30 * DAY_MS);

    const [recent, allTime] = await Promise.all([
      this.prisma.bookingService.groupBy({
        by: ['service_id'],
        where: { service_id: { in: ids }, used_at: { gte: since } },
        _sum: { quantity: true, total_price: true },
      }),
      this.prisma.bookingService.groupBy({
        by: ['service_id'],
        where: { service_id: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const map = new Map<string, Usage>();
    for (const g of allTime)
      map.set(g.service_id, { ...NO_USAGE, totalUses: g._count._all });
    for (const g of recent) {
      const cur = map.get(g.service_id) ?? { ...NO_USAGE };
      cur.usage30d = g._sum.quantity ?? 0;
      cur.revenue30d = Number(g._sum.total_price ?? 0);
      map.set(g.service_id, cur);
    }
    return map;
  }

  /** Đầu tháng này và tháng trước, theo giờ VN */
  private monthStarts() {
    const [y, m] = new Date()
      .toLocaleDateString('sv-SE', { timeZone: HOTEL_TZ })
      .split('-')
      .map(Number);
    const start = (year: number, month: number) => {
      const yy = month < 1 ? year - 1 : year;
      const mm = month < 1 ? 12 : month;
      return new Date(`${yy}-${String(mm).padStart(2, '0')}-01T00:00:00+07:00`);
    };
    return { thisMonth: start(y, m), lastMonth: start(y, m - 1) };
  }

  /** Trùng tên không phân biệt hoa thường: "giặt ủi" và "Giặt Ủi" là 1 dịch vụ */
  private async assertNameFree(name: string, excludeId?: string) {
    const dup = await this.prisma.service.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { name: true },
    });
    if (dup) throw new ConflictException(`Đã có dịch vụ "${dup.name}"`);
  }

  /** 2 người cùng tạo 1 tên cùng lúc: assertNameFree đều qua, DB (@unique) chặn người sau -> P2002 */
  private async saveOrConflict<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Tên dịch vụ đã tồn tại');
      }
      throw err;
    }
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy dịch vụ');
  }

  private toDto(r: ServiceRow, u: Usage): ServiceResponseDto {
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      unit: r.unit,
      price: Number(r.price),
      is_active: r.is_active,
      usage_30d: u.usage30d,
      revenue_30d: u.revenue30d,
      total_uses: u.totalUses,
      can_delete: u.totalUses === 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }
}
