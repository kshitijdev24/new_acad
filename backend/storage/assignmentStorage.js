import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultMaxFileSizeMB = 20;

function storageRoot() {
  return path.resolve(backendDirectory, process.env.ASSIGNMENT_UPLOAD_DIR || 'assignment-uploads');
}

export function assignmentTemporaryDirectory() {
  return path.join(storageRoot(), 'tmp');
}

export async function ensureAssignmentStorage() {
  await mkdir(assignmentTemporaryDirectory(), { recursive: true });
  await mkdir(path.join(storageRoot(), 'files'), { recursive: true });
}

export function maximumAssignmentUploadBytes() {
  const configured = Number(process.env.ASSIGNMENT_MAX_FILE_SIZE_MB) || defaultMaxFileSizeMB;
  return Math.max(1, Math.min(configured, 100)) * 1024 * 1024;
}

export function assignmentUploadLimitBytes(assignment) {
  const assignmentLimit = Number(assignment?.maxFileSizeMB)
    || Number(process.env.ASSIGNMENT_MAX_FILE_SIZE_MB)
    || defaultMaxFileSizeMB;
  return Math.min(maximumAssignmentUploadBytes(), Math.max(1, assignmentLimit) * 1024 * 1024);
}

export async function hashAssignmentFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function safeStoragePath(storageKey) {
  const root = storageRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('The assignment storage key is invalid.');
  }
  return resolved;
}

export async function promoteAssignmentFile(filePath, assignmentId, studentId, sha256, extension) {
  const studentKey = createHash('sha256').update(String(studentId)).digest('hex').slice(0, 24);
  const storageKey = `files/${String(assignmentId)}/${studentKey}/${sha256}${extension}`;
  const destination = safeStoragePath(storageKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await rename(filePath, destination);
  return storageKey;
}

export function resolveAssignmentFile(storageKey) {
  return safeStoragePath(storageKey);
}

export async function removeTemporaryAssignmentFile(filePath) {
  if (filePath) await rm(filePath, { force: true });
}

const dangerousExtensions = new Set([
  '.apk', '.app', '.bat', '.cmd', '.com', '.dll', '.exe', '.hta', '.js', '.jse',
  '.msi', '.ps1', '.scr', '.sh', '.vbs',
]);

const allowedMimeTypes = {
  '.pdf': new Set(['application/pdf', 'application/octet-stream']),
  '.zip': new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']),
  '.docx': new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  ]),
  '.java': new Set(['text/plain', 'text/x-java-source', 'application/octet-stream']),
  '.py': new Set(['text/plain', 'text/x-python', 'application/x-python-code', 'application/octet-stream']),
};

function hasZipHeader(buffer) {
  return buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(buffer[2])
    && [0x04, 0x06, 0x08].includes(buffer[3]);
}

export async function validateAssignmentUpload(file, assignment) {
  const originalName = String(file?.originalname || '');
  if (!originalName || /[\\/\0]/.test(originalName) || originalName === '.' || originalName === '..') {
    throw Object.assign(new Error('The uploaded filename is invalid.'), { status: 400 });
  }
  const extension = path.extname(originalName).toLowerCase();
  const allowedTypes = (assignment.allowedFileTypes || ['.pdf', '.zip', '.java', '.py', '.docx'])
    .map((type) => String(type).startsWith('.') ? String(type).toLowerCase() : `.${String(type).toLowerCase()}`);
  const filenameParts = originalName.toLowerCase().split('.');
  if (
    dangerousExtensions.has(extension)
    || filenameParts.slice(1, -1).some((part) => dangerousExtensions.has(`.${part}`))
  ) {
    throw Object.assign(new Error('Executable or double-extension files are not allowed.'), { status: 400 });
  }
  if (!allowedTypes.includes(extension)) {
    throw Object.assign(new Error('This file type is not allowed for the assignment.'), { status: 400 });
  }
  if (file.size > assignmentUploadLimitBytes(assignment)) {
    throw Object.assign(new Error('The uploaded file exceeds the assignment size limit.'), { status: 413 });
  }

  const mimeType = String(file.mimetype || '').toLowerCase();
  if (!allowedMimeTypes[extension]?.has(mimeType)) {
    throw Object.assign(new Error('The file MIME type does not match its extension.'), { status: 400 });
  }
  const fileHandle = await open(file.path, 'r');
  const prefix = Buffer.alloc(8192);
  try {
    const { bytesRead } = await fileHandle.read(prefix, 0, prefix.length, 0);
    prefix.fill(0, bytesRead);
  } finally {
    await fileHandle.close();
  }
  if (extension === '.pdf' && !prefix.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw Object.assign(new Error('The uploaded file is not a valid PDF.'), { status: 400 });
  }
  if (['.zip', '.docx'].includes(extension) && !hasZipHeader(prefix)) {
    throw Object.assign(new Error('The uploaded archive is not valid.'), { status: 400 });
  }
  if (['.java', '.py'].includes(extension)) {
    try {
      if (prefix.includes(0)) throw new Error('binary data');
      new TextDecoder('utf-8', { fatal: true }).decode(prefix);
    } catch {
      throw Object.assign(new Error('Source files must contain valid UTF-8 text.'), { status: 400 });
    }
  }

  return {
    extension,
    mimeType,
    originalName: originalName.normalize('NFKC').replace(/[^\w .()-]/g, '_').slice(0, 180),
  };
}

export async function scanAssignmentFile(filePath) {
  const host = process.env.CLAMAV_HOST;
  if (!host) return { scanned: false };
  const port = Number(process.env.CLAMAV_PORT) || 3310;
  const timeoutMs = Math.max(1000, Number(process.env.CLAMAV_TIMEOUT_MS) || 15000);

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const input = createReadStream(filePath);
    let response = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      input.destroy();
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const fail = (message, status = 503) => finish(Object.assign(new Error(message), { status }));

    socket.setTimeout(timeoutMs, () => fail('The malware scan timed out.'));
    socket.on('error', () => fail('The configured malware scanner is unavailable.'));
    socket.on('connect', () => {
      socket.write(Buffer.from('zINSTREAM\0'));
      input.on('data', (chunk) => {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length);
        if (!socket.write(Buffer.concat([length, chunk]))) input.pause();
      });
      socket.on('drain', () => input.resume());
      input.on('end', () => {
        const terminator = Buffer.alloc(4);
        socket.end(terminator);
      });
      input.on('error', () => fail('The uploaded file could not be scanned.'));
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (!response.includes('\0')) return;
      if (/\bOK\0/.test(response)) return finish(null, { scanned: true });
      if (/\bFOUND\0/.test(response)) return fail('The uploaded file failed the malware scan.', 400);
      return fail('The malware scanner returned an unexpected response.');
    });
    socket.on('end', () => {
      if (!settled) fail('The malware scanner closed the connection without a result.');
    });
  });
}

export function temporaryAssignmentFilename() {
  return randomUUID();
}
