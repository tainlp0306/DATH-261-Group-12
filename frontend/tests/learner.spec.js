import { test, expect } from '@playwright/test';
import { labels, login, meta } from './helpers.js';

test('enrolled learner sees the course and cannot open instructor tools', async ({ page }) => {
  const learner = Object.entries(labels).find(([, persona]) => persona === 'on_track')[0];
  await login(page, learner);
  await page.goto('/my-courses');
  await expect(page.getByRole('link', { name: meta.course_title })).toBeVisible();

  await page.goto('/instructor/courses');
  await expect(page).toHaveURL(/unauthorized/);
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
});
