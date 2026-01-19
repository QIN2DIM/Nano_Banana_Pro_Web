# Build Stage
FROM node:25-alpine AS builder

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Production Stage
FROM nginx:1.28-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
