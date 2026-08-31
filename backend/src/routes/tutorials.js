import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../auth.js";

export const tutorialsRouter = Router();

const tutorialSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(""),
  category: z.enum(["TUTORIAL", "DEVOCIONAL", "ESTUDIO_BIBLICO", "DOCUMENTO", "OTRO"]).default("TUTORIAL"),
  position: z.number().int().default(0),
  fileName: z.string().nullable().optional(),
  fileMimeType: z.string().nullable().optional(),
  fileData: z.string().nullable().optional(),
});

const resourceSummary = {
  id: true,
  title: true,
  body: true,
  category: true,
  position: true,
  fileName: true,
  fileMimeType: true,
  createdAt: true,
  updatedAt: true,
};

tutorialsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await prisma.tutorial.findMany({
      select: resourceSummary,
      orderBy: [{ position: "asc" }, { title: "asc" }],
    }));
  } catch (error) {
    next(error);
  }
});

tutorialsRouter.get("/:id/file", async (req, res, next) => {
  try {
    const resource = await prisma.tutorial.findUnique({
      where: { id: req.params.id },
      select: { fileName: true, fileMimeType: true, fileData: true },
    });
    if (!resource?.fileData) {
      return res.status(404).json({ message: "Este recurso no tiene un archivo adjunto." });
    }
    res.setHeader("Content-Type", resource.fileMimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(resource.fileName || "recurso.pdf")}`);
    return res.send(Buffer.from(resource.fileData, "base64"));
  } catch (error) {
    next(error);
  }
});

tutorialsRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const data = tutorialSchema.parse(req.body);
    if (!data.body.trim() && !data.fileData) {
      return res.status(400).json({ message: "Agrega contenido o adjunta un PDF." });
    }
    res.status(201).json(await prisma.tutorial.create({ data, select: resourceSummary }));
  } catch (error) {
    next(error);
  }
});

tutorialsRouter.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const data = tutorialSchema.parse(req.body);
    const current = await prisma.tutorial.findUnique({
      where: { id: req.params.id },
      select: { fileData: true },
    });
    const keepsExistingFile = data.fileData === undefined && Boolean(current?.fileData);
    if (!data.body.trim() && !data.fileData && !keepsExistingFile) {
      return res.status(400).json({ message: "Agrega contenido o adjunta un PDF." });
    }
    res.json(await prisma.tutorial.update({
      where: { id: req.params.id },
      data,
      select: resourceSummary,
    }));
  } catch (error) {
    next(error);
  }
});

tutorialsRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await prisma.tutorial.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
