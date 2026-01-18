import path from "path";

const DEFAULT_STORAGE_DIR =
  process.env.NODE_ENV === "production"
    ? "/apps/api/storage"
    : path.resolve(__dirname, "..", "..", "storage");
const storageOverride = process.env.UPLOADS_DIR;
export const STORAGE_DIR = storageOverride
  ? path.resolve(storageOverride)
  : DEFAULT_STORAGE_DIR;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const TRACE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export const TRACE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
