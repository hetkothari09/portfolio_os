-- TASK-01 fix-mf-debt-equity-tax-classification: capitalGains.service.ts no
-- longer assumes every MUTUAL_FUND row is equity-oriented — it now reads the
-- real category from MutualFundMaster. When that category can't be resolved
-- (no fundId, or fundId missing from MutualFundMaster) the row falls back to
-- debt-conservative tax treatment and is flagged here instead of silently
-- guessing equity treatment.

ALTER TABLE "CapitalGain" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CapitalGain_portfolioId_needsReview_idx" ON "CapitalGain"("portfolioId", "needsReview");
