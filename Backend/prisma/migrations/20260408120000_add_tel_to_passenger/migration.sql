-- Add Passenger.tel as TEXT with safe default for existing rows
ALTER TABLE "Passenger"
ADD COLUMN IF NOT EXISTS "tel" TEXT NOT NULL DEFAULT '';
