import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../auth.js";

export const setlistsRouter = Router();

const arrangementSchema = z.array(z.object({
  id: z.string().min(1),
  type: z.enum(["intro", "verse", "prechorus", "chorus", "bridge", "solo", "instrumental", "final", "other"]),
  name: z.string().trim().min(1).max(120),
  lyrics: z.string().max(100000),
  comment: z.string().max(2000).default(""),
})).max(200);

const itemSchema = z.object({
  songVersionId: z.string(),
  position: z.number().int().min(1),
  comment: z.string().default(""),
  arrangement: arrangementSchema.optional(),
});

const setlistSchema = z.object({
  name: z.string().default("Domingo"),
  date: z.string(),
  leader: z.string().default(""),
  musicians: z.record(z.string()).default({}),
  comments: z.string().default(""),
  items: z.array(itemSchema).default([]),
});

setlistsRouter.get("/", async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const summary = ["1", "true", "yes"].includes(String(req.query.summary || "").toLowerCase());
    const setlists = await prisma.setlist.findMany({
      where: from ? { date: { gte: from } } : {},
      orderBy: { date: "asc" },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            songVersion: summary
              ? {
                  select: {
                    id: true,
                    name: true,
                    key: true,
                    capo: true,
                    rehearsalSpeed: true,
                    song: { select: { id: true, title: true, artist: true } },
                  },
                }
              : { include: { song: true } },
          },
        },
      },
    });
    res.json(setlists);
  } catch (error) {
    next(error);
  }
});

setlistsRouter.get("/:id", async (req, res, next) => {
  try {
    const setlist = await prisma.setlist.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: { songVersion: { include: { song: true } } },
        },
      },
    });
    if (!setlist) return res.status(404).json({ message: "Setlist no encontrada." });
    res.json(setlist);
  } catch (error) {
    next(error);
  }
});

setlistsRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = setlistSchema.parse(req.body);
    const setlist = await prisma.setlist.create({
      data: {
        name: input.name,
        date: new Date(input.date),
        leader: input.leader,
        musicians: input.musicians,
        comments: input.comments,
        items: { create: input.items },
      },
      include: { items: true },
    });
    res.status(201).json(setlist);
  } catch (error) {
    next(error);
  }
});

setlistsRouter.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const input = setlistSchema.parse(req.body);
    const setlist = await prisma.$transaction(async (tx) => {
      const previousItems = await tx.setlistItem.findMany({ where: { setlistId: req.params.id }, orderBy: { position: "asc" } });
      const items = input.items.map((item) => {
        const previousIndex = previousItems.findIndex((previous) => previous.songVersionId === item.songVersionId);
        const previous = previousIndex >= 0 ? previousItems.splice(previousIndex, 1)[0] : null;
        return { ...item, arrangement: item.arrangement ?? previous?.arrangement ?? [] };
      });
      await tx.setlistItem.deleteMany({ where: { setlistId: req.params.id } });
      return tx.setlist.update({
        where: { id: req.params.id },
        data: {
          name: input.name,
          date: new Date(input.date),
          leader: input.leader,
          musicians: input.musicians,
          comments: input.comments,
          items: { create: items },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
    });
    res.json(setlist);
  } catch (error) {
    next(error);
  }
});

setlistsRouter.patch("/:id/items/:itemId/arrangement", requireAdmin, async (req, res, next) => {
  try {
    const arrangement = arrangementSchema.parse(req.body.arrangement);
    const result = await prisma.setlistItem.updateMany({
      where: { id: req.params.itemId, setlistId: req.params.id },
      data: { arrangement },
    });
    if (!result.count) return res.status(404).json({ message: "Cancion no encontrada en esta setlist. Vuelve a abrirla." });
    res.json({ arrangement });
  } catch (error) {
    next(error);
  }
});

setlistsRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await prisma.setlist.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
