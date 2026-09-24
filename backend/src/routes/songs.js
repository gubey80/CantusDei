import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../auth.js";
import { chordParts, summarizeChords, transposeLyricsBy } from "../music.js";

export const songsRouter = Router();

function optionalNumberWithDefault(defaultValue, schema, options = {}) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    if (typeof value === "string" && !value.trim()) return defaultValue;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return defaultValue;
    if (options.min !== undefined && numericValue < options.min) return defaultValue;
    if (options.max !== undefined && numericValue > options.max) return defaultValue;
    return value;
  }, z.coerce.number().pipe(schema).default(defaultValue));
}

const versionSchema = z.object({
  name: z.string().optional(),
  key: z.string().min(1),
  capo: optionalNumberWithDefault(0, z.number().int().min(0).max(12), { min: 0, max: 12 }),
  bpm: optionalNumberWithDefault(96, z.number().int().min(40).max(240), { min: 40, max: 240 }),
  duration: z.string().default("4:00"),
  difficulty: z.string().default("Inicial"),
  owner: z.string().default(""),
  lyrics: z.string().min(1),
  comments: z.string().default(""),
  internalNotes: z.string().default(""),
  reviewed: z.boolean().default(false),
  playbackSpeed: optionalNumberWithDefault(2800, z.number().int()),
  rehearsalSpeed: optionalNumberWithDefault(0.75, z.number().min(0.1).max(5), { min: 0.1, max: 5 }),
});

const songSchema = z.object({
  songbookCode: z.string().default("mayor"),
  title: z.string().min(1),
  artist: z.string().default(""),
  listenUrl: z.string().default(""),
  copyrightText: z.string().default(""),
  tags: z.array(z.string()).default([]),
  version: versionSchema,
});

const importSongSchema = z.object({
  id: z.string().optional(),
  familyId: z.string().optional(),
  songbook: z.string().optional(),
  songbookCode: z.string().optional(),
  title: z.string().min(1),
  artist: z.string().default(""),
  listenUrl: z.string().default(""),
  copyrightText: z.string().default(""),
  tags: z.array(z.string()).default([]),
  key: z.string().min(1).default("C"),
  capo: optionalNumberWithDefault(0, z.number().int().min(0).max(12), { min: 0, max: 12 }),
  versionName: z.string().optional(),
  name: z.string().optional(),
  lyrics: z.string().min(1),
  bpm: optionalNumberWithDefault(96, z.number().int().min(40).max(240), { min: 40, max: 240 }),
  duration: z.string().default("4:00"),
  level: z.string().optional(),
  difficulty: z.string().optional(),
  owner: z.string().default(""),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  comments: z.string().default(""),
  reviewed: z.boolean().default(false),
  playbackSpeed: optionalNumberWithDefault(2800, z.number().int()),
  rehearsalSpeed: optionalNumberWithDefault(0.75, z.number().min(0.1).max(5), { min: 0.1, max: 5 }),
});

const importPayloadSchema = z.union([
  importSongSchema,
  z.object({ song: importSongSchema }),
  z.object({ songs: z.array(importSongSchema).min(1) }),
]);

function normalizeSongbookCode(value = "mayor") {
  return String(value || "mayor")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mayor";
}

function songbookNameFromCode(code) {
  if (code === "mayor") return "Cancionero Mayor";
  if (code === "escuela-biblica" || code === "menor-escuela-biblica") return "Escuela Biblica";
  return code.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function normalizeImportPayload(payload) {
  const parsed = importPayloadSchema.parse(payload);
  if ("songs" in parsed) return parsed.songs;
  if ("song" in parsed) return [parsed.song];
  return [parsed];
}

function normalizeImportSong(item) {
  const songbookCode = normalizeSongbookCode(item.songbookCode || item.songbook || "mayor");
  const key = item.key || "C";
  const capo = Number(item.capo || 0);
  return {
    id: item.familyId || item.id,
    songbookCode,
    title: item.title.trim(),
    artist: item.artist || "",
    listenUrl: item.listenUrl || "",
    copyrightText: item.copyrightText || "",
    tags: item.tags || [],
    version: {
      name: item.versionName || item.name || `Tono ${key}${capo ? ` - Capo ${capo}` : ""}`,
      key,
      capo,
      bpm: Number(item.bpm || 96),
      duration: item.duration || "4:00",
      difficulty: item.difficulty || item.level || "Inicial",
      owner: item.owner || "",
      lyrics: item.lyrics || "",
      comments: item.comments || "",
      internalNotes: item.internalNotes || item.notes || "",
      reviewed: Boolean(item.reviewed),
      playbackSpeed: Number(item.playbackSpeed || 2800),
      rehearsalSpeed: Number(item.rehearsalSpeed || 0.75),
    },
  };
}

async function getOrCreateChord(name) {
  const parts = chordParts(name);
  return prisma.chord.upsert({
    where: { name },
    update: {},
    create: {
      name,
      root: parts.root,
      suffix: parts.suffix,
      bass: parts.bass,
      configured: false,
    },
  });
}

async function syncVersionChords(songVersionId, lyrics) {
  const summary = summarizeChords(lyrics);
  await prisma.songVersionChord.deleteMany({ where: { songVersionId } });
  for (const item of summary) {
    const chord = await getOrCreateChord(item.chord);
    await prisma.songVersionChord.create({
      data: {
        songVersionId,
        chordId: chord.id,
        count: item.count,
        firstPosition: item.firstPosition,
      },
    });
  }
}

async function findSongByTitleAndSongbook(title, songbookId) {
  return prisma.song.findFirst({
    where: {
      songbookId,
      title: { equals: title, mode: "insensitive" },
    },
    include: { versions: true, songbook: true },
  });
}

async function previewImportSong(input) {
  const songbook = await prisma.songbook.findUnique({ where: { code: input.songbookCode } });
  const existingSong = songbook ? await findSongByTitleAndSongbook(input.title, songbook.id) : null;
  const existingVersion = existingSong?.versions?.find((version) => (
    version.key === input.version.key && Number(version.capo || 0) === Number(input.version.capo || 0)
  ));
  return {
    title: input.title,
    artist: input.artist,
    songbookCode: input.songbookCode,
    songbookName: songbook?.name || songbookNameFromCode(input.songbookCode),
    key: input.version.key,
    capo: input.version.capo,
    versionName: input.version.name,
    chords: summarizeChords(input.version.lyrics).map((item) => item.chord),
    action: existingVersion ? "UPDATE_VERSION" : existingSong ? "ADD_VERSION" : "CREATE_SONG",
    existingSongId: existingSong?.id || null,
    existingVersionId: existingVersion?.id || null,
  };
}

async function importSong(input) {
  const songbook = await prisma.songbook.upsert({
    where: { code: input.songbookCode },
    update: {},
    create: {
      code: input.songbookCode,
      name: songbookNameFromCode(input.songbookCode),
    },
  });
  const existingSong = await findSongByTitleAndSongbook(input.title, songbook.id);
  const songData = {
    songbookId: songbook.id,
    title: input.title,
    artist: input.artist,
    listenUrl: input.listenUrl,
    copyrightText: input.copyrightText,
    tags: input.tags,
  };
  const song = existingSong
    ? await prisma.song.update({ where: { id: existingSong.id }, data: songData, include: { versions: true } })
    : await prisma.song.create({ data: { ...(input.id ? { id: input.id } : {}), ...songData }, include: { versions: true } });

  const versionData = {
    ...input.version,
    status: input.version.reviewed ? "REVIEWED" : "DRAFT",
  };
  const existingVersion = song.versions.find((version) => (
    version.key === input.version.key && Number(version.capo || 0) === Number(input.version.capo || 0)
  ));
  const version = existingVersion
    ? await prisma.songVersion.update({ where: { id: existingVersion.id }, data: versionData })
    : await prisma.songVersion.create({ data: { songId: song.id, ...versionData } });
  await syncVersionChords(version.id, input.version.lyrics);
  return {
    songId: song.id,
    versionId: version.id,
    title: song.title,
    key: version.key,
    capo: version.capo,
    action: existingVersion ? "updatedVersion" : existingSong ? "addedVersion" : "createdSong",
  };
}

songsRouter.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const songbookCode = String(req.query.songbook || "").trim();
    const summary = ["1", "true", "yes"].includes(String(req.query.summary || "").toLowerCase());
    const where = {
      ...(songbookCode ? { songbook: { code: songbookCode } } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { artist: { contains: search, mode: "insensitive" } },
          { songbook: { name: { contains: search, mode: "insensitive" } } },
          { songbook: { code: { contains: search, mode: "insensitive" } } },
          { versions: { some: { name: { contains: search, mode: "insensitive" } } } },
          { versions: { some: { key: { contains: search, mode: "insensitive" } } } },
          { versions: { some: { difficulty: { contains: search, mode: "insensitive" } } } },
          { versions: { some: { owner: { contains: search, mode: "insensitive" } } } },
          { versions: { some: { comments: { contains: search, mode: "insensitive" } } } },
          { versions: { some: { internalNotes: { contains: search, mode: "insensitive" } } } },
          { versions: { some: { lyrics: { contains: search, mode: "insensitive" } } } },
        ],
      } : {}),
    };
    const songs = await prisma.song.findMany({
      where,
      orderBy: { title: "asc" },
      include: {
        songbook: true,
        versions: summary
          ? {
              orderBy: [{ key: "asc" }, { capo: "asc" }],
              select: {
                id: true,
                songId: true,
                name: true,
                key: true,
                capo: true,
                bpm: true,
                duration: true,
                difficulty: true,
                owner: true,
                reviewed: true,
                status: true,
                playbackSpeed: true,
                rehearsalSpeed: true,
                createdAt: true,
                updatedAt: true,
              },
            }
          : { orderBy: [{ key: "asc" }, { capo: "asc" }] },
      },
    });
    res.json(songs);
  } catch (error) {
    next(error);
  }
});

songsRouter.get("/songbooks", async (req, res, next) => {
  try {
    res.json(await prisma.songbook.findMany({ orderBy: { name: "asc" } }));
  } catch (error) {
    next(error);
  }
});

songsRouter.post("/import/preview", requireAdmin, async (req, res, next) => {
  try {
    const normalized = normalizeImportPayload(req.body).map(normalizeImportSong);
    const errors = normalized.flatMap((item, index) => {
      const current = [];
      if (!item.title) current.push({ index, field: "title", message: "Falta el titulo." });
      if (!item.version.lyrics) current.push({ index, field: "lyrics", message: "Falta la letra." });
      return current;
    });
    const items = await Promise.all(normalized.map(previewImportSong));
    res.json({
      total: normalized.length,
      valid: errors.length === 0,
      errors,
      summary: {
        createSong: items.filter((item) => item.action === "CREATE_SONG").length,
        addVersion: items.filter((item) => item.action === "ADD_VERSION").length,
        updateVersion: items.filter((item) => item.action === "UPDATE_VERSION").length,
      },
      items,
    });
  } catch (error) {
    next(error);
  }
});

songsRouter.post("/import/commit", requireAdmin, async (req, res, next) => {
  try {
    const normalized = normalizeImportPayload(req.body).map(normalizeImportSong);
    const results = [];
    for (const item of normalized) {
      results.push(await importSong(item));
    }
    res.status(201).json({
      total: results.length,
      summary: {
        createdSong: results.filter((item) => item.action === "createdSong").length,
        addedVersion: results.filter((item) => item.action === "addedVersion").length,
        updatedVersion: results.filter((item) => item.action === "updatedVersion").length,
      },
      results,
    });
  } catch (error) {
    next(error);
  }
});

songsRouter.get("/:id", async (req, res, next) => {
  try {
    const song = await prisma.song.findUnique({
      where: { id: req.params.id },
      include: {
        songbook: true,
        versions: {
          include: { chords: { include: { chord: true }, orderBy: { firstPosition: "asc" } } },
          orderBy: [{ key: "asc" }, { capo: "asc" }],
        },
      },
    });
    if (!song) return res.status(404).json({ message: "Canción no encontrada" });
    res.json(song);
  } catch (error) {
    next(error);
  }
});

songsRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = songSchema.parse(req.body);
    const songbook = await prisma.songbook.upsert({
      where: { code: input.songbookCode },
      update: {},
      create: { code: input.songbookCode, name: input.songbookCode === "mayor" ? "Cancionero Mayor" : input.songbookCode },
    });

    const song = await prisma.song.create({
      data: {
        songbookId: songbook.id,
        title: input.title,
        artist: input.artist,
        listenUrl: input.listenUrl,
        copyrightText: input.copyrightText,
        tags: input.tags,
        versions: {
          create: {
            ...input.version,
            name: input.version.name || `Tono ${input.version.key}${input.version.capo ? ` · Capo ${input.version.capo}` : ""}`,
            status: input.version.reviewed ? "REVIEWED" : "DRAFT",
          },
        },
      },
      include: { versions: true },
    });
    await syncVersionChords(song.versions[0].id, input.version.lyrics);
    res.status(201).json(await prisma.song.findUnique({ where: { id: song.id }, include: { versions: true } }));
  } catch (error) {
    next(error);
  }
});

songsRouter.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().min(1),
      artist: z.string().default(""),
      listenUrl: z.string().default(""),
      copyrightText: z.string().default(""),
      tags: z.array(z.string()).default([]),
    }).parse(req.body);
    const song = await prisma.song.update({ where: { id: req.params.id }, data: input });
    res.json(song);
  } catch (error) {
    next(error);
  }
});

songsRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await prisma.song.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

songsRouter.post("/:id/versions", requireAdmin, async (req, res, next) => {
  try {
    const input = versionSchema.extend({ transposeSteps: z.number().int().optional() }).parse(req.body);
    const sourceVersionId = String(req.body.sourceVersionId || "");
    const source = sourceVersionId
      ? await prisma.songVersion.findUnique({ where: { id: sourceVersionId } })
      : null;
    const lyrics = source && Number.isInteger(input.transposeSteps)
      ? transposeLyricsBy(source.lyrics, input.transposeSteps)
      : input.lyrics;
    const version = await prisma.songVersion.create({
      data: {
        songId: req.params.id,
        ...input,
        lyrics,
        name: input.name || `Tono ${input.key}${input.capo ? ` · Capo ${input.capo}` : ""}`,
        status: input.reviewed ? "REVIEWED" : "DRAFT",
      },
    });
    await syncVersionChords(version.id, lyrics);
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
});

songsRouter.put("/versions/:versionId", requireAdmin, async (req, res, next) => {
  try {
    const input = versionSchema.partial().parse(req.body);
    const version = await prisma.songVersion.update({
      where: { id: req.params.versionId },
      data: {
        ...input,
        ...(typeof input.reviewed === "boolean" ? { status: input.reviewed ? "REVIEWED" : "DRAFT" } : {}),
      },
    });
    if (typeof input.lyrics === "string") await syncVersionChords(version.id, input.lyrics);
    res.json(version);
  } catch (error) {
    next(error);
  }
});

songsRouter.delete("/versions/:versionId", requireAdmin, async (req, res, next) => {
  try {
    await prisma.songVersion.delete({ where: { id: req.params.versionId } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
