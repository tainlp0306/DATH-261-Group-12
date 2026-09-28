# LingoSphere LMS - Frontend (React & Tailwind CSS)

Hệ thống giao diện người dùng cho nền tảng quản lý học tập LingoSphere, kết nối với Backend Django REST Framework.

## 🚀 Tính năng & Màn hình chính

1. **Xác thực & Phân quyền (Auth & RBAC):**
   - **Đăng nhập (`/login`) & Đăng ký (`/register`)**: Hỗ trợ chọn vai trò Học viên (*Learner*) hoặc Giảng viên (*Instructor*).
   - **Quản lý Token**: Tự động lưu JWT Token (Access & Refresh) và Role vào `localStorage`.
   - **Axios Interceptor**: Tự động đính kèm `Authorization: Bearer <access_token>` và cơ chế Refresh Token khi gặp lỗi 401.
   - **Protected Routes**: Phân quyền truy cập các trang nhạy cảm theo Role.

2. **Khám phá Khóa học (`/courses`):**
   - Tìm kiếm khóa học theo từ khóa.
   - Danh sách thẻ khóa học trực quan hiển thị số lượng chương, bài học và tên giảng viên.
   - Đăng ký học nhanh hoặc xem chi tiết khóa học.
   - Lọc khóa học: *Tất cả* / *Đã đăng ký*.

3. **Giao diện Học tập & Đề cương (`/courses/:id`):**
   - Sidebar/Accordion hiển thị danh sách Chương học (Modules) và các Bài học (Lessons).
   - Khung trình chiếu bài giảng đa phương tiện (Văn bản, Video nhúng/YouTube, Slide thuyết trình).
   - Nút "Hoàn thành bài học" gửi API lưu tiến độ học tập và cập nhật thanh tiến trình theo thời gian thực.

4. **Studio Dành cho Giảng viên (`/instructor/courses/create`):**
   - Khởi tạo khóa học mới (Tiêu đề, Mô tả, Yêu cầu, Xuất bản).
   - Thêm Chương học (Module) và Bài học (Lesson) với đầy đủ định dạng (Text / Video / Slide).
   - Cây đề cương hiển thị trực quan theo thời gian thực.

---

## 🛠️ Hướng dẫn Khởi chạy Frontend

```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt các thư viện phụ thuộc (nếu chưa cài)
npm install

# 3. Khởi động môi trường phát triển (Dev server)
npm run dev

# 4. Build sản phẩm (Production)
npm run build
```

Mặc định ứng dụng chạy tại: `http://localhost:5173` và kết nối với Backend API tại `http://localhost:8000/api/auth/`.

