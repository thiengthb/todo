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

# ---------- Stage 2b: prisma CLI tối thiểu (chỉ để migrate deploy) ----------
# Cài riêng trong stage này để lấy đủ CLI + dependency của nó (effect, @prisma/config...)
# đúng version khai báo trong package.json, không phình node_modules của app.
FROM node:24-alpine AS prisma-cli
WORKDIR /cli
COPY package.json ./
RUN npm install --no-save --omit=dev prisma@"$(node -p "require('./package.json').devDependencies.prisma")"

# ---------- Stage 3: runtime ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma engine trên alpine cần openssl; tzdata để TZ=Asia/Ho_Chi_Minh
# hoạt động đúng (app tính "hôm nay" theo giờ địa phương)
RUN apk add --no-cache openssl tzdata

# Output standalone của Next: server.js + node_modules đã tỉa gọn
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Prisma CLI + schema/migrations để chạy "migrate deploy" lúc khởi động.
# Trên NUC, Watchtower pull image mới rồi restart container — migration mới
# (nếu có) tự áp vào DB trong volume /data, không cần service migrate riêng.
# Để CLI ở đường dẫn riêng, không đè node_modules đã tỉa của standalone.
COPY --from=prisma-cli /cli/node_modules ./prisma-cli/node_modules
COPY --from=build /app/prisma ./prisma

RUN mkdir -p /data && chown node:node /data
ENV DATABASE_URL="file:/data/todo.db"
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# git-SHA của image — MCP `ping` trả về để xác minh build nào đang chạy (mục 15)
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Áp migration vào /data trước rồi mới chạy server (exec để node nhận signal)
CMD ["sh", "-c", "./prisma-cli/node_modules/.bin/prisma migrate deploy && exec node server.js"]
