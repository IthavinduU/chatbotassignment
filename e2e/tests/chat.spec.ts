import { expect, test } from '@playwright/test';
import { openRoom, signIn, TINY_PNG, uniqueStamp } from './helpers';

test.describe('Live chat', () => {
  test('people in a chatroom are told when someone joins and leaves', async ({ browser }) => {
    const admin = await (await browser.newContext()).newPage();
    const member = await (await browser.newContext()).newPage();

    await signIn(admin, 'groupadmin');
    await openRoom(admin, 'Study Group', 'general');

    await signIn(member, 'user1');
    await openRoom(member, 'Study Group', 'general');
    await expect(admin.getByText('user1 joined #general')).toBeVisible();

    // Switching to another chatroom leaves #general.
    await member.locator('.rooms').getByRole('link', { name: '# assignment-help' }).click();
    await expect(admin.getByText('user1 left #general')).toBeVisible();
  });

  test('text and image messages appear for everyone instantly', async ({ browser }) => {
    const admin = await (await browser.newContext()).newPage();
    const member = await (await browser.newContext()).newPage();
    const stamp = uniqueStamp();

    await signIn(admin, 'groupadmin');
    await openRoom(admin, 'Study Group', 'general');
    await signIn(member, 'user1');
    await openRoom(member, 'Study Group', 'general');

    // Text message, sent with the Enter key.
    const text = `Hello from the E2E test ${stamp}`;
    await member.locator('#draft').fill(text);
    await member.locator('#draft').press('Enter');
    await expect(admin.locator('.bubble', { hasText: text })).toBeVisible();

    // Image message with a caption.
    const caption = `Picture ${stamp}`;
    await member.locator('input[type=file]').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: TINY_PNG });
    await member.locator('#draft').fill(caption);
    await member.getByRole('button', { name: 'Send' }).click();
    const imageBubble = admin.locator('.bubble', { hasText: caption });
    await expect(imageBubble).toBeVisible();
    await expect(imageBubble.locator('img')).toHaveAttribute('src', /\/uploads\//);

    await admin.reload();
    await expect(admin.locator('.bubble', { hasText: text })).toBeVisible();
  });
});