import asyncHandler from "express-async-handler";
import JobDescription from "../model/jobDescription.js";
import CVUpload from "../model/Cv.js";
import fs from "fs";
import path from "path";
import nlp from "compromise";

// ------------------------------
// Utility: Extract skills from JD text
// ------------------------------
const extractSkillsFromText = (text) => {
  const doc = nlp(text);
  const skillsSet = new Set();

  // Extract noun phrases
  doc
    .nouns()
    .out("array")
    .forEach((s) => skillsSet.add(s.toLowerCase()));

  // Extract uppercase terms (CI/CD, SQL, C++, etc.)
  const custom = text.match(/\b[A-Za-z0-9.+/-]+\b/g) || [];
  custom.forEach((s) => skillsSet.add(s.toLowerCase()));

  return skillsSet;
};

// ------------------------------
// Utility: Extract candidate details
// ------------------------------
const extractCandidateDetails = (text, fileName) => {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/(\+?\d[\d\s-]{8,15})/);

  console.log("This is text from CV:", text);

  let name = "";
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let line of lines) {
    if (
      !line.includes("@") &&
      !/\d/.test(line) &&
      line.split(" ").length <= 5
    ) {
      name = line.replace(/[^a-zA-Z\s]/g, ""); // remove weird chars
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

// ------------------------------
// Utility: Calculate score
// ------------------------------
const calculateScore = (cvText, jdSkills) => {
  const cvTextLower = cvText.toLowerCase();

  const matched = [...jdSkills].filter((s) => cvTextLower.includes(s));
  const gap = [...jdSkills].filter((s) => !cvTextLower.includes(s));

  let score = jdSkills.size ? (matched.length / jdSkills.size) * 100 : 0;
  let bonus = 0;
  let reasons = [];

  if (
    cvTextLower.includes("bachelor") ||
    cvTextLower.includes("master") ||
    cvTextLower.includes("degree")
  ) {
    bonus += 10;
    reasons.push("Degree +10");
  }

  if (
    cvTextLower.includes("experience") ||
    cvTextLower.match(/\d+\s+(years|year)/)
  ) {
    bonus += 10;
    reasons.push("Experience +10");
  }

  score = Math.min(100, score + bonus);

  return { score, matched, gap, bonus, reasons: reasons.join("; ") };
};

async function readPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    console.log("Text Content:", data.text);
    // You can also access other metadata like data.numpages, data.info, etc.
  } catch (error) {
    console.error("Error reading PDF:", error);
  }
}

const readPDFAsText = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
};

// ------------------------------
// Controller: Rank all CVs
// ------------------------------
export const rankCVsAgainstJD = asyncHandler(async (req, res) => {
  // 1. Fetch latest JD
  const jdRecord = await JobDescription.findOne().sort({ createdAt: -1 });
  if (!jdRecord)
    return res.status(404).json({ message: "No job description found" });

  let jdText = jdRecord.description || "";
  if (!jdText && jdRecord.pdfFile && fs.existsSync(jdRecord.pdfFile)) {
    jdText = fs.readFileSync(jdRecord.pdfFile, "utf-8");
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

      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        continue;
      }
      // export cvs
      const text = fs.readFileSync(filePath, "utf-8");

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
