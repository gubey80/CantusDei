CREATE TABLE "ChordVariant" (
    "id" TEXT NOT NULL,
    "chordId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Principal',
    "frets" JSONB,
    "capo" INTEGER NOT NULL DEFAULT 0,
    "barreFret" INTEGER,
    "barreFromString" INTEGER,
    "barreToString" INTEGER,
    "difficulty" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "configured" BOOLEAN NOT NULL DEFAULT false,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChordVariant_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ChordVariant" (
    "id",
    "chordId",
    "name",
    "frets",
    "capo",
    "barreFret",
    "barreFromString",
    "barreToString",
    "difficulty",
    "configured",
    "validated",
    "isDefault",
    "createdAt",
    "updatedAt"
)
SELECT
    'principal_' || "id",
    "id",
    'Principal',
    "frets",
    "capo",
    "barreFret",
    "barreFromString",
    "barreToString",
    "difficulty",
    "configured",
    false,
    true,
    "createdAt",
    "updatedAt"
FROM "Chord";

CREATE UNIQUE INDEX "ChordVariant_chordId_name_key" ON "ChordVariant"("chordId", "name");
CREATE INDEX "ChordVariant_chordId_idx" ON "ChordVariant"("chordId");
CREATE INDEX "ChordVariant_validated_idx" ON "ChordVariant"("validated");
CREATE INDEX "ChordVariant_isDefault_idx" ON "ChordVariant"("isDefault");

ALTER TABLE "ChordVariant" ADD CONSTRAINT "ChordVariant_chordId_fkey" FOREIGN KEY ("chordId") REFERENCES "Chord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
