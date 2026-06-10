-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "emotion" TEXT,
    "date" TEXT NOT NULL,
    "carriedFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "planId" TEXT,
    "milestoneId" TEXT,
    "parentId" TEXT,
    "cue" TEXT,
    "impact" TEXT,
    "slipReason" TEXT,
    "deepWork" BOOLEAN NOT NULL DEFAULT false,
    "actualBucket" TEXT,
    "description" TEXT,
    "status" TEXT,
    "priority" TEXT,
    "dueDate" DATETIME,
    "scheduledFor" DATETIME,
    "estimatedMinutes" INTEGER,
    "projectId" TEXT,
    CONSTRAINT "Task_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("carriedFrom", "completedAt", "createdAt", "cue", "date", "description", "done", "dueDate", "emotion", "estimatedMinutes", "id", "impact", "milestoneId", "parentId", "planId", "priority", "projectId", "scheduledFor", "slipReason", "status", "title") SELECT "carriedFrom", "completedAt", "createdAt", "cue", "date", "description", "done", "dueDate", "emotion", "estimatedMinutes", "id", "impact", "milestoneId", "parentId", "planId", "priority", "projectId", "scheduledFor", "slipReason", "status", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
