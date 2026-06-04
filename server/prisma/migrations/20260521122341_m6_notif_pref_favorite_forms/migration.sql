-- CreateTable
CREATE TABLE "DocumentFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFavorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "defaultHome" TEXT NOT NULL DEFAULT '/app/dashboard',
    "editorFontFamily" TEXT,
    "editorFontSize" INTEGER NOT NULL DEFAULT 16,
    "autoSaveSeconds" INTEGER NOT NULL DEFAULT 1,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "calendarDefaultRemind" INTEGER NOT NULL DEFAULT 15,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TableFormView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fieldsJson" TEXT NOT NULL DEFAULT '[]',
    "requireLogin" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TableFormView_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableBase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TableFormView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DocumentFavorite_userId_createdAt_idx" ON "DocumentFavorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFavorite_userId_documentId_key" ON "DocumentFavorite"("userId", "documentId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TableFormView_token_key" ON "TableFormView"("token");

-- CreateIndex
CREATE INDEX "TableFormView_tableId_idx" ON "TableFormView"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarReminderLog_eventId_key" ON "CalendarReminderLog"("eventId");
