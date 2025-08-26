// backend/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { google } = require("googleapis");

const app = express();
app.use(cors());

// --- TEMP LOCAL SAVE DIR ---
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Optional: serve local files for debugging in browser
app.use("/uploads", express.static(UPLOAD_DIR));

// --- Multer for receiving the file ---
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = (file.originalname || "recording.webm").replace(/[^\w.\-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage });

// --- Google Auth / Drive client ---
const { getOAuthDrive } = require("./driveAuth"); // if you placed the helper above in driveAuth.js

async function uploadToDrive(localPath, filename, mimeType = "video/webm") {
  const drive = await getOAuthDrive();
  const parents = [process.env.DRIVE_FOLDER_ID]; // optional: a folder in *your* My Drive
  const created = await drive.files.create({
    requestBody: { name: filename, parents },
    media: { mimeType, body: fs.createReadStream(localPath) },
    fields: "id,name,webViewLink,webContentLink",
  });

  // Make link public (optional)
  await drive.permissions.create({
    fileId: created.data.id,
    requestBody: { role: "reader", type: "anyone" },
  });

  const { data } = await drive.files.get({
    fileId: created.data.id,
    fields: "id,name,webViewLink,webContentLink",
  });
  return data;
}


// --- Health check ---
app.get("/health", (_, res) => res.json({ ok: true }));

// --- MAIN UPLOAD ROUTE (Front-end must send field name 'file') ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

    const localPath = req.file.path;
    const filename = req.file.originalname || path.basename(localPath);
    const mimeType = req.file.mimetype || "video/webm";

    console.log("📥 /upload hit");
    console.log("   file:", filename);
    console.log("   saved:", localPath);
    console.log("   DRIVE_FOLDER_ID:", process.env.DRIVE_FOLDER_ID);

    // ---- Upload to Google Drive ----
    const driveFile = await uploadToDrive(localPath, filename, mimeType);
    console.log("☁️  Drive upload OK:", driveFile.id);

    // Keep or remove local temp:
    // Comment the next line OUT if you want to keep local copies in /uploads
    fs.unlink(localPath, () => {});

    return res.json({
      ok: true,
      id: driveFile.id,
      name: driveFile.name,
      viewLink: driveFile.webViewLink,
      downloadLink: driveFile.webContentLink,
      // localUrl: `/uploads/${path.basename(localPath)}`, // only valid if you keep the file
    });
  } catch (e) {
    console.error("❌ Upload error:", e?.response?.data || e);
    return res.status(500).json({ ok: false, error: e.message || "Upload failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend listening on ${PORT}`));
