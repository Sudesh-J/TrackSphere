FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p uploads/assets uploads/invoices

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]
