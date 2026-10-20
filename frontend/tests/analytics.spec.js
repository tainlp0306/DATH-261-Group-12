import { test, expect } from '@playwright/test';
import { labels, login, meta } from './helpers.js';

const predicted = new Set(['dropout_late', 'dropout_early', 'struggling', 'crammer', 'on_track_break']);

test('instructor sees the seeded at-risk cohort and the progress chart', async ({ page }) => {
  await login(page, meta.instructor);
  await page.goto(`/instructor/courses/${meta.course_id}/manage`);
  await page.getByTestId('tab-analytics').click();
  await expect(page.getByTestId('kpi-at-risk-count')).toHaveText(String(meta.at_risk_count));
  await expect(page.getByTestId('progress-chart')).toContainText('%');
  await expect(page.getByTestId('at-risk-table')).toBeVisible();

  for (const [username, persona] of Object.entries(labels)) {
    const row = page.getByTestId(`at-risk-row-${username}`);
    if (predicted.has(persona)) {
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
    }
  }
});

test('instructor reminder reaches the learner notification bell', async ({ page }) => {
  await login(page, meta.instructor);
  await page.goto(`/instructor/courses/${meta.course_id}/manage`);
  await page.getByTestId('tab-analytics').click();
  await page.getByTestId(`intervene-notify-${meta.dropout_early}`).click();
  await expect(page.getByText(/Đã gửi nhắc\.|Đã nhắc trong 24 giờ qua\./)).toBeVisible();

  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.waitForURL(/\/login/);
  await login(page, meta.dropout_early);
  await page.getByRole('button', { name: 'Thông báo' }).click();
  await expect(page.getByText('Nhắc tiến độ')).toBeVisible();
});

test('learner cannot open the class analytics table', async ({ page }) => {
  const learner = Object.entries(labels).find(([, persona]) => persona === 'on_track')[0];
  await login(page, learner);
  await page.goto(`/instructor/courses/${meta.course_id}/manage`);
  await expect(page.getByTestId('at-risk-table')).toHaveCount(0);
  await expect(page).toHaveURL(/unauthorized/);
});
