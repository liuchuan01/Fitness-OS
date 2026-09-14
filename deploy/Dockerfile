FROM node:22.23.1-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY dsh-fitness/automation-bridge/package.json ./dsh-fitness/automation-bridge/package.json
COPY dsh-fitness/surface/package.json ./dsh-fitness/surface/package.json
RUN npm ci

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts --offline --no-audit

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22.23.1-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DSH_WEB_BIND_HOST=0.0.0.0 \
    WORKSPACE_ROOT=/workspace
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/LICENSE ./LICENSE
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist-server/server ./server
COPY --from=build --chown=node:node /app/dist-server/shared ./shared
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dsh-fitness ./dsh-fitness
COPY --from=build --chown=node:node /app/resources ./resources
COPY --from=build --chown=node:node /app/templates ./templates
COPY --from=build --chown=node:node /app/examples ./examples
COPY --from=build --chown=node:node /app/docs ./docs
RUN mkdir -p /workspace/fitness /workspace/config /workspace/runtime && chown -R node:node /workspace
USER node
EXPOSE 8787 3080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
