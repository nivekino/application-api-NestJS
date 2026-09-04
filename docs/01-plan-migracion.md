# Plan de migración — Express → NestJS + PostgreSQL/TypeORM

> Roadmap operativo de la migración, **ya cerrada** (CP-00…CP-06 en estado `Hecho`). Se ejecutó un
> checkpoint a la vez. Análisis de origen en [`00-analisis-proyectos.md`](00-analisis-proyectos.md).
> Este documento es **referencia histórica**; el flujo vigente para features nuevas es el ciclo TDD
> descrito en [`../CLAUDE.md`](../CLAUDE.md).

## Objetivo

Dejar de trabajar en `application-api` (Express) y continuar el desarrollo sobre `application-api-NestJS`,
replicando fielmente las features actuales (Auth con JWT + Users) sobre **PostgreSQL + TypeORM**, con DI nativa
de NestJS, validación global, manejo de errores y logging estandarizados, y documentación Swagger.

## Decisiones

- **BD:** PostgreSQL + TypeORM (`@nestjs/typeorm`). Se elimina MongoDB/Mongoose.
- **Datos:** base limpia, sin migración desde Mongo (solo se crea el esquema).
- **DI:** nativa de NestJS por módulos. Se elimina InversifyJS.
- **Extra:** Swagger/OpenAPI en `/api/docs`.
- **Prefijo global:** `/api`.

## Mapeo de arquitectura Express → NestJS

| Express (origen) | NestJS (destino) | Acción |
|---|---|---|
| `src/index.ts` (CORS, helmet, morgan, error handler) | `src/main.ts` | `ValidationPipe` global, prefijo `/api`, CORS, helmet, Swagger. |
| `src/config.ts` (manual) | `@nestjs/config` (`ConfigModule` + validación) | Variables tipadas y validadas. |
| `src/database.ts` (Mongoose + reintentos) | `TypeOrmModule.forRootAsync` | Conexión Postgres async; `retryAttempts`/`retryDelay`. |
| `src/domain/models/user.model.ts` (Schema) | `users/entities/user.entity.ts` (Entity) | Reescribir: columnas, `@Unique` username/email, enum role, timestamps, `lastTokenIssuedAt`. |
| `src/domain/enums/userRole.enum.ts` | `users/enums/user-role.enum.ts` | Reutilizar tal cual. |
| `src/domain/dtos/*` | `users/dto/*`, `auth/dto/*` | DTOs class-validator + `@ApiProperty`. |
| `src/application/services/*` (`@injectable`) | `*.service.ts` (`@Injectable`) | Cambiar decoradores. |
| `src/infrastructure/repositories/mongoose/UserRepository.ts` | `@InjectRepository(User)` | Repositorio TypeORM. |
| `src/controllers/*` + `src/routes/*` | `*.controller.ts` (`@Controller/@Get/@Post`) | Fusionar rutas+controladores. |
| `src/Strategy/jwt.strategy.ts` + `jwtAuth` | `auth/strategies/jwt.strategy.ts` + `JwtAuthGuard` | PassportStrategy + `@UseGuards`. |
| `src/utils/container.ts`, `types.ts` | (eliminado) | DI nativa. |
| `src/utils/validate.ts` | `ValidationPipe` global | Validación automática. |
| `src/utils/http-response.ts` | `common/` interceptor + `HttpExceptionFilter` | Respuesta `{ statusCode, message, resource, isError }`. |
| `src/utils/logger.ts` (Winston) | `common/logger/` (`WinstonLoggerService` propio, feature #3) | Mismos transports; `nest-winston` no soporta NestJS 12 y se reemplazó por un adaptador propio sobre `winston`. |

## Estructura destino propuesta

```
application-api-NestJS/
├── .env.example
└── src/
    ├── main.ts                 bootstrap, pipes, swagger, cors, helmet
    ├── app.module.ts           ConfigModule, TypeOrmModule, UsersModule, AuthModule
    ├── common/                 interceptor respuesta, exception filter, logger winston
    ├── users/
    │   ├── users.module.ts · users.controller.ts · users.service.ts · password.service.ts
    │   ├── entities/user.entity.ts
    │   ├── enums/user-role.enum.ts
    │   └── dto/  (create-user.dto.ts · user.dto.ts · user-list-item.dto.ts)
    └── auth/
        ├── auth.module.ts · auth.controller.ts · auth.service.ts
        ├── strategies/jwt.strategy.ts
        ├── guards/jwt-auth.guard.ts
        └── dto/auth-credentials.dto.ts
```

## Roadmap de checkpoints

| CP | Título | Depende de | Estado |
|---|---|---|---|
| [CP-00](checkpoints/CP-00-dependencias-bootstrap.md) | Dependencias y bootstrap | — | Hecho |
| [CP-01](checkpoints/CP-01-config-postgres.md) | ConfigModule + conexión Postgres | CP-00 | Hecho |
| [CP-02](checkpoints/CP-02-users-entidad-dtos.md) | Users: entidad y DTOs | CP-01 | Hecho |
| [CP-03](checkpoints/CP-03-users-service-controller.md) | Users: service, repo y controller | CP-02 | Hecho |
| [CP-04](checkpoints/CP-04-auth-jwt.md) | Auth: JWT + Guard | CP-03 | Hecho |
| [CP-05](checkpoints/CP-05-cross-cutting.md) | Respuestas, errores y logging | CP-04 | Hecho |
| [CP-06](checkpoints/CP-06-tests-verificacion.md) | Tests y verificación e2e | CP-05 | Hecho (e2e con BD: manual) |

## Reglas de negocio a preservar (no negociables)

- **Invalidación de JWT:** rechazar tokens con `iat < user.lastTokenIssuedAt`.
- **JWT:** payload `{ sub, username, role, iat }`, expiración `8h`.
- **Contraseñas:** bcrypt, salt rounds `10`. Nunca exponer el hash en respuestas/listados.
- **Seguridad de datos:** no registrar contraseñas, `JWT_SECRET` ni cadenas de conexión en logs.

## Verificación end-to-end

1. PostgreSQL local (Docker o instancia). `.env` desde `.env.example`.
2. `npm install` && `npm run start:dev` → conecta a Postgres y crea la tabla `users`.
3. `GET /api/` → "Server is up". `GET /api/docs` → Swagger UI.
4. `POST /api/users` sin token → 401.
5. `POST /api/auth/login` con credenciales válidas → `{ token }`.
6. `GET /api/users` con `Authorization: Bearer <token>` → lista sin passwords.
7. Re-login y reintento con el token anterior → 401 (invalidación por `lastTokenIssuedAt`).
8. `npm test` y `npm run test:e2e` en verde (CP-06).
