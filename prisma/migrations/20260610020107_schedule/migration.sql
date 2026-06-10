-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'khac',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'khac',
    "cancels" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE INDEX "Commitment_dayOfWeek_idx" ON "Commitment"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ScheduleEvent_date_idx" ON "ScheduleEvent"("date");
