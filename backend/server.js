import express from "express";
import cors from "cors";
import { extractStreamUrl } from "./scraper.js";
import { clearStreamUrl, saveStreamUrl } from "./firebase.js";

const MOVIE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_CONCURRENT_JOBS = 3;
const runningJobs = new Set();

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json());

function isValidMovieId(value) {
  return typeof value === "string" && MOVIE_ID_PATTERN.test(value);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

app.post("/extract", (req, res) => {
  const { movieId, url } = req.body ?? {};
  if (!isValidMovieId(movieId)) return res.status(400).json({ error: "invalid movieId" });
  if (!isHttpUrl(url)) return res.status(400).json({ error: "invalid url" });
  if (runningJobs.has(movieId)) return res.status(202).json({ status: "running" });
  if (runningJobs.size >= MAX_CONCURRENT_JOBS) return res.status(503).json({ error: "busy" });

  runningJobs.add(movieId);
  res.status(202).json({ status: "started" });

  extractStreamUrl(url)
    .then((streamUrl) => {
      if (!streamUrl) {
        console.warn(`No stream found for ${movieId}`);
        return null;
      }
      return saveStreamUrl(movieId, streamUrl);
    })
    .catch((error) => console.error(`Extraction failed for ${movieId}:`, error))
    .finally(() => runningJobs.delete(movieId));
});

app.post("/release", (req, res) => {
  const { movieId } = req.body ?? {};
  if (!isValidMovieId(movieId)) return res.status(400).json({ error: "invalid movieId" });

  clearStreamUrl(movieId)
    .then(() => res.json({ status: "released" }))
    .catch((error) => {
      console.error(`Release failed for ${movieId}:`, error);
      res.status(500).json({ error: "release failed" });
    });
});

app.get("/", (req, res) => {
  res.status(200).send("Backend is alive!");
});

// تم ضبط البورت ليعمل مرناً مع بيئة Termux المحلية أو متغيرات النظام
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on port ${PORT}`));
