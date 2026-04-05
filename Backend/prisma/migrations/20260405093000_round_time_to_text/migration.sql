-- Keep Round.time as plain string text in PostgreSQL
ALTER TABLE "Round"
ALTER COLUMN "time" TYPE TEXT
USING CASE
  WHEN "time" IS NULL THEN ''
  ELSE "time"::text
END;
