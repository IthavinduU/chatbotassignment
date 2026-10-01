export const SERVER_URL = 'http://localhost:3000';
export const API_URL = `${SERVER_URL}/api`;

/** Uploaded files are stored as "/uploads/..." paths on the server. */
export function fileUrl(path: string | null | undefined): string | null {
  return path ? `${SERVER_URL}${path}` : null;
}
