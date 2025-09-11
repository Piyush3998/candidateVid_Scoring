import asyncHandler from "express-async-handler";

import fs from "fs";
import path from "path";
import CVUpload from "../model/Cv.js";

// Upload multiple CVs
export const createCVsCtrl = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    res.status(400);
    throw new Error("No CV files uploaded");
  }

  const savedCVs = [];

  for (let file of files) {
    const exists = await CVUpload.findOne({ originalName: file.originalname });
    if (exists) {
      fs.unlinkSync(path.join(file.path)); // delete duplicate
      continue;
    }

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
