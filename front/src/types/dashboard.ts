/**
 * Kiểu dữ liệu trang Tổng quan — khớp 1-1 với dashboard-response.dto.ts ở BE.
 */
import type { BookingStatus } from "./booking";

export interface DashboardGuest {
  booking_id: string;
  code: string;
  customer_name: string;
  rooms: string[];
  /** Khách đến chưa nhận: phòng sẵn sàng / chưa dọn / còn khách cũ / bảo trì */
  room_state: "ready" | "cleaning" | "occupied" | "blocked";
  status: BookingStatus;
  done: boolean; // đã nhận / đã trả hôm nay
  overdue: boolean; // lẽ ra đến / đi từ hôm trước
  at: string | null;
  nights: number;
}

export interface GuestFlow {
  total: number;
  done: number;
  items: DashboardGuest[]; // còn lại trước, đã xong sau, tối đa 8
}

export interface DashboardRooms {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  maintenance: number;
  inactive: number;
  reserved_today: number; // trong số phòng trống: giữ cho khách đến hôm nay
  occupancy: number; // %
  cleaning_rooms: string[];
  maintenance_rooms: string[];
}

export interface RateKpi {
  adr: number; // tiền phòng / đêm phòng đã bán
  revpar: number; // tiền phòng / đêm phòng có thể bán
  room_revenue: number;
  rooms_sold: number;
}

export interface DashboardOverview {
  today: string;
  arrivals: GuestFlow;
  departures: GuestFlow;
  in_house: number; // số đặt phòng đang ở
  in_house_rooms: number; // số phòng có khách
  rooms: DashboardRooms;
  collected_today: number;
  collected_yesterday: number;
  collected_month: number;
  collected_prev_month: number;
  rate_today: RateKpi; // đêm nay
  rate_month: RateKpi; // từ đầu tháng
  bookings_today: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  channels_month: {
    channel: "online" | "walk_in";
    amount: number;
    bookings: number;
  }[];
  guests: {
    in_house_guests: number;
    new_this_month: number;
    returning_this_month: number;
    members: number;
  };
  past_7d: { date: string; amount: number; rooms_sold: number; occupancy: number }[];
  forecast_7d: { date: string; booked: number; occupancy: number }[];
  alerts: {
    pending_requests: number;
    rooms_cleaning: number;
    rooms_maintenance: number;
    ready_for_check_in: number;
    not_ready_for_check_in: number;
    arrivals_overdue: number;
    departures_overdue: number;
    debt_count: number;
    debt_amount: number;
  };
}
