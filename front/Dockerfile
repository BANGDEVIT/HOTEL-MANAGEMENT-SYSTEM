# syntax=docker/dockerfile:1
 
# ============ Stage 1: build ============
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite nhúng biến VITE_* vào bundle lúc build, không đọc được lúc chạy
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
 
# ============ Stage 2: nginx phục vụ file tĩnh + chuyển /api sang BE ============
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

# Không có CMD? Image nginx đã có sẵn CMD ["nginx", "-g", "daemon off;"]
# Không có USER? Image nginx tự xử lý: tiến trình chính chạy bằng root để mở được cổng 80 (cổng dưới 1024 cần quyền root), còn các tiến trình xử lý request chạy bằng user nginx