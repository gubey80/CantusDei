CREATE TABLE "ChordFamily" (
    "id" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChordFamily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChordFamily_root_key" ON "ChordFamily"("root");

INSERT INTO "ChordFamily" ("id", "root", "label", "createdAt", "updatedAt")
VALUES
    ('family-c', 'C', 'DO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('family-d', 'D', 'RE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('family-e', 'E', 'MI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('family-f', 'F', 'FA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('family-g', 'G', 'SOL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('family-a', 'A', 'LA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('family-b', 'B', 'SI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
