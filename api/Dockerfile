# syntax=docker/dockerfile:1

# ============ Stage 1: build ============
FROM node:24-bookworm-slim AS build
WORKDIR /app
# Prisma CLI (schema engine) cần openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# URL GIẢ, không bao giờ dùng để kết nối.
# prisma.config.ts gọi env('DATABASE_URL') / env('DIRECT_URL'): prisma generate không kết nối DB
# nhưng biến phải tồn tại, thiếu là báo lỗi. URL thật chỉ nằm trong .env.api trên VPS.
# ARG chỉ sống trong stage build, không lọt vào image chạy thật.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG DIRECT_URL=postgresql://build:build@localhost:5432/build

# Copy package trước để cache lớp npm ci: chỉ cài lại khi package*.json đổi
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ============ Stage 2: runtime ============
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Giữ nguyên node_modules (kể cả prisma CLI) để chạy được `prisma migrate deploy` trong container
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./

# Không chạy bằng root
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]