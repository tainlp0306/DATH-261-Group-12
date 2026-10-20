import { test, expect } from '@playwright/test';
import { meta } from './helpers.js';

test('guest can search the published catalogue', async ({ page }) => {
  await page.goto('/courses');
  await expect(page.getByRole('link', { name: meta.course_title })).toBeVisible();

  await page.getByPlaceholder('Tìm kiếm khóa học theo tên hoặc nội dung...').fill('zzzz-khong-co');
  await page.getByRole('button', { name: 'Tìm' }).click();
  await expect(page.getByRole('heading', { name: 'Không tìm thấy khóa học nào' })).toBeVisible();

  await page.getByPlaceholder('Tìm kiếm khóa học theo tên hoặc nội dung...').fill('Tiếng Nhật');
  await page.getByRole('button', { name: 'Tìm' }).click();
  await expect(page.getByRole('link', { name: meta.course_title })).toBeVisible();
});

test('wrong password stays on the login page', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Nhập tên đăng nhập của bạn').fill(meta.instructor);
  await page.getByPlaceholder('••••••••').fill('not-the-password');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/No active account|Đăng nhập thất bại/)).toBeVisible();
});
