# HƯỚNG DẪN TẠO CHỨNG CHỈ TỰ KÝ (SELF-SIGNED SSL CERTIFICATE)

Thư mục này dùng để lưu trữ chứng chỉ SSL phục vụ Nginx HTTPS trong môi trường phát triển cục bộ và demo đồ án.

## 1. Lưu ý quan trọng về bảo mật
- File khóa riêng tư `*.key` đã được cấu hình trong `.gitignore` để **TUYỆT ĐỐI KHÔNG COMMIT LÊN GITHUB**.
- Chỉ file hướng dẫn `README.md` và chứng chỉ công khai `*.crt` (nếu cần) được phép quản lý.

## 2. Lệnh tự sinh chứng chỉ SSL (OpenSSL)
Nếu clone repository về máy tính mới hoặc chưa có chứng chỉ, hãy chạy lệnh sau trong PowerShell:

```powershell
# Chạy từ thư mục gốc của dự án:
& "F:\Git\usr\bin\openssl.exe" req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout "certs/server.key" -out "certs/server.crt" `
  -subj "/C=VN/ST=ThaiNguyen/L=ThaiNguyen/O=ICTU/OU=DevOps/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

*(Hoặc dùng `openssl` nếu đã cài đặt sẵn trong PATH)*.

## 3. Các file được sinh ra
- `certs/server.crt`: Chứng chỉ công khai (Certificate).
- `certs/server.key`: Khóa bí mật (Private Key) dùng cho Nginx.
