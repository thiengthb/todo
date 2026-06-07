# ---------- Stage 1: cài dependency ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- Stage 2: build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---------- Stage 3: runtime ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma engine trên alpine cần openssl; tzdata để TZ=Asia/Ho_Chi_Minh
# hoạt động đúng (app tính "hôm nay" theo giờ địa phương)
RUN apk add --no-cache openssl tzdata

# Output standalone của Next: server.js + node_modules đã tỉa gọn
# (migration chạy bằng service "migrate" riêng trong docker-compose,
#  dùng stage build có đủ prisma CLI — runtime image giữ gọn)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN mkdir -p /data && chown node:node /data
ENV DATABASE_URL="file:/data/todo.db"
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
