/*
  Warnings:

  - You are about to drop the column `day_of_week` on the `Shift` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employee_id,work_date]` on the table `EmployeeShift` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Shift` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "EmployeeShift_employee_id_work_date_idx";

-- DropIndex
DROP INDEX "Shift_name_day_of_week_key";

-- AlterTable
ALTER TABLE "Shift" DROP COLUMN "day_of_week";

-- DropEnum
DROP TYPE "DayOfWeek";

-- CreateIndex
CREATE INDEX "EmployeeShift_work_date_idx" ON "EmployeeShift"("work_date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeShift_employee_id_work_date_key" ON "EmployeeShift"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_name_key" ON "Shift"("name");
