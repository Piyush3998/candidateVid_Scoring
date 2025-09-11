import asyncHandler from "express-async-handler";

import fs from "fs";
import path from "path";
import CVUpload from "../model/Cv.js";

// Upload multiple CVs safely
export const createCVsCtrl = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    res.status(400);
    throw new Error("No CV files uploaded");
  }

  const savedCVs = [];

  for (let file of files) {
    // Check if originalName already exists in DB
    const exists = await CVUpload.findOne({ originalName: file.originalname });
    if (exists) {
      // Delete duplicate file safely
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      continue;
    }

    // Save CV to DB
    const cv = await CVUpload.create({
      filename: file.filename,
      originalName: file.originalname,
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

// Get all CVs with links
export const getAllCVsCtrl = asyncHandler(async (req, res) => {
  const cvs = await CVUpload.find();

  const host = req.get("host");
  const protocol = req.protocol;

  const filesWithLinks = cvs.map((cv) => ({
    _id: cv._id,
    originalName: cv.originalName,
    link: `${protocol}://${host}/uploads/cv/${cv.filename}`,
  }));

  res.status(200).json({
    status: "success",
    total: cvs.length,
    files: filesWithLinks,
  });
});

// ------------------------------
// Delete all CVs
// ------------------------------
export const deleteAllCVsCtrl = asyncHandler(async (req, res) => {
  // Fetch all CV entries from DB
  const allCVs = await CVUpload.find();

  // Delete files from filesystem
  for (let cv of allCVs) {
    const filePath = path.join("uploads", cv.filename); // adjust 'uploads' if your folder is different
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Remove all records from DB
  await CVUpload.deleteMany();

  res.status(200).json({
    status: "success",
    message: `${allCVs.length} CVs deleted successfully`,
  });
});
