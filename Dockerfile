# KAZI-1120 — CN Next.js SSR image for Aliyun SAE (ACR push target).
# Intl stays on Netlify; this image is for www.kazispace.cn / SAE only.
# Build: docker build -t kazispace-ai-cn:local .
# Run:   docker run --rm -p 3000:3000 kazispace-ai-cn:local

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-optional --ignore-scripts=false

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
# Align with netlify.toml [build.environment] so CN binary matches intl feature flags.
ENV NEXT_PUBLIC_IRP_PROFILE_ENABLED=true
ENV NEXT_PUBLIC_EPP_PROFILE_ENABLED=true
ENV NEXT_PUBLIC_SPACES_ENABLED=true
ENV NEXT_PUBLIC_WORKSPACE_ASSET_RAIL_V2=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
