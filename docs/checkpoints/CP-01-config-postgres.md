# CP-01 — ConfigModule + conexión PostgreSQL

**Estado:** Hecho · **Depende de:** CP-00

## Objetivo
Reemplazar `config.ts` y `database.ts` del origen por la configuración tipada de NestJS y la conexión
a PostgreSQL vía TypeORM.

## Tareas
1. `ConfigModule.forRoot({ isGlobal: true })` en `app.module.ts`, con validación de variables
   (esquema con `class-validator` o `joi`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`,
   `JWT_SECRET`, `PORT`.
2. `TypeOrmModule.forRootAsync` usando `ConfigService`:
   - `type: 'postgres'`, host/port/username/password/database desde env.
   - `autoLoadEntities: true`.
   - `synchronize: true` **solo en desarrollo** (en prod, migraciones).
   - `retryAttempts` / `retryDelay` (equivalente a los reintentos de `database.ts`).
3. Crear `.env.example` con todas las variables (sin valores reales/secretos).

## Archivos a tocar
- `src/app.module.ts`
- `src/config/` (opcional: esquema de validación de env)
- `.env.example` (nuevo)

## Criterios de aceptación
- [ ] `npm run build` compila sin errores.
- [ ] Con un Postgres disponible y `.env` configurado, la app conecta al arrancar (sin errores de conexión).
- [ ] Si falta una variable obligatoria, la app falla al iniciar con mensaje claro de validación.

## Notas de ejecución

**Archivos creados/modificados:**
- `src/config/env.validation.ts` (nuevo) — esquema `EnvironmentVariables` con `class-validator` y función `validateEnv`. Valida `NODE_ENV`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`. En caso de error reporta solo propiedad + restricción, **nunca el valor** (no filtra secretos).
- `src/app.module.ts` — `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` y `TypeOrmModule.forRootAsync` con `ConfigService`: `type: 'postgres'`, host/port/user/pass/name desde env, `autoLoadEntities: true`, `synchronize` solo cuando `NODE_ENV !== 'production'`, `retryAttempts: 5`, `retryDelay: 5000` (equivalente a los reintentos de `database.ts`).
- `.env.example` (nuevo) — todas las variables con valores placeholder, sin secretos reales.

**Resultado del build:** `npm run build` compila sin errores.

**Decisiones / desviaciones:**
- Se usó validación con **class-validator** (ya instalado) en vez de joi, para no añadir dependencias.
- Verificación de conexión a Postgres en vivo y de fallo por variable faltante requieren BD/arranque. Verificación manual:
  1. Copiar `.env.example` a `.env` y completar credenciales de un Postgres local.
  2. `npm run start:dev` → debe conectar y, con `synchronize`, crear el esquema. Sin Postgres reintentará 5 veces (retryDelay 5s).
  3. Quitar p.ej. `JWT_SECRET` del `.env` → la app debe abortar al inicio con el mensaje `Validacion de variables de entorno fallida -> JWT_SECRET: ...`.
