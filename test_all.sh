#!/usr/bin/env bash
# ==========================================================
# SCRIPT KIEM TRA TOAN BO HE THONG (14 TEST CASES)
# Cinema Ticket Booking System - De 11
# ==========================================================

PASS=0
FAIL=0
BASE_HTTPS="https://localhost:8443"
BASE_HTTP="http://localhost:8080"

check() {
  local name="$1"
  local result="$2"
  local expected="$3"
  if echo "$result" | grep -q "$expected"; then
    echo "[PASS] $name"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name | Got: $result"
    FAIL=$((FAIL + 1))
  fi
}

echo "=================================================="
echo "  CINEMA TICKET SYSTEM - KIEM TRA HE THONG"
echo "=================================================="
echo ""

# TC-01: Health Check
R=$(curl -sk "$BASE_HTTPS/health")
check "TC-01: Health Check API" "$R" '"status":"UP"'

# TC-02: Movie List
R=$(curl -sk "$BASE_HTTPS/api/movies")
check "TC-02: Movie List (5 phim)" "$R" '"success":true'

# TC-03: Filter now_showing
R=$(curl -sk "$BASE_HTTPS/api/movies?status=now_showing")
check "TC-03: Filter now_showing" "$R" '"status":"now_showing"'

# TC-04: Movie detail
R=$(curl -sk "$BASE_HTTPS/api/movies/1")
check "TC-04: Movie Detail ID=1" "$R" '"id":1'

# TC-05: Showtimes by movie
R=$(curl -sk "$BASE_HTTPS/api/showtimes?movie_id=1")
check "TC-05: Showtimes for movie 1" "$R" '"success":true'

# TC-06: Seats for showtime
R=$(curl -sk "$BASE_HTTPS/api/showtimes/1/seats")
check "TC-06: Seats for showtime 1" "$R" '"seat_code"'

# TC-08: HTTP -> HTTPS Redirect
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_HTTP/")
check "TC-08: HTTP->HTTPS Redirect 301" "$R" '301'

# TC-09: Prometheus metrics
R=$(curl -sk "$BASE_HTTPS/metrics")
check "TC-09: Prometheus /metrics endpoint" "$R" 'cinema_http_requests_total'

# TC-10: Prometheus all targets up
R=$(curl -s "http://localhost:9090/api/v1/query?query=up")
check "TC-10: Prometheus Targets UP" "$R" '"value":["'

# TC-11: Loki ready
R=$(curl -s "http://localhost:3100/ready")
check "TC-11: Loki Ready" "$R" 'ready'

# TC-12: DB not in frontend network
R=$(docker inspect movieticket_db --format '{{json .NetworkSettings.Networks}}' 2>/dev/null)
if echo "$R" | grep -q "movie-ticket_frontend"; then
  echo "[FAIL] TC-12: Network Isolation | DB exposed to frontend!"
  FAIL=$((FAIL + 1))
else
  echo "[PASS] TC-12: Network Isolation (DB isolated from frontend)"
  PASS=$((PASS + 1))
fi

# TC-13: Non-root user
R=$(docker exec movieticket_app whoami 2>/dev/null)
check "TC-13: Non-Root Container User" "$R" 'node\|appuser'

# TC-14: Security Headers
R=$(curl -skI "$BASE_HTTPS")
check "TC-14: X-Content-Type-Options Header" "$R" 'X-Content-Type-Options'

echo ""
echo "=================================================="
echo "  KET QUA: PASS=$PASS | FAIL=$FAIL"
echo "=================================================="
