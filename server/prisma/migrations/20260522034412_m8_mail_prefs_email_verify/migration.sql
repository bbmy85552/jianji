-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPreferences" (
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
    "mailListPageSize" INTEGER NOT NULL DEFAULT 30,
    "mailSyncLimit" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserPreferences" ("autoSaveSeconds", "calendarDefaultRemind", "defaultHome", "editorFontFamily", "editorFontSize", "language", "notifyEmail", "notifyInApp", "theme", "updatedAt", "userId") SELECT "autoSaveSeconds", "calendarDefaultRemind", "defaultHome", "editorFontFamily", "editorFontSize", "language", "notifyEmail", "notifyInApp", "theme", "updatedAt", "userId" FROM "UserPreferences";
DROP TABLE "UserPreferences";
ALTER TABLE "new_UserPreferences" RENAME TO "UserPreferences";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
