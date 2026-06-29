# CP-04 — Módulo Auth: JWT + Guard

**Estado:** Hecho · **Depende de:** CP-03 · **Responsable:** `nestjs-migrator`

## Objetivo
Migrar la autenticación: login con JWT, estrategia Passport con la regla de invalidación de tokens, y
protección de las rutas de Users. Replica `auth.service.ts`, `jwt.strategy.ts` y `auth.controller.ts`.

## Tareas
1. `auth/dto/auth-credentials.dto.ts`: `username` (`@IsString`), `password` (`@IsString @MinLength(6)`) + `@ApiProperty`.
2. `auth/auth.service.ts` (`@Injectable`), usando `UsersService` + `PasswordService` + `JwtService`:
   - `login(dto)`: buscar por username, comparar bcrypt, calcular `iat = floor(Date.now()/1000)`,
     **actualizar `lastTokenIssuedAt`**, firmar JWT `{ sub, username, role, iat }` con expiración **8h**,
     devolver `{ token }`.
   - Errores: usuario/contraseña incorrectos → 401.
3. `auth/strategies/jwt.strategy.ts` (`PassportStrategy(Strategy)`):
   - `secretOrKey` desde `ConfigService` (`JWT_SECRET`), `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()`.
   - `validate(payload)`: cargar usuario por `payload.sub`; **rechazar si `payload.iat < user.lastTokenIssuedAt`**.
4. `auth/guards/jwt-auth.guard.ts` → `AuthGuard('jwt')`.
5. `auth/auth.module.ts`: `JwtModule.registerAsync` (secret desde config), `PassportModule`, importar `UsersModule`.
6. `auth/auth.controller.ts`: `POST /api/auth/login` (+ Swagger).
7. Proteger Users: `@UseGuards(JwtAuthGuard)` en `POST /api/users` y `GET /api/users`; `@ApiBearerAuth()`.

## Archivos a tocar
- `src/auth/` (module, controller, service, strategies/, guards/, dto/)
- `src/users/users.controller.ts` (añadir guards)
- `src/app.module.ts` (importar `AuthModule`)

## Criterios de aceptación
- [ ] `npm run build` compila sin errores.
- [ ] `POST /api/auth/login` con credenciales válidas devuelve `{ token }`.
- [ ] Rutas de Users sin Bearer válido → 401.
- [ ] Tras un nuevo login, un token anterior es rechazado (regla `iat < lastTokenIssuedAt`).

## Notas de ejecución

**Archivos creados/modificados:**
- `src/auth/dto/auth-credentials.dto.ts` — `username` (`@IsString`), `password` (`@IsString @MinLength(6)`) + `@ApiProperty`.
- `src/auth/auth.service.ts` — `login`: busca por username, compara bcrypt, calcula `iat = floor(Date.now()/1000)`, **actualiza `lastTokenIssuedAt`** y firma JWT `{ sub, username, role, iat }` con `expiresIn: '8h'`. Credenciales malas → `UnauthorizedException` (401). Exporta la interfaz `JwtPayload`.
- `src/auth/strategies/jwt.strategy.ts` — `PassportStrategy(Strategy)`, `secretOrKey` desde `ConfigService` (`JWT_SECRET`), `ExtractJwt.fromAuthHeaderAsBearerToken()`. `validate` carga por `payload.sub` y **rechaza si `payload.iat < Number(user.lastTokenIssuedAt)`** (coerción por bigint→string del driver pg).
- `src/auth/guards/jwt-auth.guard.ts` — `AuthGuard('jwt')`.
- `src/auth/auth.controller.ts` — `POST /api/auth/login` (HTTP 200) + Swagger.
- `src/auth/auth.module.ts` — `JwtModule.registerAsync` (secret desde config), `PassportModule`, importa `UsersModule`.
- `src/users/users.controller.ts` — `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth('access-token')` a nivel de controller (protege POST y GET).
- `src/app.module.ts` — import de `AuthModule`.

**Resultado del build:** `npm run build` compila sin errores.

**Correcciones / desviaciones:**
- Se corrigió la ruta de imports en `jwt.strategy.ts` a `../../users/...` (la carpeta `strategies/` está un nivel más abajo).
- El secreto se obtiene del `JwtModule` (registerAsync) para firmar y del `ConfigService` en la estrategia para verificar; nunca se loguea.
- Verificación funcional (login real, 401 sin token, invalidación tras re-login) requiere Postgres en vivo; cubierta por tests con mocks/e2e en CP-06 y verificación manual.
