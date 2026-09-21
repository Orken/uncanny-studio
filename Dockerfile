FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=3000 STORAGE_DIR=/app/storage WEB_DIST=/app/web
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./api
COPY --from=build /app/apps/api/assets ./assets
COPY --from=build /app/apps/web/dist/uncanny-web/browser ./web
RUN mkdir -p /app/storage
EXPOSE 3000
CMD ["node", "api/main.js"]

