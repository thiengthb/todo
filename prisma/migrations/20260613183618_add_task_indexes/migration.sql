-- CreateIndex
CREATE INDEX "Task_date_idx" ON "Task"("date");

-- CreateIndex
CREATE INDEX "Task_done_date_idx" ON "Task"("done", "date");

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
