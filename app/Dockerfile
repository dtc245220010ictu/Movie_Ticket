# ========================================================
# DOCKERFILE - BACKEND NODE.JS EXPRESS (HARDENED NON-ROOT)
# ========================================================

FROM node:20-alpine

# Thiết lập thư mục làm việc
WORKDIR /usr/src/app

# Cài đặt biến môi trường production
ENV NODE_ENV=production
ENV PORT=3000

# Copy file định nghĩa package trước để tận dụng Docker layer caching
COPY package*.json ./

# Cài đặt dependencies phục vụ production
RUN npm install --omit=dev && npm cache clean --force

# Copy toàn bộ mã nguồn ứng dụng
COPY . .

# PHÂN QUYỀN NON-ROOT USER:
# Cấp quyền sở hữu thư mục cho user `node` có sẵn trong image node:alpine
RUN chown -R node:node /usr/src/app

# Chuyển sang user `node` (UID 1000, không phải root UID 0)
USER node

# Mở cổng dịch vụ nội bộ
EXPOSE 3000

# HEALTHCHECK: Kiểm tra tính sẵn sàng của ứng dụng mỗi 15 giây
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Lệnh khởi chạy ứng dụng
CMD ["node", "server.js"]
