FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter backend

FROM base AS build
COPY tsconfig.base.json ./
COPY backend/tsconfig.json backend/
COPY backend/src backend/src
RUN pnpm --filter backend build

FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter backend --prod
COPY --from=build /app/backend/dist backend/dist
EXPOSE 8000
CMD ["node", "backend/dist/index.js"]
