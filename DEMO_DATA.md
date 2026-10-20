# Dữ liệu demo LingoSphere

## Tạo/cập nhật dữ liệu

Sau khi khởi động Compose và migration đã áp dụng:

```powershell
docker compose exec backend python manage.py seed_demo_data
```

Lệnh có thể chạy lại; dữ liệu demo được cập nhật thay vì nhân bản. Lệnh sẽ đặt lại mật khẩu của bốn tài khoản demo mỗi lần chạy.

## Tài khoản

Mật khẩu mặc định: `LingoDemo2026!`

| Vai trò | Tên đăng nhập | Dùng để kiểm tra |
|---|---|---|
| Admin | `demo_admin` | Dashboard, danh sách người dùng/khóa học, báo cáo, log |
| Instructor | `demo_instructor` | Khóa học demo, chương/bài học, tạo bài tập và chấm bài |
| Learner | `demo_learner` | Nội dung học, tiến độ tiếp tục, làm quiz, nộp tệp đang chờ chấm |
| Learner | `demo_learner2` | Kiểm tra quyền riêng tư, lịch sử quiz và bài tệp đã có điểm |

Đây là mật khẩu dùng cho môi trường demo cục bộ. Không dùng các tài khoản này trong môi trường production.

## Dữ liệu được tạo

- Khóa published với hai chương; có bài text, video, tài liệu nhiều trang, tệp đính kèm và một bài chưa bắt đầu.
- Khóa draft riêng để kiểm tra phân quyền và khóa tiên quyết.
- Learner chính có enrollment, một bài hoàn thành, video đang ở giây 74 và tài liệu đang ở trang 2.
- Quiz 4 câu, thời lượng 12 phút, deadline 14 ngày tới; learner phụ có kết quả mẫu 7.5/10. Learner chính có thể nộp quiz để kiểm tra tính điểm và lịch sử.
- Bài tệp đang mở với submission chờ chấm, submission đã chấm 8.5/10 kèm phản hồi và bài đã quá hạn.
- Bình luận, báo cáo, thông báo và một admin log mẫu.

Sau khi seed, mở khóa học chính từ trang catalog hoặc `/courses/<id>` (ID được in ra khi command chạy). Quản lý khóa học nằm tại `/instructor/courses/<id>/manage`.