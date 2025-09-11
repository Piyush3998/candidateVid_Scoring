import asyncHandler from "express-async-handler";

import JobDescription from "../model/jobDescription.js";

// @desc Create New Job Description
// @route POST /api/v1/jobDescription/jd
// @access Private/Admin
export const createJobDescriptionCtrl = asyncHandler(async (req, res) => {
  const description = req.body?.description || null;
  const pdfFile = req.file ? req.file.path : null;

  if (!description && !pdfFile) {
    res.status(400);
    throw new Error("Job description text or file is required");
  }

  // Check if description exists (optional)
  if (description) {
    const jobExists = await JobDescription.findOne({ description });
    if (jobExists) {
      res.status(400);
      throw new Error("Job description already exists");
    }
  }

  const jobDes = await JobDescription.create({
    description,
    pdfFile,
  });

  res.status(201).json({
    status: "success",
    message: "Job description created successfully",
    jobDes,
  });
});

// @desc Get New PRODUCT
// @route POST /api/v1/products
// @access public

export const getJobDescriptionsCtrl = asyncHandler(async (req, res) => {
  // query
  let jobDescriptionQuery = JobDescription.find();
  // pagination
  // page
  const page = parseInt(req.query.page) ? parseInt(req.query.page) : 1;
  //   limit
  const limit = parseInt(req.query.limit) ? parseInt(req.query.limit) : 10;
  //   startIdx
  const startIndex = (page - 1) * limit;
  //   endIdx
  const endIndex = page * limit;
  //   total
  const total = await JobDescription.countDocuments();
  jobDescriptionQuery = jobDescriptionQuery.skip(startIndex).limit(limit);
  // pagination results
  const pagination = {};
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  //   await the query
  const jobDescriptions = await jobDescriptionQuery;

  res.json({
    status: "Success",
    total,
    result: jobDescriptions.length,
    pagination,
    message: "jobDescriptions fetched successfully",
    jobDescriptions,
  });
});
