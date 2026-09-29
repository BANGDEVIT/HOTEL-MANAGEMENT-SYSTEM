-- ============================================================
-- Booking giai đoạn 1: no_show, mã booking, số người, ai làm gì, lý do huỷ
-- ============================================================

-- 1. Trạng thái mới. Postgres 12+ cho ADD VALUE trong transaction,
--    chỉ không được DÙNG giá trị mới ngay trong cùng migration (ở đây không dùng).
ALTER TYPE "BookingStatus" ADD VALUE 'no_show';

-- 2. Cột mới của Booking. "code" CHƯA đặt NOT NULL: bảng đang có dữ liệu,
--    phải điền mã cho các dòng cũ trước (bước 3), nếu không migration báo lỗi.
ALTER TABLE "Booking"
ADD COLUMN "code" VARCHAR(20),
ADD COLUMN "adults" SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN "children" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN "note" VARCHAR(500),
ADD COLUMN "confirmed_by" UUID,
ADD COLUMN "confirmed_at" TIMESTAMP(3),
ADD COLUMN "checked_in_by" UUID,
ADD COLUMN "checked_out_by" UUID,
ADD COLUMN "cancelled_by" UUID,
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "cancel_reason" VARCHAR(300);

-- 3. Sequence sinh số thứ tự cho mã booking. nextval() là nguyên tử:
--    2 lễ tân tạo booking cùng lúc không bao giờ nhận cùng một số.
CREATE SEQUENCE "booking_code_seq";

-- Điền mã cho booking cũ, theo thứ tự tạo. Ngày trong mã tính theo giờ VN.
-- created_at lưu UTC (không kèm múi giờ) -> AT TIME ZONE 'UTC' rồi mới đổi sang giờ VN.
WITH ordered AS (
  SELECT id, created_at, row_number() OVER (ORDER BY created_at, id) AS n
  FROM "Booking"
)
UPDATE "Booking" b
SET code = 'BK-'
  || to_char((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYMMDD')
  || '-'
  || lpad(o.n::text, GREATEST(4, length(o.n::text)), '0') -- không cắt số khi vượt 9999
FROM ordered o
WHERE b.id = o.id;

-- Sequence chạy tiếp sau số lớn nhất vừa dùng
SELECT setval (
        '"booking_code_seq"', (
            SELECT count(*)
            FROM "Booking"
        ) + 1, false
    );

ALTER TABLE "Booking" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Booking_code_key" ON "Booking" ("code");

CREATE INDEX "Booking_check_out_date_idx" ON "Booking" ("check_out_date");

-- 4. Ai thu tiền
ALTER TABLE "Payment"
ADD COLUMN "received_by" UUID,
ADD COLUMN "note" VARCHAR(300);

-- 5. Khoá ngoại. Xoá nhân viên / tài khoản thì chỉ để trống người thực hiện, không xoá booking.
ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE;