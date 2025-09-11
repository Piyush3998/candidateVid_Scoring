import fs from "fs";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

export const readPdfText = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error("PDF file not found: " + filePath);
  }

  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let textContent = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    textContent += pageText + "\n";
  }

  return textContent.trim();
};
