import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { createToken, hashPassword, requireAdmin, verifyPassword } from "../auth.js";

export const usersRouter = Router();

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "VISITOR"]).default("VISITOR"),
  active: z.boolean().default(true),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

usersRouter.get("/", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
    res.json(users.map(publicUser));
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const fallbackEmail = process.env.ADMIN_EMAIL || "admin@cantusdei.local";
    const fallbackPassword = process.env.ADMIN_PASSWORD || "admin123";
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user && email === fallbackEmail && input.password === fallbackPassword) {
      user = await prisma.user.create({
        data: {
          name: "Administrador",
          email,
          passwordHash: hashPassword(input.password),
          role: "ADMIN",
          active: true,
        },
      });
    }

    if (user && !user.passwordHash && user.email === fallbackEmail && input.password === fallbackPassword) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(input.password), role: "ADMIN", active: true },
      });
    }

    if (!user || !user.active || !verifyPassword(input.password, user.passwordHash)) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    res.json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = userSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: input.password ? hashPassword(input.password) : undefined,
        role: input.role,
        active: input.active,
      },
    });
    res.status(201).json(publicUser(user));
  } catch (error) {
    next(error);
  }
});
