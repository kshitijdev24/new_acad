import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateAssignmentUpload } from '../storage/assignmentStorage.js';

describe('private assignment upload validation', () => {
  let directory;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'acadlytic-assignment-test-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('accepts a PDF only when its filename, MIME type, and signature agree', async () => {
    const filePath = path.join(directory, 'upload');
    await writeFile(filePath, Buffer.from('%PDF-1.7\nfixture'));
    const file = {
      path: filePath,
      originalname: 'lab report.pdf',
      mimetype: 'application/pdf',
      size: 16,
    };
    await expect(validateAssignmentUpload(file, {})).resolves.toMatchObject({
      extension: '.pdf',
      mimeType: 'application/pdf',
      originalName: 'lab report.pdf',
    });
    await expect(validateAssignmentUpload(
      { ...file, mimetype: 'text/plain' },
      {}
    )).rejects.toMatchObject({ status: 400 });
  });

  test('rejects path traversal names, executable types, and oversized files', async () => {
    const filePath = path.join(directory, 'upload');
    await writeFile(filePath, Buffer.from('%PDF-1.7\nfixture'));
    await expect(validateAssignmentUpload({
      path: filePath,
      originalname: '../report.pdf',
      mimetype: 'application/pdf',
      size: 16,
    }, {})).rejects.toMatchObject({ status: 400 });
    await expect(validateAssignmentUpload({
      path: filePath,
      originalname: 'payload.exe',
      mimetype: 'application/octet-stream',
      size: 16,
    }, {})).rejects.toMatchObject({ status: 400 });
    await expect(validateAssignmentUpload({
      path: filePath,
      originalname: 'large.pdf',
      mimetype: 'application/pdf',
      size: 2 * 1024 * 1024,
    }, { maxFileSizeMB: 1 })).rejects.toMatchObject({ status: 413 });
  });
});
