import mongoose from "mongoose";

const Schema = mongoose.Schema;

const jobDescriptionSchema = new Schema(
  {
    description: {
      type: String,
      required: false, // optional now
    },
    pdfFile: {
      type: String, // you can store the file path (if uploaded to local storage) or filename
    },
  },
  {
    timestamps: true,
  }
);

// Compile the schema to model
const JobDescription = mongoose.model("JobDescription", jobDescriptionSchema);

export default JobDescription;
