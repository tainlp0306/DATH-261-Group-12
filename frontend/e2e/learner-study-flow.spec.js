import { expect, test } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8000/api/auth/';
const PASSWORD = process.env.E2E_PASSWORD || 'LingoDemo2026!';

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
  }
  return payload;
}

async function login(username) {
  let payload;
  try {
    payload = await api('login/', {
      method: 'POST',
      body: { username, password: PASSWORD },
    });
  } catch (error) {
    const cause = error?.cause?.code || error?.cause?.message || error.message;
    if (String(cause).includes('ECONNREFUSED') || String(error.message).includes('fetch failed')) {
      throw new Error(
        `Cannot reach ${API_BASE}. Start the Django backend on port 8000 and run seed_demo_data before this browser test.`,
        { cause: error },
      );
    }
    throw error;
  }
  if (!payload?.access) {
    throw new Error(`Login for ${username} did not return an access token.`);
  }
  return payload.access;
}

test('learner enrols, completes a lesson, submits a quiz, and sees the score', async ({ page }) => {
  const title = `E2E UI course ${Date.now()}`;
  const lessonTitle = 'E2E greeting lesson';
  const quizTitle = 'E2E greeting quiz';

  const instructorToken = await login('demo_instructor');
  const course = await api('courses/', {
    token: instructorToken,
    method: 'POST',
    body: {
      title,
      description: 'Browser flow course created for the Playwright learner journey.',
      is_published: true,
    },
  });
  const module = await api('modules/', {
    token: instructorToken,
    method: 'POST',
    body: { course: course.id, title: 'Chapter 1', order: 1 },
  });
  await api('lessons/', {
    token: instructorToken,
    method: 'POST',
    body: {
      module: module.id,
      title: lessonTitle,
      lesson_type: 'text',
      content: 'Hello is used to greet someone.',
      order: 1,
      notify_students: false,
    },
  });
  await api(`courses/${course.id}/assignments/`, {
    token: instructorToken,
    method: 'POST',
    body: {
      title: quizTitle,
      assignment_type: 'quiz',
      time_limit_minutes: 10,
      questions: [{
        content: 'Which word is a greeting?',
        option_a: 'Goodbye',
        option_b: 'Hello',
        option_c: 'Thanks',
        option_d: 'Please',
        correct_option: 'B',
      }],
    },
  });

  await page.goto('/login');
  await page.getByPlaceholder('Nhập email hoặc tên đăng nhập').fill('demo_learner');
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/my-courses/);

  await page.goto('/courses');
  await page.getByPlaceholder('Tìm kiếm khóa học theo tên hoặc nội dung...').fill(title);
  await page.getByRole('button', { name: 'Tìm' }).click();
  const courseRow = page.getByRole('listitem').filter({ hasText: title });
  await courseRow.getByRole('link', { name: 'Xem chi tiết' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('Đăng ký để mở').first()).toBeVisible();

  await page.getByRole('button', { name: 'Đăng ký khóa học' }).click();
  await expect(page.getByText('Bạn đã đăng ký khóa học này.')).toBeVisible();
  await page.getByRole('link', { name: lessonTitle }).click();
  await expect(page.getByText('Hello is used to greet someone.')).toBeVisible();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click();
  await expect(page.getByRole('button', { name: 'Đã hoàn thành' })).toBeVisible();

  await page.getByRole('link', { name: title }).click();
  await page.getByRole('link', { name: quizTitle }).click();
  await page.getByRole('button', { name: 'Bắt đầu làm bài' }).click();
  await page.getByRole('radio', { name: /B\.\s*Hello/ }).check();
  await page.getByRole('button', { name: 'Nộp bài' }).click();
  await expect(page.getByText(/Điểm:\s*10(?:\.0)?\s*\/\s*10/)).toBeVisible();
});
