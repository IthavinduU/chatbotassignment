import { expect, test } from '@playwright/test';
import { signIn, uniqueStamp } from './helpers';

test.describe('Super admin console', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'super');
  });

  test('lists every user with their role', async ({ page }) => {
    await page.getByRole('button', { name: 'Users', exact: true }).click();
    await expect(page.getByRole('row', { name: /user1/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /groupadmin/ })).toBeVisible();
  });

  test('shows the audit log, sorted and grouped by type', async ({ page }) => {
    const name = `audit${uniqueStamp()}`;
    const signUp = await page.request.post('http://localhost:3000/api/auth/register', {
      data: { username: name, email: `${name}@e2e.test`, password: 'abc123', birthdate: '2000-01-01' },
    });
    expect(signUp.ok()).toBeTruthy();

    await page.getByRole('button', { name: 'Audit log' }).click();
    await expect(page.locator('td code').first()).toBeVisible();

    await page.getByLabel('Order').selectOption('asc');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('td code').first()).toBeVisible();

    await page.getByLabel('Group by type').check();
    await expect(page.getByRole('heading', { name: /\(\d+\)$/ }).first()).toBeVisible();
  });
});