import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('Signing in', () => {
  test('the sign-up page shows the logo at the bottom', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    const lastPartOfCard = page.locator('.auth-card > :last-child');
    await expect(lastPartOfCard).toHaveClass(/auth-logo/);
    await expect(lastPartOfCard).toContainText('Fabulari');
  });

  test('a wrong password shows a clear error and stays on the sign-in page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[formcontrolname=login]').fill('groupadmin');
    await page.locator('input[formcontrolname=password]').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Username, email or password is incorrect');
    await expect(page).toHaveURL(/\/login/);
  });

  test('each role lands in the right place and members are kept out of the admin console', async ({ page, browser }) => {
    // A member goes to the chat area and is sent back there if they try the admin console.
    await signIn(page, 'user1');
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByText('Pick a chatroom to start chatting.')).toBeVisible();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/app/);

    // The super admin goes to the admin console.
    const superPage = await (await browser.newContext()).newPage();
    await signIn(superPage, 'super');
    await expect(superPage).toHaveURL(/\/admin/);
    await expect(superPage.getByRole('heading', { name: 'Requests from group admins' })).toBeVisible();
  });
});