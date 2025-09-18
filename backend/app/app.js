// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getOAuthDrive } from "./driveAuth.js"; // keep as in your project
import dbConnect from "../config/dbConnect.js";
import { globalErrhandler, notFound } from "../middleware/globalErrHandler.js";

// Your existing route modules
import userRoutes from "../routes/userRoute.js";
import jobDescRoutes from "../routes/jobDescRoute.js";
import cvRoutes from "../routes/cvRoute.js";
import scoreRoute from "../routes/cvRankingRoute.js";

// ------------------------------
// DB connect (keep as in your project)
// ------------------------------
dbConnect();

// ------------------------------
// __dirname replacement for ESM
// ------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ------------------------------
// Express app
// ------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
// Mount your existing routes
// ------------------------------
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/jobDesc", jobDescRoutes);
app.use("/api/v1/cv", cvRoutes);
app.use("/api/v1/score", scoreRoute);

// =====================================================================
// 🔽🔽🔽  O L L A M A   H E L P E R S   (for dynamic questions)  🔽🔽🔽
// =====================================================================

/**
 * Build a strict JSON-only prompt so Ollama returns parseable output.
 */
function buildOllamaPrompt({
  resumeText = "",
  jobDescription = "",
  matchedSkills = [],
  numQuestions = 8,
}) {
  const kwLine = matchedSkills?.length
    ? `Focus keywords: ${matchedSkills.join(", ")}`
    : "Focus keywords: (not provided)";
  const n = Math.min(Math.max(parseInt(numQuestions || 8, 10), 3), 20);

  return `You are an interview question generator for HR screening and technical rounds.
Use the candidate CV and the Job Description to propose ${n} diverse, specific, non-redundant, and role-aligned questions.
Mix types: technical, behavioral, situational, and screening.
For each question, include:
- "question": the question text
- "type": one of ["technical","behavioral","situational","screening"]
- "focus": 1-3 short keywords/skills
- "why": 1 sentence rationale

${kwLine}

=== CV ===
${resumeText || "(none)"}

=== JOB DESCRIPTION ===
${jobDescription || "(none)"}

Return ONLY valid JSON of the form:
{ "questions": [ { "question": "...", "type": "...", "focus": ["..."], "why":"..." }, ... ] }`;
}

/**
 * Call local Ollama /api/generate
 * Requires: `ollama serve` and a pulled model (e.g., `ollama pull llama3.1:8b`)
 * Node 18+ has global fetch. If on older Node, install node-fetch and import it.
 */
async function callOllamaGenerate(prompt) {
  const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const temperature = parseFloat(process.env.DYNQ_TEMPERATURE || "0.35");
  const maxTokens = parseInt(process.env.DYNQ_MAX_TOKENS || "700", 10);

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      options: { temperature, num_predict: maxTokens },
      stream: false,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${txt}`);
  }
  const data = await res.json(); // { response: "...", ... }
  return data.response || "";
}

/**
 * Safely parse JSON even if the model adds extra text around it.
 */
function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1));
    } catch {}
  }
  return null;
}

// Optional health check for questions service
app.get("/api/v1/questions/health", (_req, res) => {
  res.json({
    ok: true,
    model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    base: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  });
});

// =====================================================================
// ✅ Ollama-powered dynamic questions endpoint (returns string[] for Interview.tsx)
// =====================================================================
// POST /api/v1/questions/generate
// Body: { resumeText?: string, jobDescription?: string, matchedSkills?: string[], numQuestions?: number }
app.post("/api/v1/questions/generate", async (req, res) => {
  try {
    const {
      resumeText = "",
      jobDescription = "",
      matchedSkills = [],
      numQuestions = 8,
    } = req.body || {};

    if (!resumeText && !jobDescription) {
      return res
        .status(400)
        .json({ ok: false, error: "Provide at least resumeText or jobDescription" });
    }

    // Build prompt + call Ollama
    const prompt = buildOllamaPrompt({
      resumeText,
      jobDescription,
      matchedSkills,
      numQuestions,
    });

    const raw = await callOllamaGenerate(prompt);

    // ---- Try several ways to extract questions into a string[] ----
    const stringsFromParsedJSON = (() => {
      const parsed = safeParseJSON(raw);
      if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions
          .map((q) => (typeof q === "string" ? q : q?.question))
          .filter((s) => typeof s === "string" && s.trim().length > 0);
      }
      return null;
    })();

    // Try to extract from a fenced ```json code block if present
    const stringsFromCodeFence = (() => {
      const m = raw.match(/```json([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/);
      if (!m) return null;
      const parsed = safeParseJSON(m[1]);
      if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions
          .map((q) => (typeof q === "string" ? q : q?.question))
          .filter((s) => typeof s === "string" && s.trim().length > 0);
      }
      return null;
    })();

    // Heuristic: pull question-like lines if JSON failed
    const stringsFromHeuristic = (() => {
      const lines = raw.split(/\r?\n/).map((l) => l.trim());
      const candidates = lines
        .map((l) => l.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")) // strip bullets/numbers
        .filter((s) => s.length >= 8 && /[?]$/.test(s)); // keep lines that end with '?'
      const uniq = Array.from(new Set(candidates)).filter((s) => s.trim().length > 0);
      return uniq.length ? uniq : null;
    })();

    const strings =
      stringsFromParsedJSON ||
      stringsFromCodeFence ||
      stringsFromHeuristic ||
      [];

    if (!strings.length) {
      return res.status(502).json({
        ok: false,
        error: "Could not parse dynamic questions from model output",
        raw, // helpful for debugging
    });
    }

    // Keep to 5 for your UI
    const limited = strings.slice(0, 5);

    return res.json({
      ok: true,
      questions: limited, // <-- string[]
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e.message || "failed" });
  }
});

// ------------------------------
// Error middleware (keep as-is)
// ------------------------------
app.use(notFound);
app.use(globalErrhandler);

export default app;
