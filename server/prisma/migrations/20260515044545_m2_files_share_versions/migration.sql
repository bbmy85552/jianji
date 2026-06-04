-- CreateTable
CREATE TABLE "TablePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TablePermission_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableBase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TablePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "documentId" TEXT,
    "tableId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'file',
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableBase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAvatar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'view',
    "requireLogin" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "label" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourcePresence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourcePresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TablePermission_tableId_userId_key" ON "TablePermission"("tableId", "userId");

-- CreateIndex
CREATE INDEX "Attachment_ownerId_createdAt_idx" ON "Attachment"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_documentId_idx" ON "Attachment"("documentId");

-- CreateIndex
CREATE INDEX "Attachment_tableId_idx" ON "Attachment"("tableId");

-- CreateIndex
CREATE INDEX "UserAvatar_userId_createdAt_idx" ON "UserAvatar"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_resourceType_resourceId_idx" ON "ShareLink"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourcePresence_resourceType_resourceId_lastSeenAt_idx" ON "ResourcePresence"("resourceType", "resourceId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResourcePresence_resourceType_resourceId_userId_key" ON "ResourcePresence"("resourceType", "resourceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_name_key" ON "UserGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupMember_groupId_userId_key" ON "UserGroupMember"("groupId", "userId");
