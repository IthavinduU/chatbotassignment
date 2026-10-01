import { fileUrl, SERVER_URL } from './config';

describe('fileUrl', () => {
  it('turns an upload path into a full URL on the server', () => {
    expect(fileUrl('/uploads/photo.png')).toBe(`${SERVER_URL}/uploads/photo.png`);
  });

  it('returns null when there is no file', () => {
    expect(fileUrl(null)).toBeNull();
    expect(fileUrl(undefined)).toBeNull();
    expect(fileUrl('')).toBeNull();
  });
});