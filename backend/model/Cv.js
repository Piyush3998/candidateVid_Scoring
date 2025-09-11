import mongoose from "mongoose";

const cvSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      unique: true, // ensures no duplicate filenames in DB
    },
    originalName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const CVUpload = mongoose.model("CVUpload", cvSchema);

export default CVUpload;
