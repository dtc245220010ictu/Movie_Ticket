-- ========================================================
-- KỊCH BẢN KHỞI TẠO CƠ SỞ DỮ LIỆU CINEMA BOOKING (ĐỀ 11)
-- ========================================================

CREATE DATABASE IF NOT EXISTS cinema_booking 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE cinema_booking;

-- Ép client charset = utf8mb4 TRƯỚC khi seed (chống mojibake nếu mysql client
-- chạy với latin1 mặc định — byte UTF-8 sẽ bị đọc nhầm thành CP1252 rồi encode lại)
SET NAMES utf8mb4;

-- 1. Bảng danh sách phim (movies)
CREATE TABLE IF NOT EXISTS movies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    duration INT NOT NULL COMMENT 'Thời lượng tính bằng phút',
    description TEXT,
    poster_url VARCHAR(500) NOT NULL,
    trailer_url VARCHAR(500) DEFAULT '',
    rating VARCHAR(10) DEFAULT 'P' COMMENT 'Phân loại độ tuổi (P, C13, C16, C18)',
    status ENUM('now_showing', 'coming_soon') NOT NULL DEFAULT 'now_showing',
    release_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng phòng chiếu (rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    screen_type VARCHAR(50) DEFAULT 'IMAX Laser 3D',
    capacity INT NOT NULL DEFAULT 40,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng danh sách ghế trong phòng (seats)
CREATE TABLE IF NOT EXISTS seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    seat_code VARCHAR(10) NOT NULL COMMENT 'Ví dụ: A1, A2, B1...',
    seat_type ENUM('standard', 'vip') NOT NULL DEFAULT 'standard',
    seat_row CHAR(1) NOT NULL,
    seat_number INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT uq_room_seat UNIQUE (room_id, seat_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng suất chiếu (showtimes)
CREATE TABLE IF NOT EXISTS showtimes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id INT NOT NULL,
    room_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 85000.00 COMMENT 'Giá vé cơ bản (VND)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    INDEX idx_showtime_movie (movie_id),
    INDEX idx_showtime_start (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bảng đơn đặt vé (bookings)
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(32) NOT NULL UNIQUE,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_booking_status (status),
    INDEX idx_booking_code (booking_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bảng chi tiết ghế đã đặt theo đơn (booking_seats)
-- RÀNG BUỘC THEN CHỐT: uq_showtime_seat ngăn chặn cùng 1 ghế bị đặt 2 lần trong 1 suất chiếu
CREATE TABLE IF NOT EXISTS booking_seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    showtime_id INT NOT NULL,
    seat_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
    CONSTRAINT uq_showtime_seat UNIQUE (showtime_id, seat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bảng giao dịch thanh toán (payments)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    payment_code VARCHAR(64) NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(50) NOT NULL DEFAULT 'MOCK_QR_BANKING',
    status ENUM('success', 'failed', 'refunded') NOT NULL DEFAULT 'success',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- PHÂN QUYỀN BẢO MẬT (HARDENING DATABASE)
-- ========================================================
-- Tạo hoặc cập nhật user ứng dụng với quyền tối thiểu (không cấp DROP, ALTER, GRANT)
CREATE USER IF NOT EXISTS 'cinema_user'@'%' IDENTIFIED BY 'CinemaSecurePass2026!';
GRANT SELECT, INSERT, UPDATE, DELETE ON cinema_booking.* TO 'cinema_user'@'%';

-- Tạo user phục vụ cho MySQL Prometheus Exporter (Monitor Phase)
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY 'ExporterSecurePass2026!' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';

FLUSH PRIVILEGES;

-- ========================================================
-- NẠP DỮ LIỆU MẪU (SEED DATA CHO DEMO)
-- ========================================================

-- Thêm phòng chiếu
INSERT INTO rooms (id, name, screen_type, capacity) VALUES
(1, 'Phòng Chiếu 01 - IMAX Laser', 'IMAX Laser High-Definition', 40),
(2, 'Phòng Chiếu 02 - Dolby Atmos', 'Dolby Surround 7.1', 30)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Thêm ghế cho Phòng 1 (40 ghế: Hàng A, B là Standard; Hàng C, D là VIP. Mỗi hàng 10 ghế)
INSERT IGNORE INTO seats (room_id, seat_code, seat_type, seat_row, seat_number) VALUES
-- Hàng A (Standard)
(1, 'A1', 'standard', 'A', 1), (1, 'A2', 'standard', 'A', 2), (1, 'A3', 'standard', 'A', 3), (1, 'A4', 'standard', 'A', 4), (1, 'A5', 'standard', 'A', 5),
(1, 'A6', 'standard', 'A', 6), (1, 'A7', 'standard', 'A', 7), (1, 'A8', 'standard', 'A', 8), (1, 'A9', 'standard', 'A', 9), (1, 'A10', 'standard', 'A', 10),
-- Hàng B (Standard)
(1, 'B1', 'standard', 'B', 1), (1, 'B2', 'standard', 'B', 2), (1, 'B3', 'standard', 'B', 3), (1, 'B4', 'standard', 'B', 4), (1, 'B5', 'standard', 'B', 5),
(1, 'B6', 'standard', 'B', 6), (1, 'B7', 'standard', 'B', 7), (1, 'B8', 'standard', 'B', 8), (1, 'B9', 'standard', 'B', 9), (1, 'B10', 'standard', 'B', 10),
-- Hàng C (VIP - Ghế trung tâm đẹp nhất)
(1, 'C1', 'vip', 'C', 1), (1, 'C2', 'vip', 'C', 2), (1, 'C3', 'vip', 'C', 3), (1, 'C4', 'vip', 'C', 4), (1, 'C5', 'vip', 'C', 5),
(1, 'C6', 'vip', 'C', 6), (1, 'C7', 'vip', 'C', 7), (1, 'C8', 'vip', 'C', 8), (1, 'C9', 'vip', 'C', 9), (1, 'C10', 'vip', 'C', 10),
-- Hàng D (VIP)
(1, 'D1', 'vip', 'D', 1), (1, 'D2', 'vip', 'D', 2), (1, 'D3', 'vip', 'D', 3), (1, 'D4', 'vip', 'D', 4), (1, 'D5', 'vip', 'D', 5),
(1, 'D6', 'vip', 'D', 6), (1, 'D7', 'vip', 'D', 7), (1, 'D8', 'vip', 'D', 8), (1, 'D9', 'vip', 'D', 9), (1, 'D10', 'vip', 'D', 10);

-- Thêm ghế cho Phòng 2 (30 ghế: Hàng A standard, B standard, C vip. Mỗi hàng 10 ghế)
INSERT IGNORE INTO seats (room_id, seat_code, seat_type, seat_row, seat_number) VALUES
(2, 'A1', 'standard', 'A', 1), (2, 'A2', 'standard', 'A', 2), (2, 'A3', 'standard', 'A', 3), (2, 'A4', 'standard', 'A', 4), (2, 'A5', 'standard', 'A', 5),
(2, 'A6', 'standard', 'A', 6), (2, 'A7', 'standard', 'A', 7), (2, 'A8', 'standard', 'A', 8), (2, 'A9', 'standard', 'A', 9), (2, 'A10', 'standard', 'A', 10),
(2, 'B1', 'standard', 'B', 1), (2, 'B2', 'standard', 'B', 2), (2, 'B3', 'standard', 'B', 3), (2, 'B4', 'standard', 'B', 4), (2, 'B5', 'standard', 'B', 5),
(2, 'B6', 'standard', 'B', 6), (2, 'B7', 'standard', 'B', 7), (2, 'B8', 'standard', 'B', 8), (2, 'B9', 'standard', 'B', 9), (2, 'B10', 'standard', 'B', 10),
(2, 'C1', 'vip', 'C', 1), (2, 'C2', 'vip', 'C', 2), (2, 'C3', 'vip', 'C', 3), (2, 'C4', 'vip', 'C', 4), (2, 'C5', 'vip', 'C', 5),
(2, 'C6', 'vip', 'C', 6), (2, 'C7', 'vip', 'C', 7), (2, 'C8', 'vip', 'C', 8), (2, 'C9', 'vip', 'C', 9), (2, 'C10', 'vip', 'C', 10);

-- Thêm danh sách phim hot
INSERT INTO movies (id, title, genre, duration, description, poster_url, rating, status, release_date) VALUES
(1, 'Dune: Hành Tinh Cát - Phần 2', 'Khoa học viễn tưởng, Hành động', 166, 
 'Paul Atreides liên minh cùng Chani và tộc người Fremen khi anh tìm kiếm sự báo thù chống lại những kẻ đã hủy diệt gia tộc mình.',
 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop', 'C16', 'now_showing', '2026-03-01'),

(2, 'Mai - Tình Yêu & Khát Vọng', 'Tâm lý, Tình cảm', 131, 
 'Mai là một người phụ nữ làm nghề massage trị liệu với quá khứ nhiều tổn thương, cô gặp Dương - một chàng trai đào hoa theo đuổi cô nhiệt thành.',
 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=600&auto=format&fit=crop', 'C18', 'now_showing', '2026-02-10'),

(3, 'Thám Tử Lừng Danh Conan: Ngôi Sao 5 Cánh 1 Triệu Đô', 'Hoạt hình, Trinh thám', 111, 
 'Conan và Heiji cùng đối đầu với Siêu Đạo Chích Kid trong vụ án thanh kiếm cổ ngàn năm và kho báu ẩn giấu tại Hakodate.',
 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop', 'P', 'now_showing', '2026-08-02'),

(4, 'Exhuma: Quật Mộ Trùng Ma', 'Kinh dị, Giật gân', 134, 
 'Một gia đình giàu có gốc Hàn ở Los Angeles liên lạc với hai pháp sư trẻ tài ba để cứu đứa con mới sinh khỏi những hiện tượng kỳ bí siêu nhiên.',
 'https://images.unsplash.com/photo-1509281373149-e957c6296406?q=80&w=600&auto=format&fit=crop', 'C18', 'now_showing', '2026-03-15'),

(5, 'Avatar 3: Người Tro Tàn', 'Hành động, Phiêu lưu', 190, 
 'Jake Sully và Neytiri khám phá những vùng đất mới trên hành tinh Pandora và chạm trán với tộc Người Tro Tàn hung hãn.',
 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop', 'C13', 'coming_soon', '2026-12-19')
ON DUPLICATE KEY UPDATE 
    title=VALUES(title), 
    genre=VALUES(genre), 
    duration=VALUES(duration), 
    description=VALUES(description), 
    poster_url=VALUES(poster_url), 
    rating=VALUES(rating), 
    status=VALUES(status), 
    release_date=VALUES(release_date);

-- Thêm các suất chiếu hôm nay và những ngày tới (sử dụng thời gian động)
INSERT INTO showtimes (id, movie_id, room_id, start_time, base_price) VALUES
(1, 1, 1, DATE_ADD(NOW(), INTERVAL 2 HOUR), 95000.00),
(2, 1, 1, DATE_ADD(NOW(), INTERVAL 5 HOUR), 95000.00),
(3, 2, 2, DATE_ADD(NOW(), INTERVAL 3 HOUR), 85000.00),
(4, 3, 1, DATE_ADD(NOW(), INTERVAL 8 HOUR), 90000.00),
(5, 4, 2, DATE_ADD(NOW(), INTERVAL 6 HOUR), 90000.00),
(6, 1, 1, DATE_ADD(DATE_ADD(CURDATE(), INTERVAL 1 DAY), INTERVAL 14 HOUR), 95000.00),
(7, 2, 2, DATE_ADD(DATE_ADD(CURDATE(), INTERVAL 1 DAY), INTERVAL 18 HOUR), 85000.00)
ON DUPLICATE KEY UPDATE start_time=VALUES(start_time);

-- Thêm 1 đơn đặt vé mẫu đã hoàn thành để minh họa trạng thái ghế đã đặt
INSERT INTO bookings (id, booking_code, customer_name, customer_email, customer_phone, total_amount, status) VALUES
(1, 'BK-DEMO-001', 'Nguyễn Văn An', 'an.nguyen@example.com', '0912345678', 228000.00, 'confirmed')
ON DUPLICATE KEY UPDATE customer_name=VALUES(customer_name);

-- Ghế C5, C6 (VIP) của suất chiếu 1 đã được đặt trước
INSERT IGNORE INTO booking_seats (booking_id, showtime_id, seat_id, price) VALUES
(1, 1, 25, 114000.00), -- Ghế C5 (VIP)
(1, 1, 26, 114000.00); -- Ghế C6 (VIP)

-- Giao dịch thanh toán mẫu
INSERT INTO payments (id, booking_id, payment_code, amount, method, status) VALUES
(1, 1, 'PAY-DEMO-998877', 228000.00, 'MOCK_QR_BANKING', 'success')
ON DUPLICATE KEY UPDATE amount=VALUES(amount);
