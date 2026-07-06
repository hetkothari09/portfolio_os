-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "totalNetWorth" DECIMAL(18,4) NOT NULL,
    "totalLiabilities" DECIMAL(18,4) NOT NULL,
    "netWorthAfterLiabilities" DECIMAL(18,4) NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetWorthSnapshot_userId_asOf_idx" ON "NetWorthSnapshot"("userId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthSnapshot_userId_asOf_key" ON "NetWorthSnapshot"("userId", "asOf");

-- AddForeignKey
ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: NetWorthSnapshot carries a direct userId column (§3.6). Bundled into
-- the same migration as the table creation (same pattern as
-- 20260701130000_family_hof_foundation and 20260603120000_aa_consent).
ALTER TABLE "NetWorthSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NetWorthSnapshot" FORCE ROW LEVEL SECURITY;
CREATE POLICY networthsnapshot_owner ON "NetWorthSnapshot"
  USING (app_is_system() OR "userId" = app_current_user_id())
  WITH CHECK (app_is_system() OR "userId" = app_current_user_id());
