import pdfParse from "pdf-parse";
import fs from "fs";

export const readPdfText = async (fileBuffer) => {
  try {
    const data = await pdfParse(fileBuffer);
    return (data?.text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\s+/g, " ")
      .trim();
  } catch (err) {
    console.error("Error parsing PDF:", err.message || err);
    return "";
  }
};

// ------------------------------
// Read plain text file
// ------------------------------
export const readTxtFromPath = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Text file not found: ${filePath}`);
      return "";
    }
    const text = await fs.promises.readFile(filePath, "utf8");
    return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("Error reading TXT file:", err.message || err);
    return "";
  }
};

export const readPdfFromPath = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return "";
    }
    const buffer = await fs.promises.readFile(filePath);
    return await readPdfText(buffer);
  } catch (err) {
    console.error("Error reading PDF file:", err.message || err);
    return "";
  }
};
