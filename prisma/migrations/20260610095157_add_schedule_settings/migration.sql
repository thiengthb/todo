-- CreateTable
CREATE TABLE "ScheduleSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "wakeTime" TEXT NOT NULL DEFAULT '07:00',
    "sleepTime" TEXT NOT NULL DEFAULT '23:00',
    "bufferMin" INTEGER NOT NULL DEFAULT 15,
    "minSlotMin" INTEGER NOT NULL DEFAULT 30,
    "termAnchorMonday" TEXT,
    "updatedAt" DATETIME NOT NULL
);
