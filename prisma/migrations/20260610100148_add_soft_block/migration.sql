-- CreateTable
CREATE TABLE "SoftBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'focus',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TEXT,
    "validUntil" TEXT,
    "weekParity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SoftBlock_dayOfWeek_idx" ON "SoftBlock"("dayOfWeek");
