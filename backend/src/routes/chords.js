import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../auth.js";
import { chordParts } from "../music.js";

export const chordsRouter = Router();

const chordSchema = z.object({
  name: z.string().trim().min(1),
  variantName: z.string().trim().min(1).max(60).default("Principal"),
  frets: z.array(z.number().nullable()).length(6).nullable().optional(),
  capo: z.number().int().min(0).max(12).default(0),
  barreFret: z.number().int().min(1).max(24).nullable().optional(),
  barreFromString: z.number().int().min(1).max(6).nullable().optional(),
  barreToString: z.number().int().min(1).max(6).nullable().optional(),
  difficulty: z.number().min(0).max(10).default(1),
  validated: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

const variantSchema = chordSchema.omit({ name: true });

const familySchema = z.object({
  root: z.string().trim().toUpperCase().regex(/^[A-G]$/),
  label: z.string().trim().min(1).max(30),
});

function chordConfiguration(inputFrets, barreFret) {
  const frets = Array.isArray(inputFrets) ? inputFrets : Array(6).fill(null);
  return {
    frets,
    configured: frets.some((fret) => Number.isFinite(fret)) || Number.isFinite(barreFret),
  };
}

function barreConfiguration(input) {
  if (!input.barreFret) return { barreFret: null, barreFromString: null, barreToString: null };
  if (!input.barreFromString || !input.barreToString || input.barreFromString === input.barreToString) {
    throw new z.ZodError([{
      code: "custom",
      path: ["barreFromString"],
      message: "La cejilla debe cubrir al menos dos cuerdas.",
    }]);
  }
  return {
    barreFret: input.barreFret,
    barreFromString: input.barreFromString,
    barreToString: input.barreToString,
  };
}

function defaultVariantData(chord) {
  const variants = Array.isArray(chord.variants) ? chord.variants : [];
  return variants.find((variant) => variant.isDefault) || variants[0] || null;
}

function chordWithDefaultShape(chord) {
  const variant = defaultVariantData(chord);
  if (!variant) return chord;
  return {
    ...chord,
    frets: variant.frets,
    capo: variant.capo,
    barreFret: variant.barreFret,
    barreFromString: variant.barreFromString,
    barreToString: variant.barreToString,
    difficulty: variant.difficulty,
    configured: variant.configured,
    validated: variant.validated,
    defaultVariantId: variant.id,
  };
}

async function syncChordDefaultShape(chordId, tx = prisma) {
  const chord = await tx.chord.findUnique({
    where: { id: chordId },
    include: { variants: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] } },
  });
  if (!chord) return null;
  const variant = defaultVariantData(chord);
  if (!variant) return chord;
  return tx.chord.update({
    where: { id: chordId },
    data: {
      frets: variant.frets,
      capo: variant.capo,
      barreFret: variant.barreFret,
      barreFromString: variant.barreFromString,
      barreToString: variant.barreToString,
      difficulty: variant.difficulty,
      configured: variant.configured,
    },
    include: { variants: { orderBy: [{ isDefault: "desc" }, { name: "asc" }] } },
  });
}

chordsRouter.get("/", async (req, res, next) => {
  try {
    const chords = await prisma.chord.findMany({
      orderBy: [{ root: "asc" }, { name: "asc" }],
      include: { variants: { orderBy: [{ isDefault: "desc" }, { name: "asc" }] } },
    });
    res.json(chords.map(chordWithDefaultShape));
  } catch (error) {
    next(error);
  }
});

chordsRouter.get("/families", async (req, res, next) => {
  try {
    const families = await prisma.chordFamily.findMany({ orderBy: { root: "asc" } });
    res.json(families);
  } catch (error) {
    next(error);
  }
});

chordsRouter.post("/families", requireAdmin, async (req, res, next) => {
  try {
    const input = familySchema.parse(req.body);
    const existing = await prisma.chordFamily.findUnique({ where: { root: input.root } });
    if (existing) return res.status(409).json({ message: `Ya existe la familia ${existing.label}.` });
    const family = await prisma.chordFamily.create({ data: input });
    res.status(201).json(family);
  } catch (error) {
    next(error);
  }
});

chordsRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = chordSchema.parse(req.body);
    const parts = chordParts(input.name);
    const barre = barreConfiguration(input);
    const configuration = chordConfiguration(input.frets, barre.barreFret);
    const chord = await prisma.$transaction(async (tx) => {
      const savedChord = await tx.chord.upsert({
        where: { name: input.name },
        update: {
          root: parts.root,
          suffix: parts.suffix,
          bass: parts.bass,
        },
        create: {
          name: input.name,
          root: parts.root,
          suffix: parts.suffix,
          bass: parts.bass,
          frets: configuration.frets,
          capo: input.capo,
          ...barre,
          difficulty: input.difficulty,
          configured: configuration.configured,
        },
      });
      const existingDefault = await tx.chordVariant.findFirst({ where: { chordId: savedChord.id, isDefault: true } });
      const shouldBeDefault = input.isDefault || !existingDefault;
      if (shouldBeDefault) {
        await tx.chordVariant.updateMany({ where: { chordId: savedChord.id }, data: { isDefault: false } });
      }
      await tx.chordVariant.upsert({
        where: { chordId_name: { chordId: savedChord.id, name: input.variantName } },
        update: {
          frets: configuration.frets,
          capo: input.capo,
          ...barre,
          difficulty: input.difficulty,
          configured: configuration.configured,
          validated: input.validated,
          isDefault: shouldBeDefault,
        },
        create: {
          chordId: savedChord.id,
          name: input.variantName,
          frets: configuration.frets,
          capo: input.capo,
          ...barre,
          difficulty: input.difficulty,
          configured: configuration.configured,
          validated: input.validated,
          isDefault: shouldBeDefault,
        },
      });
      return syncChordDefaultShape(savedChord.id, tx);
    });
    res.status(201).json(chordWithDefaultShape(chord));
  } catch (error) {
    next(error);
  }
});

chordsRouter.get("/usage", async (req, res, next) => {
  try {
    const usage = await prisma.songVersionChord.groupBy({
      by: ["chordId"],
      _sum: { count: true },
      _count: { songVersionId: true },
      orderBy: { _sum: { count: "desc" } },
      take: Number(req.query.limit || 25),
    });
    const chords = await prisma.chord.findMany({ where: { id: { in: usage.map((item) => item.chordId) } } });
    const byId = new Map(chords.map((chord) => [chord.id, chord]));
    res.json(usage.map((item) => ({
      chord: byId.get(item.chordId),
      count: item._sum.count || 0,
      versions: item._count.songVersionId,
    })));
  } catch (error) {
    next(error);
  }
});

chordsRouter.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const input = chordSchema.parse(req.body);
    const parts = chordParts(input.name);
    const barre = barreConfiguration(input);
    const configuration = chordConfiguration(input.frets, barre.barreFret);
    const duplicate = await prisma.chord.findFirst({
      where: {
        name: input.name,
        NOT: { id: req.params.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return res.status(409).json({ message: `Ya existe un acorde llamado ${input.name}.` });
    }
    const chord = await prisma.$transaction(async (tx) => {
      const savedChord = await tx.chord.update({
        where: { id: req.params.id },
        data: {
          name: input.name,
          root: parts.root,
          suffix: parts.suffix,
          bass: parts.bass,
        },
      });
      const existingDefault = await tx.chordVariant.findFirst({ where: { chordId: savedChord.id, isDefault: true } });
      const shouldBeDefault = input.isDefault || !existingDefault;
      if (shouldBeDefault) {
        await tx.chordVariant.updateMany({ where: { chordId: savedChord.id }, data: { isDefault: false } });
      }
      await tx.chordVariant.upsert({
        where: { chordId_name: { chordId: savedChord.id, name: input.variantName } },
        update: {
          frets: configuration.frets,
          capo: input.capo,
          ...barre,
          difficulty: input.difficulty,
          configured: configuration.configured,
          validated: input.validated,
          isDefault: shouldBeDefault,
        },
        create: {
          chordId: savedChord.id,
          name: input.variantName,
          frets: configuration.frets,
          capo: input.capo,
          ...barre,
          difficulty: input.difficulty,
          configured: configuration.configured,
          validated: input.validated,
          isDefault: shouldBeDefault,
        },
      });
      return syncChordDefaultShape(savedChord.id, tx);
    });
    res.json(chordWithDefaultShape(chord));
  } catch (error) {
    next(error);
  }
});

chordsRouter.post("/:id/variants", requireAdmin, async (req, res, next) => {
  try {
    const input = variantSchema.parse(req.body);
    const barre = barreConfiguration(input);
    const configuration = chordConfiguration(input.frets, barre.barreFret);
    const variant = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.chordVariant.updateMany({ where: { chordId: req.params.id }, data: { isDefault: false } });
      }
      const existingDefault = await tx.chordVariant.findFirst({ where: { chordId: req.params.id, isDefault: true } });
      const saved = await tx.chordVariant.create({
        data: {
          chordId: req.params.id,
          name: input.variantName,
          frets: configuration.frets,
          capo: input.capo,
          ...barre,
          difficulty: input.difficulty,
          configured: configuration.configured,
          validated: input.validated,
          isDefault: input.isDefault || !existingDefault,
        },
      });
      await syncChordDefaultShape(req.params.id, tx);
      return saved;
    });
    res.status(201).json(variant);
  } catch (error) {
    next(error);
  }
});

chordsRouter.put("/:id/variants/:variantId", requireAdmin, async (req, res, next) => {
  try {
    const input = variantSchema.parse(req.body);
    const barre = barreConfiguration(input);
    const configuration = chordConfiguration(input.frets, barre.barreFret);
    const variant = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.chordVariant.updateMany({ where: { chordId: req.params.id }, data: { isDefault: false } });
      }
      const saved = await tx.chordVariant.update({
        where: { id: req.params.variantId },
        data: {
          name: input.variantName,
          frets: configuration.frets,
          capo: input.capo,
          ...barre,
          difficulty: input.difficulty,
          configured: configuration.configured,
          validated: input.validated,
          isDefault: input.isDefault,
        },
      });
      const existingDefault = await tx.chordVariant.findFirst({ where: { chordId: req.params.id, isDefault: true } });
      if (!existingDefault) {
        await tx.chordVariant.update({ where: { id: saved.id }, data: { isDefault: true } });
      }
      await syncChordDefaultShape(req.params.id, tx);
      return saved;
    });
    res.json(variant);
  } catch (error) {
    next(error);
  }
});

chordsRouter.delete("/:id/variants/:variantId", requireAdmin, async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.chordVariant.count({ where: { chordId: req.params.id } });
      if (count <= 1) {
        throw new z.ZodError([{
          code: "custom",
          path: ["variantId"],
          message: "El acorde debe conservar al menos una variante.",
        }]);
      }
      const variant = await tx.chordVariant.delete({ where: { id: req.params.variantId } });
      if (variant.isDefault) {
        const nextDefault = await tx.chordVariant.findFirst({
          where: { chordId: req.params.id },
          orderBy: { createdAt: "asc" },
        });
        if (nextDefault) await tx.chordVariant.update({ where: { id: nextDefault.id }, data: { isDefault: true } });
      }
      await syncChordDefaultShape(req.params.id, tx);
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

chordsRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await prisma.chord.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
