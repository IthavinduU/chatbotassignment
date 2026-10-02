import { expect, Page } from '@playwright/test';
export const DEMO_PASSWORD = '123';

/** Signs in through the sign-in page and waits until the app has moved on from it. */
export async function signIn(page: Page, username: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.locator('input[formcontrolname=login]').fill(username);
  await page.locator('input[formcontrolname=password]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Opens a chatroom from the front page and waits for its messages to load. */
export async function openRoom(page: Page, groupName: string, roomName: string): Promise<void> {
  await page.goto('/app');
  await page.locator('section.group-card', { hasText: groupName }).getByRole('link', { name: `# ${roomName}` }).click();
  await expect(page.getByRole('heading', { name: `# ${roomName}` })).toBeVisible();
  await expect(page.locator('.bubble').first()).toBeVisible();
}

/** A short value that is different on every run, so tests can be repeated. */
export function uniqueStamp(): string {
  return Date.now().toString().slice(-8);
}

/** A 1x1 PNG image, used to test sending pictures. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);