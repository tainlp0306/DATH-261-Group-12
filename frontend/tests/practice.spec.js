import { test, expect } from '@playwright/test';
import { labels, login, meta } from './helpers.js';

test('instructor adds a typing item and the learner can retry', async ({ page }) => {
  const word = `e2e-${Date.now()}`;
  await login(page, meta.instructor);
  await page.goto(`/instructor/courses/${meta.course_id}/manage`);
  await page.getByTestId('tab-vocabulary').click();
  await page.getByTestId('vocabulary-word').fill(word);
  await page.getByTestId('vocabulary-romaji').fill('konnichiwa');
  await page.getByTestId('vocabulary-meaning').fill('luyen e2e');
  await page.getByTestId('vocabulary-kind').selectOption('typing');
  await page.getByTestId('vocabulary-save').click();
  await expect(page.getByText(word)).toBeVisible();

  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.waitForURL(/\/login/);

  const learner = Object.entries(labels).find(([, persona]) => persona === 'on_track')[0];
  await login(page, learner);
  await page.goto(`/courses/${meta.course_id}/practice`);
  await page.locator(`[data-testid="practice-item"][data-word="${word}"]`).click();
  await page.getByTestId('practice-answer').fill('sai');
  await page.getByTestId('practice-submit').click();
  await expect(page.getByTestId('practice-result')).toContainText('Chưa đúng');

  await page.getByTestId('practice-answer').fill(word);
  await page.getByTestId('practice-submit').click();
  await expect(page.getByTestId('practice-result')).toContainText('Đúng');
});
