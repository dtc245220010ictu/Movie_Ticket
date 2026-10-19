const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const client = require('prom-client');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================================
// 1. PROMETHEUS METRICS SETUP (prom-client)
// ========================================================
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'cinema_app_' });

// Custom Metrics
const httpRequestCounter = new client.Counter({
  name: 'cinema_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDuration = new client.Histogram({
  name: 'cinema_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const bookingsCounter = new client.Counter({
  name: 'cinema_bookings_total',
  help: 'Total number of bookings created by status',
  labelNames: ['status'],
});

register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestDuration);
register.registerMetric(bookingsCounter);

// ========================================================
// 2. MIDDLEWARES & STRUCTURED LOGGING
// ========================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging & metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    // Track Metrics
    httpRequestCounter.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode,
    });
    httpRequestDuration.observe(
      { method: req.method, route: route, status_code: res.statusCode },
      duration
    );

    // Logging (structured format for Loki)
    const logData = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: (Date.now() - start),
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    };
    console.log(JSON.stringify(logData));
  });
  next();
});

// ========================================================
// 3. DATABASE CONNECTION POOL (mysql2/promise)
// ========================================================
const dbConfig = {
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'cinema_user',
  password: process.env.DB_PASSWORD || 'CinemaSecurePass2026!',
  database: process.env.DB_NAME || 'cinema_booking',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

const pool = mysql.createPool(dbConfig);

// Kiểm tra kết nối ban đầu
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('[DB] Ket noi MySQL Database thanh cong!');
    connection.release();
  } catch (err) {
    console.error('[DB ERROR] Chua the ket noi MySQL:', err.message);
  }
}
testDbConnection();

// ========================================================
// 4. HEALTH CHECK & METRICS ENDPOINTS
// ========================================================
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0',
    });
  } catch (err) {
    return res.status(503).json({
      status: 'DOWN',
      database: 'disconnected',
      error: err.message,
    });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ========================================================
// 5. REST APIS CHỨC NĂNG HỆ THỐNG
// ========================================================

// 5.1. Lấy danh sách phim
app.get('/api/movies', async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM movies ORDER BY release_date DESC';
    let params = [];

    if (status && (status === 'now_showing' || status === 'coming_soon')) {
      query = 'SELECT * FROM movies WHERE status = ? ORDER BY release_date DESC';
      params = [status];
    }

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// 5.2. Lấy chi tiết 1 phim và danh sách các suất chiếu
app.get('/api/movies/:id', async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    if (isNaN(movieId)) {
      return res.status(400).json({ success: false, message: 'ID phim không hợp lệ' });
    }

    const [movieRows] = await pool.query('SELECT * FROM movies WHERE id = ?', [movieId]);
    if (movieRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phim' });
    }

    // Lấy suất chiếu sắp tới của phim
    const [showtimes] = await pool.query(
      `SELECT s.id, s.start_time, s.base_price, r.id as room_id, r.name as room_name, r.screen_type
       FROM showtimes s
       JOIN rooms r ON s.room_id = r.id
       WHERE s.movie_id = ? AND s.start_time >= NOW() - INTERVAL 30 MINUTE
       ORDER BY s.start_time ASC`,
      [movieId]
    );

    res.json({
      success: true,
      data: {
        ...movieRows[0],
        showtimes: showtimes,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5.3. Lấy tất cả suất chiếu
app.get('/api/showtimes', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.start_time, s.base_price, 
              m.id as movie_id, m.title as movie_title, m.poster_url, m.duration, m.rating,
              r.id as room_id, r.name as room_name, r.screen_type
       FROM showtimes s
       JOIN movies m ON s.movie_id = m.id
       JOIN rooms r ON s.room_id = r.id
       WHERE s.start_time >= NOW() - INTERVAL 30 MINUTE
       ORDER BY s.start_time ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// 5.4. Lấy sơ đồ ghế và trạng thái đặt ghế theo suất chiếu
app.get('/api/showtimes/:id/seats', async (req, res, next) => {
  try {
    const showtimeId = parseInt(req.params.id, 10);
    if (isNaN(showtimeId)) {
      return res.status(400).json({ success: false, message: 'ID suất chiếu không hợp lệ' });
    }

    // Lấy thông tin suất chiếu và phòng chiếu
    const [showtimeRows] = await pool.query(
      `SELECT s.id, s.start_time, s.base_price, s.room_id, 
              m.title as movie_title, m.rating,
              r.name as room_name, r.screen_type
       FROM showtimes s
       JOIN movies m ON s.movie_id = m.id
       JOIN rooms r ON s.room_id = r.id
       WHERE s.id = ?`,
      [showtimeId]
    );

    if (showtimeRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu' });
    }

    const showtime = showtimeRows[0];
    const basePrice = parseFloat(showtime.base_price);

    // Lấy danh sách tất cả các ghế của phòng
    const [seats] = await pool.query(
      `SELECT id, room_id, seat_code, seat_type, seat_row, seat_number
       FROM seats
       WHERE room_id = ?
       ORDER BY seat_row ASC, seat_number ASC`,
      [showtime.room_id]
    );

    // Lấy danh sách các ghế đã được đặt trong suất chiếu này (trạng thái pending hoặc confirmed)
    const [bookedRows] = await pool.query(
      `SELECT bs.seat_id
       FROM booking_seats bs
       JOIN bookings b ON bs.booking_id = b.id
       WHERE bs.showtime_id = ? AND b.status IN ('pending', 'confirmed')`,
      [showtimeId]
    );

    const bookedSeatIds = new Set(bookedRows.map((r) => r.seat_id));

    // Ghép dữ liệu trạng thái và giá vé từng ghế
    const seatMap = seats.map((seat) => {
      const isVip = seat.seat_type === 'vip';
      const seatPrice = isVip ? Math.round(basePrice * 1.2) : basePrice;
      return {
        ...seat,
        price: seatPrice,
        is_booked: bookedSeatIds.has(seat.id),
      };
    });

    res.json({
      success: true,
      data: {
        showtime: showtime,
        seats: seatMap,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5.5. ĐẶT VÉ VỚI TRANSACTION & CHỐNG ĐẶT TRÙNG GHẾ
app.post('/api/bookings', async (req, res, next) => {
  const { showtime_id, seat_ids, customer_name, customer_email, customer_phone } = req.body;

  // 1. Validation đầu vào
  if (!showtime_id || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ: Vui lòng chọn ít nhất 1 ghế và suất chiếu.',
    });
  }

  if (!customer_name || !customer_email || !customer_phone) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ thông tin: Họ tên, Email, Số điện thoại.',
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // BẮT ĐẦU TRANSACTION
    await connection.beginTransaction();

    // 2. Lấy thông tin suất chiếu và khóa dòng (FOR UPDATE)
    const [showtimeRows] = await connection.query(
      'SELECT id, room_id, base_price FROM showtimes WHERE id = ? FOR UPDATE',
      [showtime_id]
    );
    if (showtimeRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Suất chiếu không tồn tại.' });
    }
    const showtime = showtimeRows[0];
    const basePrice = parseFloat(showtime.base_price);

    // 3. Lấy thông tin chi tiết các ghế được chọn
    const [seatRows] = await connection.query(
      'SELECT id, seat_code, seat_type, room_id FROM seats WHERE id IN (?) AND room_id = ?',
      [seat_ids, showtime.room_id]
    );

    if (seatRows.length !== seat_ids.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Một số ghế bạn chọn không thuộc phòng chiếu này.',
      });
    }

    // 4. KIỂM TRA GHẾ ĐÃ ĐƯỢC ĐẶT CHƯA (RÀNG BUỘC TRANSACTION ĐỘC QUYỀN)
    const [alreadyBooked] = await connection.query(
      `SELECT bs.seat_id, s.seat_code
       FROM booking_seats bs
       JOIN bookings b ON bs.booking_id = b.id
       JOIN seats s ON bs.seat_id = s.id
       WHERE bs.showtime_id = ? AND bs.seat_id IN (?) AND b.status IN ('pending', 'confirmed')
       FOR UPDATE`,
      [showtime_id, seat_ids]
    );

    if (alreadyBooked.length > 0) {
      await connection.rollback();
      const bookedCodes = alreadyBooked.map((item) => item.seat_code).join(', ');
      return res.status(409).json({
        success: false,
        message: `Rất tiếc! Ghế [${bookedCodes}] vừa có người khác đặt. Vui lòng chọn ghế khác!`,
      });
    }

    // 5. TÍNH TOÁN LẠI TỔNG TIỀN CHÍNH XÁC TỪ DATABASE (KHÔNG TIN DỮ LIỆU CLIENT)
    let totalAmount = 0;
    const seatPrices = {};
    for (const seat of seatRows) {
      const price = seat.seat_type === 'vip' ? Math.round(basePrice * 1.2) : basePrice;
      seatPrices[seat.id] = price;
      totalAmount += price;
    }

    // 6. TẠO MÃ BOOKING DUY NHẤT
    const bookingCode = 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    // 7. LƯU BẢNG BOOKINGS
    const [bookingResult] = await connection.query(
      `INSERT INTO bookings (booking_code, customer_name, customer_email, customer_phone, total_amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [bookingCode, customer_name, customer_email, customer_phone, totalAmount]
    );
    const bookingId = bookingResult.insertId;

    // 8. LƯU BẢNG BOOKING_SEATS
    const bookingSeatsData = seatRows.map((seat) => [
      bookingId,
      showtime_id,
      seat.id,
      seatPrices[seat.id],
    ]);

    await connection.query(
      'INSERT INTO booking_seats (booking_id, showtime_id, seat_id, price) VALUES ?',
      [bookingSeatsData]
    );

    // HOÀN TẤT TRANSACTION
    await connection.commit();
    bookingsCounter.inc({ status: 'pending' });

    res.status(201).json({
      success: true,
      message: 'Tạo đơn đặt vé thành công!',
      data: {
        booking_id: bookingId,
        booking_code: bookingCode,
        total_amount: totalAmount,
        customer_name,
        seats: seatRows.map((s) => ({ id: s.id, code: s.seat_code, type: s.seat_type, price: seatPrices[s.id] })),
      },
    });
  } catch (err) {
    if (connection) await connection.rollback();
    // Bắt lỗi ràng buộc trùng lặp UNIQUE (showtime_id, seat_id) từ MySQL
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Xung đột ghế! Một trong các ghế vừa được hệ thống xử lý cho khách khác.',
      });
    }
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

// 5.6. THANH TOÁN MÔ PHỎNG (MOCK PAYMENT)
app.post('/api/payments/mock', async (req, res, next) => {
  const { booking_id, action } = req.body;

  if (!booking_id || !['pay', 'cancel'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ: Yêu cầu booking_id và action ("pay" hoặc "cancel").',
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [bookingRows] = await connection.query(
      'SELECT id, booking_code, total_amount, status FROM bookings WHERE id = ? FOR UPDATE',
      [booking_id]
    );

    if (bookingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Đơn đặt vé không tồn tại.' });
    }

    const booking = bookingRows[0];

    if (booking.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Đơn đặt vé này đã ở trạng thái [${booking.status}], không thể thực hiện thao tác.`,
      });
    }

    if (action === 'pay') {
      // 1. Cập nhật booking status = 'confirmed'
      await connection.query('UPDATE bookings SET status = "confirmed" WHERE id = ?', [booking_id]);

      // 2. Ghi nhật ký bảng payments
      const paymentCode = 'PAY' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      await connection.query(
        `INSERT INTO payments (booking_id, payment_code, amount, method, status)
         VALUES (?, ?, ?, 'MOCK_QR_BANKING', 'success')`,
        [booking_id, paymentCode, booking.total_amount]
      );

      await connection.commit();
      bookingsCounter.inc({ status: 'confirmed' });

      return res.json({
        success: true,
        message: 'Thanh toán thành công! Vé của bạn đã được xác nhận.',
        data: {
          booking_code: booking.booking_code,
          payment_code: paymentCode,
          status: 'confirmed',
          amount: booking.total_amount,
        },
      });
    } else if (action === 'cancel') {
      // 1. Cập nhật booking status = 'cancelled'
      await connection.query('UPDATE bookings SET status = "cancelled" WHERE id = ?', [booking_id]);

      // 2. Xóa liên kết ghế trong booking_seats để giải phóng ghế cho khách khác
      await connection.query('DELETE FROM booking_seats WHERE booking_id = ?', [booking_id]);

      await connection.commit();
      bookingsCounter.inc({ status: 'cancelled' });

      return res.json({
        success: true,
        message: 'Đã hủy đơn đặt vé thành công. Các ghế đã được giải phóng.',
        data: {
          booking_code: booking.booking_code,
          status: 'cancelled',
        },
      });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

// 5.7. TRA CỨU ĐƠN VÉ (LOOKUP)
app.get('/api/bookings/:code', async (req, res, next) => {
  try {
    const bookingCode = req.params.code;
    const [bookingRows] = await pool.query(
      `SELECT b.id, b.booking_code, b.customer_name, b.customer_email, b.customer_phone,
              b.total_amount, b.status, b.created_at,
              p.payment_code, p.paid_at
       FROM bookings b
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.booking_code = ?`,
      [bookingCode]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé với mã này.' });
    }

    const booking = bookingRows[0];

    // Lấy thông tin phim và danh sách ghế
    const [seatRows] = await pool.query(
      `SELECT s.seat_code, s.seat_type, bs.price,
              st.start_time, m.title as movie_title, m.poster_url, r.name as room_name
       FROM booking_seats bs
       JOIN seats s ON bs.seat_id = s.id
       JOIN showtimes st ON bs.showtime_id = st.id
       JOIN movies m ON st.movie_id = m.id
       JOIN rooms r ON st.room_id = r.id
       WHERE bs.booking_id = ?`,
      [booking.id]
    );

    res.json({
      success: true,
      data: {
        booking: booking,
        details: seatRows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5.8. VÉ CỦA TÔI (MY TICKETS) — LIỆT KÊ VÉ ĐÃ ĐẶT THEO EMAIL HOẶC MÃ VÉ
app.get('/api/my-tickets', async (req, res, next) => {
  try {
    const email = (req.query.email || '').trim();
    const codes = (req.query.codes || '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (!email && codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dữ liệu tra cứu: cần truyền email hoặc danh sách mã vé (codes).',
      });
    }

    let bookingRows;
    if (email) {
      [bookingRows] = await pool.query(
        `SELECT b.id, b.booking_code, b.customer_name, b.customer_email, b.customer_phone,
                b.total_amount, b.status, b.created_at,
                p.payment_code, p.paid_at
         FROM bookings b
         LEFT JOIN payments p ON b.id = p.booking_id
         WHERE b.customer_email = ?
         ORDER BY b.created_at DESC`,
        [email]
      );
    } else {
      [bookingRows] = await pool.query(
        `SELECT b.id, b.booking_code, b.customer_name, b.customer_email, b.customer_phone,
                b.total_amount, b.status, b.created_at,
                p.payment_code, p.paid_at
         FROM bookings b
         LEFT JOIN payments p ON b.id = p.booking_id
         WHERE b.booking_code IN (?)
         ORDER BY b.created_at DESC`,
        [codes]
      );
    }

    if (bookingRows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Lấy chi tiết ghế / suất chiếu / phim cho toàn bộ đơn trong 1 truy vấn
    const bookingIds = bookingRows.map((b) => b.id);
    const [detailRows] = await pool.query(
      `SELECT bs.booking_id, s.seat_code, s.seat_type, bs.price,
              st.start_time, m.title as movie_title, m.poster_url,
              r.name as room_name, r.screen_type
       FROM booking_seats bs
       JOIN seats s ON bs.seat_id = s.id
       JOIN showtimes st ON bs.showtime_id = st.id
       JOIN movies m ON st.movie_id = m.id
       JOIN rooms r ON st.room_id = r.id
       WHERE bs.booking_id IN (?)
       ORDER BY s.seat_row, s.seat_number`,
      [bookingIds]
    );

    const detailsByBooking = new Map();
    detailRows.forEach((row) => {
      if (!detailsByBooking.has(row.booking_id)) {
        detailsByBooking.set(row.booking_id, []);
      }
      detailsByBooking.get(row.booking_id).push(row);
    });

    res.json({
      success: true,
      data: bookingRows.map((booking) => ({
        booking,
        details: detailsByBooking.get(booking.id) || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ========================================================
// 6. GLOBAL ERROR HANDLING (Bảo mật: Không leak stack trace)
// ========================================================
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]:', err);
  res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
    error_id: Date.now().toString(36),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CINEMA APP] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
