# Multi-stage build for the CaterKart NestJS API.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# wget is used by the container healthcheck below; curl is not in the base image.
RUN apk add --no-cache wget

COPY package*.json ./
# `--omit=dev` drops the Prisma CLI, which the start command needs to run
# migrations. Copying the built CLI from the build stage keeps the runtime image
# lean AND pins it to the exact version resolved in package-lock — the previous
# `npx prisma` fetched it from the network on every container start, so a boot
# depended on npm being reachable and could pull a CLI newer than the
# @prisma/client it has to match.
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

# Drop privileges. `node` (uid 1000) ships with the base image. A process that
# never needs to write to its own image should not be able to: it turns a
# file-write primitive from a code-execution bug into a failed syscall.
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Liveness only — see src/health/health.controller.ts for why this must not
# check the databases: a brief Postgres blip would otherwise have Docker kill
# and restart every healthy container mid-outage.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

# Run pending migrations then boot. `migrate deploy` only applies committed
# migrations and never prompts, so it is safe to run unattended on every start.
#
# Invoked through its build entrypoint rather than `node_modules/.bin/prisma`:
# that symlink is written by npm at install time, and `npm ci --omit=dev` never
# installs the CLI, so the bin link does not exist in this stage even though the
# package was copied in from the build stage.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
