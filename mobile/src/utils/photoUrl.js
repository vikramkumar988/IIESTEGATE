import { getBaseUrl } from '../services/api';

/**
 * Resolve a photo URL from the backend.
 * Handles three cases:
 * 1. base64 data URI (data:image/...) — return as-is (new storage format)
 * 2. Full URL (http/https) — return as-is
 * 3. Relative path (/uploads/...) — prepend server base URL (legacy format)
 */
export function resolvePhotoUrl(path) {
  if (!path) return null;
  if (typeof path !== 'string') return null;
  // base64 data URI — stored directly in DB (survives redeploys)
  if (path.startsWith('data:')) return path;
  // Already a full URL
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // Legacy: relative path like /uploads/xxx.jpg
  return `${getBaseUrl()}${path}`;
}
