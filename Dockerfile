# Image de production pour Coolify : build Vite + serveur Node (site et API sur le même port).
# NODE_ENV n'est défini qu'à l'exécution : en build, `npm ci` doit installer les outils de build.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
USER node
EXPOSE 3000
# 127.0.0.1 et non localhost : sur Alpine, localhost résout en IPv6.
HEALTHCHECK --start-period=30s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server-dist/index.cjs"]
