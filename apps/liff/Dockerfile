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
ARG VITE_LIFF_ID_ADMISSION
ARG VITE_LIFF_ID_APPOINTMENT
ARG VITE_LIFF_ID_VISIT
ARG VITE_LIFF_ID_CONTRACT
ARG VITE_API_URL
ENV VITE_LIFF_ID_ADMISSION=$VITE_LIFF_ID_ADMISSION
ENV VITE_LIFF_ID_APPOINTMENT=$VITE_LIFF_ID_APPOINTMENT
ENV VITE_LIFF_ID_VISIT=$VITE_LIFF_ID_VISIT
ENV VITE_LIFF_ID_CONTRACT=$VITE_LIFF_ID_CONTRACT
ENV VITE_API_URL=$VITE_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/liff
RUN npm run build

# Production - serve static files via nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/liff/dist /usr/share/nginx/html/liff
COPY apps/liff/nginx-liff.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
