-- CreateTable
CREATE TABLE "DayCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "energy" INTEGER,
    "mood" INTEGER,
    "stress" INTEGER,
    "sleepHours" REAL
);

-- CreateIndex
CREATE UNIQUE INDEX "DayCheckin_date_key" ON "DayCheckin"("date");
