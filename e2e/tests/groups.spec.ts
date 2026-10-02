import { expect, test } from '@playwright/test';
import { signIn, uniqueStamp } from './helpers';

test.describe('Joining a group', () => {
  test('a new user signs up, asks to join, and the group admin approves from the requests menu', async ({ page, browser }) => {
    const username = `e2e${uniqueStamp()}`;

    await page.goto('/register');
    await page.locator('input[formcontrolname=username]').fill(username);
    await page.locator('input[formcontrolname=email]').fill(`${username}@e2e.test`);
    await page.locator('input[formcontrolname=password]').fill('abc123');
    await page.locator('input[formcontrolname=birthdate]').fill('2000-01-01');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Find groups' })).toBeVisible();

    const studyGroupRow = page.locator('li.row', { hasText: 'Study Group' });
    await studyGroupRow.getByRole('button', { name: 'Ask to join' }).click();
    await expect(studyGroupRow.getByText('Request sent')).toBeVisible();

    const admin = await (await browser.newContext()).newPage();
    await signIn(admin, 'groupadmin');
    await admin.getByRole('button', { name: /Requests to review/ }).click();
    await admin.getByRole('link', { name: /Join requests/ }).click();
    const request = admin.locator('li.row', { hasText: `${username} wants to join Study Group` });
    await request.getByRole('button', { name: 'Approve' }).click();
    await expect(admin.getByText('Request approved')).toBeVisible();

    await page.goto('/app');
    await expect(page.locator('section.group-card', { hasText: 'Study Group' })).toBeVisible();
  });
});