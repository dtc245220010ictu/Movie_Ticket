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
  myTickets: new Map(), // booking_id -> { booking, details } cho màn hình "Vé Của Tôi"
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
    refreshMyTicketsIfOpen();
  });

  // Modal Vé Của Tôi (My Tickets)
  document.getElementById('nav-my-tickets-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openMyTicketsModal();
  });
  document.getElementById('close-my-tickets-modal-btn')?.addEventListener('click', closeMyTicketsModal);
  document.getElementById('my-tickets-modal-backdrop')?.addEventListener('click', closeMyTicketsModal);
  document.getElementById('my-tickets-form')?.addEventListener('submit', handleMyTicketsSearch);
  document.getElementById('clear-search-results-btn')?.addEventListener('click', clearMyTicketsSearch);

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
    // Lưu mã vé vào thiết bị để hiển thị ở mục "Vé Của Tôi"
    saveMyTicketCode(state.activeBooking.booking_code);
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
      openTicketModal(state.activeBooking, state.activeBooking.details || null);
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
// Hỗ trợ 2 nguồn: details (từ "Vé Của Tôi") hoặc state.currentShowtime (luồng đặt vé cũ)
function openTicketModal(booking, details = null) {
  const modal = document.getElementById('ticket-modal');
  const source = details && details.length > 0 ? details : null;
  const first = source ? source[0] : null;

  document.getElementById('ticket-movie-name').textContent =
    first?.movie_title || state.currentShowtime?.movie_title || 'Phim Điện Ảnh';
  document.getElementById('ticket-time').textContent = formatDateTime(
    first?.start_time || state.currentShowtime?.start_time || new Date()
  );
  document.getElementById('ticket-room').textContent = first
    ? `${first.room_name} (${first.screen_type})`
    : `${state.currentShowtime?.room_name} (${state.currentShowtime?.screen_type})`;

  const seatCodes = source
    ? source.map((d) => d.seat_code).join(', ')
    : (booking.seats || []).map((s) => s.code).join(', ');
  document.getElementById('ticket-seats').textContent = seatCodes;
  document.getElementById('ticket-customer').textContent = booking.customer_name;
  document.getElementById('ticket-barcode-val').textContent = booking.booking_code;

  // Nhãn trạng thái trên vé
  const statusBadge = document.getElementById('ticket-status-badge');
  if (statusBadge) {
    const status = booking.status || 'confirmed';
    statusBadge.textContent =
      status === 'confirmed' ? 'ĐÃ XÁC NHẬN' : status === 'pending' ? 'CHỜ THANH TOÁN' : 'ĐÃ HỦY';
    statusBadge.style.background = status === 'confirmed' ? '' : 'rgba(245, 158, 11, 0.15)';
    statusBadge.style.color = status === 'confirmed' ? '' : status === 'pending' ? '#f59e0b' : '#ef4444';
    statusBadge.style.border = status === 'confirmed' ? '' : '1px solid currentColor';
  }

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

// ================= VÉ CỦA TÔI (MY TICKETS) =================
const MY_TICKETS_STORAGE_KEY = 'cybercinema_my_tickets';

function getSavedTicketCodes() {
  try {
    const raw = localStorage.getItem(MY_TICKETS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((code) => typeof code === 'string' && code) : [];
  } catch (err) {
    return [];
  }
}

function saveMyTicketCode(code) {
  if (!code) return;
  try {
    const list = getSavedTicketCodes().filter((c) => c !== code);
    list.unshift(code);
    localStorage.setItem(MY_TICKETS_STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (err) {
    // localStorage có thể bị chặn (chế độ riêng tư) — bỏ qua an toàn
  }
}

function openMyTicketsModal() {
  document.getElementById('my-tickets-modal').classList.add('active');
  loadDeviceTickets();
}

function closeMyTicketsModal() {
  document.getElementById('my-tickets-modal').classList.remove('active');
}

// Tự làm mới danh sách khi modal đang mở (sau thanh toán / hủy vé / in vé)
function refreshMyTicketsIfOpen() {
  const modal = document.getElementById('my-tickets-modal');
  if (!modal || !modal.classList.contains('active')) return;

  loadDeviceTickets();

  const searchSection = document.getElementById('my-tickets-search-section');
  if (searchSection && searchSection.style.display !== 'none') {
    const email = document.getElementById('my-tickets-email-input').value.trim();
    if (email) searchMyTickets(email);
  }
}

function myTicketsSpinner(text) {
  return `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> ${escapeHtml(text)}</div>`;
}

// Tải các vé đã lưu trên thiết bị này (mã vé trong localStorage)
async function loadDeviceTickets() {
  const container = document.getElementById('my-tickets-device-list');
  const codes = getSavedTicketCodes();

  if (codes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p><i class="fa-solid fa-ticket"></i> Chưa có vé nào trên thiết bị này.</p>
        <small>Hãy chọn phim và đặt vé — mã vé sẽ tự động xuất hiện tại đây.</small>
      </div>`;
    return;
  }

  container.innerHTML = myTicketsSpinner('Đang tải danh sách vé trên thiết bị...');

  try {
    const res = await fetch(`/api/my-tickets?codes=${encodeURIComponent(codes.join(','))}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi tải danh sách vé');
    renderMyTicketsList(container, data.data);
  } catch (err) {
    console.error('Lỗi tải vé trên thiết bị:', err);
    container.innerHTML = `<div class="error-state"><p>Không thể tải danh sách vé. Vui lòng thử lại sau.</p></div>`;
  }
}

// Tra cứu vé theo email
async function handleMyTicketsSearch(e) {
  e.preventDefault();
  const email = document.getElementById('my-tickets-email-input').value.trim();
  if (!email) return;

  document.getElementById('my-tickets-search-section').style.display = 'block';
  await searchMyTickets(email);
}

async function searchMyTickets(email) {
  const list = document.getElementById('my-tickets-search-list');
  list.innerHTML = myTicketsSpinner('Đang tra cứu vé theo email...');

  try {
    const res = await fetch(`/api/my-tickets?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi tra cứu vé');
    renderMyTicketsList(list, data.data);
  } catch (err) {
    console.error('Lỗi tra cứu vé theo email:', err);
    list.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation"></i> Không thể tra cứu vé. Vui lòng thử lại sau.</div>`;
  }
}

function clearMyTicketsSearch() {
  document.getElementById('my-tickets-search-section').style.display = 'none';
  document.getElementById('my-tickets-search-list').innerHTML = '';
  document.getElementById('my-tickets-email-input').value = '';
}

function renderMyTicketsList(container, items) {
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Không tìm thấy vé nào phù hợp.</p></div>`;
    return;
  }

  // Ghi cache để các nút hành động (thanh toán / hủy / xem vé) tra ngược được dữ liệu
  items.forEach((item) => state.myTickets.set(item.booking.id, item));
  container.innerHTML = items.map(renderMyTicketCard).join('');
}

function renderMyTicketCard({ booking, details }) {
  const status = booking.status;
  const statusClass = status === 'confirmed' ? 'confirmed' : status === 'pending' ? 'pending' : 'cancelled';
  const statusText =
    status === 'confirmed' ? 'ĐÃ XÁC NHẬN' : status === 'pending' ? 'CHỜ THANH TOÁN' : 'ĐÃ HỦY';
  const first = details.length > 0 ? details[0] : null;
  const seats = details.map((d) => d.seat_code).join(', ') || 'N/A';

  let actions = '';
  if (status === 'pending') {
    actions = `
      <button class="btn btn-success btn-sm" onclick="resumeMyTicketPayment(${booking.id})">
        <i class="fa-solid fa-credit-card"></i> Thanh Toán
      </button>
      <button class="btn btn-danger btn-sm" onclick="cancelMyTicket(${booking.id})">
        <i class="fa-solid fa-ban"></i> Hủy Vé
      </button>`;
  } else if (status === 'confirmed') {
    actions = `
      <button class="btn btn-outline btn-sm" onclick="viewMyTicket(${booking.id})">
        <i class="fa-solid fa-eye"></i> Xem Vé
      </button>`;
  }

  return `
    <div class="my-ticket-card">
      <div class="my-ticket-card-head">
        <span class="my-ticket-code"><i class="fa-solid fa-barcode"></i> ${escapeHtml(booking.booking_code)}</span>
        <span class="my-ticket-status my-ticket-status-${statusClass}">${statusText}</span>
      </div>

      <h5 class="my-ticket-movie">${escapeHtml(first ? first.movie_title : 'Không rõ suất chiếu')}</h5>

      <div class="my-ticket-grid">
        <div>
          <span class="tk-label">Suất Chiếu</span>
          <span class="tk-val">${first ? formatDateTime(first.start_time) : '--:--'}</span>
        </div>
        <div>
          <span class="tk-label">Phòng Chiếu</span>
          <span class="tk-val">${first ? escapeHtml(`${first.room_name} (${first.screen_type})`) : '--'}</span>
        </div>
        <div>
          <span class="tk-label">Ghế Đã Đặt</span>
          <span class="tk-val tk-highlight">${escapeHtml(seats)}</span>
        </div>
        <div>
          <span class="tk-label">Khách Hàng</span>
          <span class="tk-val">${escapeHtml(booking.customer_name)}</span>
        </div>
        <div>
          <span class="tk-label">Ngày Đặt</span>
          <span class="tk-val">${formatDateTime(booking.created_at)}</span>
        </div>
        <div>
          <span class="tk-label">Mã Thanh Toán</span>
          <span class="tk-val">${booking.payment_code ? escapeHtml(booking.payment_code) : '—'}</span>
        </div>
      </div>

      <div class="my-ticket-footer">
        <span class="my-ticket-total">${formatVnd(parseFloat(booking.total_amount))}</span>
        <div class="my-ticket-actions">${actions}</div>
      </div>
    </div>`;
}

// Xem lại vé điện tử từ danh sách
function viewMyTicket(bookingId) {
  const item = state.myTickets.get(bookingId);
  if (!item) return;
  openTicketModal(
    {
      booking_code: item.booking.booking_code,
      customer_name: item.booking.customer_name,
      status: item.booking.status,
      seats: item.details.map((d) => ({ code: d.seat_code })),
    },
    item.details
  );
}

// Tiếp tục thanh toán cho đơn đang chờ (pending)
function resumeMyTicketPayment(bookingId) {
  const item = state.myTickets.get(bookingId);
  if (!item) return;

  state.activeBooking = {
    booking_id: item.booking.id,
    booking_code: item.booking.booking_code,
    total_amount: parseFloat(item.booking.total_amount),
    customer_name: item.booking.customer_name,
    seats: item.details.map((d) => ({ code: d.seat_code })),
    details: item.details,
  };
  openPaymentModal(state.activeBooking);
}

// Hủy đơn đặt vé (giải phóng ghế)
async function cancelMyTicket(bookingId) {
  const item = state.myTickets.get(bookingId);
  if (!item) return;

  const ok = confirm(
    `Bạn có chắc muốn hủy vé ${item.booking.booking_code}? Các ghế đã giữ sẽ được giải phóng cho khách khác.`
  );
  if (!ok) return;

  try {
    const res = await fetch('/api/payments/mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, action: 'cancel' }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || 'Không thể hủy vé. Vui lòng thử lại.', 'error');
      return;
    }

    showToast(data.message || 'Đã hủy vé thành công. Ghế đã được giải phóng.', 'success');
    refreshMyTicketsIfOpen();
    loadShowtimes();
  } catch (err) {
    console.error('Lỗi hủy vé:', err);
    showToast('Lỗi kết nối khi hủy vé', 'error');
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
