# CP-06 — Tests y verificación end-to-end

**Estado:** Hecho (parcial: e2e con BD pendiente de verificación manual) · **Depende de:** CP-05

## Objetivo
Añadir cobertura de tests (el origen no tenía) y verificar el flujo completo de la API migrada.

## Tareas
1. Tests unitarios:
   - `PasswordService`: `hash` produce hash válido; `compare` true/false correctos.
   - `AuthService`: login exitoso firma token y actualiza `lastTokenIssuedAt`; credenciales malas → error.
   - `UsersService`: `create` hashea y no expone password; `list` devuelve DTO público.
2. Test e2e (`test/`):
   - `POST /api/auth/login` → token.
   - `POST /api/users` y `GET /api/users` con `Authorization: Bearer <token>`.
   - Acceso sin token → 401.
   - Token previo tras re-login → 401 (invalidación).
3. Documentar resultados en este archivo.

## Archivos a tocar
- `src/**/*.spec.ts`
- `test/app.e2e-spec.ts` (y nuevos e2e)

## Criterios de aceptación
- [ ] `npm test` (unitarios) en verde.
- [ ] `npm run test:e2e` en verde (requiere Postgres de prueba o contenedor).
- [ ] Verificación manual de los 8 pasos de la sección "Verificación end-to-end" del plan.

## Notas de ejecución

**Archivos creados/modificados:**
- `src/users/password.service.spec.ts` — `hash` produce hash bcrypt (`$2...`) distinto del texto plano; `compare` true/false correctos.
- `src/users/users.service.spec.ts` — con repo y `PasswordService` simulados: `create` hashea y devuelve DTO **sin password**; `list` devuelve solo campos públicos (sin password ni email).
- `src/auth/auth.service.spec.ts` — login exitoso firma token y actualiza `lastTokenIssuedAt` con el mismo `iat` (expiración `8h`); usuario inexistente y contraseña incorrecta → `UnauthorizedException` (401) sin actualizar `lastTokenIssuedAt`.
- `src/auth/strategies/jwt.strategy.spec.ts` — regla de invalidación: rechaza si no existe usuario, acepta si `iat >= lastTokenIssuedAt`, **rechaza el token previo si `iat < lastTokenIssuedAt`** (re-login), acepta si `lastTokenIssuedAt` es null, y coerce el bigint-string del driver pg.
- `src/app.controller.spec.ts` — actualizado al nuevo health (`{ msg: 'Server is up and running' }`).
- `test/app.e2e-spec.ts` — flujo e2e (health, 401 sin token, login + listar con Bearer). Carga `AppModule` de forma diferida y **se omite (skip)** si no hay variables de BD, para no fallar sin Postgres.

**Resultado de tests:**
- `npm test` (unitarios): **5 suites, 14 tests, todos en verde.**
- `npm run test:e2e`: **3 tests omitidos (skip)** por ausencia de Postgres/`.env`. La suite compila y se ejecuta sin error.
- `npm run build`: compila sin errores.

**Hallazgo de entorno importante (bloqueante para arranque/e2e en vivo):**
- Con **Node v18.16.1**, al inicializar `TypeOrmModule.forRootAsync` se produce `ReferenceError: crypto is not defined` (NestJS/TypeORM usan el `crypto` global, disponible solo en Node >= 20). Esto **también afecta `npm run start:dev`** y la corrida e2e con BD. **Solución: usar Node >= 20 LTS** (alineado con los avisos `EBADENGINE` de la instalación). En CP-00 ya se fijó `typeorm@0.3.20` por la misma razón de compatibilidad.

## Pasos manuales pendientes (verificación end-to-end con BD)
1. **Node >= 20 LTS** instalado (requisito para evitar el error `crypto is not defined`).
2. Levantar PostgreSQL (Docker: `docker run --name api-pg -e POSTGRES_PASSWORD=... -e POSTGRES_DB=application_api -p 5432:5432 -d postgres`).
3. Copiar `.env.example` a `.env` y completar `DB_*` y un `JWT_SECRET` largo y aleatorio.
4. `npm run start:dev` → conecta a Postgres y, con `synchronize`, crea la tabla `users`.
5. Sembrar un usuario admin (vía SQL o un primer `POST /api/users` temporalmente sin guard) para poder autenticar.
6. Ejecutar los 8 pasos de "Verificación end-to-end" del plan, incluyendo el re-login y el rechazo del token previo (401).
7. Con `.env` cargado en el entorno, `npm run test:e2e` ejecutará (no omitirá) la suite.
