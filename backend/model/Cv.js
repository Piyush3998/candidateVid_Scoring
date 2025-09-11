import mongoose from "mongoose";

const cvSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      // unique: true, // remove this
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
