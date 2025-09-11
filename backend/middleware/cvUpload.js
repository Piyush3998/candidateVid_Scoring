import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads/cv";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

// Only accept PDF and DOCX
const fileFilter = (req, file, cb) => {
  const allowedTypes = [".pdf", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();
  allowedTypes.includes(ext)
    ? cb(null, true)
    : cb(new Error("Only .pdf and .docx files are allowed!"), false);
};

export const uploadCV = multer({ storage, fileFilter });
