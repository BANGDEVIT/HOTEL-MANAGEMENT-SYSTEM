-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "void_reason" VARCHAR(300),
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by" UUID;

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_created_at_idx" ON "Invoice"("created_at");

-- CreateIndex
CREATE INDEX "Payment_paid_at_idx" ON "Payment"("paid_at");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
