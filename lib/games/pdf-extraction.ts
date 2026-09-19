import { PDFParse } from "pdf-parse";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function extractDocumentText(buffer: Buffer, type: string) {
  if (type === "text/plain" || type === "text/markdown") {
    const text = buffer.toString("utf8").slice(0, 100000);
    if (!text.trim()) throw new Error("Document contains no extractable text.");
    return text;
  }
  if (type !== "application/pdf") throw new Error("Unsupported document type.");
  try {
    PDFParse.setWorker(pathToFileURL(path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")).href);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text.trim().slice(0, 100000);
      if (!text) throw new Error("PDF contains no extractable text.");
      return text;
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    if (error instanceof Error && error.message === "PDF contains no extractable text.") throw error;
    throw new Error("Unable to extract text from this PDF.", { cause: error });
  }
}
