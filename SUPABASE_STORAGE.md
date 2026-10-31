# Hướng dẫn dùng Supabase Storage cho LingoSphere

Hướng dẫn này cấu hình Supabase Storage để lưu slide, tài liệu bài tập, tệp đính kèm câu hỏi và bài nộp của học viên. Supabase Storage chỉ lưu nội dung tệp; database PostgreSQL của ứng dụng vẫn giữ nguyên.

Bucket phải để **Private**. Backend sẽ tạo URL có chữ ký, hết hạn sau 5 phút, khi API trả về tệp cho người dùng đã được ứng dụng cấp quyền. Không đặt S3 secret key hoặc `service_role` key trong frontend, Git, hay tin nhắn.

## 1. Tạo project và bucket

1. Đăng nhập tại [Supabase Dashboard](https://supabase.com/dashboard) và chọn **New project**.
2. Chọn organization, nhập tên project và đặt database password. Lưu password ở nơi an toàn; không dùng password này làm S3 secret key.
3. Chọn region phù hợp, rồi tạo project. Chờ trạng thái project sẵn sàng.
4. Mở project, vào **Storage** và chọn **New bucket**.
5. Đặt tên bucket, ví dụ `lingosphere-media`. Tắt **Public bucket** để bucket ở chế độ riêng tư, rồi tạo bucket.
6. Giữ nguyên tên bucket vì backend sẽ dùng đúng tên này trong cấu hình.

## 2. Lấy thông tin S3 của Supabase

1. Trong Supabase Dashboard, mở **Storage** → **S3 Connection** (hoặc mục S3 nằm trong **Storage Settings**).
2. Tại trang cấu hình S3, tạo một cặp access key nếu project chưa có:
   - **Access Key ID**
   - **Secret Access Key**
3. Sao chép endpoint và region mà chính trang S3 của project hiển thị. Không tự đoán region.
4. Endpoint thường có dạng:

   ```text
   https://<project-ref>.storage.supabase.co/storage/v1/s3
   ```

   Dùng nguyên endpoint hiện trên trang S3 nếu khác ví dụ. Region cũng phải khớp giá trị của project.
5. Lưu cả hai access key ngay lúc tạo. Secret key là thông tin nhạy cảm; không chia sẻ hoặc đưa vào source code.

**Lưu ý quyền:** Supabase S3 access key có quyền rộng trên Storage và bỏ qua Storage RLS. Chỉ cấu hình chúng ở backend (local/Render), không đưa vào frontend. Bucket vẫn để private để người dùng không thể đọc tệp bằng URL công khai.

## 3. Cấu hình môi trường local

Ở thư mục gốc dự án, tạo hoặc cập nhật file `.env` (cùng cấp `docker-compose.yml`). Không sửa `.env.example` để điền secret thật; file `.env` đã được Git bỏ qua.

Thêm các dòng sau và thay giá trị mẫu bằng thông tin lấy từ Supabase:

```dotenv
SUPABASE_STORAGE_ENABLED=true
SUPABASE_STORAGE_BUCKET=lingosphere-media
SUPABASE_STORAGE_ENDPOINT_URL=https://<project-ref>.storage.supabase.co/storage/v1/s3
SUPABASE_STORAGE_REGION=<region-trong-trang-s3>
SUPABASE_STORAGE_ACCESS_KEY_ID=<access-key-id>
SUPABASE_STORAGE_SECRET_ACCESS_KEY=<secret-access-key>
```

`SUPABASE_STORAGE_BUCKET` phải giống hệt tên bucket đã tạo. Không thêm dấu nháy quanh giá trị nếu không cần và không để dấu cách ở đầu/cuối dòng.

`docker-compose.yml` chuyển các biến trên vào container backend. Khởi động hoặc khởi động lại backend để áp dụng:

```powershell
docker compose up -d --build backend
```

Kiểm tra cấu hình Django:

```powershell
docker compose exec backend python manage.py check
```

Nếu thiếu biến hoặc endpoint không dùng HTTPS, backend báo lỗi cấu hình rõ ràng. Khi `SUPABASE_STORAGE_ENABLED=false`, local tiếp tục dùng `backend/media` như trước.

## 4. Chuyển các tệp đang có từ local

Database chỉ lưu đường dẫn/tên file, không chứa nội dung file. Vì vậy, cần tải các tệp trong `backend/media` lên đúng bucket trước khi các bản ghi cũ có thể mở file trên Render.

Sau khi cấu hình `.env` và chạy lại backend, thực hiện:

```powershell
docker compose exec backend python manage.py sync_media_to_supabase
```

Lệnh này:

- duyệt file bên trong `backend/media`;
- giữ nguyên đường dẫn tương đối, ví dụ `lessons/files/slide_test.pdf`;
- bỏ qua object đã có cùng đường dẫn trong bucket;
- **không xóa** hoặc sửa file local.

Chỉ chạy một lần cho mỗi đợt file mới; có thể chạy lại an toàn để đồng bộ file mới. Nếu file nguồn không còn trong `backend/media`, lệnh không thể khôi phục file đó.

## 5. Cấu hình Render

1. Mở **Render Dashboard** → chọn dịch vụ backend của LingoSphere.
2. Mở **Environment** → **Add Environment Variable**.
3. Thêm đủ sáu biến, dùng **cùng bucket, endpoint, region, Access Key ID và Secret Access Key** như local:

   | Key | Giá trị |
   |---|---|
   | `SUPABASE_STORAGE_ENABLED` | `true` |
   | `SUPABASE_STORAGE_BUCKET` | Tên bucket, ví dụ `lingosphere-media` |
   | `SUPABASE_STORAGE_ENDPOINT_URL` | Endpoint S3 của project |
   | `SUPABASE_STORAGE_REGION` | Region hiển thị trong S3 settings |
   | `SUPABASE_STORAGE_ACCESS_KEY_ID` | S3 Access Key ID |
   | `SUPABASE_STORAGE_SECRET_ACCESS_KEY` | S3 Secret Access Key |

4. Lưu biến môi trường và deploy backend sau khi các thay đổi code đã được push lên nhánh mà Render theo dõi (thường là `main`).
5. Kiểm tra Render **Logs** để chắc chắn backend khởi động và không báo lỗi cấu hình.

Không cần thay `DATABASE_URL` hoặc chuyển database sang Supabase. Tích hợp này chỉ chuyển file media sang Supabase Storage.

## 6. Kiểm tra sau khi triển khai

1. Đăng nhập bằng tài khoản giảng viên, tải một slide mới lên bài học.
2. Mở bài học bằng tài khoản học viên đã đăng ký khóa học và kiểm tra slide mở được.
3. Thử nộp một file bài tập; sau đó kiểm tra giảng viên có mở được file để chấm không.
4. Trong Supabase Dashboard → **Storage** → bucket vừa tạo, kiểm tra object xuất hiện nhưng bucket vẫn ở chế độ private.
5. Khi mở URL file, URL phải có query chữ ký và chỉ dùng được trong thời hạn ngắn. Không chia sẻ URL này lâu dài.

Route demo `/media/lessons/files/slide_test.pdf` cũng dùng storage đã cấu hình; cần đồng bộ file này lên bucket như ở bước 4 để route mở được trên Render.

## Giới hạn gói Free

Theo [bảng giá Supabase](https://supabase.com/pricing), gói Free hiện có **1 GB file storage**. Project Free có thể bị tạm dừng sau một tuần không hoạt động; trong thời gian project bị tạm dừng, các file có thể không truy cập được cho đến khi project được khôi phục. Kiểm tra giới hạn mới nhất trên trang giá trước khi dùng cho dữ liệu cần lưu lâu dài.
