-- CreateTable
CREATE TABLE "DocumentComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "anchorId" TEXT,
    "anchorText" TEXT,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "color" TEXT,
    "reminderMinutes" INTEGER,
    "relatedTodoId" TEXT,
    "repeatRule" TEXT,
    "exceptionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CalendarEvent" ("allDay", "color", "createdAt", "description", "endAt", "id", "location", "relatedTodoId", "reminderMinutes", "startAt", "title", "updatedAt", "userId") SELECT "allDay", "color", "createdAt", "description", "endAt", "id", "location", "relatedTodoId", "reminderMinutes", "startAt", "title", "updatedAt", "userId" FROM "CalendarEvent";
DROP TABLE "CalendarEvent";
ALTER TABLE "new_CalendarEvent" RENAME TO "CalendarEvent";
CREATE INDEX "CalendarEvent_userId_startAt_idx" ON "CalendarEvent"("userId", "startAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DocumentComment_documentId_resolvedAt_createdAt_idx" ON "DocumentComment"("documentId", "resolvedAt", "createdAt");
