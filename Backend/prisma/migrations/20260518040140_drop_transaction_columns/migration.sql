/*
  Warnings:

  - You are about to drop the column `checkInAt` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `checkInBy` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `checkOutAt` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `checkOutBy` on the `Transaction` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AttendanceAction" AS ENUM ('CHECK_IN_ON', 'CHECK_IN_OFF', 'CHECK_OUT_ON', 'CHECK_OUT_OFF');

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_checkInBy_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_checkOutBy_fkey";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "checkInAt",
DROP COLUMN "checkInBy",
DROP COLUMN "checkOutAt",
DROP COLUMN "checkOutBy",
ADD COLUMN     "lastActionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "action" "AttendanceAction" NOT NULL,
    "actorId" INTEGER,
    "busId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceEvent_transactionId_idx" ON "AttendanceEvent"("transactionId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_actorId_idx" ON "AttendanceEvent"("actorId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_busId_idx" ON "AttendanceEvent"("busId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_createdAt_idx" ON "AttendanceEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
