import mongoose from "mongoose";

const numberEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true }, // Unique identifier
    numbers: {
      type: [Number],
      required: true,
      validate: [(arr) => arr.length <= 3, "Maximum 3 numbers allowed"],
    },
  },
  { timestamps: true }
);

const NumberEntry = mongoose.model("NumberEntry", numberEntrySchema);

export default NumberEntry;
