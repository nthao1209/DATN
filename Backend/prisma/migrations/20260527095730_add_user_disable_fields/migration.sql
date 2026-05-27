-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "isDisabled" BOOLEAN NOT NULL DEFAULT false;
