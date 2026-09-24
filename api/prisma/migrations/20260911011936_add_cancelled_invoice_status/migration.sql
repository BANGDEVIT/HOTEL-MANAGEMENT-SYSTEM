-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'maintenance';
