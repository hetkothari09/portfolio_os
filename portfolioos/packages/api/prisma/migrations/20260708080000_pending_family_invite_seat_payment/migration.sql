-- Seat-overage invites now require upfront payment before the
-- FamilyInvitation row (and the includedSeats bump) is created — see
-- packages/api/src/services/family.service.ts. Previously an overage
-- invite succeeded immediately with a "this will be added to your next
-- bill" note; that let a user add paid seats, use them, and churn
-- before the deferred charge ever landed. PendingFamilyInvite holds the
-- invite payload while its Razorpay order is in flight.

CREATE TABLE "PendingFamilyInvite" (
  "id"                  TEXT NOT NULL,
  "familyId"            TEXT NOT NULL,
  "invitedEmail"        TEXT NOT NULL,
  "invitedName"         TEXT,
  "role"                "FamilyRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "visibleAssetClasses" "AssetClass"[] NOT NULL DEFAULT ARRAY[]::"AssetClass"[],
  "visibleCategories"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdById"         TEXT NOT NULL,
  "razorpayOrderId"     TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PendingFamilyInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingFamilyInvite_razorpayOrderId_key" ON "PendingFamilyInvite"("razorpayOrderId");
CREATE INDEX "PendingFamilyInvite_familyId_idx" ON "PendingFamilyInvite"("familyId");
CREATE INDEX "PendingFamilyInvite_expiresAt_idx" ON "PendingFamilyInvite"("expiresAt");

ALTER TABLE "PendingFamilyInvite"
  ADD CONSTRAINT "PendingFamilyInvite_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PendingFamilyInvite"
  ADD CONSTRAINT "PendingFamilyInvite_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PendingFamilyInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingFamilyInvite" FORCE ROW LEVEL SECURITY;
CREATE POLICY pendingfamilyinvite_access ON "PendingFamilyInvite"
  USING (
    app_is_system()
    OR "createdById" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" own
      WHERE own."familyId" = "PendingFamilyInvite"."familyId"
        AND own."userId" = app_current_user_id()
        AND own.role = 'OWNER'
        AND own.status = 'ACTIVE'
    )
  )
  WITH CHECK (
    app_is_system()
    OR "createdById" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" own
      WHERE own."familyId" = "PendingFamilyInvite"."familyId"
        AND own."userId" = app_current_user_id()
        AND own.role = 'OWNER'
        AND own.status = 'ACTIVE'
    )
  );
