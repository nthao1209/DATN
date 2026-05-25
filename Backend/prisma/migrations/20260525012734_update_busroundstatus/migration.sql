-- CreateEnum
CREATE TYPE "BusRoundCompletionStatus" AS ENUM ('PENDING', 'DRIVER_CONFIRMED', 'ADMIN_APPROVED');

-- AlterTable
ALTER TABLE "BusRoundStatus" ADD COLUMN     "adminApprovedBy" INTEGER,
ADD COLUMN     "driverConfirmedBy" INTEGER;

-- AddForeignKey
ALTER TABLE "BusRoundStatus" ADD CONSTRAINT "BusRoundStatus_driverConfirmedBy_fkey" FOREIGN KEY ("driverConfirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusRoundStatus" ADD CONSTRAINT "BusRoundStatus_adminApprovedBy_fkey" FOREIGN KEY ("adminApprovedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
