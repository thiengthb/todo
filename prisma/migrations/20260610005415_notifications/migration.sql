-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "discordWebhookUrl" TEXT,
    "intensity" TEXT NOT NULL DEFAULT 'balanced',
    "morningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "morningTime" TEXT NOT NULL DEFAULT '07:30',
    "streakGuardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "streakGuardTime" TEXT NOT NULL DEFAULT '20:00',
    "randomNudgeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eveningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eveningTime" TEXT NOT NULL DEFAULT '21:30',
    "randomWindowStart" TEXT NOT NULL DEFAULT '09:00',
    "randomWindowEnd" TEXT NOT NULL DEFAULT '18:00',
    "quietStart" TEXT NOT NULL DEFAULT '22:00',
    "quietEnd" TEXT NOT NULL DEFAULT '07:00',
    "includeMotivation" BOOLEAN NOT NULL DEFAULT true,
    "includeQuote" BOOLEAN NOT NULL DEFAULT true,
    "includeTip" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "NotificationLog_kind_date_idx" ON "NotificationLog"("kind", "date");

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");
