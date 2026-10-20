import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const meta = JSON.parse(readFileSync(join(here, 'seed-meta.json'), 'utf8'));

export const labels = JSON.parse(readFileSync(
  join(here, '../../backend/lms_core/fixtures/analytics_labels.json'),
  'utf8',
));

export async function login(page, username, password = meta.password) {
  await page.goto('/login');
  await page.getByPlaceholder('Nhập tên đăng nhập của bạn').fill(username);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
