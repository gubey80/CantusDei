-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VISITOR');

-- CreateEnum
CREATE TYPE "SongVersionStatus" AS ENUM ('DRAFT', 'REVIEWED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VISITOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Songbook" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Songbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "songbookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL DEFAULT '',
    "listenUrl" TEXT NOT NULL DEFAULT '',
    "copyrightText" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongVersion" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "capo" INTEGER NOT NULL DEFAULT 0,
    "bpm" INTEGER NOT NULL DEFAULT 96,
    "duration" TEXT NOT NULL DEFAULT '4:00',
    "difficulty" TEXT NOT NULL DEFAULT 'Inicial',
    "owner" TEXT NOT NULL DEFAULT '',
    "lyrics" TEXT NOT NULL,
    "comments" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "status" "SongVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "playbackSpeed" INTEGER NOT NULL DEFAULT 2800,
    "rehearsalSpeed" DECIMAL(4,2) NOT NULL DEFAULT 0.75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "suffix" TEXT NOT NULL DEFAULT '',
    "bass" TEXT,
    "frets" JSONB,
    "capo" INTEGER NOT NULL DEFAULT 0,
    "difficulty" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "configured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongVersionChord" (
    "id" TEXT NOT NULL,
    "songVersionId" TEXT NOT NULL,
    "chordId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstPosition" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SongVersionChord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "leader" TEXT NOT NULL DEFAULT '',
    "musicians" JSONB NOT NULL DEFAULT '{}',
    "comments" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetlistItem" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "songVersionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SetlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tutorial" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tutorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Songbook_code_key" ON "Songbook"("code");

-- CreateIndex
CREATE INDEX "Song_title_idx" ON "Song"("title");

-- CreateIndex
CREATE INDEX "Song_songbookId_idx" ON "Song"("songbookId");

-- CreateIndex
CREATE INDEX "SongVersion_key_idx" ON "SongVersion"("key");

-- CreateIndex
CREATE INDEX "SongVersion_capo_idx" ON "SongVersion"("capo");

-- CreateIndex
CREATE UNIQUE INDEX "SongVersion_songId_key_capo_key" ON "SongVersion"("songId", "key", "capo");

-- CreateIndex
CREATE UNIQUE INDEX "Chord_name_key" ON "Chord"("name");

-- CreateIndex
CREATE INDEX "Chord_root_idx" ON "Chord"("root");

-- CreateIndex
CREATE INDEX "Chord_capo_idx" ON "Chord"("capo");

-- CreateIndex
CREATE INDEX "SongVersionChord_chordId_idx" ON "SongVersionChord"("chordId");

-- CreateIndex
CREATE UNIQUE INDEX "SongVersionChord_songVersionId_chordId_key" ON "SongVersionChord"("songVersionId", "chordId");

-- CreateIndex
CREATE INDEX "Setlist_date_idx" ON "Setlist"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistItem_setlistId_position_key" ON "SetlistItem"("setlistId", "position");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_songbookId_fkey" FOREIGN KEY ("songbookId") REFERENCES "Songbook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongVersion" ADD CONSTRAINT "SongVersion_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongVersionChord" ADD CONSTRAINT "SongVersionChord_songVersionId_fkey" FOREIGN KEY ("songVersionId") REFERENCES "SongVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongVersionChord" ADD CONSTRAINT "SongVersionChord_chordId_fkey" FOREIGN KEY ("chordId") REFERENCES "Chord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_songVersionId_fkey" FOREIGN KEY ("songVersionId") REFERENCES "SongVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
