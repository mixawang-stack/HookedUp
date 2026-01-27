-- Add enum value for FULL entitlement
ALTER TYPE "EntitlementScope" ADD VALUE IF NOT EXISTS 'FULL';

-- Allow pending orders without user/novel
ALTER TABLE "CreemOrder"
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "novelId" DROP NOT NULL;
