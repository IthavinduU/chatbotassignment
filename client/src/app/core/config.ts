export const SERVER_URL = 'http://localhost:3000';
export const API_URL = `${SERVER_URL}/api`;

/** Returns the full URL for an uploaded file. */
export function fileUrl(path: string | null | undefined): string | null {
  return path ? `${SERVER_URL}${path}` : null;
}
