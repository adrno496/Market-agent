# Resolve and pin an approved current digest in the deployment pipeline before commercial release.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts/build.ts ./scripts/build.ts
RUN node --experimental-strip-types scripts/build.ts
FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/apps/web/server.js"]
