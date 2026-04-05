/*
  Warnings:

  - Made the column `time` on table `Round` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Round" ALTER COLUMN "time" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" DROP DEFAULT;
