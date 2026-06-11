-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationSettings" (
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
    "queueNudgeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "randomWindowStart" TEXT NOT NULL DEFAULT '09:00',
    "randomWindowEnd" TEXT NOT NULL DEFAULT '18:00',
    "quietStart" TEXT NOT NULL DEFAULT '22:00',
    "quietEnd" TEXT NOT NULL DEFAULT '07:00',
    "includeMotivation" BOOLEAN NOT NULL DEFAULT true,
    "includeQuote" BOOLEAN NOT NULL DEFAULT true,
    "includeTip" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_NotificationSettings" ("discordWebhookUrl", "enabled", "eveningEnabled", "eveningTime", "id", "includeMotivation", "includeQuote", "includeTip", "intensity", "morningEnabled", "morningTime", "quietEnd", "quietStart", "randomNudgeEnabled", "randomWindowEnd", "randomWindowStart", "streakGuardEnabled", "streakGuardTime", "updatedAt") SELECT "discordWebhookUrl", "enabled", "eveningEnabled", "eveningTime", "id", "includeMotivation", "includeQuote", "includeTip", "intensity", "morningEnabled", "morningTime", "quietEnd", "quietStart", "randomNudgeEnabled", "randomWindowEnd", "randomWindowStart", "streakGuardEnabled", "streakGuardTime", "updatedAt" FROM "NotificationSettings";
DROP TABLE "NotificationSettings";
ALTER TABLE "new_NotificationSettings" RENAME TO "NotificationSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
