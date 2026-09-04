# Análisis comparativo de proyectos — `application-api` (Express) vs `application-api-NestJS`

> Documento base de la migración. Fecha: 2026-06-29. Autor: nivekino (proyecto personal de aprendizaje).

## 1. Resumen ejecutivo

| | **application-api** (origen) | **application-api-NestJS** (destino) |
|---|---|---|
| Framework | Express 5.1 | NestJS 11 |
| Estado | Funcional, arquitectura DDD | Scaffold virgen (`nest new`, solo "Hello World") |
| Lenguaje | TypeScript 5.6 (CommonJS) | TypeScript 5.7 (nodenext, ES2023) |
| Base de datos | MongoDB Atlas / Mongoose 8 | **PostgreSQL + TypeORM** (decisión de migración) |
| Inyección de dependencias | InversifyJS (manual, símbolos) | DI nativa de NestJS (módulos) |
| Autenticación | Passport + passport-jwt | Passport + passport-jwt (`@nestjs/passport`/`@nestjs/jwt`) |
| Validación | class-validator + class-transformer | class-validator + class-transformer (igual) |
| Hashing | bcrypt (salt 10) | bcrypt (salt 10) |
| Logging | Winston + rotación diaria | nest-winston (mismos transports) |
| Docs API | — | **Swagger/OpenAPI** (nuevo) |
| Tests | No configurados | Jest (scaffold) → se añaden en CP-06 |

**Conclusión:** la arquitectura del origen (DI por interfaces, DTOs con class-validator, JWT aislado,
respuestas estandarizadas) mapea casi 1:1 a NestJS. El cambio de mayor impacto es **MongoDB → PostgreSQL/TypeORM**,
que obliga a reescribir el modelo `User` como entidad y el repositorio. Se arranca con base de datos limpia
(sin migración de datos).

## 2. Inventario funcional a migrar

| Feature | Endpoints (Express) | Lógica de negocio a preservar |
|---|---|---|
| Health | `GET /api/` | Responde `{ msg: "Server is up and running" }`. |
| Auth | `POST /api/auth/login` | Busca usuario por `username`, compara bcrypt, **actualiza `lastTokenIssuedAt`** (segundos Unix), firma JWT `{ sub, username, role, iat }`, expiración **8h**. |
| Users | `POST /api/users/` (JWT), `GET /api/users/` (JWT) | Crear: hash bcrypt salt 10 + persistir + devolver `UserDto`. Listar: devolver `UserListItemDto[]` (sin password). |

**Regla crítica — invalidación de tokens:** la JWT strategy rechaza tokens cuyo
`payload.iat < user.lastTokenIssuedAt`. Así, tras un nuevo login (o reset), los tokens previos quedan inválidos.

## 3. Arquitectura del origen (Express) — capas DDD

```
src/
├── application/services/     auth.service / user.service / password.service   (@injectable)
├── controllers/              auth.controller / user.controller
├── domain/
│   ├── dtos/                 AuthCredentialsDto, CreateUserDto, UserDto, UserListItemDto, ResponseDto
│   ├── enums/                userRole.enum (admin | user)
│   ├── interfaces/           IUserRepository, IAuthService, IUserService, IPasswordService
│   └── models/               user.model (Schema Mongoose + IUser)
├── infrastructure/
│   └── repositories/mongoose/UserRepository.ts
├── routes/                   index / auth.routes / user.routes
├── Strategy/                 jwt.strategy (passport-jwt + regla lastTokenIssuedAt)
├── utils/                    container (Inversify), types, http-response, logger (Winston), validate
├── config.ts                 variables de entorno (manual)
├── database.ts               conexión Mongo con reintentos exponenciales
└── index.ts                  bootstrap Express (CORS *, helmet, morgan, json, error handler global)
```

### Modelo `User` (Mongoose) — campos a portar a la entidad TypeORM

| Campo | Tipo | Restricciones |
|---|---|---|
| `_id` → `id` | ObjectId → uuid/serial | PK |
| `username` | string | requerido, **único** |
| `name` | string | requerido |
| `email` | string | requerido, **único**, lowercase |
| `password` | string | requerido (hash bcrypt) |
| `role` | enum `UserRole` | default `user` |
| `isActive` | boolean | default `true` |
| `lastTokenIssuedAt` | number (Unix) | default `null` — clave para invalidación JWT |
| `createdAt` / `updatedAt` | Date | timestamps automáticos |

### DTOs (validación)

- **AuthCredentialsDto:** `username` (`@IsString`), `password` (`@IsString @MinLength(6)`).
- **CreateUserDto:** `username` (3–50), `name` (1–100), `email` (`@IsEmail`), `password` (6–200),
  `role` (`@IsEnum(UserRole)`), `active?` (`@IsBoolean`, default true).
- **UserDto** (respuesta): `id, username, name, email, role, isActive, createdAt, updatedAt`.
- **UserListItemDto** (lista pública): `username, name, role, isActive` (sin password).

### Respuesta estandarizada (`http-response.ts`)

```ts
interface ApiResponse<T> { statusCode: number; message: string; resource?: T; isError: boolean; }
// ok() 200 · created() 201 · fail() error
```

## 4. Estado del destino (NestJS) antes de migrar

Scaffold por defecto: `main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts` (devuelve "Hello World!").
Sin BD, sin módulos de features, sin dependencias adicionales. Configuración moderna ya lista
(TypeScript ES2023, ESLint flat config, Prettier, Jest). Base limpia y sin deuda técnica.

## 5. Riesgos y consideraciones

- **Cambio de paradigma de datos:** documentos Mongo → tablas relacionales. Con base limpia el riesgo es bajo;
  solo se define el esquema. `synchronize: true` solo en desarrollo (en producción, migraciones TypeORM).
- **Eliminación de InversifyJS:** simplifica el código; verificar que cada dependencia quede declarada en su módulo.
- **Seguridad de datos:** nunca registrar contraseñas, JWT_SECRET ni cadenas de conexión.
  CORS hoy es `*` en Express; revisar restringirlo en NestJS para producción.

Ver el roadmap y el detalle de tareas en [`01-plan-migracion.md`](01-plan-migracion.md) y en
[`checkpoints/`](checkpoints/).
