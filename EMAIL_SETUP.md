# Cấu hình gửi email OTP

LingoSphere giữ nguyên luồng OTP đăng ký và đặt lại mật khẩu ở local lẫn bản deploy.

- **Local:** tiếp tục dùng Gmail SMTP như hiện tại.
- **Render Free:** dùng Mailjet Send API qua HTTPS. Render Free chặn SMTP outbound ở cổng 25, 465 và 587, vì vậy Gmail SMTP không thể kết nối trực tiếp từ Web Service Free. Xem [giới hạn Render Free](https://render.com/docs/free#outbound-smtp-restrictions).

Gói Mailjet Free hiện có **6.000 email/tháng**, tối đa **200 email/ngày**, có API. Xem [bảng giá chính thức](https://www.mailjet.com/pricing/). Các giới hạn có thể thay đổi theo thời gian.

## A. Tạo tài khoản Mailjet và xác minh người gửi

1. Tạo tài khoản tại [Mailjet](https://www.mailjet.com/), chọn gói Free nếu được hỏi.
2. Xác minh email đăng ký tài khoản và hoàn tất các bước xác thực tài khoản Mailjet yêu cầu.
3. Trong Mailjet, mở trang **Senders & Domains** (có thể nằm dưới **Account settings**).
4. Chọn thêm sender, nhập tên hiển thị (ví dụ `LingoSphere`) và địa chỉ email mà bạn có thể mở để xác nhận.
5. Mở email xác nhận Mailjet gửi tới địa chỉ đó và bấm xác minh. Sender phải hiện trạng thái đã xác minh/active trước khi API chấp nhận gửi.
6. Nếu Mailjet yêu cầu xác minh domain hoặc sender bổ sung cho tài khoản của bạn, làm theo Dashboard. Không giả mạo địa chỉ `@gmail.com` hoặc đặt địa chỉ chưa xác minh làm người gửi. Email học viên nhận OTP vẫn có thể là Gmail hay nhà cung cấp khác.

Mailjet yêu cầu trường `From.Email` là sender đã được xác minh và đang hoạt động. Xem [tài liệu Send API v3.1](https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email).

## B. Tạo API credentials

1. Mở trang **Account settings → API keys** trong Mailjet.
2. Dùng API key của tài khoản chính hoặc tạo API key riêng cho ứng dụng nếu Dashboard cho phép.
3. Lấy hai giá trị:
   - **API Key** (public key) — dùng cho `MAILJET_API_KEY`.
   - **Secret Key** (private key) — dùng cho `MAILJET_SECRET_KEY`.
4. Sao chép Secret Key khi Mailjet hiển thị. Nếu không còn xem được, tạo/đổi key theo giao diện Mailjet.

Hai key này được gửi từ backend tới Mailjet bằng HTTP Basic Authentication qua HTTPS. **Không đặt chúng trong frontend, biến `VITE_*`, Git, ảnh chụp màn hình hoặc tin nhắn.**

## C. Cấu hình Render

1. Mở **Render Dashboard → backend Web Service → Environment**.
2. Thêm hoặc cập nhật các biến sau:

   | Key | Giá trị |
   |---|---|
   | `EMAIL_BACKEND` | `lms_core.email_backends.MailjetEmailBackend` |
   | `MAILJET_API_KEY` | API Key từ Mailjet |
   | `MAILJET_SECRET_KEY` | Secret Key từ Mailjet |
   | `DEFAULT_FROM_EMAIL` | Địa chỉ sender đã xác minh trong Mailjet |

3. Không cần xoá `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_USE_SSL`, `EMAIL_HOST_USER` hoặc `EMAIL_HOST_PASSWORD`; Mailjet API backend không dùng chúng. Local Gmail SMTP vẫn dùng các biến Gmail này.
4. Lưu Environment. Sau khi code Mailjet được push lên nhánh Render theo dõi, deploy backend.
5. Mở Render **Logs** và xác nhận backend khởi động bình thường.

## D. Cấu hình local (tuỳ chọn)

Mặc định local tiếp tục dùng Gmail SMTP. Nếu muốn thử Mailjet ở local, thêm vào `.env` tại thư mục gốc:

```dotenv
EMAIL_BACKEND=lms_core.email_backends.MailjetEmailBackend
MAILJET_API_KEY=<api-key>
MAILJET_SECRET_KEY=<secret-key>
DEFAULT_FROM_EMAIL=<sender-da-xac-minh>
```

Sau đó chạy lại backend:

```powershell
docker compose up -d --build backend
```

Để quay lại Gmail SMTP local, đặt `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`.

## E. Kiểm tra gửi OTP

1. Trên website đã deploy, thử đăng ký với một email bạn có thể truy cập, chưa được dùng trong hệ thống.
2. Kiểm tra Inbox và cả Spam/Junk.
3. Thử nhập OTP để hoàn tất đăng ký. Có thể thử luồng quên mật khẩu với tài khoản demo không chứa dữ liệu nhạy cảm.
4. Nếu API trả lỗi 503, mở Render **Logs** để xem backend, loại lỗi và mã HTTP Mailjet. Log không ghi nội dung OTP, email người nhận hoặc API secret.
5. Trong Mailjet, xem **Transactional → Statistics/Email activity** để biết Mailjet đã nhận và xử lý yêu cầu hay chưa.

Một yêu cầu API được chấp nhận chưa đảm bảo thư vào Inbox: Mailjet hoặc nhà cung cấp người nhận vẫn có thể trì hoãn, lọc Spam, hoặc từ chối địa chỉ.

## Giới hạn và lưu ý

- Gói Free có giới hạn theo ngày và tháng; kiểm tra quota mới nhất trên [trang giá Mailjet](https://www.mailjet.com/pricing/).
- Tài khoản mới có thể cần hoàn tất xét duyệt/xác minh trước khi gửi thư giao dịch.
- Dùng sender đã xác minh. Xác thực domain với SPF/DKIM là hướng tốt hơn cho độ tin cậy nếu bạn có domain riêng; làm theo hướng dẫn DNS Mailjet khi Dashboard yêu cầu.
- Nếu thiếu credentials, sender chưa xác minh, vượt quota hoặc API từ chối, backend phải trả lỗi gửi OTP thay vì báo gửi thành công.
