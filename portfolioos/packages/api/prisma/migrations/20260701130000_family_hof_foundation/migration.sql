-- Family / HOF hierarchical feature — foundation migration.
--
-- Introduces three new tables (`Family`, `FamilyMember`, `FamilyInvitation`)
-- plus a nullable `Portfolio.familyId` FK for family-shared portfolios
-- (HUF pot, ancestral fund, joint accounts). Personal portfolios keep
-- `familyId` NULL. Access control lives on `FamilyMember` rows:
--   - role (OWNER | CONTRIBUTOR | VIEWER)
--   - visibleAssetClasses (per-member allowlist over the AssetClass enum)
--   - visibleCategories (per-member allowlist over non-AC entity buckets:
--     VEHICLE, RENTAL, INSURANCE, LOAN, CREDIT_CARD, BANK_ACCOUNT, ...)
--
-- Approach chosen: service-layer fan-out via getEffectiveScope +
-- applyScopeToWhere helpers, using the existing runAsUser primitive for
-- OWNER cross-member reads. RLS on these new tables is defense-in-depth,
-- not the primary enforcement mechanism.

-- ─── Enums ────────────────────────────────────────────────────────────

CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'CONTRIBUTOR', 'VIEWER');

CREATE TYPE "FamilyMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- ─── Portfolio.familyId (personal vs family-shared) ───────────────────

ALTER TABLE "Portfolio"
  ADD COLUMN "familyId" TEXT;

CREATE INDEX "Portfolio_familyId_idx" ON "Portfolio"("familyId");

-- FK added at the end after the Family table exists.

-- ─── Family table ────────────────────────────────────────────────────

CREATE TABLE "Family" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Family_createdById_idx" ON "Family"("createdById");

ALTER TABLE "Family"
  ADD CONSTRAINT "Family_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── FamilyMember table ──────────────────────────────────────────────

CREATE TABLE "FamilyMember" (
  "id"                  TEXT NOT NULL,
  "familyId"            TEXT NOT NULL,
  "userId"              TEXT NOT NULL,
  "role"                "FamilyRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "status"              "FamilyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "visibleAssetClasses" "AssetClass"[] NOT NULL DEFAULT ARRAY[]::"AssetClass"[],
  "visibleCategories"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "invitedById"         TEXT,
  "joinedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");
CREATE INDEX "FamilyMember_userId_status_idx" ON "FamilyMember"("userId", "status");
CREATE INDEX "FamilyMember_familyId_status_idx" ON "FamilyMember"("familyId", "status");

ALTER TABLE "FamilyMember"
  ADD CONSTRAINT "FamilyMember_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyMember"
  ADD CONSTRAINT "FamilyMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyMember"
  ADD CONSTRAINT "FamilyMember_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── FamilyInvitation table ──────────────────────────────────────────

CREATE TABLE "FamilyInvitation" (
  "id"                  TEXT NOT NULL,
  "familyId"            TEXT NOT NULL,
  "invitedEmail"        TEXT NOT NULL,
  "invitedName"         TEXT,
  "role"                "FamilyRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "visibleAssetClasses" "AssetClass"[] NOT NULL DEFAULT ARRAY[]::"AssetClass"[],
  "visibleCategories"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "invitedById"         TEXT NOT NULL,
  "token"               TEXT NOT NULL,
  "expiresAt"           TIMESTAMP(3) NOT NULL,
  "acceptedAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FamilyInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyInvitation_token_key" ON "FamilyInvitation"("token");
CREATE INDEX "FamilyInvitation_invitedEmail_idx" ON "FamilyInvitation"("invitedEmail");
CREATE INDEX "FamilyInvitation_familyId_idx" ON "FamilyInvitation"("familyId");
CREATE INDEX "FamilyInvitation_expiresAt_idx" ON "FamilyInvitation"("expiresAt");

ALTER TABLE "FamilyInvitation"
  ADD CONSTRAINT "FamilyInvitation_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyInvitation"
  ADD CONSTRAINT "FamilyInvitation_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Portfolio.familyId FK (now that Family exists) ──────────────────

ALTER TABLE "Portfolio"
  ADD CONSTRAINT "Portfolio_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Row-level security ──────────────────────────────────────────────
--
-- The service layer (getEffectiveScope) is the primary enforcement
-- mechanism. RLS below is defense-in-depth so a forgotten `where`
-- clause on any of these tables fails closed rather than leaking data.
--
-- Family        → visible to any ACTIVE/PENDING member of that family.
--                 Insert allowed when `createdById = current user`;
--                 update/delete allowed only to OWNERs of that family.
-- FamilyMember  → visible to the member themselves + all OWNERs in
--                 the same family. Writes gated by OWNER-membership,
--                 with an exception for self-insert-on-accept (the
--                 row's own userId matches the current user).
-- FamilyInvitation → owner-only reads (invitees resolve invites via
--                 token on a public endpoint, not through RLS).

ALTER TABLE "Family" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Family" FORCE ROW LEVEL SECURITY;
CREATE POLICY family_access ON "Family"
  USING (
    app_is_system()
    OR "createdById" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" fm
      WHERE fm."familyId" = "Family".id
        AND fm."userId" = app_current_user_id()
        AND fm.status IN ('ACTIVE', 'PENDING')
    )
  )
  WITH CHECK (
    app_is_system()
    OR "createdById" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" fm
      WHERE fm."familyId" = "Family".id
        AND fm."userId" = app_current_user_id()
        AND fm.role = 'OWNER'
        AND fm.status = 'ACTIVE'
    )
  );

ALTER TABLE "FamilyMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY familymember_access ON "FamilyMember"
  USING (
    app_is_system()
    OR "userId" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" own
      WHERE own."familyId" = "FamilyMember"."familyId"
        AND own."userId" = app_current_user_id()
        AND own.role = 'OWNER'
        AND own.status = 'ACTIVE'
    )
  )
  WITH CHECK (
    app_is_system()
    -- Self-write (accept invite / leave family): the row's own userId
    -- must equal the caller. This handles the accept flow inserting
    -- the caller's own membership row.
    OR "userId" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" own
      WHERE own."familyId" = "FamilyMember"."familyId"
        AND own."userId" = app_current_user_id()
        AND own.role = 'OWNER'
        AND own.status = 'ACTIVE'
    )
  );

ALTER TABLE "FamilyInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyInvitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY familyinvitation_access ON "FamilyInvitation"
  USING (
    app_is_system()
    OR "invitedById" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" own
      WHERE own."familyId" = "FamilyInvitation"."familyId"
        AND own."userId" = app_current_user_id()
        AND own.role = 'OWNER'
        AND own.status = 'ACTIVE'
    )
  )
  WITH CHECK (
    app_is_system()
    OR "invitedById" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "FamilyMember" own
      WHERE own."familyId" = "FamilyInvitation"."familyId"
        AND own."userId" = app_current_user_id()
        AND own.role = 'OWNER'
        AND own.status = 'ACTIVE'
    )
  );

-- ─── Portfolio policy extension for family-shared access ─────────────
--
-- Personal portfolios (familyId NULL) keep the existing single-owner
-- rule: only `userId = current` can read/write. Family-shared portfolios
-- (familyId set) become readable by any ACTIVE member of that family
-- and writable by OWNER/CONTRIBUTOR members. VIEWER is read-only.
--
-- This is the minimal policy change needed for Approach 1 to work
-- without runAsUser fan-out for every family-portfolio read. Cross-user
-- PERSONAL reads (OWNER seeing another member's personal Zerodha
-- portfolio) still go through service-layer runAsUser fan-out — no
-- personal-portfolio RLS relaxation happens here.

DROP POLICY IF EXISTS portfolio_owner ON "Portfolio";
CREATE POLICY portfolio_access ON "Portfolio"
  USING (
    app_is_system()
    OR "userId" = app_current_user_id()
    OR (
      "familyId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "FamilyMember" fm
        WHERE fm."familyId" = "Portfolio"."familyId"
          AND fm."userId" = app_current_user_id()
          AND fm.status = 'ACTIVE'
      )
    )
  )
  WITH CHECK (
    app_is_system()
    OR "userId" = app_current_user_id()
    OR (
      "familyId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "FamilyMember" fm
        WHERE fm."familyId" = "Portfolio"."familyId"
          AND fm."userId" = app_current_user_id()
          AND fm.status = 'ACTIVE'
          AND fm.role IN ('OWNER', 'CONTRIBUTOR')
      )
    )
  );
