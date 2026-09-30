/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Service` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('food', 'laundry', 'minibar', 'surcharge', 'other');

-- CreateEnum
CREATE TYPE "ServiceUnit" AS ENUM ('turn', 'portion', 'kg', 'set', 'bottle', 'can', 'hour', 'day');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "category" "ServiceCategory" NOT NULL DEFAULT 'other',
ADD COLUMN     "unit" "ServiceUnit" NOT NULL DEFAULT 'turn';

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");
