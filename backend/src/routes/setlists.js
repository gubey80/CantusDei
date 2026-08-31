import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../auth.js";

export const setlistsRouter = Router();

const itemSchema = z.object({
  songVersionId: z.string(),
  position: z.number().int().min(1),
  comment: z.string().default(""),
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
    const setlists = await prisma.setlist.findMany({
      where: from ? { date: { gte: from } } : {},
      orderBy: { date: "asc" },
      include: { items: { orderBy: { position: "asc" }, include: { songVersion: { include: { song: true } } } } },
    });
    res.json(setlists);
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
    await prisma.setlistItem.deleteMany({ where: { setlistId: req.params.id } });
    const setlist = await prisma.setlist.update({
      where: { id: req.params.id },
      data: {
        name: input.name,
        date: new Date(input.date),
        leader: input.leader,
        musicians: input.musicians,
        comments: input.comments,
        items: { create: input.items },
      },
      include: { items: { orderBy: { position: "asc" } } },
    });
    res.json(setlist);
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
