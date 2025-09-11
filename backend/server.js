// backend/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Node 18+ has global fetch. If you're on Node 16, uncomment:
// const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 5000;

// ----- CORS -----
app.use(cors({
  origin: (process.env.CORS_ORIGIN || "*").split(","),
  credentials: false
}));
app.use(express.json());

// ----- Static (optional) -----
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

// ----- Multer for uploads -----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = (file.originalname || "video.webm").replace(/[^\w.\-]+/g, "_");
    cb(null, `${ts}_${safe}`);
  }
});
const upload = multer({ storage });

// ===================================================================
//  A) VIDEO ANSWER UPLOAD (your existing frontend calls this)
// ===================================================================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file" });

    // candidate metadata (used if/when you route to Drive later)
    const candidateName  = (req.body.candidateName || "").trim();
    const candidateEmail = (req.body.candidateEmail || "").trim();
    const jobRole        = (req.body.jobRole || "").trim();

    console.log("📥 /upload");
    console.log("  file:", req.file.originalname);
    console.log("  saved:", req.file.path);
    console.log("  candidate:", candidateName, candidateEmail, jobRole);

    // (Local save only. If you want Google Drive again, we can re-add that later.)
    return res.json({
      ok: true,
      path: `/uploads/${path.basename(req.file.path)}`,
      name: req.file.originalname
    });
  } catch (e) {
    console.error("❌ /upload error:", e);
    res.status(500).json({ ok: false, error: e.message || "upload failed" });
  }
});

// ===================================================================
//  B) D-ID AVATAR: text -> rendered talking video URL
// ===================================================================
app.get("/avatar/talk", async (req, res) => {
  try {
    const text = (req.query.text || "").trim();
    if (!text) return res.status(400).json({ ok: false, error: "text required" });

    const apiKey  = process.env.DID_API_KEY;
    const faceUrl = process.env.AVATAR_IMAGE_URL;
    if (!apiKey)  return res.status(500).json({ ok: false, error: "DID_API_KEY missing" });
    if (!faceUrl) return res.status(500).json({ ok: false, error: "AVATAR_IMAGE_URL missing" });

    // 1) Create a talk job
    const createResp = await fetch("https://api.d-id.com/talks", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(apiKey + ":").toString("base64"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source_url: faceUrl,
        script: {
          type: "text",
          input: text,
          provider: { type: "microsoft", voice_id: "en-US-JennyNeural" } // change if you like
        }
      })
    });

    const created = await createResp.json();
    if (!createResp.ok) {
      console.error("D-ID create error:", created);
      return res.status(500).json({ ok: false, error: created?.error || "create failed" });
    }

    const id = created?.id;
    if (!id) return res.status(500).json({ ok: false, error: "no id returned" });

    // 2) Poll until done (max ~25s)
    let url = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const r = await fetch(`https://api.d-id.com/talks/${id}`, {
        headers: { "Authorization": "Basic " + Buffer.from(apiKey + ":").toString("base64") }
      });
      const j = await r.json();
      if (j?.status === "done" && j?.result_url) { url = j.result_url; break; }
      if (j?.status === "error") {
        console.error("D-ID render error:", j);
        return res.status(500).json({ ok: false, error: j?.error || "render error" });
      }
    }

    if (!url) return res.status(504).json({ ok: false, error: "timeout waiting for avatar" });
    res.json({ ok: true, url });
  } catch (e) {
    console.error("❌ /avatar/talk error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Backend listening on ${PORT}`);
});
