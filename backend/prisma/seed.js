import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { chordParts, summarizeChords } from "../src/music.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

const importFiles = [
  path.join(root, "acordia", "importaciones", "cancionero-ibbn-acordia.json"),
  path.join(root, "acordia", "importaciones", "cancionero-escuela-biblica-cantusdei.json"),
];

const DEFAULT_CHORDS = {
  C: [null, 3, 2, 0, 1, 0],
  D: [null, null, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  A: [0, 0, 2, 2, 2, 0],
  B: [2, 2, 4, 4, 4, 2],
  Am: [0, 0, 2, 2, 1, 0],
  Bm: [2, 2, 4, 4, 3, 2],
  Cm: [null, 3, 5, 5, 4, 3],
  Dm: [null, null, 0, 2, 3, 1],
  Em: [0, 2, 2, 0, 0, 0],
  Fm: [1, 3, 3, 1, 1, 1],
  Gm: [3, 5, 5, 3, 3, 3],
  A7: [0, 0, 2, 0, 2, 0],
  B7: [null, 2, 1, 2, 0, 2],
  C7: [null, 3, 2, 3, 1, 0],
  D7: [null, null, 0, 2, 1, 2],
  E7: [0, 2, 0, 1, 0, 0],
  G7: [3, 2, 0, 0, 0, 1],
};

async function upsertChord(name, countHint = 0) {
  const parts = chordParts(name);
  const frets = DEFAULT_CHORDS[name] || DEFAULT_CHORDS[name.split("/")[0]] || null;
  return prisma.chord.upsert({
    where: { name },
    update: {},
    create: {
      name,
      root: parts.root,
      suffix: parts.suffix,
      bass: parts.bass,
      frets,
      configured: Boolean(frets),
      difficulty: frets ? Math.min(10, 1 + countHint * 0.01) : 6,
    },
  });
}

async function syncVersionChords(versionId, lyrics) {
  const summary = summarizeChords(lyrics);
  for (const item of summary) {
    const chord = await upsertChord(item.chord, item.count);
    await prisma.songVersionChord.upsert({
      where: { songVersionId_chordId: { songVersionId: versionId, chordId: chord.id } },
      update: { count: item.count, firstPosition: item.firstPosition },
      create: {
        songVersionId: versionId,
        chordId: chord.id,
        count: item.count,
        firstPosition: item.firstPosition,
      },
    });
  }
}

async function seedSongbooks() {
  await prisma.songbook.upsert({
    where: { code: "mayor" },
    update: { name: "Cancionero Mayor" },
    create: { code: "mayor", name: "Cancionero Mayor", description: "Cancionero principal de la iglesia." },
  });
  await prisma.songbook.upsert({
    where: { code: "menor-escuela-biblica" },
    update: { name: "Cancionero Menor · Escuela Bíblica" },
    create: { code: "menor-escuela-biblica", name: "Cancionero Menor · Escuela Bíblica", description: "Canciones para escuela bíblica." },
  });
}

async function seedUsersAndTutorials() {
  await prisma.user.upsert({
    where: { email: "admin@cantusdei.local" },
    update: { role: "ADMIN", active: true },
    create: { name: "Administrador", email: "admin@cantusdei.local", role: "ADMIN" },
  });
  await prisma.tutorial.upsert({
    where: { id: "tutorial-transposicion" },
    update: {},
    create: {
      id: "tutorial-transposicion",
      title: "Subir y bajar tono",
      body: "Para transponer una canción se mueve cada acorde la misma cantidad de semitonos. Revisar siempre la versión final antes de marcarla como revisada.",
      position: 1,
    },
  });
}

async function seedSongsFromFile(filePath) {
  if (!fs.existsSync(filePath)) return { imported: 0, filePath };
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const songs = Array.isArray(payload.songs) ? payload.songs : [];
  let imported = 0;

  for (const item of songs) {
    const songbookCode = item.songbook || "mayor";
    const songbook = await prisma.songbook.findUnique({ where: { code: songbookCode } });
    if (!songbook) continue;

    const song = await prisma.song.upsert({
      where: { id: item.familyId || item.id },
      update: {
        title: item.title,
        artist: item.artist || "",
        listenUrl: item.listenUrl || "",
        copyrightText: item.copyrightText || "",
        tags: item.tags || [],
      },
      create: {
        id: item.familyId || item.id,
        songbookId: songbook.id,
        title: item.title,
        artist: item.artist || "",
        listenUrl: item.listenUrl || "",
        copyrightText: item.copyrightText || "",
        tags: item.tags || [],
      },
    });

    const version = await prisma.songVersion.upsert({
      where: { songId_key_capo: { songId: song.id, key: item.key || "C", capo: Number(item.capo || 0) } },
      update: {
        name: item.versionName || `Tono ${item.key || "C"}`,
        lyrics: item.lyrics || "",
        bpm: Number(item.bpm || 96),
        duration: item.duration || "4:00",
        difficulty: item.level || "Inicial",
        owner: item.owner || "",
        internalNotes: item.notes || "",
        comments: item.comments || "",
        reviewed: Boolean(item.reviewed),
        status: item.reviewed ? "REVIEWED" : "DRAFT",
      },
      create: {
        songId: song.id,
        name: item.versionName || `Tono ${item.key || "C"}`,
        key: item.key || "C",
        capo: Number(item.capo || 0),
        lyrics: item.lyrics || "",
        bpm: Number(item.bpm || 96),
        duration: item.duration || "4:00",
        difficulty: item.level || "Inicial",
        owner: item.owner || "",
        internalNotes: item.notes || "",
        comments: item.comments || "",
        reviewed: Boolean(item.reviewed),
        status: item.reviewed ? "REVIEWED" : "DRAFT",
        playbackSpeed: Number(item.playbackSpeed || 2800),
      },
    });

    await syncVersionChords(version.id, version.lyrics);
    imported += 1;
  }

  return { imported, filePath };
}

async function main() {
  await seedSongbooks();
  await seedUsersAndTutorials();
  const results = [];
  for (const filePath of importFiles) {
    results.push(await seedSongsFromFile(filePath));
  }
  console.log("Seed CantusDei completo", results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
