import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './error';

describe('errorMessage', () => {
  it('explains when the server cannot be reached', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('Cannot reach the server');
  });

  it('shows the message the server sent', () => {
    const err = new HttpErrorResponse({ status: 409, error: { error: 'That username is taken' } });
    expect(errorMessage(err)).toBe('That username is taken');
  });

  it('falls back to the status code when the server sent no message', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500 }))).toBe('Request failed (500)');
  });

  it('uses the message of a normal error', () => {
    expect(errorMessage(new Error('Message not sent'))).toBe('Message not sent');
  });

  it('has a default for anything else', () => {
    expect(errorMessage('unexpected')).toBe('Something went wrong');
  });
});