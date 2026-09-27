-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('cccd', 'passport');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "id_type" "IdType";

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerNote_customer_id_created_at_idx" ON "CustomerNote" ("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "Customer_id_card_idx" ON "Customer" ("id_card");

-- AddForeignKey
ALTER TABLE "CustomerNote"
ADD CONSTRAINT "CustomerNote_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote"
ADD CONSTRAINT "CustomerNote_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;