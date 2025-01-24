# Stage 1 (Build)
FROM node:22.12 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

# # Stage 2 (Run)
FROM nginx:alpine

VOLUME [ "/dataset" ]

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html