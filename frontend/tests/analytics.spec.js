import { test, expect } from '@playwright/test';
import { labels, login, meta } from './helpers.js';

test('instructor sees the seeded at-risk cohort and the progress chart', async ({ page }) => {
  await login(page, meta.instructor);
  await page.goto(`/instructor/courses/${meta.course_id}/manage`);
  await page.getByTestId('tab-analytics').click();
  await expect(page.getByRole('heading', { name: 'Tiến độ và cảnh báo sớm' })).toBeVisible();
  await expect(page.getByTestId('kpi-at-risk-count')).toBeVisible();
  await expect(page.getByTestId('progress-chart')).toContainText('%');
  await expect(page.getByTestId('at-risk-table')).toBeVisible();
  await expect(page.locator(`[data-username="${meta.dropout_early}"]`)).toBeVisible();
  await expect(page.locator(`[data-username="${meta.dropout_early}"]`)).toContainText('Cần can thiệp');
});

test('instructor reminder reaches the learner notification bell', async ({ page }) => {
  await login(page, meta.instructor);
  await page.goto(`/instructor/courses/${meta.course_id}/manage`);
  await page.getByTestId('tab-analytics').click();
  await page.getByTestId(`intervene-notify-${meta.dropout_early}`).click();
  await expect(page.getByText(/Đã gửi thông báo nhắc tiến độ\.|Đã gửi nhắc học viên trong 24 giờ qua\./)).toBeVisible();

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
