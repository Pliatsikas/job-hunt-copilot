import { extractText, getDocumentProxy } from "unpdf";
import { CV_PDF_MAX_BYTES } from "../schemas/cv-import";

/** User-facing; nothing is persisted when this is thrown. */
export class CvImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvImportError";
  }
}

const PDF_MAGIC = "%PDF-";

/**
 * Text out of a PDF, with the checks that belong before any parsing: the
 * declared type is not trusted (a browser sets it from the extension), the
 * first bytes are, and the size cap is enforced on the bytes actually
 * received rather than on a header the client wrote.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  if (file.size === 0) throw new CvImportError("The file is empty.");
  if (file.size > CV_PDF_MAX_BYTES) {
    throw new CvImportError(
      `That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${CV_PDF_MAX_BYTES / 1024 / 1024} MB. A CV should be well under that — is this a scan?`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, PDF_MAGIC.length));
  if (head !== PDF_MAGIC) {
    throw new CvImportError("That file is not a PDF, whatever its name says.");
  }

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch {
    throw new CvImportError("The PDF could not be opened. It may be damaged or password-protected.");
  }

  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const trimmed = text.trim();

  // A scanned CV is an image: it opens fine and contains no text at all.
  // Saying so is better than sending fifty bytes of noise to a model.
  if (trimmed.length < 100) {
    throw new CvImportError(
      "Almost no text came out of that PDF. If it is a scan or an image export, it has no text layer to read — paste the CV as text instead.",
    );
  }

  return { text: trimmed, pages: totalPages };
}
