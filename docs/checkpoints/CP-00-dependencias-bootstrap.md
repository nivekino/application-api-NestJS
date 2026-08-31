# CP-00 — Dependencias y bootstrap

**Estado:** Hecho · **Depende de:** —

## Objetivo
Instalar las dependencias necesarias para toda la migración y dejar `main.ts` listo con la
configuración base de la aplicación (validación global, prefijo, CORS, helmet y Swagger).

## Tareas
1. Instalar dependencias de producción:
   ```
   @nestjs/typeorm typeorm pg @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
   class-validator class-transformer bcrypt @nestjs/swagger nest-winston winston helmet
   ```
2. Instalar dev dependencies de tipos:
   ```
   @types/passport-jwt @types/bcrypt
   ```
3. Configurar `src/main.ts`:
   - `app.setGlobalPrefix('api')`.
   - `ValidationPipe` global: `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
   - `app.enableCors(...)` (métodos `GET, POST, PUT, DELETE, OPTIONS`, headers `Content-Type, Authorization`).
   - `app.use(helmet())`.
   - Swagger (`DocumentBuilder` + `SwaggerModule.setup('api/docs', ...)`), con esquema Bearer JWT.
   - Puerto desde `process.env.PORT ?? 3000`.

## Archivos a tocar
- `package.json` (dependencias)
- `src/main.ts`

## Criterios de aceptación
- [ ] `npm run build` compila sin errores.
- [ ] `npm run start:dev` levanta la app en el puerto configurado.
- [ ] `GET /api/docs` responde con la UI de Swagger.

## Notas de ejecución

**Archivos modificados:**
- `package.json` — dependencias de producción y dev instaladas.
- `src/main.ts` — bootstrap con prefijo `/api`, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), CORS (GET/POST/PUT/DELETE/OPTIONS, headers Content-Type/Authorization), `helmet()`, Swagger en `/api/docs` con esquema Bearer JWT (`addBearerAuth` nombre `access-token`) y puerto desde `process.env.PORT ?? 3000`.

**Dependencias instaladas:**
- Producción: `@nestjs/typeorm typeorm pg @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt class-validator class-transformer bcrypt @nestjs/swagger nest-winston winston helmet`.
- Dev: `@types/passport-jwt @types/bcrypt`.

**Resultado del build:** `npm run build` (nest build) compila sin errores.

**Desviaciones / notas de entorno:**
- El entorno corre **Node v18.16.1**. La resolución por defecto traía `typeorm@1.0.0` (requiere Node >=20.19), incompatible. Se **fijó `typeorm@0.3.20`** (línea estable compatible con Node 18 y NestJS 11). Recomendado al usuario alinear Node >=20 LTS en producción.
- `npm install` reporta avisos `EBADENGINE` (varias dependencias piden Node >=18.18/20) por la versión de Node del entorno; no bloquean el build. También hay avisos de `npm audit` (vulnerabilidades en árbol transitivo) a revisar por separado.
- Verificación de `GET /api/docs` (UI Swagger) y `start:dev` requieren ejecución en vivo; quedan como verificación manual del usuario (no hay forma de levantar el servidor de forma persistente en este entorno).
