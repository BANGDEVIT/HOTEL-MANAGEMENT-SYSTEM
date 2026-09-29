-- DropForeignKey
ALTER TABLE "CustomerNote" DROP CONSTRAINT "CustomerNote_customer_id_fkey";

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
