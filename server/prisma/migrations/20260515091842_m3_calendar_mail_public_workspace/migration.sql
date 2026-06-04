-- CreateTable
CREATE TABLE "CalendarEvent" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "fromName" TEXT,
    "signature" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "uid" INTEGER NOT NULL,
    "messageId" TEXT,
    "subject" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "toJson" TEXT NOT NULL DEFAULT '[]',
    "ccJson" TEXT NOT NULL DEFAULT '[]',
    "receivedAt" DATETIME NOT NULL,
    "preview" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MailMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MailAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRIVATE',
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Workspace" ("createdAt", "id", "name", "ownerId") SELECT "createdAt", "id", "name", "ownerId" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
CREATE INDEX "Workspace_kind_idx" ON "Workspace"("kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_startAt_idx" ON "CalendarEvent"("userId", "startAt");

-- CreateIndex
CREATE INDEX "MailAccount_userId_idx" ON "MailAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MailAccount_userId_email_key" ON "MailAccount"("userId", "email");

-- CreateIndex
CREATE INDEX "MailMessage_accountId_receivedAt_idx" ON "MailMessage"("accountId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_accountId_folder_uid_key" ON "MailMessage"("accountId", "folder", "uid");
