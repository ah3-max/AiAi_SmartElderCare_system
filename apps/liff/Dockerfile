FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/liff/package.json ./apps/liff/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=apps/liff --workspace=packages/shared --include-workspace-root

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/liff
RUN npm run build

# Production - serve static files via nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/liff/dist /usr/share/nginx/html/liff
COPY apps/liff/nginx-liff.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
