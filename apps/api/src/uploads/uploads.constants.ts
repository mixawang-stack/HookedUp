import path from "path";

export const STORAGE_DIR = path.resolve(__dirname, "..", "..", "storage");

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
