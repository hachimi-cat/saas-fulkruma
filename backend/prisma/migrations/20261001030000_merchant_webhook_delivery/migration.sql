-- Merchant webhook delivery (2026-10-01).
--
-- Merchants could register webhook endpoints, but nothing ever POSTed
-- to them: the outbox worker only knew the partner URLs in env
-- (Storlaunch, Malapos), and nothing wrote the WebhookEvent rows that
-- GET /webhooks/events reads. services/webhook-delivery.ts now fans
-- every outbox event out to the account's matching endpoints. This
-- adds what that needs:
--
--  * WebhookEvent."eventId" — the outbox event a row delivers, unique
--    per endpoint so a re-run of the fan-out never queues it twice.
--    Nothing has written this table before, so the backfill below only
--    exists to keep the NOT NULL safe on a database that has rows.
--  * the last attempt's error / duration and when it was delivered;
--  * WebhookDeliveryAttempt — one row per HTTP attempt;
--  * the endpoint's failure streak, and why Fulkruma switched it off
--    when it kept failing.

-- CreateEnum
CREATE TYPE "WebhookAttemptStatus" AS ENUM ('succeeded', 'failed');

-- AlterTable
ALTER TABLE "WebhookEndpoint"
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failingSince"        TIMESTAMP(3),
  ADD COLUMN "disabledAt"          TIMESTAMP(3),
  ADD COLUMN "disabledReason"      TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent"
  ADD COLUMN "eventId"     TEXT,
  ADD COLUMN "lastError"   TEXT,
  ADD COLUMN "durationMs"  INTEGER,
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

UPDATE "WebhookEvent" SET "eventId" = "id" WHERE "eventId" IS NULL;

ALTER TABLE "WebhookEvent" ALTER COLUMN "eventId" SET NOT NULL;

-- CreateTable
CREATE TABLE "WebhookDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "WebhookAttemptStatus" NOT NULL,
    "responseCode" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_endpointId_eventId_key" ON "WebhookEvent"("endpointId", "eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_nextRetryAt_idx" ON "WebhookEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDeliveryAttempt_webhookEventId_attemptNumber_key" ON "WebhookDeliveryAttempt"("webhookEventId", "attemptNumber");

-- CreateIndex
CREATE INDEX "WebhookDeliveryAttempt_accountId_attemptedAt_idx" ON "WebhookDeliveryAttempt"("accountId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
