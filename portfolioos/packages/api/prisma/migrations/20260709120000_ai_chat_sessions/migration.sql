-- CreateTable
CREATE TABLE "AiChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "familyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiChatSession_userId_lastMessageAt_idx" ON "AiChatSession"("userId", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AiConversation" ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "AiConversation_sessionId_createdAt_idx" ON "AiConversation"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: multi-session support ships from this migration
-- forward. Every pre-existing AiConversation row predates the concept
-- of a session, so rather than orphan that history (sessionId stays
-- NULL forever, invisible in any session-scoped query), fold each
-- user's existing messages into one new session, titled from their
-- earliest question.
DO $$
DECLARE
  r RECORD;
  new_session_id TEXT;
  first_msg TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT "userId" FROM "AiConversation" WHERE "sessionId" IS NULL
  LOOP
    SELECT "content" INTO first_msg
    FROM "AiConversation"
    WHERE "userId" = r."userId" AND "role" = 'USER'
    ORDER BY "createdAt" ASC
    LIMIT 1;

    new_session_id := 'aics_' || replace(gen_random_uuid()::text, '-', '');

    INSERT INTO "AiChatSession" ("id", "userId", "title", "createdAt", "updatedAt", "lastMessageAt")
    SELECT
      new_session_id,
      r."userId",
      COALESCE(NULLIF(left(first_msg, 60), ''), 'New chat'),
      MIN("createdAt"),
      MAX("createdAt"),
      MAX("createdAt")
    FROM "AiConversation"
    WHERE "userId" = r."userId" AND "sessionId" IS NULL;

    UPDATE "AiConversation"
    SET "sessionId" = new_session_id
    WHERE "userId" = r."userId" AND "sessionId" IS NULL;
  END LOOP;
END $$;
