# LingoSphere LMS - Feature QA Checklist

> Mục đích: kiểm tra từng thao tác nhỏ bằng trình duyệt/API trước khi nghiệm thu. Chỉ đánh dấu `[x]` sau khi đã chạy và xác nhận kết quả; checklist không khẳng định các mục đã được kiểm thử thủ công.

## 0. Chuẩn bị

- [x] Tạo dữ liệu mẫu bằng `docker compose exec backend python manage.py seed_demo_data` (tài khoản và chi tiết nằm trong `DEMO_DATA.md`).

## 1. Khách truy cập và xác thực

- [X] Danh sách khóa học chỉ hiển thị khóa học đã published.
- [X] Tìm khóa học theo một phần tiêu đề.
- [X] Tìm khóa học theo một từ trong mô tả.
- [X] Xóa từ khóa tìm kiếm và xác nhận danh sách ban đầu trở lại.
- [X] Sắp xếp khóa học mới nhất/cũ nhất.
- [X] Sắp xếp tên A-Z/Z-A.
- [X] Chuyển trang danh sách; nút Trước/Trang sau disable đúng ở biên.
- [X] Mở URL trực tiếp của khóa draft khi chưa đăng nhập; API/UI không tiết lộ nội dung. 
- [X] Đăng nhập sai mật khẩu; hiện lỗi và không tạo trạng thái đăng nhập.
- [X] Đăng nhập đúng learner; chuyển đến khu vực learner phù hợp.
- [X] Đăng nhập đúng instructor; menu quản lý khóa học và trang tạo khóa học truy cập được.
- [X] Đăng nhập admin; trang quản trị truy cập được.
- [X] Refresh browser sau đăng nhập; phiên hợp lệ được khôi phục.
- [X] Đăng xuất; token/profile biến mất và route được bảo vệ không còn truy cập được.
- [X] Thử mở `/admin` bằng learner/instructor; bị từ chối.
- [X] Thử mở `/instructor/courses` bằng learner; bị từ chối.
- [X] Mở URL không tồn tại; trang 404 hiển thị.
- [x] Đăng ký learner và kiểm tra xác minh OTP email.
- [x] Đăng ký instructor và kiểm tra xác minh OTP email.
- [X] Nhập OTP sai/hết hạn; hiện lỗi rõ ràng, không tạo tài khoản.
- [X] Yêu cầu OTP liên tiếp trong thời gian giới hạn; server áp dụng giới hạn gửi lại.
- [X] Yêu cầu khôi phục mật khẩu cho email hợp lệ và hoàn tất bằng liên kết/token.
- [X] Đặt mật khẩu mới yếu; server từ chối và giữ nguyên mật khẩu cũ.
- [X] Đặt mật khẩu mới hợp lệ; đăng nhập bằng mật khẩu mới.
- [X] Thử Google login khi đã cấu hình client ID; hoàn tất callback thành công.
- [X] Thử Google login với token sai; UI báo lỗi, token không bị lưu.

## 2. Học viên - khóa học và nội dung

- [X] Mở `Khóa học của tôi`; danh sách ghi danh tải đúng.
- [X] Tìm một khóa theo tên trong `Khóa học của tôi`.
- [X] Tìm chuỗi không khớp; trạng thái rỗng hiển thị.
- [X] Xóa tìm kiếm; toàn bộ khóa đã tham gia trở lại.
- [X] Bấm “Tiếp tục học”; mở đúng khóa học. 
- [X] Rời khóa học và xác nhận; khóa bị xóa khỏi danh sách.
- [X] Hủy xác nhận rời khóa; enrollment không thay đổi.
- [X] Ghi danh khóa published; enrollment xuất hiện trong danh sách cá nhân.
- [X] Ghi danh khóa đã tham gia lần nữa; không tạo enrollment trùng.
- [X] Ghi danh khóa draft/unavailable như learner; server từ chối nếu không có quyền hợp lệ.
- [X] Mở một chương; danh sách bài học hiện theo thứ tự.
- [X] Mở bài học dạng text và xem nội dung.
- [X] Mở bài học có video; media hiển thị/phát được.
- [X] Mở bài học có slide/tài liệu; liên kết mở được.
- [X] Chọn trang tài liệu kế tiếp/trước; trang cập nhật.
- [X] Đánh dấu hoàn thành bài học; trạng thái và tiến độ cập nhật.
- [X] Refresh khóa học; trạng thái hoàn thành/vị trí học được khôi phục.
- [X] Lưu tiến độ video; mở lại bài học và xác nhận vị trí được khôi phục nếu player hỗ trợ.
- [X] Gửi bình luận bài học; bình luận mới xuất hiện.
- [X] Báo cáo bình luận; phản hồi thành công và không gửi lý do rỗng.
- [X] Chưa ghi danh; nội dung hạn chế không thể truy cập hoặc ghi tiến độ.

## 3. Học viên - bài tập và đánh giá

- [X] Tab Bài tập tải bài tập của khóa học đã ghi danh.
- [X] Tab “Điểm số & Lịch sử làm bài” hiển thị trạng thái chưa nộp khi chưa làm.
- [X] Bắt đầu quiz; tiêu đề, câu hỏi và bốn lựa chọn A/B/C/D đúng.
- [X] Chọn đáp án; chỉ một radio được chọn cho mỗi câu.
- [X] Bộ đếm giảm theo thời gian và hiển thị đúng mm:ss.
- [X] Còn câu chưa trả lời; nộp thủ công yêu cầu xác nhận.
- [X] Nộp quiz; điểm và số câu đúng hiện trong modal.
- [X] Hết thời gian; bài tự động gửi một lần, không gửi trùng.
- [X] Đóng modal; lịch sử được cập nhật với điểm quiz vừa làm.
- [X] Hạn quiz đã qua; nút làm bài bị disable.
- [X] Bài tập tệp hiển thị hạn nộp theo múi giờ mong muốn.
- [X] Chọn tệp hợp lệ; tên tệp được hiển thị trước khi gửi.
- [X] Bấm “Tải lên”; API nhận multipart và hiện toast thành công.
- [X] Upload lỗi; thông báo lỗi rõ ràng và tệp đã chọn vẫn còn để thử lại.
- [X] Quá hạn; nút chọn tệp/tải lên bị disable và API cũng từ chối request.
- [-] Tab lịch sử hiển thị tệp đã nộp, thời gian nộp, điểm và phản hồi.
- [-] Chưa được chấm; lịch sử hiển thị “Chưa chấm”.
- [X] Đăng nhập learner khác; không xem được bài nộp/điểm của người khác.

## 4. Giảng viên - tạo và quản lý khóa học

- [X] Tạo khóa học với tiêu đề/mô tả hợp lệ.
- [X] Bỏ trống tiêu đề hoặc mô tả; UI/API từ chối.
- [X] Chọn khóa tiên quyết; giá trị được lưu và hiển thị lại.
- [X] Không cho khóa học tự làm tiên quyết của chính nó.
- [X] Lưu khóa ở trạng thái draft; khách không xem được.
- [X] Publish khóa; khóa xuất hiện trong catalog.
- [X] Tạo chương; chương xuất hiện đúng thứ tự.
- [X] Sửa tên/thứ tự chương; dữ liệu được cập nhật.
- [X] Xóa chương; xác nhận cảnh báo và kiểm tra bài học liên quan.
- [X] Tạo bài học text.
- [X] Tạo bài học video với URL hợp lệ.
- [X] Tạo bài học slide/tài liệu và upload tệp hợp lệ.
- [X] Upload tệp vượt giới hạn; server từ chối và UI báo lỗi.
- [X] Sửa bài học; nội dung/link/tệp cập nhật đúng.
- [X] Xóa bài học; xác nhận và kiểm tra danh sách.
- [X] Mở tab danh sách học viên/tiến độ; học viên và trạng thái tải đúng.
- [X] Gửi thông báo lớp học; học viên đã ghi danh nhận thông báo.
- [X] Instructor khác không sửa/xóa khóa học không thuộc sở hữu.
- [X] Instructor khác không thêm chương, bài học, bài tập hoặc chấm bài vào khóa này (API regression tests).

## 5. Giảng viên - bài tập và chấm điểm

- [X] Mở tab “Bài tập & Chấm điểm” trong quản lý khóa học.
- [X] Tạo bài trắc nghiệm với tiêu đề, mô tả và thời lượng.
- [X] Thêm/xóa động câu hỏi.
- [X] Nhập đủ bốn lựa chọn và chọn đúng một đáp án đúng.
- [X] Quiz không có câu hỏi; backend từ chối tạo.
- [X] Đáp án đúng không thuộc A/B/C/D; backend từ chối.
- [X] Tạo bài tập nộp tệp với hạn nộp.
- [X] Chọn loại bài tập; trường thời lượng/câu hỏi chỉ hiện cho quiz.
- [X] Bảng chấm phân biệt quiz tự động chấm và bài tệp cần chấm.
- [X] Quiz có bài nộp; học viên, thời gian và điểm tự động hiển thị.
- [X] Bài tệp có bài nộp; tên học viên và thời gian nộp hiển thị.
- [X] Bấm “Tải bài làm về”; nội dung tệp mở/tải đúng.
- [X] Nhập điểm 0–10 và phản hồi; lưu thành công.
- [X] Nhập điểm âm/trên 10/không phải số; server từ chối.
- [X] Sau khi chấm, learner nhìn thấy điểm và phản hồi mới.
- [X] Learner nhận thông báo khi bài được chấm.
- [X] Không có bài nộp; bảng chấm hiển thị trạng thái rỗng.

## 6. Quản trị viên

- [X] Dashboard tải số liệu thống kê.
- [X] Danh sách người dùng tải và tìm kiếm theo tên/email.
- [X] Lọc người dùng theo learner/instructor/admin.
- [X] Khóa/mở tài khoản; trạng thái và nhật ký cập nhật.
- [X] Admin không thể tự khóa hoặc mở khóa tài khoản (API regression test).
- [X] Admin không thể xóa chính tài khoản đang dùng.
- [X] Xóa tài khoản khác; xác nhận tác động lên dữ liệu liên quan.
- [X] Danh sách toàn bộ khóa học tải.
- [X] Tìm khóa theo tiêu đề/giảng viên.
- [X] Publish/unpublish khóa học; catalog phản ánh trạng thái mới.
- [X] Xóa khóa; UI yêu cầu xác nhận và dữ liệu bị xóa đúng.
- [X] Xem báo cáo; đánh dấu đã xử lý/chưa xử lý.
- [X] Xem nhật ký admin và xác nhận người thực hiện/thời gian.
- [X] Learner/instructor gọi API admin; server trả 403.

## 7. Phi chức năng và hồi quy

- [ ] Mở các trang chính ở desktop và mobile; không có tràn ngang ngoài ý muốn.
- [ ] Dùng bàn phím để đi qua form, tabs, dialog và nút hành động.
- [ ] Radio/select/input có label hoặc tên truy cập được.
- [ ] Toast hiển thị cho thành công/lỗi quan trọng và tự đóng đúng lúc.
- [ ] API lỗi/mất mạng; UI không mắc kẹt ở trạng thái loading.
- [ ] Không có lỗi uncaught trong console ở các luồng chính.
- [X] `cd backend; python manage.py check` hoàn tất không lỗi.
- [X] `cd backend; python manage.py makemigrations --check --dry-run` không phát hiện migration thiếu.
- [X] `cd backend; python manage.py test lms_core` chạy với PostgreSQL trong Docker Compose; 36 test passed.
- [X] `cd frontend; npm run lint` không có lỗi lint mới (còn các warning đã tồn tại).
- [X] `cd frontend; npm run build` hoàn tất thành công.

## Yêu cầu bổ sung và trạng thái triển khai

Các mục dưới đây đã được cập nhật trong code. Những thao tác UI được giữ ở trạng thái chưa xác nhận cho đến khi chạy thử trực tiếp trên trình duyệt.

| Yêu cầu | Cập nhật | Xác minh |
|---|---|---|
| Instructor quản lý khóa draft của chính mình; không xem trang quản lý khóa của instructor khác | Thêm danh sách khóa theo owner, endpoint chi tiết quản lý chỉ trả khóa của owner/admin | API regression tests |
| Chọn/xóa nhiều khóa tiên quyết | Dùng checkbox picker có thể chọn và bỏ chọn trong trang tạo và chỉnh sửa | Chưa xác nhận thủ công trên trình duyệt |
| Mật khẩu mạnh hơn | Tối thiểu 10 ký tự, áp dụng ở server và các form tạo/đặt lại mật khẩu | API tests passed |
| Nội dung slide | Trang bài học riêng hỗ trợ liên kết slide, tài liệu đính kèm và phân trang; có test upload/page API | API test passed; chưa kiểm tra mở tài liệu trên trình duyệt |
| Đề cương khóa học, bài học và bài tập | Đề cương chỉ liệt kê chương/nội dung; bài học và bài tập mở trên route riêng; bài tập gắn chương nằm ngang cấp bài học | Build passed; chưa xác nhận thủ công |
| Nộp tệp | Trang riêng, hiển thị tên/dung lượng, giới hạn 20 MB, bài nộp hiện tại và thay thế/bỏ tệp đã chọn | Build passed; chưa xác nhận thủ công |
| Ẩn ID khóa học | Gỡ ID khỏi các giao diện danh sách, trang quản lý, tạo khóa và hồ sơ | Source/build verified |
| Thông báo ghi rõ khóa học | API trả `course_title`; kênh thông báo và menu notification hiển thị tiêu đề | Django check/build passed |
| Tách trang chấm điểm | Quiz có bảng học viên/câu hỏi/đáp án/đúng-sai; bài tệp có học viên/tệp mới nhất/điểm; bỏ lưu phản hồi | API tests/build passed |
| Admin không tự khóa/mở khóa | Server từ chối toggle tài khoản hiện tại và UI vô hiệu hóa nút tương ứng | API regression test passed |
| Nội dung bài học nhiều trang | Instructor tạo/sửa trang nội dung; learner khôi phục trang đã lưu; thay đổi trang được thông báo | API regression test/build passed; chưa xác nhận thủ công |
| Slide và học liệu | PDF/slide được nhúng trong trang bài học, phân trang lưu tiến độ và vẫn có liên kết tải/mở ngoài | API regression test/build passed; chưa xác nhận thủ công |
| Đề bài và đính kèm câu hỏi | Assignment nhận tệp đề; câu hỏi quiz có tệp/hình ảnh; learner xem được nội dung | API regression tests/build passed; chưa xác nhận thủ công |
| Nháp, lịch mở và deadline giờ Việt Nam | Assignment có thể lưu nháp/lên lịch, tự mở theo thời gian; deadline quick-pick 10/15/20/30 phút dùng UTC+7 | API regression test/build passed; chưa xác nhận thủ công |
| Chỉnh sửa quiz và cập nhật điểm | Câu hỏi/đáp án sửa được sau khi tạo; submission được tính lại theo bộ câu hỏi hiện hành | API regression test passed |
| Thông báo cập nhật có điều hướng | Course/module/lesson/assignment/điểm có target; instructor mặc định gửi và có thể tắt với lesson/assignment/course updates | API regression tests/build passed; chưa xác nhận thủ công |
| AI | Đã loại khỏi phạm vi theo quyết định giảm tải; không triển khai AI/RAG | — |

## Ghi nhận lỗi đã xử lý

| Ngày | Vấn đề | Vai trò bị ảnh hưởng | Nguyên nhân | Xử lý |
|---|---|---|---|---|
| 2026-10-24 | Course list/detail trả HTTP 500 sau thay đổi outline | Instructor và learner | Migration `0009_assignment_module_submission_answers` chưa áp dụng; outline mới truy vấn `Assignment.module_id` không tồn tại trong DB. Không phát hiện class trùng tên. | Backend log xác nhận cột thiếu; đã áp migration, thêm API list riêng cho instructor và chạy 31 test thành công |

Tài khoản admin duy nhất có `is_active=False` trong DB local (`demo_admin`) đã được kích hoạt lại; không thay đổi mật khẩu.