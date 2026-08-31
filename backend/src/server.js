import "dotenv/config";
import express from "express";
import cors from "cors";
import { songsRouter } from "./routes/songs.js";
import { chordsRouter } from "./routes/chords.js";
import { setlistsRouter } from "./routes/setlists.js";
import { tutorialsRouter } from "./routes/tutorials.js";
import { usersRouter } from "./routes/users.js";
import { authenticate } from "./auth.js";

const app = express();
const port = Number(process.env.PORT || 4710);
const allowedOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origen no permitido por CORS."));
  },
}));
app.use(express.json({ limit: "15mb" }));
app.use(authenticate);

app.get("/health", (req, res) => res.json({ ok: true, app: "CantusDei" }));
app.use("/api/songs", songsRouter);
app.use("/api/chords", chordsRouter);
app.use("/api/setlists", setlistsRouter);
app.use("/api/tutorials", tutorialsRouter);
app.use("/api/users", usersRouter);

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.name === "ZodError" ? 400 : Number(error.status || 500);
  res.status(status).json({
    message: status === 400 ? "Datos inválidos" : error.message || "Error de servidor",
    errors: error.errors?.map((item) => item.message),
  });
});

app.listen(port, () => {
  console.log(`Backend CantusDei en http://localhost:${port}`);
});
