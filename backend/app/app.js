// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getOAuthDrive } from "./driveAuth.js"; // ✅ ESM import

dotenv.config();

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());

// --- Ensure candidate folder in Drive ---
async function ensureCandidateFolder(drive, parentFolderId, nameRaw, emailRaw) {
  const safe = (s) =>
    (s || "")
      .trim()
      .replace(/[^\w.@-]+/g, "_")
      .slice(0, 80);
  const folderName =
    `${safe(nameRaw)}_${safe(emailRaw)}` || "Unknown_Candidate";

  // Search for existing folder
  const q = [
    `name='${folderName.replace(/'/g, "\\'")}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `'${parentFolderId}' in parents`,
    "trashed=false",
  ].join(" and ");

  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
  });

  if (list.data.files && list.data.files.length) {
    return list.data.files[0].id;
  }

  // Create if not exists
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id, name",
  });
  return created.data.id;
}

// --- TEMP LOCAL SAVE DIR ---
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Optional: serve local files for debugging in browser
app.use("/uploads", express.static(UPLOAD_DIR));

// --- Multer for receiving the file ---
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = (file.originalname || "recording.webm").replace(
      /[^\w.\-]/g,
      "_"
    );
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage });

// --- Health check ---
app.get("/health", (_, res) => res.json({ ok: true }));

// --- MAIN UPLOAD ROUTE ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const localPath = req.file.path;
    const filename = req.file.originalname || path.basename(localPath);
    const mimeType = req.file.mimetype || "video/webm";

    const candidateName = (req.body.candidateName || "").trim();
    const candidateEmail = (req.body.candidateEmail || "").trim();
    const jobRole = (req.body.jobRole || "").trim();

    console.log("📥 /upload hit");
    console.log("   file:", filename);
    console.log("   saved:", localPath);
    console.log("   DRIVE_FOLDER_ID:", process.env.DRIVE_FOLDER_ID);
    console.log("   candidate:", candidateName, candidateEmail, jobRole);

    // Get an authenticated Drive client
    const drive = await getOAuthDrive();

    // 1) Ensure subfolder "<Name>_<Email>" under main Joblens folder
    const subFolderId = await ensureCandidateFolder(
      drive,
      process.env.DRIVE_FOLDER_ID,
      candidateName,
      candidateEmail
    );

    // 2) Upload file into that subfolder
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [subFolderId] },
      media: { mimeType, body: fs.createReadStream(localPath) },
      fields: "id,name,webViewLink,webContentLink",
    });

    // Make file public (optional)
    try {
      await drive.permissions.create({
        fileId: created.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (e) {
      console.warn("Permission set failed (non-fatal):", e.message);
    }

    // Cleanup local temp
    fs.unlink(localPath, () => {});

    return res.json({
      ok: true,
      id: created.data.id,
      name: created.data.name,
      viewLink: created.data.webViewLink,
      downloadLink: created.data.webContentLink,
      folderId: subFolderId,
    });
  } catch (e) {
    console.error("❌ Upload error:", e?.response?.data || e);
    return res
      .status(500)
      .json({ ok: false, error: e.message || "Upload failed" });
  }
});

export default app;
