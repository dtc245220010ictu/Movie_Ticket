// ========================================================
// CYBER CINEMA — CLIENT APPLICATION CONTROLLER
// ========================================================

const state = {
  movies: [],
  showtimes: [],
  currentShowtime: null,
  currentMovie: null,
  selectedSeats: new Map(), // seatId -> seatObject
  activeBooking: null,
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadMovies('all');
  loadShowtimes();
  checkSystemHealth();
});

// ================= EVENT LISTENERS =================
function initEventListeners() {
  // Tab filter phim
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      loadMovies(e.target.dataset.status);
    });
  });

  // Đóng Modal Ghế
  document.getElementById('close-seat-modal-btn')?.addEventListener('click', closeSeatModal);
  document.getElementById('seat-modal-backdrop')?.addEventListener('click', closeSeatModal);

  // Submit Đặt vé
  document.getElementById('booking-customer-form')?.addEventListener('submit', handleBookingSubmit);

  // Đóng Modal Thanh toán
  document.getElementById('close-payment-modal-btn')?.addEventListener('click', closePaymentModal);
  document.getElementById('payment-modal-backdrop')?.addEventListener('click', closePaymentModal);

  // Nút Xác nhận / Hủy thanh toán
  document.getElementById('confirm-pay-success-btn')?.addEventListener('click', () => handleMockPayment('pay'));
  document.getElementById('confirm-pay-cancel-btn')?.addEventListener('click', () => handleMockPayment('cancel'));

  // Đóng Modal Vé
  document.getElementById('close-ticket-modal-btn')?.addEventListener('click', closeTicketModal);
  document.getElementById('ticket-modal-backdrop')?.addEventListener('click', closeTicketModal);
  document.getElementById('ticket-done-btn')?.addEventListener('click', () => {
    closeTicketModal();
    loadShowtimes();
  });

  // Modal Tra cứu vé
  document.getElementById('nav-lookup-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openLookupModal();
  });
  document.getElementById('close-lookup-modal-btn')?.addEventListener('click', closeLookupModal);
  document.getElementById('lookup-modal-backdrop')?.addEventListener('click', closeLookupModal);
  document.getElementById('lookup-form')?.addEventListener('submit', handleLookupSubmit);

  // Quick Demo Architect button
  document.getElementById('quick-demo-btn')?.addEventListener('click', () => {
    showToast('Hệ thống gồm: Docker Compose, Nginx SSL, Node.js App, MySQL 8, Prometheus & Grafana, Loki', 'success');
  });
}

// ================= LOAD MOVIES =================
async function loadMovies(status = 'all') {
  const container = document.getElementById('movies-grid');
  try {
    const url = status === 'all' ? '/api/movies' : `/api/movies?status=${status}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.data || data.data.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>Không tìm thấy phim phù hợp.</p></div>`;
      return;
    }

    state.movies = data.data;
    renderMovieGrid(state.movies);
  } catch (err) {
    console.error('Lỗi tải phim:', err);
    container.innerHTML = `<div class="error-state"><p>Không thể kết nối Backend API. Vui lòng thử lại sau.</p></div>`;
  }
}

function renderMovieGrid(movies) {
  const container = document.getElementById('movies-grid');
  container.innerHTML = movies
    .map((movie) => {
      const isNow = movie.status === 'now_showing';
      return `
      <div class="movie-card">
        <div class="movie-poster-box">
          <img src="${movie.poster_url}" alt="${escapeHtml(movie.title)}" class="movie-poster-img" loading="lazy">
          <span class="movie-badge-rating">${movie.rating || 'P'}</span>
          <span class="movie-badge-status ${isNow ? 'status-now-showing' : 'status-coming-soon'}">
            ${isNow ? 'Đang Chiếu' : 'Sắp Chiếu'}
          </span>
        </div>
        <div class="movie-info">
          <span class="movie-genre">${escapeHtml(movie.genre)}</span>
          <h3 class="movie-title">${escapeHtml(movie.title)}</h3>
          <div class="movie-meta">
            <span><i class="fa-regular fa-clock"></i> ${movie.duration} phút</span>
            <span><i class="fa-regular fa-calendar"></i> ${formatDate(movie.release_date)}</span>
          </div>
          <p class="movie-desc">${escapeHtml(movie.description)}</p>
          <button class="btn btn-primary btn-block btn-sm" onclick="handleSelectMovie(${movie.id})">
            <i class="fa-solid fa-ticket"></i> ${isNow ? 'Chọn Suất Chiếu' : 'Xem Thông Tin'}
          </button>
        </div>
      </div>
    `;
    })
    .join('');
}

// ================= LOAD SHOWTIMES =================
async function loadShowtimes() {
  const tbody = document.getElementById('showtimes-tbody');
  try {
    const res = await fetch('/api/showtimes');
    const data = await res.json();

    if (!data.success || !data.data || data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Hiện chưa có lịch chiếu mới.</td></tr>`;
      return;
    }

    state.showtimes = data.data;
    tbody.innerHTML = state.showtimes
      .map(
        (st) => `
      <tr>
        <td>
          <strong>${escapeHtml(st.movie_title)}</strong>
          <br><small style="color: var(--text-muted);">${st.duration} phút • ${st.rating}</small>
        </td>
        <td>
          ${escapeHtml(st.room_name)}
          <br><small style="color: var(--accent-cyan); font-weight: 600;">${escapeHtml(st.screen_type)}</small>
        </td>
        <td>
          <i class="fa-regular fa-clock"></i> <strong>${formatDateTime(st.start_time)}</strong>
        </td>
        <td>
          <span style="color: #10b981; font-weight: 700;">${formatVnd(st.base_price)}</span>
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openSeatModal(${st.id})">
            <i class="fa-solid fa-chair"></i> Chọn Ghế
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Lỗi tải suất chiếu:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: #ef4444;">Không thể tải danh sách suất chiếu.</td></tr>`;
  }
}

// Khi bấm "Chọn Suất Chiếu" từ thẻ phim
async function handleSelectMovie(movieId) {
  try {
    const res = await fetch(`/api/movies/${movieId}`);
    const data = await res.json();
    if (!data.success || !data.data) return;

    const movie = data.data;
    if (!movie.showtimes || movie.showtimes.length === 0) {
      showToast(`Phim "${movie.title}" hiện chưa mở bán suất chiếu hôm nay.`, 'error');
      return;
    }

    // Mở suất chiếu đầu tiên
    openSeatModal(movie.showtimes[0].id);
  } catch (err) {
    showToast('Không thể mở thông tin phim', 'error');
  }
}

// ================= MODAL CHỌN GHẾ =================
async function openSeatModal(showtimeId) {
  state.selectedSeats.clear();
  updateSummarySidebar();

  const modal = document.getElementById('seat-modal');
  const container = document.getElementById('seats-grid-container');
  container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải sơ đồ ghế...</div>`;
  modal.classList.add('active');

  try {
    const res = await fetch(`/api/showtimes/${showtimeId}/seats`);
    const data = await res.json();

    if (!data.success || !data.data) {
      showToast(data.message || 'Lỗi tải sơ đồ ghế', 'error');
      closeSeatModal();
      return;
    }

    state.currentShowtime = data.data.showtime;
    const seats = data.data.seats;

    // Hiển thị tiêu đề modal
    document.getElementById('seat-modal-movie-title').textContent = state.currentShowtime.movie_title;
    document.getElementById('seat-modal-room-badge').textContent = `${state.currentShowtime.room_name} (${state.currentShowtime.screen_type})`;

    // Cập nhật sidebar tóm tắt
    document.getElementById('summary-movie').textContent = state.currentShowtime.movie_title;
    document.getElementById('summary-time').textContent = formatDateTime(state.currentShowtime.start_time);
    document.getElementById('summary-room').textContent = state.currentShowtime.room_name;

    renderSeatsGrid(seats);
  } catch (err) {
    console.error(err);
    showToast('Lỗi kết nối khi lấy sơ đồ ghế', 'error');
    closeSeatModal();
  }
}

function renderSeatsGrid(seats) {
  const container = document.getElementById('seats-grid-container');

  // Gom nhóm ghế theo Hàng (A, B, C, D...)
  const rowsMap = new Map();
  seats.forEach((seat) => {
    if (!rowsMap.has(seat.seat_row)) {
      rowsMap.set(seat.seat_row, []);
    }
    rowsMap.get(seat.seat_row).push(seat);
  });

  let html = '';
  rowsMap.forEach((rowSeats, rowChar) => {
    html += `
      <div class="seat-row-wrapper">
        <div class="row-label">${rowChar}</div>
        <div class="row-seats">
          ${rowSeats
            .map((seat) => {
              const isVip = seat.seat_type === 'vip';
              const typeClass = isVip ? 'seat-vip' : 'seat-standard';
              const bookedClass = seat.is_booked ? 'seat-booked' : '';
              return `
              <div class="seat-item ${typeClass} ${bookedClass}" 
                   id="seat-btn-${seat.id}"
                   data-seat-id="${seat.id}"
                   data-code="${seat.seat_code}"
                   data-price="${seat.price}"
                   data-type="${seat.seat_type}"
                   data-booked="${seat.is_booked ? 'true' : 'false'}"
                   title="Ghế ${seat.seat_code} (${isVip ? 'VIP' : 'Thường'}) - ${formatVnd(seat.price)}"
                   onclick="toggleSeatSelection(${seat.id})">
                ${seat.seat_number}
              </div>
            `;
            })
            .join('')}
        </div>
        <div class="row-label">${rowChar}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function toggleSeatSelection(seatId) {
  const seatEl = document.getElementById(`seat-btn-${seatId}`);
  if (!seatEl || seatEl.dataset.booked === 'true') {
    return; // Ghế đã bị đặt trước, không thể chọn
  }

  if (state.selectedSeats.has(seatId)) {
    state.selectedSeats.delete(seatId);
    seatEl.classList.remove('seat-selected');
  } else {
    state.selectedSeats.set(seatId, {
      id: seatId,
      code: seatEl.dataset.code,
      price: parseFloat(seatEl.dataset.price),
      type: seatEl.dataset.type,
    });
    seatEl.classList.add('seat-selected');
  }

  updateSummarySidebar();
}

function updateSummarySidebar() {
  const seatsSpan = document.getElementById('summary-seats');
  const totalSpan = document.getElementById('summary-total');

  if (state.selectedSeats.size === 0) {
    seatsSpan.textContent = 'Chưa chọn ghế';
    totalSpan.textContent = '0 đ';
    return;
  }

  const seatCodes = Array.from(state.selectedSeats.values())
    .map((s) => s.code)
    .join(', ');
  const totalPrice = Array.from(state.selectedSeats.values()).reduce((sum, s) => sum + s.price, 0);

  seatsSpan.textContent = seatCodes;
  totalSpan.textContent = formatVnd(totalPrice);
}

function closeSeatModal() {
  document.getElementById('seat-modal').classList.remove('active');
  state.selectedSeats.clear();
}

// ================= SUBMIT BOOKING (TẠO ĐƠN) =================
async function handleBookingSubmit(e) {
  e.preventDefault();

  if (state.selectedSeats.size === 0) {
    showToast('Vui lòng chọn ít nhất 1 ghế để tiếp tục!', 'error');
    return;
  }

  const name = document.getElementById('cust-name').value.trim();
  const email = document.getElementById('cust-email').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();

  const payload = {
    showtime_id: state.currentShowtime.id,
    seat_ids: Array.from(state.selectedSeats.keys()),
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
  };

  const submitBtn = document.getElementById('submit-booking-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý giao dịch...';

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || 'Lỗi khi tạo đơn đặt vé!', 'error');
      // Nếu có xung đột ghế (409), tải lại sơ đồ ghế ngay
      if (res.status === 409) {
        openSeatModal(state.currentShowtime.id);
      }
      return;
    }

    state.activeBooking = data.data;
    closeSeatModal();
    openPaymentModal(state.activeBooking);
    showToast('Tạo đơn giữ vé thành công! Vui lòng hoàn tất thanh toán.', 'success');
  } catch (err) {
    console.error('Booking error:', err);
    showToast('Lỗi mạng kết nối đến máy chủ Backend', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Xác Nhận & Sang Thanh Toán';
  }
}

// ================= THANH TOÁN MÔ PHỎNG (MOCK PAYMENT) =================
function openPaymentModal(booking) {
  const modal = document.getElementById('payment-modal');
  document.getElementById('payment-amount-val').textContent = formatVnd(booking.total_amount);
  document.getElementById('payment-booking-code').textContent = booking.booking_code;
  modal.classList.add('active');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('active');
}

async function handleMockPayment(action) {
  if (!state.activeBooking) return;

  const btnSuccess = document.getElementById('confirm-pay-success-btn');
  const btnCancel = document.getElementById('confirm-pay-cancel-btn');
  btnSuccess.disabled = true;
  btnCancel.disabled = true;

  try {
    const res = await fetch('/api/payments/mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: state.activeBooking.booking_id,
        action: action,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || 'Thao tác thất bại!', 'error');
      return;
    }

    closePaymentModal();

    if (action === 'pay') {
      showToast('Thanh toán thành công! Vé đã được xuất.', 'success');
      openTicketModal(state.activeBooking);
    } else {
      showToast('Đã hủy giao dịch đặt vé. Các ghế đã được mở lại.', 'error');
      loadShowtimes();
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi kết nối khi thanh toán', 'error');
  } finally {
    btnSuccess.disabled = false;
    btnCancel.disabled = false;
  }
}

// ================= XUẤT VÉ ĐIỆN TỬ (E-TICKET) =================
function openTicketModal(booking) {
  const modal = document.getElementById('ticket-modal');
  document.getElementById('ticket-movie-name').textContent = state.currentShowtime?.movie_title || 'Phim Điện Ảnh';
  document.getElementById('ticket-time').textContent = formatDateTime(state.currentShowtime?.start_time || new Date());
  document.getElementById('ticket-room').textContent = `${state.currentShowtime?.room_name} (${state.currentShowtime?.screen_type})`;
  
  const seatCodes = booking.seats.map((s) => s.code).join(', ');
  document.getElementById('ticket-seats').textContent = seatCodes;
  document.getElementById('ticket-customer').textContent = booking.customer_name;
  document.getElementById('ticket-barcode-val').textContent = booking.booking_code;

  modal.classList.add('active');
}

function closeTicketModal() {
  document.getElementById('ticket-modal').classList.remove('active');
}

// ================= TRA CỨU VÉ (LOOKUP) =================
function openLookupModal() {
  document.getElementById('lookup-modal').classList.add('active');
  document.getElementById('lookup-result-box').style.display = 'none';
  document.getElementById('lookup-code-input').value = '';
}

function closeLookupModal() {
  document.getElementById('lookup-modal').classList.remove('active');
}

async function handleLookupSubmit(e) {
  e.preventDefault();
  const code = document.getElementById('lookup-code-input').value.trim();
  const resultBox = document.getElementById('lookup-result-box');

  if (!code) return;

  resultBox.style.display = 'block';
  resultBox.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Đang tra cứu trên máy chủ...</div>';

  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(code)}`);
    const data = await res.json();

    if (!res.ok || !data.success || !data.data) {
      resultBox.innerHTML = `
        <div class="alert alert-danger" style="margin-top: 14px;">
          <i class="fa-solid fa-circle-exclamation"></i> Không tìm thấy đơn vé với mã: <strong>${escapeHtml(code)}</strong>
        </div>`;
      return;
    }

    const { booking, details } = data.data;
    const isConfirmed = booking.status === 'confirmed';
    const seatsStr = details.map((d) => d.seat_code).join(', ');

    resultBox.innerHTML = `
      <div class="lookup-card" style="margin-top: 16px; background: var(--bg-surface-elevated); padding: 18px; border-radius: 12px; border: 1px solid var(--border-glass);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-weight: 700; color: var(--primary); font-size: 16px;">${booking.booking_code}</span>
          <span class="badge" style="background: ${isConfirmed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color: ${isConfirmed ? '#10b981' : '#ef4444'}; border: none;">
            ${booking.status.toUpperCase()}
          </span>
        </div>
        <p><strong>Khách hàng:</strong> ${escapeHtml(booking.customer_name)} (${escapeHtml(booking.customer_phone)})</p>
        <p><strong>Tổng tiền:</strong> <span style="color: #10b981; font-weight: 700;">${formatVnd(booking.total_amount)}</span></p>
        <p><strong>Ghế đặt:</strong> <span style="color: #fbbf24; font-weight: 700;">${seatsStr || 'N/A'}</span></p>
        ${details.length > 0 ? `<p><strong>Phim:</strong> ${escapeHtml(details[0].movie_title)} (${escapeHtml(details[0].room_name)})</p>` : ''}
        <small style="color: var(--text-muted); display: block; margin-top: 8px;">Ngày tạo đơn: ${formatDateTime(booking.created_at)}</small>
      </div>
    `;
  } catch (err) {
    resultBox.innerHTML = `<div class="alert alert-danger">Lỗi tra cứu: Không thể kết nối máy chủ.</div>`;
  }
}

// ================= HEALTH MONITORING =================
async function checkSystemHealth() {
  const badge = document.getElementById('system-status-badge');
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (res.ok && data.status === 'UP') {
      badge.innerHTML = `<span class="status-dot"></span><span>Hệ Thống Online (MySQL Sẵn Sàng)</span>`;
    } else {
      badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      badge.style.color = '#ef4444';
      badge.innerHTML = `<span class="status-dot" style="background:#ef4444; box-shadow:0 0 8px #ef4444;"></span><span>Hệ Thống Lỗi DB</span>`;
    }
  } catch (e) {
    badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    badge.style.color = '#ef4444';
    badge.innerHTML = `<span class="status-dot" style="background:#ef4444; box-shadow:0 0 8px #ef4444;"></span><span>Mất Kết Nối API</span>`;
  }
}

// ================= HELPERS =================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatVnd(val) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN');
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.toLocaleDateString('vi-VN')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
