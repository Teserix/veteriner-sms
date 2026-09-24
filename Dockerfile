# Veteriner SMS - üretim imajı
# node:sqlite yerleşik modülü Node >= 24 gerektirir; 22'ye düşürmeyin.
# İki aşama: bağımlılıklar ayrı katmanda kurulur, çalışma imajına yalnızca gerekenler kopyalanır.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public
COPY scripts ./scripts
# Hukuki metinler çalışma zamanında okunur (src/legal.js); imajda bulunmazsa uygulama açılmaz.
COPY docs/legal ./docs/legal
# /api/version bu dosyadan derleme zamanını okur (src/routes/ops.js -> ../../BUILD_TIME)
ARG BUILD_TIME=
RUN echo "${BUILD_TIME:-$(date -u +%FT%TZ)}" > /app/BUILD_TIME && mkdir -p /app/data && chown -R node:node /app
ENV NODE_ENV=production DATA_DIR=/app/data PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
