FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

# Public API URL baked into the SPA at build time.
# Leave empty in production so the browser uses same-origin /api (nginx).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist

EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
