import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function getUploadRoot() {
  return path.resolve(backendDirectory, process.env.PYQ_UPLOAD_DIR || 'uploads');
}

export async function ensureUploadDirectories() {
  const uploadRoot = getUploadRoot();
  await mkdir(path.join(uploadRoot, 'tmp'), { recursive: true });
  await mkdir(path.join(uploadRoot, 'papers'), { recursive: true });
}

export function getTemporaryDirectory() {
  return path.join(getUploadRoot(), 'tmp');
}

export async function hashFile(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export async function promoteUpload(filePath, userId, fileHash, extension) {
  const uploadRoot = getUploadRoot();
  const userDirectory = createHash('sha256').update(String(userId)).digest('hex').slice(0, 24);
  const relativePath = path.join('papers', userDirectory, `${fileHash}${extension}`);
  const absolutePath = path.resolve(uploadRoot, relativePath);
  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new Error('The upload destination is invalid.');
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await rename(filePath, absolutePath);
  return relativePath;
}

export function resolveStoredFile(fileUrl) {
  const uploadRoot = getUploadRoot();
  const absolutePath = path.resolve(uploadRoot, fileUrl);
  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new Error('The stored file path is invalid.');
  }
  return absolutePath;
}

export async function deleteStoredFile(fileUrl) {
  if (!fileUrl) return;
  await rm(resolveStoredFile(fileUrl), { force: true });
}

export function temporaryFileName() {
  return randomUUID();
}
