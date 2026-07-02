-- DropForeignKey
ALTER TABLE "Bus" DROP CONSTRAINT "Bus_managerId_fkey";

-- AlterTable
ALTER TABLE "Bus" ALTER COLUMN "registrationNumber" DROP NOT NULL,
ALTER COLUMN "managerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
