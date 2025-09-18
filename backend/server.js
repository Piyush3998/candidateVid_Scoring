// // backend/server.js
// const express = require("express");
// const cors = require("cors");
// const multer = require("multer");
// const fs = require("fs");
// const path = require("path");
// require("dotenv").config();
// const { google } = require("googleapis");

// const app = express();
// app.use(cors());

// // ensure a subfolder under DRIVE_FOLDER_ID named `${Name}_${Email}`
// async function ensureCandidateFolder(drive, parentFolderId, nameRaw, emailRaw) {
//   const safe = (s) => (s || "").trim().replace(/[^\w.@-]+/g, "_").slice(0, 80);
//   const folderName = `${safe(nameRaw)}_${safe(emailRaw)}` || "Unknown_Candidate";

//   // search for existing folder
//   const q = [
//     `name='${folderName.replace(/'/g, "\\'")}'`,
//     `mimeType='application/vnd.google-apps.folder'`,
//     `'${parentFolderId}' in parents`,
//     "trashed=false"
//   ].join(" and ");

//   const list = await drive.files.list({
//     q,
//     fields: "files(id, name)",
//   });

//   if (list.data.files && list.data.files.length) {
//     return list.data.files[0].id;
//   }

//   // create if not exists
//   const created = await drive.files.create({
//     requestBody: {
//       name: folderName,
//       mimeType: "application/vnd.google-apps.folder",
//       parents: [parentFolderId],
//     },
//     fields: "id, name",
//   });
//   return created.data.id;
// }

// // --- TEMP LOCAL SAVE DIR ---
// const UPLOAD_DIR = path.join(__dirname, "uploads");
// if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// // Optional: serve local files for debugging in browser
// app.use("/uploads", express.static(UPLOAD_DIR));

// // --- Multer for receiving the file ---
// const storage = multer.diskStorage({
//   destination: (_, __, cb) => cb(null, UPLOAD_DIR),
//   filename: (req, file, cb) => {
//     const safe = (file.originalname || "recording.webm").replace(/[^\w.\-]/g, "_");
//     cb(null, `${Date.now()}_${safe}`);
//   },
// });
// const upload = multer({ storage });

// // --- Google Auth / Drive client ---
// const { getOAuthDrive } = require("./driveAuth"); // if you placed the helper above in driveAuth.js

// async function uploadToDrive(localPath, filename, mimeType = "video/webm") {
//   const drive = await getOAuthDrive();
//   const parents = [process.env.DRIVE_FOLDER_ID]; // optional: a folder in *your* My Drive
//   const created = await drive.files.create({
//     requestBody: { name: filename, parents },
//     media: { mimeType, body: fs.createReadStream(localPath) },
//     fields: "id,name,webViewLink,webContentLink",
//   });

//   // Make link public (optional)
//   await drive.permissions.create({
//     fileId: created.data.id,
//     requestBody: { role: "reader", type: "anyone" },
//   });

//   const { data } = await drive.files.get({
//     fileId: created.data.id,
//     fields: "id,name,webViewLink,webContentLink",
//   });
//   return data;
// }

// // --- Health check ---
// app.get("/health", (_, res) => res.json({ ok: true }));

// // --- MAIN UPLOAD ROUTE (Front-end must send field name 'file') ---
// app.post("/upload", upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

//     const localPath = req.file.path;
//     const filename = req.file.originalname || path.basename(localPath);
//     const mimeType = req.file.mimetype || "video/webm";

//     const candidateName = (req.body.candidateName || "").trim();
//     const candidateEmail = (req.body.candidateEmail || "").trim();
//     const jobRole = (req.body.jobRole || "").trim();

//     console.log("📥 /upload hit");
//     console.log("   file:", filename);
//     console.log("   saved:", localPath);
//     console.log("   DRIVE_FOLDER_ID:", process.env.DRIVE_FOLDER_ID);
//     console.log("   candidate:", candidateName, candidateEmail, jobRole);

//     // Get an authenticated Drive client (OAuth or service account as you already set up)
//     const drive = await getOAuthDrive?.() || getDrive(); // use whichever auth helper you kept

//     // 1) ensure subfolder "<Name>_<Email>" under the main Joblens folder
//     const subFolderId = await ensureCandidateFolder(
//       drive,
//       process.env.DRIVE_FOLDER_ID,
//       candidateName,
//       candidateEmail
//     );

//     // 2) upload file into that subfolder
//     const created = await drive.files.create({
//       requestBody: { name: filename, parents: [subFolderId] },
//       media: { mimeType, body: fs.createReadStream(localPath) },
//       fields: "id,name,webViewLink,webContentLink",
//     });

//     // Make public link (optional; remove if you want private)
//     try {
//       await drive.permissions.create({
//         fileId: created.data.id,
//         requestBody: { role: "reader", type: "anyone" },
//       });
//     } catch (e) {
//       console.warn("Permission set failed (non-fatal):", e.message);
//     }

//     // cleanup local temp (comment out if you want to keep local copy)
//     fs.unlink(localPath, () => {});

//     return res.json({
//       ok: true,
//       id: created.data.id,
//       name: created.data.name,
//       viewLink: created.data.webViewLink,
//       downloadLink: created.data.webContentLink,
//       folderId: subFolderId,
//     });
//   } catch (e) {
//     console.error("❌ Upload error:", e?.response?.data || e);
//     return res.status(500).json({ ok: false, error: e.message || "Upload failed" });
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✅ Backend listening on ${PORT}`));

import http from "http";
import app from "./app/app.js";

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
server.listen(PORT, console.log(`server is up and running on ${PORT}`));
