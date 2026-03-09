const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");

/**
 * Extract plain text from an uploaded file buffer.
 * Supports: PDF, DOCX, DOC, TXT, MD
 * Returns { text, pages, wordCount, extractionMethod }
 */
async function extractText(buffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  try {
    if (ext === ".pdf") {
      return await extractPDF(buffer, originalName);
    }
    if (ext === ".docx" || ext === ".doc") {
      return await extractDOCX(buffer, originalName);
    }
    // Plain text fallback (txt, md, etc.)
    return extractPlainText(buffer, originalName);
  } catch (err) {
    console.error(`Text extraction failed for ${originalName}:`, err.message);
    // Return what we can rather than crashing
    return {
      text: `[Extraction failed for ${originalName}: ${err.message}. Please convert to .txt and re-upload.]`,
      pages: 0,
      wordCount: 0,
      extractionMethod: "failed",
    };
  }
}

async function extractPDF(buffer, name) {
  const data = await pdfParse(buffer, {
    // Preserve layout for tables/forms
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });

  const text = data.text
    .replace(/\x00/g, "")           // null bytes
    .replace(/[ \t]+\n/g, "\n")     // trailing whitespace
    .replace(/\n{4,}/g, "\n\n\n")   // collapse excessive blank lines
    .trim();

  return {
    text: text.slice(0, 150000),     // safety cap ~150k chars
    pages: data.numpages,
    wordCount: text.split(/\s+/).length,
    extractionMethod: "pdf-parse",
  };
}

async function extractDOCX(buffer, name) {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length) {
    console.warn(`DOCX extraction warnings for ${name}:`, result.messages.slice(0, 3));
  }

  const text = result.value
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  return {
    text: text.slice(0, 150000),
    pages: null,
    wordCount: text.split(/\s+/).length,
    extractionMethod: "mammoth",
  };
}

function extractPlainText(buffer, name) {
  const text = buffer.toString("utf8").slice(0, 150000);
  return {
    text,
    pages: null,
    wordCount: text.split(/\s+/).length,
    extractionMethod: "plain-text",
  };
}

module.exports = { extractText };
