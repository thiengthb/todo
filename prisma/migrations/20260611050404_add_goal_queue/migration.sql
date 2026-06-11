-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incubating',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" TEXT,
    "lastNudgedAt" DATETIME,
    "promotedPlanId" TEXT,
    "promotedTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");
