import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

export class DashboardGuestDto {
  @ApiProperty() booking_id: string;
  @ApiProperty({ example: 'BK-260930-0092' }) code: string;
  @ApiProperty({ example: 'Martin Sophie' }) customer_name: string;
  @ApiProperty({ type: [String], example: ['306'] }) rooms: string[];
  @ApiProperty({
    enum: ['ready', 'cleaning', 'occupied', 'blocked'],
    description:
      'Khách đến chưa nhận: phòng đã sẵn sàng chưa (ready / chưa dọn / còn khách cũ / bảo trì). Còn lại: ready',
  })
  room_state: 'ready' | 'cleaning' | 'occupied' | 'blocked';
  @ApiProperty({ enum: BookingStatus }) status: BookingStatus;
  @ApiProperty({
    description: 'Đã làm thủ tục xong hôm nay (đã nhận / đã trả)',
  })
  done: boolean;
  @ApiProperty({ description: 'Lẽ ra đến / đi từ hôm trước' }) overdue: boolean;
  @ApiProperty({ nullable: true, description: 'Lúc nhận / trả thực tế' })
  at: Date | null;
  @ApiProperty({ example: 2 }) nights: number;
}

export class GuestFlowDto {
  @ApiProperty({
    description: 'Tổng khách phải xử lý hôm nay (đã xong + còn lại)',
  })
  total: number;
  @ApiProperty() done: number;
  @ApiProperty({
    type: [DashboardGuestDto],
    description: 'Còn lại trước (trễ lên đầu), đã xong sau; tối đa 8',
  })
  items: DashboardGuestDto[];
}

export class RoomStatusCountDto {
  @ApiProperty() total: number;
  @ApiProperty() available: number;
  @ApiProperty() occupied: number;
  @ApiProperty() cleaning: number;
  @ApiProperty() maintenance: number;
  @ApiProperty() inactive: number;
  @ApiProperty({
    description:
      'Trong số phòng trống: đang giữ cho khách đến hôm nay chưa nhận',
  })
  reserved_today: number;
  @ApiProperty({
    example: 62,
    description: '% phòng có khách / phòng đang kinh doanh',
  })
  occupancy: number;
  @ApiProperty({ type: [String], description: 'Số phòng đang chờ dọn' })
  cleaning_rooms: string[];
  @ApiProperty({ type: [String], description: 'Số phòng bảo trì' })
  maintenance_rooms: string[];
}

export class RateKpiDto {
  @ApiProperty({ description: 'ADR = tiền phòng / số đêm phòng đã bán' })
  adr: number;
  @ApiProperty({ description: 'RevPAR = tiền phòng / số đêm phòng có thể bán' })
  revpar: number;
  @ApiProperty() room_revenue: number;
  @ApiProperty() rooms_sold: number;
}

export class BookingsTodayDto {
  @ApiProperty({ description: 'Đặt phòng TẠO hôm nay' }) total: number;
  @ApiProperty({ description: 'Đã xác nhận (kể cả đã nhận phòng luôn)' })
  confirmed: number;
  @ApiProperty() pending: number;
  @ApiProperty({ description: 'Đã huỷ / từ chối' }) cancelled: number;
}

export class ChannelRevenueDto {
  @ApiProperty({ enum: ['online', 'walk_in'] }) channel: 'online' | 'walk_in';
  @ApiProperty({
    description: 'Thực thu tháng này của các đặt phòng thuộc nguồn này',
  })
  amount: number;
  @ApiProperty({ description: 'Số đặt phòng có thu tiền trong tháng' })
  bookings: number;
}

export class GuestStatsDto {
  @ApiProperty({ description: 'Số người đang lưu trú (người lớn + trẻ em)' })
  in_house_guests: number;
  @ApiProperty({ description: 'Hồ sơ khách tạo trong tháng' })
  new_this_month: number;
  @ApiProperty({ description: 'Khách ở trong tháng này và đã từng ở trước đó' })
  returning_this_month: number;
  @ApiProperty({ description: 'Khách có tài khoản thành viên' })
  members: number;
}

export class DayPerformanceDto {
  @ApiProperty({ example: '2026-09-30' }) date: string;
  @ApiProperty({ description: 'Thực thu trong ngày' }) amount: number;
  @ApiProperty({ description: 'Số phòng có khách đêm đó' }) rooms_sold: number;
  @ApiProperty({ description: '% công suất đêm đó' }) occupancy: number;
}

export class DayOccupancyDto {
  @ApiProperty({ example: '2026-10-01' }) date: string;
  @ApiProperty({ description: 'Số phòng đã có khách giữ đêm đó' })
  booked: number;
  @ApiProperty({ description: '% so với phòng đang kinh doanh' })
  occupancy: number;
}

export class DashboardAlertsDto {
  @ApiProperty({ description: 'Yêu cầu online chờ duyệt' })
  pending_requests: number;
  @ApiProperty({ description: 'Phòng chờ dọn' }) rooms_cleaning: number;
  @ApiProperty({ description: 'Phòng bảo trì (có sự cố)' })
  rooms_maintenance: number;
  @ApiProperty({ description: 'Khách đến chưa nhận mà phòng đã sẵn sàng' })
  ready_for_check_in: number;
  @ApiProperty({
    description:
      'Khách đến chưa nhận mà phòng CHƯA sẵn sàng (chưa dọn / còn khách cũ)',
  })
  not_ready_for_check_in: number;
  @ApiProperty({
    description: 'Khách lẽ ra đến từ hôm trước mà chưa nhận phòng',
  })
  arrivals_overdue: number;
  @ApiProperty({ description: 'Khách quá ngày trả phòng' })
  departures_overdue: number;
  @ApiProperty() debt_count: number;
  @ApiProperty() debt_amount: number;
}

export class DashboardOverviewDto {
  @ApiProperty({ example: '2026-09-30' }) today: string;
  @ApiProperty({ type: GuestFlowDto }) arrivals: GuestFlowDto;
  @ApiProperty({ type: GuestFlowDto }) departures: GuestFlowDto;
  @ApiProperty({ description: 'Số đặt phòng đang ở' }) in_house: number;
  @ApiProperty({
    description: 'Số phòng đang có khách (1 đặt phòng có thể nhiều phòng)',
  })
  in_house_rooms: number;
  @ApiProperty({ type: RoomStatusCountDto }) rooms: RoomStatusCountDto;
  @ApiProperty({ description: 'Thực thu hôm nay (không tính phiếu huỷ)' })
  collected_today: number;
  @ApiProperty() collected_yesterday: number;
  @ApiProperty() collected_month: number;
  @ApiProperty({ description: 'Cùng số ngày của tháng trước' })
  collected_prev_month: number;
  @ApiProperty({ type: RateKpiDto, description: 'Đêm nay: phòng có khách' })
  rate_today: RateKpiDto;
  @ApiProperty({ type: RateKpiDto, description: 'Từ đầu tháng tới đêm nay' })
  rate_month: RateKpiDto;
  @ApiProperty({ type: BookingsTodayDto }) bookings_today: BookingsTodayDto;
  @ApiProperty({ type: [ChannelRevenueDto] })
  channels_month: ChannelRevenueDto[];
  @ApiProperty({ type: GuestStatsDto }) guests: GuestStatsDto;
  @ApiProperty({
    type: [DayPerformanceDto],
    description: '7 ngày gần nhất, tính cả hôm nay',
  })
  past_7d: DayPerformanceDto[];
  @ApiProperty({ type: [DayOccupancyDto], description: 'Hôm nay + 6 ngày tới' })
  forecast_7d: DayOccupancyDto[];
  @ApiProperty({ type: DashboardAlertsDto }) alerts: DashboardAlertsDto;
}
