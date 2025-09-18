// @desc    Save numbers to DB

import NumberEntry from "../model/numberEntry.js";

// @desc    Save or update numbers
// @route   POST /api/numbers
export const saveNumbers = async (req, res) => {
  const { userId, numbers } = req.body;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0)
    return res.status(400).json({ message: "Numbers are required" });

  try {
    const existingEntry = await NumberEntry.findOne({ userId });

    if (existingEntry) {
      existingEntry.numbers = numbers; // update numbers
      await existingEntry.save();
      return res
        .status(200)
        .json({
          message: "Numbers updated successfully!",
          entry: existingEntry,
        });
    }

    const newEntry = new NumberEntry({ userId, numbers });
    await newEntry.save();
    res
      .status(201)
      .json({ message: "Numbers saved successfully!", entry: newEntry });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Get all numbers
// @route   GET /api/numbers
export const getNumbers = async (req, res) => {
  try {
    const entries = await NumberEntry.find();
    res.status(200).json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
