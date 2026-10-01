# Backend image for `docker compose up`.
#
# node:22 rather than 24 so the image matches the Node 18+ floor documented in
# backend/README.md while staying on a maintained release.
FROM node:22-bookworm-slim

WORKDIR /app

# sqlite3 is a native module and needs a toolchain to build. PostgreSQL is the
# real target, but the SQLite fallback must still work for local runs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Dependencies are installed before the source is copied, so a source-only edit
# does not invalidate the (slow) install layer.
COPY package.json package-lock.json* ./

RUN npm install --omit=dev || npm install

COPY . .

EXPOSE 3000

# `npm start` runs server.js: connect, sync the schema, listen.
CMD ["npm", "start"]
