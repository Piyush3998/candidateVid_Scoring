import asyncHandler from "express-async-handler";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import CVUpload from "../model/Cv.js";

// ------------------------
// Upload multiple CVs
// ------------------------
export const createCVsCtrl = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    res.status(400);
    throw new Error("No CV files uploaded");
  }

  const savedCVs = [];
  const uploadDir = path.join("uploads", "cv");

  // Ensure directory exists
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  for (let file of files) {
    // Skip duplicates by originalName
    const exists = await CVUpload.findOne({ originalName: file.originalname });
    if (exists) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path); // delete duplicate
      continue;
    }

    // Unique filename
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(
      file.originalname
    )}`;
    const destPath = path.join(uploadDir, uniqueFilename);

    try {
      fs.renameSync(file.path, destPath);
    } catch (err) {
      // If source doesn't exist, skip file
      console.error("Failed to move file:", err);
      continue;
    }

    // Save record in DB
    const cv = await CVUpload.create({
      filename: uniqueFilename,
      originalName: file.originalname,
      link: `${req.protocol}://${req.get("host")}/uploads/cv/${uniqueFilename}`,
    });

    savedCVs.push(cv);
  }

  res.status(201).json({
    status: "success",
    message: "CVs uploaded successfully",
    uploaded: savedCVs.length,
    files: savedCVs,
  });
});

// ------------------------
// Get all CVs with links
// ------------------------
export const getAllCVsCtrl = asyncHandler(async (req, res) => {
  const cvs = await CVUpload.find().sort({ createdAt: -1 });

  // Make sure link is always correct
  const cvsWithLinks = cvs.map((cv) => ({
    _id: cv._id,
    originalName: cv.originalName,
    link: `${req.protocol}://${req.get("host")}/uploads/cv/${cv.filename}`,
    createdAt: cv.createdAt,
  }));

  res.status(200).json({
    status: "success",
    results: cvsWithLinks.length,
    files: cvsWithLinks,
  });
});

// ------------------------
// Delete all CVs
// ------------------------
export const deleteAllCVsCtrl = asyncHandler(async (req, res) => {
  const cvs = await CVUpload.find();

  for (let cv of cvs) {
    const filePath = path.join("uploads/cv", cv.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // delete file
    await cv.deleteOne(); // delete record
  }

  res.status(200).json({
    status: "success",
    message: "All CVs deleted successfully",
  });
});
