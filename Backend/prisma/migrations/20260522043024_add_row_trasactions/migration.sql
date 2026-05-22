/*
  Warnings:

  - You are about to drop the column `note` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `approvedBy` on the `UnlockRequest` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "BusRoundStatus" DROP CONSTRAINT "BusRoundStatus_busId_fkey";

-- DropForeignKey
ALTER TABLE "BusRoundStatus" DROP CONSTRAINT "BusRoundStatus_roundId_fkey";

-- DropForeignKey
ALTER TABLE "UnlockRequest" DROP CONSTRAINT "UnlockRequest_approvedBy_fkey";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "note",
ADD COLUMN     "checkInNote" TEXT,
ADD COLUMN     "checkOutNote" TEXT;

-- AlterTable
ALTER TABLE "UnlockRequest" DROP COLUMN "approvedBy",
ADD COLUMN     "handledBy" INTEGER,
ADD COLUMN     "rejectReason" TEXT;

-- AddForeignKey
ALTER TABLE "BusRoundStatus" ADD CONSTRAINT "BusRoundStatus_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusRoundStatus" ADD CONSTRAINT "BusRoundStatus_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlockRequest" ADD CONSTRAINT "UnlockRequest_handledBy_fkey" FOREIGN KEY ("handledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
