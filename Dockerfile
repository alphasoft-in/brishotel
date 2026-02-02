# Stage 1: Build
FROM node:lts-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilar módulos nativos (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:lts-alpine AS runtime

WORKDIR /app

# Instalar dependencias de producción y herramientas para SQLite
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
# Copiar la DB y carpeta de datos si existen (aunque se recomienda usar volumen)
COPY --from=builder /app/src/data ./src/data
# Crear archivo de DB vacío si no existe para evitar errores en arranque limpio
RUN touch hotel.db

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
