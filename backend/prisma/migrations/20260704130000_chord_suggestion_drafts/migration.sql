CREATE TABLE "ChordSuggestionDraft" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "artist" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "capo" INTEGER NOT NULL DEFAULT 0,
    "bpm" INTEGER,
    "timeSignature" TEXT NOT NULL DEFAULT '',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL DEFAULT '',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "chords" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChordSuggestionDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChordSuggestionDraft_updatedAt_idx" ON "ChordSuggestionDraft"("updatedAt");
