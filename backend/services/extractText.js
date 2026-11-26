import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { readFile } from 'fs/promises';
import path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import { AppError } from '../utils/http.js';

if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix;
if (!globalThis.ImageData) globalThis.ImageData = ImageData;
if (!globalThis.Path2D) globalThis.Path2D = Path2D;

const MAX_PDF_PAGES = 80;
const MAX_EXTRACTED_CHARACTERS = 150000;

async function extractPdf(filePath) {
  const bytes = await readFile(filePath);
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  if (document.numPages > MAX_PDF_PAGES) {
    throw new AppError(413, `PDF has more than ${MAX_PDF_PAGES} pages.`);
  }

  const nativePages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    nativePages.push(content.items.map((item) => item.str || '').join(' '));
    page.cleanup();
  }
  const nativeText = nativePages.join('\n').trim();
  if (nativeText.length >= Math.max(100, document.numPages * 40)) {
    return nativeText.slice(0, MAX_EXTRACTED_CHARACTERS);
  }

  const worker = await createWorker('eng');
  try {
    const recognizedPages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const renderTask = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      });
      await (renderTask.promise || renderTask);
      const { data } = await worker.recognize(canvas.toBuffer('image/png'));
      recognizedPages.push(data.text);
      page.cleanup();
      if (recognizedPages.join('\n').length >= MAX_EXTRACTED_CHARACTERS) break;
    }
    return recognizedPages.join('\n').slice(0, MAX_EXTRACTED_CHARACTERS).trim();
  } finally {
    await worker.terminate();
  }
}

export async function extractText(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  let text;
  if (extension === '.pdf') {
    text = await extractPdf(filePath);
  } else if (extension === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    text = result.value;
  } else if (['.jpg', '.jpeg', '.png'].includes(extension)) {
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(filePath);
      text = data.text;
    } finally {
      await worker.terminate();
    }
  } else {
    throw new AppError(400, 'Only PDF, JPG/JPEG, PNG, and DOCX files are supported.');
  }

  const normalized = String(text || '').replace(/\u0000/g, '').trim();
  if (normalized.length < 20) {
    throw new AppError(422, 'No readable question-paper text was found in the upload.');
  }
  return normalized.slice(0, MAX_EXTRACTED_CHARACTERS);
}
