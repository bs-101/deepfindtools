FROM node:22-alpine AS next-builder

WORKDIR /app

ARG PUBLIC_BASE_URL=https://ai.deepfindtools.com
ENV PUBLIC_BASE_URL=$PUBLIC_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY next.config.mjs ./
COPY pages ./pages
COPY src ./src
COPY assets ./assets
COPY public ./public
COPY data ./data
RUN npm run build

FROM node:22-alpine AS frontend

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=next-builder /app/.next/standalone ./
COPY --from=next-builder /app/.next/static ./.next/static
COPY --from=next-builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]

FROM python:3.12-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=4173

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py ./
COPY data ./data
COPY scripts ./scripts
COPY assets ./assets
COPY public ./public

EXPOSE 4173

CMD ["python", "server.py"]
