# 🎬 CYBER CINEMA — Hệ Thống Đặt Vé Xem Phim Trực Tuyến

<div align="center">

[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x_LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Nginx](https://img.shields.io/badge/Nginx-1.27-009639?logo=nginx&logoColor=white)](https://nginx.org/)
[![Grafana](https://img.shields.io/badge/Grafana-11.3-F46800?logo=grafana&logoColor=white)](https://grafana.com/)
[![Loki](https://img.shields.io/badge/Loki-3.2-F46800?logo=grafana&logoColor=white)](https://grafana.com/oss/loki/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Do an De 11 -- Mon: Trien khai va Quan tri He thong Phan mem**

*He thong dat ve xem phim hoan chinh trien khai bang Docker Compose voi giam sat, logging tap trung va bao mat nang cao.*

</div>

---

## Muc Luc

- [Tong Quan He Thong](#tong-quan-he-thong)
- [Kien Truc](#kien-truc)
- [Danh Sach Services](#danh-sach-services)
- [Yeu Cau He Thong](#yeu-cau-he-thong)
- [Huong Dan Trien Khai](#huong-dan-trien-khai)
- [Truy Cap He Thong](#truy-cap-he-thong)
- [Tinh Nang Chuc Nang](#tinh-nang-chuc-nang)
- [API Documentation](#api-documentation)
- [Giam Sat va Logging](#giam-sat-va-logging)
- [Bao Mat Hardening](#bao-mat-hardening)
- [Cau Truc Du An](#cau-truc-du-an)
- [Test Cases](#test-cases)
- [Xu Ly Su Co](#xu-ly-su-co)

---

## Tong Quan He Thong

**CYBER CINEMA** la he thong dat ve xem phim truc tuyen duoc xay dung hoan chinh tren nen tang **Docker Compose** voi day du cac thanh phan:

| Thanh phan | Mo ta |
|---|---|
| Web App | Giao dien nguoi dung hien dai, dark-mode cinema theme |
| Backend API | RESTful API bang Node.js / Express |
| Database | MySQL 8.0 voi schema dat ve phim day du |
| HTTPS | TLS/SSL tu ky qua Nginx Reverse Proxy |
| Monitoring | Prometheus + Grafana dashboards |
| Logging | Loki + Promtail thu thap log tap trung |
| Security | Non-root container, network isolation, security headers |

### Thong Ke Du Lieu Mau

- **5 phim** dang chieu va sap chieu
- **77 suat chieu** tu 21/10 den 27/10/2026 tai 2 phong chieu
- **70 ghe tong cong**: phong 1 co 40 ghe, phong 2 co 30 ghe; moi suat chi dung ghe cua phong tuong ung
- Ho tro dat ve theo thoi gian thuc voi kiem tra xung dot

---

## Kien Truc

```
                    +-----------------------------------------+
                    |           USER (BROWSER)                |
                    |     http://localhost:8080               |
                    |     https://localhost:8443              |
                    +------------------+----------------------+
                                       |
                    +------------------v----------------------+
                    |       NGINX REVERSE PROXY               |
                    |  (:80 -> HTTPS redirect)                |
                    |  (:443 SSL/TLS + Security Headers)      |
                    |  nginx:1.27.3-alpine                    |
                    +------------------+----------------------+
                                       | [frontend network]
          +----------------------------v--------------------+
          |          NODE.JS / EXPRESS APPLICATION          |
          |         movieticket-app:1.0.0                   |
          |    /api/movies  /api/showtimes  /api/bookings   |
          |    /metrics (Prometheus)  /health               |
          +----------------------------+--------------------+
                                       | [backend network]
          +----------------------------v--------------------+
          |              MYSQL 8.0                          |
          |         cinema_booking database                 |
          |   movies | showtimes | seats | bookings         |
          +----------------------------------------------------+

  +-------------------- MONITORING STACK --------------------------+
  |                                                               |
  |  Prometheus <-- scrape -- [app /metrics, nginx_exporter,      |
  |     :9090                  mysql_exporter, cadvisor]          |
  |      |                                                        |
  |  Grafana <----------- Loki <-- Promtail <-- Container logs    |
  |  :3002                :3100                                   |
  +----------------------------------------------------------------+

  +-------------------- NETWORK ISOLATION -------------------------+
  |  frontend:   nginx <-> app <-> prometheus                      |
  |  backend:    app <-> db <-> mysql_exporter                     |
  |  dbadmin:    db <-> pma                                        |
  |  monitoring: prometheus <-> grafana <-> loki <-> promtail      |
  +----------------------------------------------------------------+
```

---

## Danh Sach Services

| # | Service | Image | Container | Mo ta |
|---|---|---|---|---|
| 1 | db | mysql:8.0.40 | movieticket_db | Co so du lieu MySQL |
| 2 | app | movieticket-app:1.0.0 | movieticket_app | Backend Node.js API |
| 3 | nginx | nginx:1.27.3-alpine | movieticket_nginx | Reverse Proxy + HTTPS |
| 4 | pma | phpmyadmin:5.2.1 | movieticket_pma | Quan tri Database |
| 5 | mysql_exporter | prom/mysqld-exporter:v0.15.1 | movieticket_mysql_exporter | MySQL Metrics |
| 6 | nginx_exporter | nginx/nginx-prometheus-exporter:1.4.1 | movieticket_nginx_exporter | Nginx Metrics |
| 7 | cadvisor | ghcr.io/google/cadvisor:v0.60.5 | movieticket_cadvisor | Container Metrics |
| 8 | prometheus | prom/prometheus:v2.55.1 | movieticket_prometheus | Metrics Aggregation |
| 9 | grafana | grafana/grafana:11.3.0 | movieticket_grafana | Visualization |
| 10 | loki | grafana/loki:3.2.1 | movieticket_loki | Log Storage |
| 11 | promtail | grafana/promtail:3.2.1 | movieticket_promtail | Log Collector |

---

## Yeu Cau He Thong

| Phan mem | Phien ban toi thieu | Ghi chu |
|---|---|---|
| Docker Desktop | 4.x tro len | Can bat WSL2 tren Windows |
| Docker Compose | v2.x (plugin) | Tich hop san trong Docker Desktop |
| Git | 2.x | De clone repository |
| RAM | 4 GB toi thieu | 8 GB khuyen nghi |
| Disk | 5 GB trong | Cho images va volumes |
| OS | Windows 10/11, macOS, Linux | |

---

## Huong Dan Trien Khai

### Buoc 1: Clone Repository

```bash
git clone https://github.com/dtc245220010ictu/Movie_Ticket.git
cd Movie_Ticket
```

### Buoc 2: Tao File Bien Moi Truong

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

> QUAN TRONG: Chinh sua file `.env` de thay doi mat khau mac dinh truoc khi trien khai production!

### Buoc 3: Tao Chung Chi SSL Tu Ky

```bash
# Dung Git Bash hoac OpenSSL
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -subj "/C=VN/ST=HaNoi/L=HaNoi/O=ICTU/OU=IT/CN=localhost"
```

### Buoc 4: Khoi Chay Toan Bo He Thong

```bash
# Build image va khoi dong tat ca services
docker compose up --build -d

# Theo doi logs khoi dong
docker compose logs -f --tail=50
```

### Buoc 5: Kiem Tra Trang Thai

```bash
# Xem trang thai tat ca containers
docker compose ps

# Kiem tra health check
curl -sk https://localhost:8443/health
```

Ket qua mong doi:
```json
{"status":"UP","uptime":123,"timestamp":"...","database":"connected","version":"1.0.0"}
```

### Dung He Thong

```bash
# Dung va xoa containers (giu data volumes)
docker compose down

# Dung va xoa toan bo bao gom volumes (CANH BAO: mat du lieu)
docker compose down -v
```

---

## Truy Cap He Thong

| Service | URL | Thong tin dang nhap |
|---|---|---|
| Ung dung Web | https://localhost:8443 | --- |
| HTTP (redirect) | http://localhost:8080 | tu dong chuyen HTTPS |
| phpMyAdmin | http://localhost:8081 | user: cinema_user / pass: tu .env |
| Grafana | http://localhost:3002 | user: admin / pass: GrafanaSecret2026! |
| Prometheus | http://localhost:9090 | --- |
| Loki | http://localhost:3100 | --- |
| cAdvisor | http://localhost:8082 | --- |

> Luu y: Trinh duyet se canh bao ve chung chi SSL tu ky. Nhan "Advanced -> Proceed to localhost" de tiep tuc.

---

## Tinh Nang Chuc Nang

### Nguoi Dung (Frontend)
- Danh sach phim -- Hien thi phim dang chieu / sap chieu voi filter tabs
- Chi tiet phim -- Poster, the loai, thoi luong, xep hang, mo ta
- Chon suat chieu -- Loc theo phim, chon ngay/gio va rap chieu
- Chon ghe ngoi -- So do ghe truc quan, phan biet ghe trong/da dat/dang chon
- Dat ve -- Form nhap thong tin khach hang, xac nhan dat ve
- Xem booking -- Kiem tra ma dat ve da tao
- Ve cua toi -- Xem danh sach ve da dat (tim theo email hoac ve luu tren thiet bi), tiep tuc thanh toan / huy ve / xem lai e-ticket
- Giao dien Responsive -- Tuong thich mobile, tablet, desktop

### Quan Tri (Admin)
- phpMyAdmin -- Quan ly truc tiep CSDL MySQL
- Grafana Dashboards -- Theo doi metrics he thong thoi gian thuc
- Loki Logs -- Tra cuu logs tap trung cua tat ca containers

---

## API Documentation

Base URL: `https://localhost:8443/api`

### Movies

| Method | Endpoint | Mo ta |
|---|---|---|
| GET | /movies | Lay danh sach tat ca phim |
| GET | /movies/:id | Lay chi tiet mot phim |
| GET | /movies?status=now_showing | Loc phim dang chieu |
| GET | /movies?status=coming_soon | Loc phim sap chieu |

Response mau `/api/movies`:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Dune: Hanh Tinh Cat - Phan 2",
      "genre": "Khoa hoc vien tuong, Hanh dong",
      "duration": 166,
      "rating": "C16",
      "status": "now_showing"
    }
  ]
}
```

### Showtimes

| Method | Endpoint | Mo ta |
|---|---|---|
| GET | /showtimes | Lay toan bo suat chieu con hieu luc |
| GET | /showtimes/:id/seats | Danh sach ghe cua suat chieu |

### Bookings

| Method | Endpoint | Mo ta |
|---|---|---|
| POST | /bookings | Tao dat ve moi |
| GET | /bookings/:bookingCode | Tra cuu booking theo ma |
| GET | /my-tickets?email=student@gmail.com | Lay danh sach ve da dat theo email |
| GET | /my-tickets?codes=BK-001,BK-002 | Lay danh sach ve theo danh sach ma ve (toi da 20 ma) |

Request body `POST /api/bookings`:
```json
{
  "showtime_id": 1,
  "seat_ids": [1, 2, 3],
  "customer_name": "Nguyen Van A",
  "customer_email": "nguyenvana@gmail.com",
  "customer_phone": "0912345678"
}
```

### System

| Method | Endpoint | Mo ta |
|---|---|---|
| GET | /health | Health check (DB + uptime) |
| GET | /metrics | Prometheus metrics endpoint |

---

## Giam Sat va Logging

### Prometheus Targets

Truy cap http://localhost:9090/targets de xem tat ca targets:

| Job | URL | Metric |
|---|---|---|
| cinema_backend | app:3000/metrics | HTTP request rate, latency, booking count |
| nginx | nginx_exporter:9113 | Connections, request rate |
| mysql | mysql_exporter:9104 | Queries/s, connections, slow queries |
| cadvisor | cadvisor:8080 | CPU, RAM, Network per container |
| prometheus | prometheus:9090 | Self-monitoring |

### Grafana Dashboards

Truy cap http://localhost:3002; tai khoan lay tu cau hinh `.env`:

1. **Cinema System / He Thong Dat Ve Xem Phim** -- HTTP requests, P95, booking events, MySQL/Nginx va CPU/RAM container
2. **Explore -> Loki** -- Tra cuu logs tap trung. Du an khong khai bao node-exporter.

`cinema_bookings_total` dem su kien trang thai, khong phai so don duy nhat hoac doanh thu.

### Loki Log Queries (LogQL)

```logql
# Logs tu app container
{container="movieticket_app"}

# Logs loi tu tat ca containers
{container=~"movieticket_.+"} |~ "(?i)error"

# Tong so dong log trong cua so truot 5 phut
sum(count_over_time({container=~"movieticket_.+"}[5m]))
```

---

## Bao Mat Hardening

### 1. Non-Root Container User

```dockerfile
# app/Dockerfile
USER node   # User co san trong node:alpine, UID 1000; khong phai root
```

### 2. Network Isolation

```yaml
networks:
  frontend:   # nginx <-> app <-> prometheus
  backend:    # app <-> db <-> mysql_exporter
  dbadmin:    # db <-> pma (phpMyAdmin)
  monitoring: # prometheus <-> grafana <-> loki <-> cadvisor
```

> db KHONG ket noi truc tiep voi frontend network -- nguoi dung web khong the truy cap database truc tiep.

### 3. HTTPS va TLS Security Headers

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "...";
```

### 4. Ports Binding (Localhost Only)

```yaml
# Chi bind 127.0.0.1 -- khong expose ra mang ngoai
ports:
  - "127.0.0.1:8080:80"
  - "127.0.0.1:8443:443"
  - "127.0.0.1:3002:3000"   # Grafana
  - "127.0.0.1:9090:9090"   # Prometheus
```

### 5. Bi Mat Duoc Bao Ve

- File `.env` duoc them vao `.gitignore` -- khong bao gio commit mat khau
- File `.env.example` cung cap template cho nguoi dung moi
- Runtime doc mat khau qua bien moi truong. Compose/backend/SQL khoi tao con gia tri mau; can thay va dong bo tai khoan DB truoc khi trien khai that.

### 6. Health Checks

App, DB, Nginx va mot so dich vu quan sat co healthcheck. Nginx kiem tra HTTP `/nginx_health` va tra loi that khi kiem tra that bai. `restart: unless-stopped` xu ly khi tien trinh dung, khong tu khoi dong lai chi vi container bi unhealthy.

---

## Cau Truc Du An

```
Movie_Ticket/
|-- compose.yaml              # Orchestration toan bo 11 services
|-- .env                      # Bien moi truong thuc te (gitignored)
|-- .env.example              # Template bien moi truong
|-- .gitignore                # Loai tru secrets va node_modules
|-- README.md                 # Tai lieu nay
|
|-- app/                      # Node.js Backend Application
|   |-- Dockerfile            # Non-root user, healthcheck
|   |-- package.json          # Dependencies: express, mysql2, prom-client
|   |-- server.js             # Express API + Prometheus metrics
|   `-- public/               # Frontend Static Files
|       |-- index.html        # SPA HTML5 semantic structure
|       |-- style.css         # Dark-mode cinema theme CSS
|       `-- app.js            # Frontend JavaScript (fetch API)
|
|-- mysql/
|   `-- init.sql              # Schema + Seed data (5 phim, 7 suat, 70 ghe)
|
|-- nginx/
|   `-- default.conf          # HTTP->HTTPS redirect, security headers
|
|-- certs/                    # SSL Certificates (gitignored)
|   |-- server.key            # Private key
|   `-- server.crt            # Self-signed certificate
|
|-- prometheus/
|   `-- prometheus.yml        # Scrape configs cho 5 targets
|
|-- grafana/
|   `-- provisioning/         # Auto-provision datasources + dashboards
|
|-- loki/
|   `-- loki-config.yaml      # Loki log storage configuration
|
`-- promtail/
    `-- promtail-config.yaml  # Thu thap Docker container logs
```

---

## Test Cases

### TC-01: Health Check API

```bash
curl -sk https://localhost:8443/health
```
Expected: `{"status":"UP","database":"connected",...}` PASS

### TC-02: Lay Danh Sach Phim

```bash
curl -sk https://localhost:8443/api/movies
```
Expected: JSON array 5 phim, "success": true  PASS

### TC-03: Loc Phim Dang Chieu

```bash
curl -sk "https://localhost:8443/api/movies?status=now_showing"
```
Expected: Chi phim co "status":"now_showing"  PASS

### TC-04: Chi Tiet Phim

```bash
curl -sk https://localhost:8443/api/movies/1
```
Expected: Chi tiet phim ID=1 (Dune)  PASS

### TC-05: Danh Sach Suat Chieu

```bash
curl -sk "https://localhost:8443/api/showtimes"
```
Expected: Danh sach cac suat chieu con hieu luc, "success": true  PASS

### TC-06: Danh Sach Ghe

```bash
curl -sk https://localhost:8443/api/showtimes/1/seats
```
Expected: 10 hang x 7 ghe = 70 ghe voi status  PASS

### TC-07: Dat Ve

```bash
curl -sk -X POST https://localhost:8443/api/bookings \
  -H "Content-Type: application/json" \
  -d "{\"showtime_id\":1,\"seat_ids\":[5,6],\"customer_name\":\"Test User\",\"customer_email\":\"test@test.com\",\"customer_phone\":\"0900000000\"}"
```
Expected: `{"success":true,"booking_code":"BK...","total_price":...}`  PASS

### TC-08: HTTP Redirect to HTTPS

```bash
curl -v http://localhost:8080/ 2>&1 | grep -E "301|Location"
```
Expected: 301 Moved Permanently voi Location: https://...  PASS

### TC-09: Prometheus Metrics

```bash
curl -sk https://localhost:8443/metrics | grep "http_requests_total"
```
Expected: Counter metrics hien thi  PASS

### TC-10: Prometheus Targets All Up

```bash
curl -s "http://localhost:9090/api/v1/query?query=up"
```
Expected: Tat ca jobs value = 1 (up)  PASS

### TC-11: Loki Ready

```bash
curl http://localhost:3100/ready
```
Expected: `ready`  PASS

### TC-12: Network Isolation (DB khong thuoc frontend)

```bash
docker inspect movieticket_db --format "{{json .NetworkSettings.Networks}}"
```
Expected: Khong co "movie-ticket_frontend" trong ket qua  PASS

### TC-13: Non-Root Container User

```bash
docker exec movieticket_app whoami
```
Expected: `node` (khong phai root). Chi ghi PASS sau khi chay lenh tren moi truong hien tai.

### TC-14: Security Headers

```bash
curl -skI https://localhost:8443 | grep -i "x-content\|x-frame\|x-xss"
```
Expected: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection  PASS

### TC-15: My Tickets (Ve cua toi theo email)

```bash
curl -sk "https://localhost:8443/api/my-tickets?email=an.nguyen@example.com"
```
Expected: `"success":true` va mang `data` chua booking + details ve  PASS

---

## Xu Ly Loi Font Chu Vietnamese (Mojibake)

**Nguyen nhan:** du lieu seed trong `mysql/init.sql` bi encode 2 lan (mysql CLI chay voi `character_set_client=latin1`), nen ten phim hien thanh `Dune: HÃ­nh Tinh CÃ¡t`.

**Cach sua da ap dung:**
1. `compose.yaml` (db service): them `command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci` (khong dung mount my.cnf vi Docker Desktop mount permission 666 bi MySQL tu choi).
2. `nginx/default.conf`: header `add_header Content-Type "text/html; charset=UTF-8"` + `charset utf-8;`
3. Du lieu trong volume cu da hong -> chay lai init.sql voi client utf8mb4:

```bash
docker exec movieticket_db sh -c 'mysql --default-character-set=utf8mb4 -uroot -p$MYSQL_ROOT_PASSWORD < /docker-entrypoint-initdb.d/init.sql'
```

4. Kiem tra lai: `SELECT HEX(title) FROM movies;` -> chu "Hanh" co byte `48C3A06E68` (UTF-8 dung) thay vi `48C383C2AD` (bi mojibake).

### Lan 2: Genre + Description Van Bi Mojibake (Da Xu Ly)

**Nguyen nhan:** clause `ON DUPLICATE KEY UPDATE title=VALUES(title)` chi lam moi cot `title` khi re-run init.sql, nen `genre` va `description` (vi du mo ta phim Exhuma van hien `Má»™t gia Ä'Ã¬nh...`) van con du lieu mojibake cu trong volume.

**Cach sua da ap dung:**
1. `mysql/init.sql`: them `SET NAMES utf8mb4;` ngay sau lenh `USE cinema_booking;` (ep client charset khi seed, khong phu thuoc vao mac dinh cua mysql client).
2. `mysql/init.sql` (bang movies): broadens clause `ON DUPLICATE KEY UPDATE` day du cac cot seed: `title, genre, duration, description, poster_url, rating, status, release_date` — de moi lan re-run tu chua het cac cot van ban (truoc do chi sua title nen genre/description hong).
3. Re-run lai init.sql dung lenh o muc 3 ben tren (file da duoc mount vao container qua bind mount nen khong can rebuild image):

```bash
docker exec movieticket_db sh -c 'mysql --default-character-set=utf8mb4 -uroot -p$MYSQL_ROOT_PASSWORD < /docker-entrypoint-initdb.d/init.sql'
```

4. Kiem tra sau fix:
   - `SELECT HEX(LEFT(description,5)) FROM movies WHERE id=4;` -> `4DE1BB9974` ("Mot" UTF-8 dung) thay vi `4DC3A1C2BBE284A274` (mojibake `Má»™t`).
   - `SELECT COUNT(*) FROM movies WHERE genre REGEXP 'Ã[^ -~]|Ä.' OR description REGEXP 'Ã[^ -~]|Ä.';` -> `0` (khong con mojibake).
   - `curl -sk https://localhost:8443/api/movies` -> ten phim / the loai / mo ta tieng Viet sach; header co `charset=utf-8`.

---

## Xu Ly Su Co

### Containers Khong Khoi Dong

```bash
docker compose logs app
docker compose logs db
docker compose restart app
```

### Loi Port Bi Chiem

```bash
# Windows
netstat -ano | findstr :8443
netstat -ano | findstr :8080
```

### Database Khong Ket Noi

```bash
docker exec movieticket_db mysqladmin ping -h 127.0.0.1
docker compose logs db
```

### Reset Toan Bo (Fresh Start)

```bash
docker compose down -v
docker rmi movieticket-app:1.0.0
docker compose up --build -d
```

---

## Cong Nghe Su Dung

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.x LTS Alpine |
| Framework | Express.js | 4.x |
| Database | MySQL | 8.0.40 |
| Reverse Proxy | Nginx | 1.27.3-alpine |
| Containerization | Docker Compose | v2.x |
| Monitoring | Prometheus | v2.55.1 |
| Dashboards | Grafana | 11.3.0 |
| Log Storage | Grafana Loki | 3.2.1 |
| Log Collector | Promtail | 3.2.1 |
| DB Admin | phpMyAdmin | 5.2.1 |
| Container Metrics | cAdvisor | v0.60.5 |

---

## Thong Tin Du An

| | |
|---|---|
| De tai | De 11 -- He thong Dat ve Xem phim / Su kien |
| Mon hoc | Trien khai va Quan tri He thong Phan mem |
| Repository | https://github.com/dtc245220010ictu/Movie_Ticket |

---

## License

MIT License
