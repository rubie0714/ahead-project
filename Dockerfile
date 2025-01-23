# Stage 1 (Build)
FROM node:22.12 AS builder

WORKDIR /app

COPY . .

RUN npm install && npm run build

# Stage 2 (Run)
FROM nginx:alpine


COPY --from=builder /app/dist /usr/share/nginx/html

# 確保靜態資料集檔案也被包含
COPY dataset /usr/share/nginx/html/dataset
