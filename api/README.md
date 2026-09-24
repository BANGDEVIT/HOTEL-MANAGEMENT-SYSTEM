# 🏨 Hotel Management System — Backend API

Backend API cho hệ thống quản lý khách sạn, xây dựng với **NestJS**, **Prisma 7**, **PostgreSQL (Neon)** và **AWS S3**.

---

## 📋 Mục lục

- [Tech Stack](#tech-stack)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cài đặt](#cài-đặt)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Biến môi trường](#biến-môi-trường)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Phân quyền](#phân-quyền)
- [Flow nghiệp vụ](#flow-nghiệp-vụ)

---

## 🛠 Tech Stack

| Công nghệ           | Phiên bản | Mô tả                      |
| ------------------- | --------- | -------------------------- |
| **NestJS**          | ^11.0.0   | Backend framework          |
| **Prisma**          | 7.x       | ORM                        |
| **PostgreSQL**      | -         | Database (Neon serverless) |
| **AWS S3**          | -         | Lưu trữ file/ảnh           |
| **JWT**             | -         | Authentication             |
| **Passport.js**     | -         | Auth strategy              |
| **Swagger**         | -         | API documentation          |
| **bcrypt**          | -         | Hash password              |
| **class-validator** | -         | Validation                 |

---

## 🏗 Kiến trúc hệ thống

```
src/
├── common/
│   ├── decorators/
│   │   ├── get-account.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── role-decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   └── s3/
│       ├── s3.module.ts
│       └── s3.service.ts
├── modules/
│   ├── auth/
│   ├── booking/
│   ├── customer/
│   ├── employee/
│   ├── invoice/
│   ├── payment/
│   ├── room/
│   ├── room-type/
│   ├── services/
│   └── shift/
├── prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.ts
│   ├── schema.prisma
│   └── seed.ts
└── main.ts
```

---

## ⚙️ Cài đặt

### Yêu cầu

- Node.js >= 18
- npm >= 9

### Bước 1: Clone project

```bash
git clone <repository-url>
cd hotel/api
```

### Bước 2: Cài đặt dependencies

```bash
npm install
```

### Bước 3: Tạo file `.env`

```bash
cp .env.example .env
```

Điền đầy đủ các biến môi trường (xem phần [Biến môi trường](#biến-môi-trường)).

### Bước 4: Migrate database

```bash
npx prisma migrate dev
```

### Bước 5: Seed dữ liệu mẫu

```bash
npx prisma db seed
```

Seed sẽ tạo:

- Các roles: `admin`, `manager`, `staff`, `customer`
- Tài khoản manager mặc định:
  - Email: `manager@hotel.com`
  - Password: `Manager@123`

---

## 🚀 Chạy ứng dụng

### Development (có hot-reload):

```bash
npm run dev
```

### Production:

```bash
npm run build
npm run start:prod
```

### Xem API docs (Swagger):

```
http://localhost:3001/api/docs
```

---

## 🔑 Biến môi trường

Tạo file `.env` ở root project với nội dung sau:

```dotenv
# App
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000

# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://username:password@ep-xxx.neon.tech/Hotel?sslmode=require"

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key

# Password Reset
RESET_PASSWORD=DefaultPassword@123

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=your_bucket_name
```

---

## 🗄 Database Schema

### Các bảng chính:

| Bảng                  | Mô tả                                    |
| --------------------- | ---------------------------------------- |
| `accounts`            | Tài khoản đăng nhập                      |
| `customers`           | Khách hàng (online + walk-in)            |
| `employees`           | Nhân viên                                |
| `roles`               | Vai trò: admin, manager, staff, customer |
| `rooms`               | Phòng khách sạn                          |
| `room_types`          | Loại phòng                               |
| `bookings`            | Đặt phòng                                |
| `booking_rooms`       | Phòng trong booking                      |
| `booking_services`    | Dịch vụ trong booking                    |
| `invoices`            | Hóa đơn                                  |
| `payments`            | Thanh toán                               |
| `services`            | Dịch vụ khách sạn                        |
| `shifts`              | Ca làm việc                              |
| `employee_shifts`     | Phân công ca                             |
| `refresh_tokens`      | Refresh token                            |
| `room_status_history` | Lịch sử trạng thái phòng                 |

### Enums:

```
RoomStatus:    available, occupied, maintenance, cleaning, inactive
BookingStatus: pending, confirmed, checked_in, checked_out, cancelled
BookingType:   online, walk_in
InvoiceStatus: unpaid, paid, partially_paid
PaymentMethod: cash, bank_transfer, e_wallet, credit_card
CustomerSource: walk_in, online_registration
ShiftName:     morning, afternoon, evening, night
DayOfWeek:     monday → sunday
BedType:       single, double, twin, king, queen
```

---

## 📡 API Endpoints

> Base URL: `http://localhost:3001/api/v1`
>
> Tất cả response đều có format:
>
> ```json
> {
>   "success": true,
>   "statusCode": 200,
>   "message": "Success",
>   "data": { ... },
>   "timestamp": "2026-05-12T00:00:00.000Z"
> }
> ```

---

### 🔐 Auth

| Method | Endpoint         | Mô tả                | Auth   |
| ------ | ---------------- | -------------------- | ------ |
| POST   | `/auth/register` | Đăng ký tài khoản    | Public |
| POST   | `/auth/login`    | Đăng nhập            | Public |
| POST   | `/auth/logout`   | Đăng xuất            | Bearer |
| POST   | `/auth/refresh`  | Refresh access token | Cookie |

---

### 👤 Customer

| Method | Endpoint                      | Mô tả                      | Role     |
| ------ | ----------------------------- | -------------------------- | -------- |
| GET    | `/customers/profile`          | Xem profile                | customer |
| PATCH  | `/customers/profile`          | Cập nhật profile           | customer |
| PATCH  | `/customers/profile/password` | Đổi mật khẩu               | customer |
| POST   | `/customers/guest`            | Tạo khách vãng lai         | staff+   |
| GET    | `/customers`                  | Danh sách khách            | manager+ |
| GET    | `/customers/:id`              | Chi tiết khách             | staff+   |
| PATCH  | `/customers/:id`              | Cập nhật khách             | manager+ |
| DELETE | `/customers/:id`              | Vô hiệu hóa                | manager+ |
| POST   | `/customers/:id/link-account` | Link tài khoản cho walk-in | staff+   |

---

### 👷 Employee

| Method | Endpoint                        | Mô tả               | Role     |
| ------ | ------------------------------- | ------------------- | -------- |
| GET    | `/employees/profile`            | Xem profile         | staff+   |
| PATCH  | `/employees/profile`            | Cập nhật profile    | staff+   |
| PATCH  | `/employees/profile/password`   | Đổi mật khẩu        | staff+   |
| GET    | `/employees/profile/shifts`     | Xem lịch làm việc   | staff+   |
| GET    | `/employees`                    | Danh sách nhân viên | manager+ |
| POST   | `/employees`                    | Tạo nhân viên       | manager+ |
| GET    | `/employees/:id`                | Chi tiết nhân viên  | manager+ |
| PATCH  | `/employees/:id`                | Cập nhật nhân viên  | manager+ |
| PATCH  | `/employees/:id/reset-password` | Reset mật khẩu      | manager+ |
| DELETE | `/employees/:id`                | Xóa mềm             | manager+ |

---

### 🕐 Shift

| Method | Endpoint                            | Mô tả               | Role     |
| ------ | ----------------------------------- | ------------------- | -------- |
| GET    | `/shifts/schedule`                  | Xem lịch tổng hợp   | staff+   |
| GET    | `/shifts`                           | Danh sách ca        | manager+ |
| POST   | `/shifts`                           | Tạo ca làm việc     | manager+ |
| GET    | `/shifts/:id`                       | Chi tiết ca         | manager+ |
| PATCH  | `/shifts/:id`                       | Cập nhật ca         | manager+ |
| DELETE | `/shifts/:id`                       | Xóa ca              | manager+ |
| POST   | `/shifts/:id/employees`             | Phân công nhân viên | manager+ |
| DELETE | `/shifts/:id/employees/:employeeId` | Hủy phân công       | manager+ |

---

### 🛏 Room Type

| Method | Endpoint          | Mô tả                | Role     |
| ------ | ----------------- | -------------------- | -------- |
| GET    | `/room-types`     | Danh sách loại phòng | staff+   |
| POST   | `/room-types`     | Tạo loại phòng       | manager+ |
| GET    | `/room-types/:id` | Chi tiết loại phòng  | staff+   |
| PATCH  | `/room-types/:id` | Cập nhật             | manager+ |
| DELETE | `/room-types/:id` | Xóa mềm              | manager+ |

---

### 🚪 Room

| Method | Endpoint            | Mô tả              | Role     |
| ------ | ------------------- | ------------------ | -------- |
| GET    | `/rooms`            | Danh sách phòng    | staff+   |
| POST   | `/rooms`            | Tạo phòng          | manager+ |
| GET    | `/rooms/:id`        | Chi tiết phòng     | staff+   |
| PATCH  | `/rooms/:id/status` | Đổi trạng thái     | staff+   |
| PATCH  | `/rooms/:id`        | Cập nhật thông tin | manager+ |
| DELETE | `/rooms/:id`        | Xóa mềm            | manager+ |

---

### 📅 Booking

| Method | Endpoint                            | Mô tả             | Role     |
| ------ | ----------------------------------- | ----------------- | -------- |
| GET    | `/bookings/my-bookings`             | Booking của tôi   | customer |
| GET    | `/bookings`                         | Danh sách booking | staff+   |
| POST   | `/bookings`                         | Tạo booking       | all      |
| GET    | `/bookings/:id`                     | Chi tiết booking  | all      |
| PATCH  | `/bookings/:id`                     | Cập nhật          | all      |
| DELETE | `/bookings/:id`                     | Hủy booking       | all      |
| POST   | `/bookings/:id/confirm`             | Xác nhận          | staff+   |
| POST   | `/bookings/:id/check-in`            | Check-in          | staff+   |
| POST   | `/bookings/:id/check-out`           | Check-out         | staff+   |
| POST   | `/bookings/:id/services`            | Thêm dịch vụ      | staff+   |
| DELETE | `/bookings/:id/services/:serviceId` | Xóa dịch vụ       | staff+   |

---

### 🛎 Service

| Method | Endpoint        | Mô tả             | Role     |
| ------ | --------------- | ----------------- | -------- |
| GET    | `/services`     | Danh sách dịch vụ | staff+   |
| POST   | `/services`     | Tạo dịch vụ       | manager+ |
| GET    | `/services/:id` | Chi tiết dịch vụ  | staff+   |
| PATCH  | `/services/:id` | Cập nhật          | manager+ |
| DELETE | `/services/:id` | Xóa mềm           | manager+ |

---

### 🧾 Invoice

| Method | Endpoint                       | Mô tả                | Role     |
| ------ | ------------------------------ | -------------------- | -------- |
| GET    | `/invoices/booking/:bookingId` | Hóa đơn theo booking | all      |
| GET    | `/invoices/:id`                | Chi tiết hóa đơn     | all      |
| PATCH  | `/invoices/:id/discount`       | Cập nhật discount    | manager+ |

---

### 💳 Payment

| Method | Endpoint                       | Mô tả                   | Role   |
| ------ | ------------------------------ | ----------------------- | ------ |
| GET    | `/payments/invoice/:invoiceId` | Thanh toán theo hóa đơn | all    |
| POST   | `/payments`                    | Tạo thanh toán          | staff+ |
| GET    | `/payments/:id`                | Chi tiết thanh toán     | all    |

---

## 🔒 Phân quyền

| Role       | Mô tả                             |
| ---------- | --------------------------------- |
| `admin`    | Toàn quyền hệ thống               |
| `manager`  | Quản lý nhân viên, phòng, booking |
| `staff`    | Xử lý booking, check-in/out       |
| `customer` | Đặt phòng online, xem lịch sử     |

---

## 🔄 Flow nghiệp vụ

### Đặt phòng Online:

```
Khách đăng ký tài khoản
        ↓
Đăng nhập → accessToken
        ↓
POST /bookings (booking_type: online)
        ↓
Booking status: pending
        ↓
Staff confirm → POST /bookings/:id/confirm
        ↓
Booking status: confirmed
Invoice tự động tạo (unpaid)
        ↓
Khách đến → POST /bookings/:id/check-in
        ↓
Booking status: checked_in
Phòng: available → occupied
        ↓
Thêm dịch vụ (nếu có)
        ↓
Thanh toán → POST /payments
        ↓
Invoice status: paid
        ↓
Check-out → POST /bookings/:id/check-out
        ↓
Booking status: checked_out
Phòng: occupied → cleaning → available
```

### Đặt phòng Walk-in:

```
Khách đến quầy
        ↓
Staff tạo Customer → POST /customers/guest
        ↓
Staff tạo booking → POST /bookings (booking_type: walk_in)
        ↓
Staff confirm → Invoice tạo
        ↓
Check-in → Ở → Thanh toán → Check-out
        ↓
(Tùy chọn) Khách muốn tạo tài khoản
        ↓
POST /customers/:id/link-account
        ↓
Khách có tài khoản, lịch sử booking giữ nguyên
```

---

# Phân quyền theo Role — Sidebar & Menu

> Bổ sung cho `README.md` chính — phần mô tả UI/FE, đặt sau mục "Phân quyền" (API-level) đã có.

## Nguyên tắc phân quyền 2 tầng

```
Tầng 1 — BE (RolesGuard + @Roles(...))
  → Chốt chặn THẬT SỰ, không thể bypass
  → Áp dụng cho từng endpoint cụ thể

Tầng 2 — FE (ProtectedRoute allowedRoles + Sidebar filterByRole)
  → Chỉ để trải nghiệm tốt hơn (ẩn menu không có quyền,
    chặn sớm trước khi gọi API)
  → KHÔNG thay thế được Tầng 1 — FE luôn có thể bị bypass
    qua DevTools/Postman, nên BE luôn phải tự kiểm tra lại
```

## Bảng phân quyền menu Admin Dashboard

| Menu        | Route         | admin | manager | staff | Ghi chú                                   |
| ----------- | ------------- | :---: | :-----: | :---: | ----------------------------------------- |
| Tổng quan   | `/dashboard`  |  ✅   |   ✅    |  ✅   |                                           |
| Nhân viên   | `/employees`  |  ✅   |   ✅    |  ❌   | Nhạy cảm: lương, tuyển/sa thải            |
| Ca làm việc | `/shifts`     |  ✅   |   ✅    |  ✅   | Staff cần xem lịch ca của mình            |
| Loại phòng  | `/room-types` |  ✅   |   ✅    |  ❌   | Cấu hình giá — chỉ manager+               |
| Dịch vụ     | `/services`   |  ✅   |   ✅    |  ❌   | Cấu hình giá dịch vụ — chỉ manager+       |
| Phòng       | `/rooms`      |  ✅   |   ✅    |  ✅   | Việc hàng ngày: đổi trạng thái phòng      |
| Khách hàng  | `/customers`  |  ✅   |   ✅    |  ✅   | Tạo walk-in guest, tra cứu                |
| Đặt phòng   | `/bookings`   |  ✅   |   ✅    |  ✅   | Việc hàng ngày: check-in/out              |
| Hoá đơn     | `/invoices`   |  ✅   |   ✅    |  ✅   | Staff xem để thu tiền, KHÔNG sửa discount |
| Thanh toán  | `/payments`   |  ✅   |   ✅    |  ✅   | Staff trực tiếp nhận tiền khách           |
| Hồ sơ       | `/profile`    |  ✅   |   ✅    |  ✅   | Ai đăng nhập cũng thấy                    |

**Lưu ý quan trọng:** bảng trên là "menu nào **hiện ra**" — không đồng nghĩa với "action nào được **phép làm**" bên trong trang đó. Ví dụ: staff thấy và vào được `/invoices`, nhưng nút "Sửa discount" bên trong vẫn chỉ `manager`/`admin` bấm được (khớp với `@Roles('manager', 'admin')` trên `PATCH /invoices/:id/discount` ở BE).

## Cấu trúc nhóm sidebar

```
QUẢN TRỊ (điều hành — chủ yếu admin/manager)
  ├── Tổng quan
  ├── Nhân viên
  ├── Ca làm việc
  ├── Loại phòng
  └── Dịch vụ

VẬN HÀNH (việc hàng ngày — staff cũng thấy)
  ├── Phòng
  ├── Khách hàng
  ├── Đặt phòng
  ├── Hoá đơn
  └── Thanh toán

TÀI KHOẢN (ai đăng nhập cũng thấy)
  └── Hồ sơ
  └── Đăng xuất
```

## Vai trò công việc thực tế (căn cứ để phân quyền)

| Role       | Mô tả công việc                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`    | Toàn quyền hệ thống, không giới hạn                                                                                                            |
| `manager`  | Điều hành vận hành: quản nhân sự, xếp ca, cấu hình giá phòng/dịch vụ, xem báo cáo                                                              |
| `staff`    | Lễ tân/trực ca: check-in/out, đặt phòng hộ khách, đổi trạng thái phòng, thu tiền — không có quyền với thông tin nhạy cảm (lương, giá cấu hình) |
| `customer` | Chỉ thấy khu vực riêng (đặt phòng, lịch sử, hồ sơ cá nhân), tách biệt hoàn toàn khỏi Admin dashboard                                           |

## 📝 Ghi chú

- Access token có thời hạn **15 phút**
- Refresh token có thời hạn **7 ngày** (lưu trong HttpOnly Cookie)
- File upload giới hạn **5MB**, chấp nhận: `jpeg`, `png`, `webp`
- Booking chỉ update được khi ở trạng thái `pending`
- Check-out bắt buộc phải thanh toán hóa đơn trước
- Phòng `inactive` không thể đặt phòng
- Walk-in customer không có tài khoản (`account_id = null`)

---

## 👨‍💻 Tác giả

**BangDEV** — Bùi Công Bằng
