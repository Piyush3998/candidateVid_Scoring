import asyncHandler from "express-async-handler";
import JobDescription from "../model/jobDescription.js";
import CVUpload from "../model/Cv.js";
import path from "path";
import nlp from "compromise";
import { readPdfFromPath, readTxtFromPath } from "../utils/readPdf.js";

// ------------------------------
// Utility: Extract skills from JD text
// ------------------------------
const extractSkillsFromText = (text) => {
  const doc = nlp(text);
  const skillsSet = new Set();

  // Extract nouns
  doc
    .nouns()
    .out("array")
    .forEach((s) => {
      s = s.toLowerCase().replace(/[^a-z0-9+#.-]/g, "");
      if (s && !STOPWORDS.has(s)) skillsSet.add(s);
    });

  // Extract tech/keywords (letters, numbers, +, #, .)
  const custom = text.match(/\b[A-Za-z0-9.+/#-]+\b/g) || [];
  custom.forEach((s) => {
    s = s.toLowerCase();
    if (s && !STOPWORDS.has(s)) skillsSet.add(s);
  });

  return Array.from(skillsSet);
};

// ------------------------------
// Utility: Extract candidate details
// ------------------------------
const extractCandidateDetails = (text, fileName) => {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);

  // Match phone numbers: optional +, 10-15 digits, may include spaces, dashes, or parentheses
  const phoneMatch = text.match(
    /(\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4})/
  );

  let name = "";
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let line of lines) {
    if (
      !line.includes("@") &&
      !/\d{4,}/.test(line) &&
      line.split(" ").length <= 5
    ) {
      // Avoid lines with 4+ consecutive digits (likely years)
      name = line.replace(/[^a-zA-Z\s]/g, "");
      break;
    }
  }

  if (!name) name = path.basename(fileName, path.extname(fileName));

  return {
    name,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "",
  };
};

// optimized the result -

// ------------------------------
// Stopwords to ignore
// ------------------------------
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "with",
  "to",
  "be",
  "is",
  "are",
  "it",
  "at",
  "from",
  "as",
  "by",
  "that",
  "this",
  "if",
  "we",
  "you",
]);

// ------------------------------
// Utility: Calculate score
// ------------------------------
const calculateScore = (cvText, jdSkills) => {
  const cvTextLower = cvText
    .toLowerCase()
    .replace(
      /\b(an|the|and|or|of|in|on|for|with|to|be|is|are|it|at|from|as|by|that|this|if|we|you)\b/g,
      ""
    )
    .replace(/[^a-z0-9+#.-]/g, " "); // remove punctuation

  const matched = [...jdSkills].filter((s) => cvTextLower.includes(s));
  const gap = [...jdSkills].filter((s) => !cvTextLower.includes(s));

  let score = jdSkills.length ? (matched.length / jdSkills.length) * 100 : 0;
  let bonus = 0;
  let reasons = [];

  if (/bachelor|master|degree/.test(cvTextLower)) {
    bonus += 10;
    reasons.push("Degree +10");
  }

  if (/experience|\d+\s+(years|year)/.test(cvTextLower)) {
    bonus += 10;
    reasons.push("Experience +10");
  }

  score = Math.min(100, score + bonus);

  return { score, matched, gap, bonus, reasons: reasons.join("; ") };
};

// ------------------------------
// Controller: Rank all CVs
// ------------------------------
export const rankCVsAgainstJD = asyncHandler(async (req, res) => {
  // 1. Fetch latest JD
  const jdRecord = await JobDescription.findOne().sort({ createdAt: -1 });
  console.log(jdRecord, "*******");

  if (!jdRecord)
    return res.status(404).json({ message: "No job description found" });

  let jdText = jdRecord.description || "";
  if (!jdText && jdRecord?.pdfFile) {
    jdText = await readTxtFromPath(jdRecord.pdfFile);
  }

  const jdSkills = extractSkillsFromText(jdText);

  // 2. Fetch all CVs
  const cvs = await CVUpload.find();
  if (!cvs.length)
    return res.status(404).json({ message: "No CVs uploaded yet" });

  // 3. Process CVs
  const results = [];

  for (let cv of cvs) {
    try {
      const filePath = path.join("uploads/cv", cv.filename);
      const text = await readPdfFromPath(filePath);

      if (!text) {
        console.warn(`Skipping CV (empty or unreadable): ${cv.originalName}`);
        continue;
      }

      const { name, email, phone } = extractCandidateDetails(
        text,
        cv.originalName
      );
      const { score, matched, gap, bonus, reasons } = calculateScore(
        text,
        jdSkills
      );

      results.push({
        "Candidate File": cv.originalName,
        Name: name,
        Email: email,
        Phone: phone,
        Score: score,
        "Bonus Points": bonus,
        "Bonus Reasons": reasons,
        "Matched Skills": matched.join(", "),
        "Missing Skills": gap.join(", "),
        "JD Skills": [...jdSkills].join(", "),
      });
    } catch (err) {
      console.error("Error processing CV:", cv.originalName, err);
    }
  }

  // 4. Sort by score descending
  results.sort((a, b) => b.Score - a.Score);

  res.status(200).json({
    status: "success",
    totalCandidates: results.length,
    message: "CVs ranked against latest JD",
    results,
  });
});
