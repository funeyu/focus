FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]
