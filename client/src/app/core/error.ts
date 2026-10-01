import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server.Check if it is running on port 3000.';
    return err.error?.error ?? `Request failed (${err.status})`;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
