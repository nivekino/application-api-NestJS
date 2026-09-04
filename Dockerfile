# syntax=docker/dockerfile:1
#
# Imagen de la API para pruebas de Nivel B y despliegue. Dos etapas:
#   build   - instala TODO (npm ci), compila con nest build y poda las devDependencies.
#   runtime - solo dist/ + node_modules de produccion, usuario sin privilegios.
#
# La version de Node es la MISMA que .nvmrc (24.20.0): .npmrc tiene engine-strict y
# package.json exige >=24.15.0, asi que una base distinta haria fallar npm ci a proposito.
# Al mover el piso de Node (ver docs/verifications.md seccion 6) se cambia aqui tambien.
#
# Seguridad de datos: la imagen NO contiene .env, logs ni secretos (ver .dockerignore).
# Toda la configuracion entra por variables de entorno en tiempo de ejecucion.

FROM node:24.20.0-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24.20.0-bookworm-slim AS runtime
# Por omision la imagen arranca como produccion (synchronize apagado). compose.yaml lo
# sobreescribe a development para la base DESECHABLE del Nivel B.
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# winston escribe en ./logs (rotacion diaria): el usuario `node` debe poder crearlo.
RUN mkdir -p /app/logs && chown -R node:node /app
USER node

EXPOSE 3000

# Sin curl en la imagen slim: el healthcheck usa fetch() de Node contra GET /api/.
HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
