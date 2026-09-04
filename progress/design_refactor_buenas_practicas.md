# Diseño — Feature #6 `refactor_buenas_practicas`

> **Refactorización y buenas prácticas del código existente, sin cambiar comportamiento.**
> Estado de la feature: **`pending`** (no se modificó `feature_list.json`).
> **Esperando "go" del usuario para pasar a la fase RED del `implementer`.**

---

## 1. Encabezado y alcance

- **Feature:** `#6 refactor_buenas_practicas` (`needs_design: true`, motivos **D1** + **D5** + **D11**;
  `tdd: true`, **`red_modo: caracterizacion`**).
- **Origen:** petición del usuario del 2026-09-04 ("refactorizar todo el código, para optimizarlo" y
  "aplicar buenas prácticas"). Proyecto personal de aprendizaje: el objetivo declarado es que el código
  sea un **ejemplo limpio y defendible** de NestJS 12 (ESM consumido desde CommonJS) + TypeORM 1.x +
  PostgreSQL, con TypeScript 6 estricto y ESLint `strictTypeChecked`.
- **Regla que gobierna toda la feature:** *comportamiento observable idéntico*. Ni una ruta, ni un verbo,
  ni una llave de DTO, ni un código de estado, ni el envoltorio `{ statusCode, message, resource,
  isError }`, ni la invalidación de JWT (`iat < lastTokenIssuedAt`, exp **8h**), ni bcrypt salt **10**.
- **Método:** primero se **fija** el comportamiento actual con specs de caracterización (rojo demostrado
  por **mutación**), después se refactoriza con la batería en verde, en pasos pequeños con un punto verde
  entre cada uno.

### 1.1. Dependencia de la feature #5 (bloqueante)

`feature_list.json` declara la #6 dependiente de la **#5 `arranque_real_port_y_guard_passport12`**, y la
regla `una_feature_a_la_vez` lo hace obligatorio de todos modos: **la #6 no puede pasar a `red` hasta que
la #5 esté `done`**. Al momento de escribir este diseño (2026-09-04)
`progress/design_arranque_real_port_y_guard_passport12.md` **no existe todavía** en disco, así que aquí
no se asume ninguna de sus decisiones.

Lo que la #6 **hereda** de la #5 y por tanto no diseña:

| Tema | Dueño | Efecto en la #6 |
|---|---|---|
| Anotación de tipo de `PORT` en `src/config/env.validation.ts` | **#5** | La #6 **no toca** esa propiedad. Si la #5 crea `src/config/env.validation.spec.ts`, la #6 **agrega** sus `it()` a ese archivo en vez de crearlo (§5.1). |
| Dónde vive la configuración de `PassportModule` para que `UsersModule` resuelva `JwtAuthGuard` bajo `@nestjs/passport` 12 | **#5** | La #6 **espeja** esa decisión: no mueve, no duplica ni "mejora" el cableado de Passport. Si la #5 crea un módulo compartido (p. ej. un `AuthCoreModule`), los pasos R9/R12 de la #6 se ajustan a él. |
| `npm run test:e2e:docker` en verde (criterio 4 de la #5) | **#5** | Es el **punto de partida medible** del Nivel B de la #6 (§9.2). Sin él, la #6 no puede demostrar "el comportamiento no cambió". |
| Si la #5 termina leyendo `PORT` desde `ConfigService` en `src/main.ts` | **#5** | Entonces R15 (§4, `main.ts`) se reduce a lo cosmético o desaparece. |

> **Instrucción para el `leader`:** antes de arrancar la fase RED de la #6, releer
> `progress/design_arranque_real_port_y_guard_passport12.md` y
> `progress/impl_arranque_real_port_y_guard_passport12.md`, y **descartar de §4 y §5 de este documento
> todo lo que la #5 ya haya hecho**. Un refactor que "arregla" algo que la #5 ya arregló es ruido y
> aparece como diferencia inexplicable en la revisión.

#### 1.1.1. Adenda del leader (2026-09-04, con la #5 ya `done`)

Releídos `progress/design_arranque_real_port_y_guard_passport12.md` y su `impl_`. Ajustes a este
diseño, sin re-litigar nada:

| Tema | Qué hizo la #5 | Efecto aquí |
|---|---|---|
| `PORT` | `readonly PORT: number = 3000` en `env.validation.ts` (el `readonly` evita que el autofix de `no-inferrable-types` borre la anotación). Creó `src/config/env.validation.spec.ts` con 7 `it()` (T1–T7 de la #5: PORT como cadena, `design:type`, valor por omisión, rechazos, mensaje sin valor, `DB_PORT`). | §5.1: los `it()` T1–T5 de este diseño **se agregan** a ese archivo. Revisar solapes: el T6 de la #5 (*"nombra la propiedad y la restriccion, nunca el valor recibido"*) ya cubre parte de T4; T4 sigue valiendo porque afirma explícitamente `JWT_SECRET` y `DB_PASS`. |
| Cableado de Passport | **No se movió ni se duplicó nada.** `JwtAuthGuard` declara su propio constructor (`super({ defaultStrategy: 'jwt' })`) y ya no depende de `AuthModuleOptions` (acoplamiento 13 en `planner.md`). | R9/R12 no se ajustan. **Regla nueva para G10 y cualquier guard futuro:** un guard que extienda un mixin de `@nestjs/passport` conserva su constructor explícito. |
| R16 (doble interceptor en la e2e) | **Cerrado en la RED de la #5.** | R16 y G0 **se descartan**. |
| `test/app.e2e-spec.ts` | Ahora tiene **6** casos (E1 invalidación real de JWT, E2 `ValidationPipe` 400). | Anclas de §5.8: la e2e son 6, no 4. |
| Hereda de la #5 (Q3/Q4 de su diseño) | `readonly` en las otras siete propiedades de `EnvironmentVariables`; `main.ts` sigue leyendo `process.env.PORT ?? 3000` en vez del `PORT` validado. | Entran como **R17** (`readonly` en `EnvironmentVariables`, tipado, prioridad **B**, protegido por T1–T5 + los 7 `it()` de la #5) y **R18** (`main.ts` toma `PORT` de `ConfigService`, prioridad **B**, sólo Nivel B como R15; opcional, mismo paso G12). |
| Infraestructura Nivel B | `compose.yaml`, `Dockerfile`, `npm run test:e2e:docker` ya existen y CI los corre. | P0b se ejecuta tal cual; la captura de partida se guarda en `progress/impl_refactor_buenas_practicas.md`. |

### 1.2. Archivos dentro del alcance

| Archivo | Qué pasa con él |
|---|---|
| `src/auth/auth.service.ts` | SÍ (R1, R2, R3) — sin tocar el orden de operaciones del login. |
| `src/auth/interfaces/jwt-payload.interface.ts` | **NUEVO** (R1). |
| `src/auth/dto/auth-response.dto.ts` | **NUEVO** (R3). |
| `src/auth/auth.controller.ts` | SÍ (R3: `@ApiResponse({ type: AuthResponseDto })`). |
| `src/auth/auth.controller.spec.ts` | **NUEVO** (T6-T8). |
| `src/auth/strategies/jwt.strategy.ts` | SÍ, sólo el import de `JwtPayload` (R1). El cuerpo de `validate` **no cambia**. |
| `src/auth/decorators/current-user.decorator.ts` | **NUEVO, condicionado** a Q1 (R12). |
| `src/common/filters/http-exception.filter.ts` | SÍ (R5, R6) — sólo tras T14/T15 en verde. |
| `src/common/interceptors/response.interceptor.ts` | SÍ (R6, R14). |
| `src/common/interfaces/api-response.interface.ts` | **NUEVO, condicionado** a Q4 (R14). |
| `src/common/logger/winston-logger.service.ts` | SÍ (R7). |
| `src/common/logger/winston.config.ts` | SÍ (R8). |
| `src/common/logger/winston.config.spec.ts` | **NUEVO** (T9-T12). |
| `src/config/env.validation.ts` | Sólo **lectura** en la #6 (lo toca la #5). Su **spec** sí (T1-T5). |
| `src/app.module.ts` | SÍ (R9). |
| `src/app.controller.ts`, `src/app.service.ts`, `src/app/dto/health.dto.ts` | SÍ (R13) — el literal `'Server is up and running'` **no cambia**. |
| `src/users/users.service.ts` | SÍ (R10, R11). |
| `src/users/users.controller.ts` | SÍ (R12 condicionado + `@ApiResponse` faltantes). |
| `src/main.ts` | SÍ, **mínimo y al final** (R15), sólo si la #5 no lo dejó resuelto. |
| `test/app.e2e-spec.ts` | SÍ, **sólo** el punto R16 (doble registro del interceptor) si la #5 no lo cerró. |
| `src/users/users.service.spec.ts`, `src/users/users.controller.spec.ts`, `src/common/filters/http-exception.filter.spec.ts`, `src/common/logger/winston-logger.service.spec.ts` | SÍ, **sólo agregando `it()`**. Los `it()` existentes se conservan **palabra por palabra** (§2.2). |

### 1.3. Qué NO toca (explícito)

- **El esquema.** `src/users/entities/user.entity.ts` no cambia: ni columnas, ni tipos, ni `@Unique`, ni
  enums persistidos, ni relaciones. **D4 no aplica y por eso no hay pregunta de "cómo llega a
  producción"** (recordatorio: `synchronize: NODE_ENV !== 'production'` y **no hay carpeta de
  migraciones**, `docs/verifications.md` §6.4). Cualquier idea de índice, `@Unique` nuevo o cambio de
  tipo queda **excluida** y necesita su propia feature con diseño (§4.3, Q3).
- **Dependencias.** Ni un paquete npm nuevo, ni un cambio de versión mayor. Lo ancla en Nivel A el `it()`
  existente de `src/framework-nestjs12.spec.ts`.
- **Toolchain.** `package.json` (scripts, `jest`, `engines`, `overrides`), `tsconfig*.json`,
  `eslint.config.mjs`, `.prettierrc`, `.nvmrc`, `compose.yaml`, `Dockerfile`,
  `scripts/harness/verify.mjs`. Única excepción admisible: subir el **piso de cobertura** en
  `feature_list.json` + `docs/verifications.md` §4 (trinquete, §9.1).
- **Reglas de negocio.** Orden de operaciones del login, payload del token, expiración, coerción del
  bigint-string, salt rounds.
- **Textos que el cliente ve.** `'OK'`, `'Internal server error'`, `'Validación fallida'`,
  `'Usuario no encontrado'`, `'Usuario incorrecto'`, `'Contraseña incorrecta'`,
  `'Server is up and running'`.
- **CORS `origin: '*'`** (preexistente, heredado del origen Express): se **asume sin cambio**; moverlo es
  D8 y afecta al consumidor.

---

## 2. Contrato confirmado y PENDIENTES

No hay endpoint nuevo ni cambio de ruta, verbo, DTO de entrada/salida o código de estado. Lo que este
diseño necesita fijar es el **inventario de invariantes** que el refactor no puede mover.

### 2.1. Superficie pública actual (confirmada leyendo el código)

| Ruta | Verbo | Guard | Entrada | Salida (dentro de `resource`) | Estado | Confirmado en |
|---|---|---|---|---|---|---|
| `/api/` | GET | — | — | `{ msg: 'Server is up and running' }` | 200 | `src/app.controller.ts`, `src/app.service.ts` |
| `/api/auth/login` | POST | — (**público**) | `AuthCredentialsDto` (`username`, `password` ≥ 6) | `{ token: string }` | **200** por `@HttpCode(HttpStatus.OK)` | `src/auth/auth.controller.ts` |
| `/api/users` | POST | `JwtAuthGuard` (de clase) | `CreateUserDto` (`username`, `name`, `email`, `password`, `role`, `active?`) | `UserDto` (sin `password`) | 201 | `src/users/users.controller.ts` |
| `/api/users` | GET | `JwtAuthGuard` | — | `UserListItemDto[]` (sin `password` ni `email`) | 200 | ídem |
| `/api/users/me` | GET | `JwtAuthGuard` | JWT (`req.user`) | `UserDto` | 200 / 401 / 404 | ídem |
| `/api/docs` | GET | — | — | Swagger, esquema Bearer con nombre **`'access-token'`** | 200 | `src/main.ts` |

Envoltorio de éxito (`ResponseInterceptor`): `{ statusCode, message: 'OK', resource, isError: false }`.
Envoltorio de error (`HttpExceptionFilter`): `{ statusCode, message, resource?, isError: true }`.

### 2.2. Invariantes duros (si uno se rompe, el gate falla o el consumidor se rompe)

1. **Los `it()` declarados en un `tdd_contract` son inmutables.** El CHECK 3c recorre **todas** las
   features en `red`/`green`/`in_review`/**`done`** (`ESTADOS_CON_CONTRATO` en
   `scripts/harness/verify.mjs`) y busca el **texto exacto** del `it()` en el archivo declarado. Textos y
   rutas congelados hoy:
   - `src/users/users.controller.guard.spec.ts` → *"UsersController declara JwtAuthGuard como guard de
     clase, de modo que GET /api/users/me responde 401 sin JWT valido"*
   - `src/users/users.controller.spec.ts` → *"getMe devuelve el DTO del usuario autenticado sin campo
     password"*, *"getMe propaga NotFoundException cuando el usuario no existe"*
   - `src/common/interceptors/response.interceptor.spec.ts` → *"envuelve una respuesta exitosa como {
     statusCode, message: \"OK\", resource, isError: false }, tomando el statusCode de la respuesta
     HTTP"*
   - `src/common/filters/http-exception.filter.spec.ts` → los **cuatro** `it()` citados por las features
     #2 y #4
   - `src/common/logger/winston-logger.service.spec.ts` → *"log delega en winston con nivel info y pasa
     el contexto de NestJS como metadato"*
   - `src/common/logger/logger.module.spec.ts` → *"LoggerModule expone APP_LOGGER y HttpExceptionFilter
     se resuelve por DI sin nest-winston"*
   - `src/framework-nestjs12.spec.ts` → *"package.json declara todos los paquetes @nestjs en la linea 12
     y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS"*

   **Consecuencia operativa:** ningún spec se renombra ni se mueve, y ningún `it()` existente cambia de
   texto. Se **agregan** casos; los existentes se citan como **anclas**.
2. **Ninguna aserción existente se modifica.** Es también el criterio de aborto (§8.3).
3. Nombre exacto del esquema Bearer: **`'access-token'`** (acoplamiento 5).
4. El controller **no** arma envoltorio (acoplamiento 3): duplicarlo produce doble envoltura.
5. `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted` (acoplamiento 2): agregar o quitar una
   propiedad de un DTO cambia qué peticiones se rechazan con 400. **Ningún DTO de entrada cambia de
   forma en esta feature.**

### 2.3. PENDIENTES de confirmar (no inventar)

| # | Elemento | Estado |
|---|---|---|
| P1 | Nombre de la constante de metadato del código de estado en `@nestjs/common/constants` (se asume `HTTP_CODE_METADATA`, por analogía con `GUARDS_METADATA` que ya usa `users.controller.guard.spec.ts`) | **PENDIENTE**: confirmarlo abriendo `@nestjs/common/constants` en `node_modules`. Si no está exportado, **T7 baja a Nivel B** (verificar el 200 con la app arriba) y se retira del `tdd_contract` de Nivel A. |
| P2 | Precedencia de `ConfigService.get()` entre el objeto validado y `process.env` (relevante para R9/R15: si `get('PORT')` puede devolver la cadena cruda del entorno en vez del número validado) | **PENDIENTE**: confirmarlo leyendo `@nestjs/config` **o** heredarlo de la #5, que resuelve `PORT`. Hasta entonces, R15 **no** cambia cómo se obtiene el puerto. |
| P3 | Nombre/ubicación del módulo compartido de Passport que introduzca la #5 | **PENDIENTE**: lo fija la #5. |
| P4 | Si `winston-daily-rotate-file` crea o abre archivos al **construirse** el transporte (afecta a T9-T12: un spec que llame `buildWinstonOptions()` podría tocar `./logs/`) | **PENDIENTE**: medirlo en la fase RED. `logs` está en `.gitignore`, así que el peor caso es un archivo local, no un cambio versionado; si además escribiera contenido, se evalúa extraer un helper puro **después** de tener la caracterización. |
| P5 | Si `@CurrentUser()` se adopta (R12) y si se unifica el idioma de identificadores | **PENDIENTE**: decisión del usuario, Q1 y Q2 (§10). Ambas tienen valor por omisión. |

---

## 3. Precedentes de la casa a ESPEJAR (no inventar)

| Lo que se va a hacer | Precedente existente a copiar |
|---|---|
| DTO de respuesta documentado | `UserDto` / `UserListItemDto` (`@ApiProperty` por campo, JSDoc que dice qué **no** incluye) + `@ApiResponse({ status, type })` en `UsersController` |
| Mapeo entidad → DTO | `UsersService.toDto` (privado, explícito campo por campo) |
| `select` explícito por columna (TypeORM 1.x) | `UsersService.list` → `select: { username: true, name: true, role: true, isActive: true }` |
| Spec de metadato de decorador sin levantar HTTP | `src/users/users.controller.guard.spec.ts` (`Reflect.getMetadata(GUARDS_METADATA, UsersController)`) |
| Mocks tipados | `type UsersServiceMock = jest.Mocked<Pick<UsersService, 'getProfile' \| 'create' \| 'list'>>` |
| Spec que compila el módulo real para atrapar DI | `src/common/logger/logger.module.spec.ts` (con `overrideProvider` para no escribir en `./logs/`) |
| Token de inyección + interfaz de `@nestjs/common` en el consumidor | `APP_LOGGER` + `HttpExceptionFilter` tipando su dependencia como `LoggerService` |
| Constante de configuración con su justificación al lado | `PasswordService.SALT_ROUNDS = 10` |
| Prefijo `node:` en módulos del runtime | `src/framework-nestjs12.spec.ts` (`node:fs`, `node:path`) |
| Comentario que explica **por qué** (no qué) | Cabecera de `winston-logger.service.ts`, JSDoc de `lastTokenIssuedAt`, nota del constructor de `JwtStrategy` |

---

## 4. Inventario de refactors

Prioridad: **A** = alto valor / riesgo bajo (se hace), **M** = medio (se hace si el paso previo quedó
verde), **B** = bajo / cosmético (se hace al final o se omite sin costo), **Q** = requiere respuesta del
usuario.

### 4.1. Los que sí valen la pena

| ID | Archivo | Qué cambia | Buena práctica que lo motiva | Riesgo | `it()` que lo protege | Pri. |
|---|---|---|---|---|---|---|
| **R1** | `src/auth/auth.service.ts` → `src/auth/interfaces/jwt-payload.interface.ts` | Mover la interfaz `JwtPayload` a su propio archivo. Hoy `jwt.strategy.ts` importa `JwtPayload` **desde `auth.service`** aunque no use `AuthService`. | **SRP / dependencias dirigidas**: un contrato compartido no vive dentro de un servicio; hoy existe una arista de import estrategia→servicio que no corresponde a ninguna dependencia real. Carpeta `interfaces/` es la convención de la documentación de NestJS para el módulo de auth. | Bajo: mover + 3 imports (uno de ellos en `jwt.strategy.spec.ts`, sólo el import, **no** las aserciones). Lo atrapa el typecheck. | Anclas: los 5 `it()` de `jwt.strategy.spec.ts` y los 3 de `auth.service.spec.ts` | **A** |
| **R2** | `src/auth/auth.service.ts` | `const EXPIRACION_TOKEN = '8h';` a nivel de módulo, con comentario de regla de negocio; `sign(..., { expiresIn: EXPIRACION_TOKEN })`. | **Sin literales mágicos en reglas de negocio**; el número de una regla vive en un solo lugar (mismo criterio que `SALT_ROUNDS`). | Nulo. | Ancla: *"login exitoso firma el token y actualiza lastTokenIssuedAt"* (afirma `{ expiresIn: '8h' }`) | **A** |
| **R3** | `src/auth/dto/auth-response.dto.ts` (nuevo), `auth.service.ts`, `auth.controller.ts` | `AuthResponseDto { @ApiProperty() token: string }`; `login` lo declara como tipo de retorno y `@ApiResponse({ status: 200, type: AuthResponseDto })`. | **DTOs con `@ApiProperty`** (CHECKPOINTS.MD, convenciones NestJS). Hoy el 200 de login **no publica schema** en Swagger, a diferencia de `UsersController`, que sí declara `type: UserDto`. | Bajo. El JSON del cable **no cambia** (misma llave `token`); lo que cambia es el **schema publicado** → se verifica en Nivel B (`/api/docs`). | **T6** + ancla e2e *"login con credenciales válidas devuelve { token }…"* | **A** |
| **R4** | `src/auth/auth.controller.spec.ts` (nuevo) | Spec del controller de auth: hoy **no tiene ninguno** (líneas sin cobertura). | **Todo controller con su spec** (regla del repo; la feature #1 la aplicó a `UsersController`). Sin él, R3 se hace a ciegas. | Nulo (sólo agrega pruebas). | **T6, T7, T8** | **A** |
| **R5** | `src/common/filters/http-exception.filter.ts` | Extraer `private extraerDeHttpException(exception: HttpException): { message: string; resource?: unknown }`, dejando `catch()` como tabla de decisión de 3 ramas. Reemplazar `res as Record<string, unknown>` por narrowing (`typeof res === 'object' && res !== null && 'message' in res`) y `(typeof obj.message === 'string' ? obj.message : undefined) ?? exception.message` por el ternario directo. | **Una función, una decisión** (SRP); **sin aserciones de tipo innecesarias** (`strictTypeChecked` las permite pero ocultan el estrechamiento real). | **Medio-alto por ser transversal (D5/acoplamiento 4)**: aplica a todos los endpoints. Mitigación: **no se toca hasta que T14 y T15 estén en verde** — hoy las ramas `res` string y `obj.message` no-string **no tienen cobertura**. | T14, T15 + los **6** `it()` existentes del archivo | **A** (después de T14/T15) |
| **R6** | `http-exception.filter.ts`, `response.interceptor.ts` | `import type { Request, Response } from 'express'` (hoy es import de valor y sólo se usa como tipo). **Lista blanca estricta: sólo estos dos tipos de `express`, en estos dos archivos.** | Coherencia con los specs, que ya usan `import type`. | Bajo, **pero con una trampa grave si se generaliza**: acoplamiento 12 — convertir a `import type` una clase que NestJS **inyecta o valida** la borra del JavaScript emitido y la DI deja de resolverla. Por eso `tsconfig.json` no habilita `verbatimModuleSyntax` ni el linter `consistent-type-imports`. | Anclas: specs del filtro y del interceptor + typecheck + build | **B** |
| **R7** | `src/common/logger/winston-logger.service.ts` | `type NivelLog = 'info' \| 'error' \| 'warn' \| 'debug' \| 'verbose'` para el parámetro `nivel` de `escribir` y para `WinstonLike.log`. | **Hacer imposible el estado ilegal** (tipado estricto de TS): hoy `nivel: string` acepta `'infoo'` y el error aparecería en el archivo de log, no en el compilador. | Bajo; el archivo tiene 6 `it()` que cubren los 6 métodos. | Anclas: los 6 `it()` existentes + **T13** | **M** |
| **R8** | `src/common/logger/winston.config.ts` | `import * as os from 'node:os'`; comparar `NODE_ENV` contra `NodeEnvironment.Development` / `NodeEnvironment.Test` (importados de `src/config/env.validation.ts`) en vez de los literales `'development'` / `'test'`. | **Prefijo `node:`** para módulos del runtime (guía de Node; precedente en `framework-nestjs12.spec.ts`). **Un solo catálogo de entornos**: hoy `NODE_ENV` se lee con literales sueltos en **tres** lugares (`winston.config.ts`, `app.module.ts`, y el enum de `env.validation.ts`), y un typo no falla, sólo cambia el nivel de log en silencio. | Bajo. Se **conserva** la lectura directa de `process.env` (el logger existe antes que `ConfigModule`; eso no cambia). Crea una arista `common → config`, dirección aceptable (config es más fundamental); la alternativa es mover el enum, ver Q5. | **T9, T10, T11, T12** | **M** |
| **R9** | `src/app.module.ts` | (a) Tipar el factory como `ConfigService<EnvironmentVariables, true>` y leer con `{ infer: true }` para que un typo en el nombre de la variable sea **error de compilación** y `DB_PORT` llegue tipado `number`. (b) Quitar `imports: [ConfigModule]` de `JwtModule.registerAsync`: `ConfigModule.forRoot` ya es `isGlobal: true`. (c) `synchronize: … !== NodeEnvironment.Production`. | **Configuración tipada** (documentación de NestJS) e **imports mínimos por módulo**: un import redundante enseña un patrón equivocado en un proyecto de ejemplo. | **Medio**: `**/*.module.ts` está **excluido de la cobertura** (`collectCoverageFrom` en `package.json`) y no tiene spec. Sólo lo prueban el build, el typecheck y el **Nivel B** (la app arranca y conecta). Va después de un punto verde y antes del cierre, nunca al final del día. | Sin `it()` propio → **Nivel B (B1, B2)** + CHECK 5/5b | **M** |
| **R10** | `src/users/users.service.ts` | (a) `private toListItemDto(u: User): UserListItemDto` junto a `toDto`, y `list()` lo usa. (b) Constante de módulo con el `select` público (mismo valor literal actual) usada por `list()`, de modo que la lista de columnas consultadas y la lista de campos mapeados **no puedan divergir**. | **DRY del mapeo entidad→DTO** y acoplamiento 7 (*la entidad no sale nunca por la API*): hoy hay dos mapeos, uno nombrado (`toDto`) y uno anónimo dentro de `list()`, más una tercera copia implícita de la misma lista de campos en el `select`. Tres copias de la misma lista es la definición de desincronización futura. | Bajo, con una condición dura: el objeto del `select` debe conservar **exactamente** el mismo valor, porque `users.service.spec.ts` afirma `find` llamado con `{ select: { username: true, name: true, role: true, isActive: true } }`. | Anclas: *"list devuelve solo campos públicos (sin password ni email)"*, *"create hashea la contraseña y devuelve un DTO sin password"* + **T16-T19** | **A** |
| **R11** | `src/users/users.service.ts`, `src/users/users.module.ts` | Retirar los separadores de sección heredados de la migración (`// ---- Métodos de apoyo para Auth (CP-04) ----`, `// ---- Perfil del usuario autenticado ----`) y las etiquetas `(CP-04)`; conservar los comentarios que justifican **un valor** (p. ej. el de TypeORM 1.x sobre `select`, o el de `retryAttempts` en `app.module.ts`). | **El comentario explica el por qué, no divide el archivo**; y no apunta a documentos cerrados (`docs/checkpoints/` es referencia histórica). Criterio de `acceptance` 4: "sin comentarios obsoletos". | Nulo funcionalmente, **pero no es protegible por test**: se verifica en revisión. Por eso va en el último paso. | — (revisión del `reviewer`) | **B** |
| **R12** | `src/auth/decorators/current-user.decorator.ts` (nuevo) + `src/users/users.controller.ts` | Reemplazar `getMe(@Request() req: { user: User })` por `getMe(@CurrentUser() user: User)` con `createParamDecorator`. Además, agregar los `@ApiResponse` faltantes de `create` (401) y `list` (401). | **Custom route decorators** (documentación de NestJS): el controller deja de conocer la forma del `Request` de Express y el tipo literal inline `{ user: User }` desaparece. | **Medio y explícito**: cambia la **firma** de `getMe`, por lo que hay que ajustar la *preparación* (no las aserciones) de los dos `it()` congelados de `users.controller.spec.ts`. Trampa técnica: `@types/passport` declara `Request.user` como `Express.User \| undefined`, así que el decorador necesita un estrechamiento **tipado y comentado**, sin `any` ni `eslint-disable`. Alternativa más barata en Q1. | Anclas: *"getMe devuelve el DTO del usuario autenticado sin campo password"*, *"getMe propaga NotFoundException cuando el usuario no existe"* + **T20, T21** | **Q** (Q1) |
| **R13** | `src/app/dto/health.dto.ts` (nuevo), `src/app.controller.ts`, `src/app.service.ts` | `HealthDto { @ApiProperty() msg: string }` como tipo de retorno de `AppService.getHealth()` y del handler, con `@ApiOperation` + `@ApiResponse({ status: 200, type: HealthDto })`. | **DTO documentado en Swagger** para el único endpoint público, y **elimina el tipo inline `{ msg: string }` duplicado en dos archivos**. | Bajo. El literal `'Server is up and running'` **no cambia** (lo afirman `app.controller.spec.ts` y el e2e). Ubicación del archivo: **PENDIENTE menor** — hoy no existe carpeta `src/app/`; alternativa: `src/dto/health.dto.ts` o dejarlo junto a `app.service.ts`. Se decide en la fase GREEN espejando `src/users/dto/`. | Anclas: *"should report the server is up"* + e2e *"GET /api/ responde que el servidor está arriba"* | **M** |
| **R14** | `src/common/interfaces/api-response.interface.ts` (nuevo) | Declarar el envoltorio en un solo archivo: `ApiResponse<T>` (éxito, hoy en `response.interceptor.ts`) y el cuerpo de error (hoy `interface ErrorBody`, privada en `http-exception.filter.ts`). | **Cada contrato en un solo archivo** (regla anti-desincronización del propio repo): hoy la misma forma `{ statusCode, message, resource?, isError }` está declarada **dos veces**, en dos archivos, con dos nombres y dos tipos de `isError`. | Bajo-medio: `test/app.e2e-spec.ts` importa `ApiResponse` desde `../src/common/interceptors/response.interceptor`; hay que actualizar ese import (lo atrapa el CHECK 5b, que typechequea `test/`). | Anclas: spec del interceptor y del filtro + typecheck de `src/` y `test/` | **Q** (Q4) |
| **R15** | `src/main.ts` | Extraer `configurarSwagger(app)` (y a lo sumo `configurarValidacion(app)`) para que `bootstrap()` se lea como una lista de pasos. | **Funciones pequeñas con nombre que revela intención.** | **El más alto por unidad de valor**: `main.ts` está excluido de la cobertura y **no tiene spec**; sólo el Nivel B lo prueba. Se hace **al final**, mínimo, y sólo si queda tiempo verde. **No** se cambia el orden de `useGlobalPipes` / `enableCors` / `helmet` / Swagger / `listen`, ni cómo se obtiene el puerto (eso es de la #5, P2). | Sólo **Nivel B (B1, B7)** | **B** |
| **R16** | `test/app.e2e-spec.ts` | **Quitar `app.useGlobalInterceptors(new ResponseInterceptor())`.** Ver §6.1: hoy es un **segundo** registro global del mismo interceptor (el primero es `APP_INTERCEPTOR` en `AppModule`) y produce **doble envoltura**. | Acoplamiento 3 + **no duplicar el bootstrap de la app en la suite**. | Bajo en código, **alto en información**: es el único hallazgo de este diseño con un fallo demostrable hoy. | **Nivel B (B2)**: la suite e2e pasa de 2 fallos a verde | **A**, *si la #5 no lo cerró antes* |

### 4.2. Lo que NO vale la pena tocar (un refactor sin motivo verificable es ruido)

| # | Candidato descartado | Por qué se deja como está |
|---|---|---|
| N1 | **`lastTokenIssuedAt: number \| string \| null` + coerción en `JwtStrategy`** (p. ej. resolverlo con un `transformer` de columna de TypeORM) | Es una **decisión ya tomada y documentada** en el JSDoc de la entidad ("para que quien compare tenga que coercionar explícitamente"), en `CLAUDE.md` y en `progress/history.md` (2026-09-03), y está cubierta por el `it()` *"coerce bigint-string de pg al comparar"*. Re-litigarla toca la regla de negocio crítica (**D3**) para ganar una anotación de tipo. Un `transformer` además se aplicaría también en la escritura, con la que hoy nadie tiene problema. |
| N2 | **`enum UserRole` → union type / objeto `as const`** ("modernizar los enums") | `@Column({ type: 'enum', enum: UserRole })` y `@IsEnum(UserRole)` necesitan el **objeto en runtime**; el enum está **persistido** en PostgreSQL. Cambiarlo es un cambio de esquema (**D4**) disfrazado de estilo. Además `tsconfig.json` no habilita `erasableSyntaxOnly` a propósito. |
| N3 | **Renombrar `CreateUserDto.active` → `isActive`** para que coincida con la columna | Es **contrato público de entrada** (**D2**): rompería a cualquier consumidor, y con `forbidNonWhitelisted` el campo viejo pasaría a producir **400**. Se documenta la asimetría con un comentario y punto. |
| N4 | **Eliminar el "triple default" de `active`** (inicializador del DTO + `?? true` en el servicio + `default: true` en la columna) | Cada capa protege un camino distinto: el inicializador cubre la entrada por el `ValidationPipe`, el `?? true` cubre las llamadas directas al servicio (incluidas las de las pruebas y cualquier consumidor interno futuro), la columna cubre los `INSERT` que no pasen por el servicio. Se **fija con T19** y se documenta; quitar el `?? true` cambiaría el comportamiento de `UsersService.create` fuera del pipe. |
| N5 | **Mover `PasswordService` de `src/users/` a `src/common/`** | La cohesión actual es defendible (el módulo de usuarios es dueño del hash de sus contraseñas y lo **exporta** para `AuthModule`). Moverlo cambia 4 imports y no elimina ninguna duplicación. |
| N6 | **Unificar por completo el idioma de los identificadores** (renombrar `escribir`, `normalizarMensaje`, `mensajeInterno`, `construirHost`, `buildWinstonOptions`, `validateEnv`…) | Diff enorme, valor funcional cero, y toca specs congelados. Lo que sí conviene es **escribir la regla** para que la mezcla deje de ser accidental (Q2). |
| N7 | **Extraer las fábricas `buildUser`/`baseUser` duplicadas en 4 specs a una fixture compartida** | En pruebas, **datos locales y explícitos (DAMP) le ganan a DRY**: cada spec necesita un usuario ligeramente distinto y la fixture compartida se vuelve un parámetro-objeto con banderas. Además tiene costo de toolchain: un `*.fixture.ts` dentro de `src/` **entraría al build** (`tsconfig.build.json` excluye sólo `**/*spec.ts`) y a `collectCoverageFrom`; colocarla en `test/` choca con `rootDir: ./src` del tsconfig raíz. No se toca. |
| N8 | **`message: 'OK'` fijo del interceptor; `'Internal server error'`; `'Validación fallida'`** | Contrato público. Cambiar el `message` del interceptor es además un cambio transversal (**D5**), no del controller (acoplamiento 3). |
| N9 | **CORS `origin: '*'`, `helmet()` por omisión, `retryAttempts: 5` / `retryDelay: 5000`** | Preexistentes y justificados por el origen Express; tocarlos es **D8** y cambia comportamiento observable en el navegador o en el arranque. |
| N10 | **Mover o renombrar `src/framework-nestjs12.spec.ts`** (o cualquier spec citado en un `tdd_contract`) | El CHECK 3c falla y el gate se pone en rojo **con el código correcto**. Además ese spec resuelve `package.json` con `join(__dirname, '..')`. |
| N11 | **Introducir una capa de repositorios propia, CQRS, o `ClassSerializerInterceptor`** | Ver §7 (alternativas descartadas): es rediseño de arquitectura o dependencia nueva (**D9**), no refactor de comportamiento neutro. |

### 4.3. "Optimizar": lo que es medible y lo que no

El usuario pidió "optimizarlo". La respuesta honesta, leyendo las cuatro consultas que existen en el
proyecto (`create`, `list`, `findOne` ×2, `update`):

| Pregunta | Respuesta medida en el código |
|---|---|
| ¿Hay un **N+1**? | **No.** La entidad `User` no tiene relaciones; no hay `relations`, ni joins, ni `QueryBuilder`, ni ningún `find` dentro de un ciclo. |
| ¿Hay un **`await` en serie evitable**? | **No.** En `AuthService.login` cada paso depende del anterior (buscar → comparar → invalidar → firmar) y **el orden es una regla de negocio** (acoplamiento 1). En `UsersService.create`, `hash` precede a `save` por necesidad. No hay nada que paralelizar con `Promise.all`. |
| ¿Hay un **`select *` que traiga `password`**? | **Sí, dos veces, y las dos quedan FUERA de alcance.** (a) `findById` (sin `select`) se ejecuta en **cada petición autenticada** desde `JwtStrategy.validate` y deja el hash bcrypt dentro de `req.user`; si alguien devolviera `req.user` directamente (acoplamiento 7), el hash se publica. (b) `findByUsername` necesita el hash, ahí es correcto. Acotar (a) exige cambiar la aserción existente `expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } })` → por el criterio de aborto (§8.3) **no se hace aquí**: se registra como candidato de backlog con disparadores **D6 + D3** (JwtStrategy necesita `id` y `lastTokenIssuedAt`, y un futuro guard de roles necesitaría `role`: es una decisión de diseño, no un ajuste). En su lugar, **T17 fija** que hoy devuelve la entidad completa, para que el cambio futuro sea deliberado. |
| ¿Hay **falta de índices**? | **No hay ninguno que agregar hoy.** `@Unique('UQ_users_username')` y `@Unique('UQ_users_email')` ya crean sus índices, y son exactamente las dos columnas por las que se filtra. Ninguna consulta filtra u ordena por otra columna. Cualquier índice nuevo sería **D4** → excluido (Q3). |
| ¿Hay **consultas sin límite**? | **Sí: `list()` no pagina** — devuelve la tabla completa. Con el volumen de un proyecto de aprendizaje es irrelevante, y paginar cambia el contrato de salida de `GET /api/users` (**D2**) → **excluido**, candidato de backlog. |
| ¿Hay **transacción de varios pasos** sin atomicidad (**D10**)? | Hay **una observación**, no un refactor: en `login`, si `jwtService.sign` fallara **después** de `updateLastTokenIssuedAt`, los tokens previos ya quedaron invalidados y no se emitió uno nuevo. Invertir el orden intercambia un modo de falla por otro (emitir un token que no invalida a los viejos) y **cambia una regla de negocio crítica**: fuera de alcance, se registra como candidato de backlog con disparador **D3**. |

**Conclusión que debe quedar escrita en el `impl_`:** esta feature **no mejora el rendimiento**, porque no
hay nada medible que mejorar sin cambiar contrato o esquema. Lo que mejora es la **legibilidad, el tipado
y la ausencia de duplicación** — y eso se demuestra con el gate (lint/typecheck/cobertura) y con la
batería, no con una afirmación de desempeño.

---

## 5. Batería de caracterización (el plan de trabajo — esto es lo que se aprueba en la puerta humana)

**`red_modo: caracterizacion`.** El comportamiento **ya existe**: la batería **pasa en disco** y el rojo
se demuestra **por mutación**, restaurando el código después. El gate, con la feature en `red` y modo
`caracterizacion`, **exige todo en verde** y que la *Evidencia RED* **describa la mutación**
(`docs/verifications.md` §1, CHECK 3d). La evidencia debe **mencionar cada archivo** de Nivel A del
`tdd_contract`.

**Regla de oro de la fase RED:** en esta fase **no se toca una sola línea de producción**. Ninguna. Si un
`it()` no se puede escribir sin cambiar producción, ese `it()` **no pertenece a esta feature**.

### 5.1. `src/config/env.validation.spec.ts` — Nivel A · **coordinar con la #5**

Hoy `validateEnv` **no tiene ninguna prueba** y es la puerta de entrada de todos los secretos.
⚠️ Si la #5 ya creó este archivo, se **agregan** los `it()`; los de `PORT` son de la #5 y no se duplican.
Cada caso construye su propio `Record<string, unknown>` y **no** depende de `process.env`.

| ID | `it()` — texto exacto | Mutación que demuestra el rojo |
|---|---|---|
| **T1** | `validateEnv devuelve una instancia de EnvironmentVariables con los valores del entorno convertidos a su tipo` | `enableImplicitConversion: false` → `DB_PORT: '5432'` deja de convertirse y `@IsInt` lo rechaza. |
| **T2** | `validateEnv aplica development como NODE_ENV cuando la variable no viene en el entorno` | Quitar el inicializador `= NodeEnvironment.Development`. |
| **T3** | `validateEnv lanza un Error que nombra la propiedad y la restriccion cuando falta una variable obligatoria` | Cambiar `if (errors.length > 0)` por `if (false)`: la función devuelve un objeto inválido en silencio. |
| **T4** | `validateEnv no incluye el valor de JWT_SECRET ni de DB_PASS en el mensaje de error` | Añadir el valor al detalle (`${e.property}: ${String(e.value)} …`) → el secreto aparece en el mensaje y el caso cae. **Es el `it()` de mayor valor de toda la feature:** hoy nada protege esa garantía (D6), y el mensaje de `validateEnv` viaja al log de arranque. |
| **T5** | `validateEnv rechaza un NODE_ENV que no esta en el catalogo de entornos` | Quitar `@IsEnum(NodeEnvironment)`. |

### 5.2. `src/auth/auth.controller.spec.ts` — Nivel A · **archivo nuevo**

Mock tipado: `type AuthServiceMock = jest.Mocked<Pick<AuthService, 'login'>>`.

| ID | `it()` — texto exacto | Mutación que demuestra el rojo |
|---|---|---|
| **T6** | `login delega en AuthService y devuelve el token sin envolverlo, porque el envoltorio lo aplica el ResponseInterceptor` | Envolver en el controller: `return { resource: await this.authService.login(dto) }` → doble envoltura (acoplamiento 3) y el caso cae. |
| **T7** | `AuthController declara HttpCode 200 en POST /auth/login y no el 201 por omision de @Post` | Quitar `@HttpCode(HttpStatus.OK)` → el metadato desaparece. Espeja `users.controller.guard.spec.ts` (metadato, sin levantar HTTP). **Depende de P1**; si la constante no está exportada, **T7 baja a Nivel B** y se retira del contrato de Nivel A. |
| **T8** | `AuthController no declara guard de clase: POST /auth/login queda publico` | Agregar `@UseGuards(JwtAuthGuard)` a la clase → `GUARDS_METADATA` deja de estar vacío y el caso cae. Protege contra el modo de falla más plausible de un refactor de auth: dejar el login detrás del guard, con lo que **nadie puede volver a autenticarse**. |

### 5.3. `src/common/logger/winston.config.spec.ts` — Nivel A · **archivo nuevo**

Hoy `buildWinstonOptions` tiene **0 % de cobertura**: `logger.module.spec.ts` sustituye el provider, así
que la fábrica real nunca se ejecuta. Cada caso guarda y **restaura** `process.env.NODE_ENV`. Ver **P4**
(posible creación de archivos en `./logs/`, ignorado por git).

| ID | `it()` — texto exacto | Mutación que demuestra el rojo |
|---|---|---|
| **T9** | `buildWinstonOptions usa nivel debug en development e info en cualquier otro entorno` | Invertir el ternario del `level`. |
| **T10** | `buildWinstonOptions baja la consola a nivel error cuando NODE_ENV es test` | Quitar `env === 'test' ? 'error' : level` del transporte `Console`. |
| **T11** | `buildWinstonOptions arma tres transportes: consola, archivo rotado de error y archivo rotado de aplicacion` | Quitar el transporte de aplicación. Se afirma el conteo, que el de error está en `level: 'error'` y las dos rutas `./logs/error-%DATE%.log` y `./logs/application-%DATE%.log`. |
| **T12** | `buildWinstonOptions no agrega por omision mas metadatos que service y hostname` | Agregar una clave extra a `defaultMeta` → el caso cae. Protege el acoplamiento 9: **lo que entra al `defaultMeta` queda en disco en cada línea de log**. |

*Trampa de implementación:* `LoggerOptions.transports` es `transport | transport[] | undefined`; estrechar
con `Array.isArray` y `instanceof winston.transports.Console` / `instanceof DailyRotateFile`, sin `any` ni
`eslint-disable`. Si `filename` no está tipado en el transporte, estrecharlo con un tipo local explícito.

### 5.4. `src/common/logger/winston-logger.service.spec.ts` — Nivel A · **se agrega 1 `it()`**

Los 6 existentes se conservan palabra por palabra (uno está en el `tdd_contract` de la #3).

| ID | `it()` — texto exacto | Mutación que demuestra el rojo |
|---|---|---|
| **T13** | `error registra el message de un Error recibido como mensaje, sin serializar el objeto completo` | En `normalizarMensaje`, devolver siempre `String(message)` → llega `"Error: …"` (y con un objeto arbitrario, `[object Object]`). Cubre la única rama sin cobertura del archivo y **es la garantía de que un objeto de dominio no se serializa al log**. |

### 5.5. `src/common/filters/http-exception.filter.spec.ts` — Nivel A · **se agregan 2 `it()`**

Los **6** existentes son intocables (features #2 y #4). Estos dos cubren las **dos ramas sin cobertura**
y son **condición previa de R5**.

| ID | `it()` — texto exacto | Mutación que demuestra el rojo |
|---|---|---|
| **T14** | `HttpExceptionFilter usa como message el texto de una HttpException construida con un string` | Eliminar la rama `typeof res === 'string'` → el `message` cae al literal genérico. Se construye con `new HttpException('texto plano', 418)`. |
| **T15** | `HttpExceptionFilter recurre a exception.message cuando el cuerpo de la HttpException no trae un message de tipo string` | Cambiar `?? exception.message` por `?? ''` → el cuerpo sale con `message` vacío. Se construye con `new HttpException({ error: 'algo' }, 418)`. |

### 5.6. `src/users/users.service.spec.ts` — Nivel A · **se agregan 4 `it()`**

`findByUsername` y `updateLastTokenIssuedAt` **no tienen prueba directa** hoy.

| ID | `it()` — texto exacto | Mutación que demuestra el rojo |
|---|---|---|
| **T16** | `findByUsername consulta por la columna username y devuelve la entidad completa, porque el login necesita el hash` | Cambiar el criterio a `{ where: { id: username } }`. |
| **T17** | `findById devuelve la entidad completa, incluido lastTokenIssuedAt, que la regla de invalidacion de JWT necesita` | Agregar `select: { id: true }` al `findOne` → `JwtStrategy` se queda sin el campo con el que compara y la invalidación de JWT **deja de funcionar en silencio** (acoplamiento 1). |
| **T18** | `updateLastTokenIssuedAt actualiza solo esa columna usando el id del usuario como criterio no vacio` | Cambiar a `update({}, …)` → en TypeORM 1.x el criterio vacío **lanza** (acoplamiento 11); con el mock, la aserción del criterio cae. |
| **T19** | `create marca isActive en true cuando el DTO no trae el campo active` | Quitar el `?? true` → `isActive: undefined`. Fija el "triple default" de N4 antes de que alguien lo "simplifique". |

### 5.7. `src/users/users.controller.spec.ts` — Nivel A · **se agregan 2 `it()`**

Los 2 existentes son intocables en su **texto** y en sus **aserciones** (feature #1). Hoy `create` y
`list` del controller no se ejercitan.

| ID | `it()` — texto exacto | Mutación que demuestra el rojo |
|---|---|---|
| **T20** | `create delega en UsersService.create y devuelve el UserDto sin envolverlo` | Envolver el resultado en el controller → doble envoltura. |
| **T21** | `list delega en UsersService.list y devuelve el arreglo de UserListItemDto tal cual` | Volver a mapear en el controller (segunda copia del mapeo, justo lo que R10 elimina) o envolver el arreglo. |

### 5.8. Anclas (no se escriben, deben seguir en verde todo el ciclo)

`src/users/users.controller.guard.spec.ts` (1) · `src/users/users.controller.spec.ts` (2) ·
`src/users/users.service.spec.ts` (4) · `src/users/password.service.spec.ts` (3) ·
`src/auth/auth.service.spec.ts` (3) · `src/auth/strategies/jwt.strategy.spec.ts` (5) ·
`src/common/interceptors/response.interceptor.spec.ts` (1) ·
`src/common/filters/http-exception.filter.spec.ts` (6) ·
`src/common/logger/winston-logger.service.spec.ts` (6) · `src/common/logger/logger.module.spec.ts` (1) ·
`src/app.controller.spec.ts` (1) · `src/framework-nestjs12.spec.ts` (1) · `test/app.e2e-spec.ts` (4,
Nivel B).

### 5.9. `tdd_contract` a copiar a `feature_list.json` (lo escribe el `implementer` en la fase RED)

Cuatro criterios de `acceptance`. Todas las entradas de Nivel A citan el texto exacto de §5.

| Criterio | Nivel | `test` (`it()`) | `archivo` | Nota |
|---|---|---|---|---|
| **1** | A | `envuelve una respuesta exitosa como { statusCode, message: "OK", resource, isError: false }, tomando el statusCode de la respuesta HTTP` | `src/common/interceptors/response.interceptor.spec.ts` | **Ancla** de la #2: el envoltorio estándar no cambia. No se escribe ni se modifica. |
| **1** | A | `rechaza el token previo si iat < lastTokenIssuedAt (re-login)` | `src/auth/strategies/jwt.strategy.spec.ts` | **Ancla**: invalidación de JWT intacta. |
| **1** | A | `login exitoso firma el token y actualiza lastTokenIssuedAt` | `src/auth/auth.service.spec.ts` | **Ancla**: payload, orden de operaciones y `expiresIn: '8h'`. |
| **1** | A | `AuthController declara HttpCode 200 en POST /auth/login y no el 201 por omision de @Post` | `src/auth/auth.controller.spec.ts` | **T7** (nuevo). Sujeto a **P1**; si la constante de metadato no existe, se sustituye por `AuthController no declara guard de clase: POST /auth/login queda publico` (**T8**) y T7 pasa a Nivel B. |
| **1** | B | — | — | e2e (`npm run test:e2e:docker`) + casos manuales B1-B9 de §9.2, ejecutados **antes y después** del refactor y comparados. Un script no puede probar que el cuerpo del cable siga byte a byte igual. |
| **2** | A | `validateEnv no incluye el valor de JWT_SECRET ni de DB_PASS en el mensaje de error` | `src/config/env.validation.spec.ts` | **T4**. Representa T1-T5 (caracterización de `src/config/`). |
| **2** | A | `buildWinstonOptions no agrega por omision mas metadatos que service y hostname` | `src/common/logger/winston.config.spec.ts` | **T12**. Representa T9-T12. |
| **2** | A | `HttpExceptionFilter usa como message el texto de una HttpException construida con un string` | `src/common/filters/http-exception.filter.spec.ts` | **T14**. Representa T14-T15 (ramas sin cobertura del filtro; condición previa de R5). |
| **2** | A | `updateLastTokenIssuedAt actualiza solo esa columna usando el id del usuario como criterio no vacio` | `src/users/users.service.spec.ts` | **T18**. Representa T16-T19. |
| **2** | A | `create delega en UsersService.create y devuelve el UserDto sin envolverlo` | `src/users/users.controller.spec.ts` | **T20**. Representa T20-T21. |
| **2** | A | `error registra el message de un Error recibido como mensaje, sin serializar el objeto completo` | `src/common/logger/winston-logger.service.spec.ts` | **T13**. |
| **2** | A | `login delega en AuthService y devuelve el token sin envolverlo, porque el envoltorio lo aplica el ResponseInterceptor` | `src/auth/auth.controller.spec.ts` | **T6**. |
| **3** | A | `package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS` | `src/framework-nestjs12.spec.ts` | **Ancla** de la #3: prueba en disco la mitad verificable del criterio ("no se agregan dependencias ni se cambian versiones mayores"). |
| **3** | B | — | — | La otra mitad es documental: el `reviewer` compara el inventario §4 de este diseño con el diff real y con `progress/impl_refactor_buenas_practicas.md`, y verifica que `package.json`/`package-lock.json` no sumen paquetes. |
| **4** | B | — | — | Lo verifica el propio Nivel A de forma automática pero **fuera de Jest**: CHECK 5 (build), 5b (typecheck de `src/` y `test/`), 5c (`eslint . --max-warnings=0`, sin `eslint-disable` nuevos, sin `any`) y 6b (cobertura). Más la revisión del `reviewer` sobre duplicación, código muerto y comentarios obsoletos, que ningún script mide. |

⚠️ **Todas las entradas de Nivel A de este contrato deben aparecer en la *Evidencia RED*** (CHECK 3d
comprueba que se mencione **cada archivo** de Nivel A): `response.interceptor.spec.ts`,
`jwt.strategy.spec.ts`, `auth.service.spec.ts`, `auth.controller.spec.ts`, `env.validation.spec.ts`,
`winston.config.spec.ts`, `http-exception.filter.spec.ts`, `users.service.spec.ts`,
`users.controller.spec.ts`, `winston-logger.service.spec.ts`, `framework-nestjs12.spec.ts`. La evidencia
debe describir **una mutación por archivo mencionado** (no basta una sola mutación global).

---

## 6. Acoplamientos y riesgos

De la lista de los doce de [`.claude/agents/planner.md`](../.claude/agents/planner.md), aplican **once**
(todos menos el 6, esquema/`synchronize`, porque el esquema no se toca).

| # | Acoplamiento | Consecuencia concreta si se ignora en ESTA feature |
|---|---|---|
| **1** | **Invalidación de JWT** (`iat < lastTokenIssuedAt`, exp 8h, payload `{ sub, username, role, iat }`, coerción del bigint-string) | El refactor toca `auth.service.ts` (R1, R2) y `jwt.strategy.ts` (import). Reordenar el login o "limpiar" el payload **invalida todos los tokens vivos**, o —peor, porque es silencioso— **deja de invalidar los viejos**. T17 agrega una segunda red: un `select` acotado en `findById` mataría la regla sin que nada más lo note. |
| **2** | **`ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`** | Los DTOs de entrada **no cambian de forma**. Si alguien "endurece" `AuthCredentialsDto` (p. ej. agregando `@MaxLength`), pasa a rechazar con **400** peticiones que hoy se aceptan: es cambio de contrato (**D2**), fuera de alcance (§10, Q8). |
| **3** | **`ResponseInterceptor` global** | Es el modo de falla más probable de este refactor: cualquier controller que devuelva su propio envoltorio produce **doble envoltura**. Lo cubren T6, T20, T21 y —crítico— el hallazgo §6.1. El `message: 'OK'` es fijo: darle mensaje propio a un endpoint sería **D5**, no un cambio de controller. |
| **4** | **`HttpExceptionFilter` global** (`@Catch()` sin argumentos) | R5 lo modifica: aplica a **todos** los endpoints a la vez. Sin T14/T15 en verde, un narrowing mal escrito devuelve `'Internal server error'` en lugar del mensaje real de una `HttpException` (o el `message` vacío) **en toda la API**, y ningún spec de controller lo nota porque los controllers lanzan, no serializan. |
| **5** | **Prefijo `/api` + Swagger en `/api/docs` con el esquema `'access-token'`** | R3 y R13 agregan anotaciones de Swagger. Un endpoint protegido que pierda `@ApiBearerAuth('access-token')` —o que lo escriba con otro nombre— **parece roto sin estarlo**: el botón *Authorize* deja de aplicarle. Se verifica en **B7** (Nivel B). |
| **7** | **La entidad no sale nunca por la API** | R10 reescribe el mapeo entidad→DTO. Si `list()` terminara devolviendo entidades "porque los campos coinciden", el día que alguien agregue una columna se publica sola —y `findById` ya trae el hash bcrypt en memoria (§4.3). Lo anclan los `it()` existentes que afirman `not.toHaveProperty('password')`. |
| **8** | **bcrypt salt rounds = 10 en `PasswordService`** | No se toca. Si un "refactor de constantes" moviera `SALT_ROUNDS` a una variable de entorno, sería **D7 + D8** y necesitaría su propio diseño. |
| **9** | **Winston con rotación a archivo: los logs no son efímeros** | R7/R8 tocan el logger. T12 y T13 son las dos pruebas que impiden que un "enriquecimiento" del log (un metadato extra, un `JSON.stringify(objeto)`) deje datos de dominio **en disco, comprimidos y rotados 14/30 días**. Lo dice la cabecera de `winston-logger.service.ts` y hay que seguirla respetando. |
| **10** | **CORS `origin: '*'`** | Se **asume sin cambio** y se declara aquí. No se toca en esta feature. |
| **11** | **TypeORM 1.x endurece la API** (`select` como objeto; `update`/`delete` con criterio vacío **lanzan**) | R10 toca el `select`. T18 fija que el criterio de `update` es el `id` y no un objeto vacío: un criterio construido dinámicamente que pudiera quedar vacío es un **500 en producción**, y en este dominio casi siempre un error de diseño. |
| **12** | **Metadatos de decoradores vs. `import type`** | Es el riesgo específico de **R6** y de **R12**. Convertir a `import type` una clase que NestJS **inyecta** (servicios, `ConfigService`, DTOs validados) la borra del JavaScript emitido y **la DI deja de resolverla**; el síntoma aparece al arrancar (Nivel B), no al compilar. La lista blanca de R6 es `Request`/`Response` de `express`, y nada más. Por lo mismo el repo sigue en **CommonJS** aunque los `@nestjs/*` 12 sean ESM puro: pasar a `"type": "module"` rompería este patrón en cada módulo y entidad. |

### 6.1. Hallazgo con fallo demostrable hoy: doble registro del `ResponseInterceptor` en la e2e

`src/app.module.ts` registra el interceptor como **`APP_INTERCEPTOR`** (global por DI), y
`test/app.e2e-spec.ts` **vuelve a registrarlo** con `app.useGlobalInterceptors(new ResponseInterceptor())`
sobre la misma aplicación. Dos interceptores globales aplican **los dos**: la respuesta exitosa queda
envuelta **dos veces**, de modo que `body.resource` es el envoltorio interno y no el recurso.

Consecuencia esperada al correr la suite: fallan **2 de los 4** casos —
*"GET /api/ responde que el servidor está arriba"* (`body.resource` sería `{ statusCode, message, resource,
isError }`) y *"login con credenciales válidas devuelve { token } y permite listar usuarios"*
(`body.resource?.token` sería `undefined`). Los otros dos van por la ruta de error, que **no** pasa por
interceptores, y seguirían pasando.

**Por qué nadie lo ha visto:** el Nivel B nunca llegó a las aserciones. La primera ejecución real
(2026-09-04) murió antes, en la compilación de `AppModule` por el guard bajo `@nestjs/passport` 12 —
justamente el defecto B2 que atiende la **#5**, cuyo criterio 4 exige `npm run test:e2e:docker` **en
verde**.

**Cómo se trata en la #6:** es **R16**. Si la #5 lo cierra (lo más probable, porque no puede poner la e2e
en verde de otra forma), la #6 sólo lo verifica y lo anota. Si no, es el **primer paso** de la fase GREEN
de la #6, y su demostración es el Nivel B (la suite pasa de 2 fallos a verde), no un test unitario.
**Este hallazgo se reporta al `leader` ahora, no al llegar a la #6.**

---

## 7. Alternativas descartadas

1. **Refactor "big-bang" en una sola pasada** (todo el inventario §4 y luego correr el gate). Descartada:
   sin punto verde intermedio, un rojo obliga a bisecar entre quince cambios en ocho archivos, y el gate
   no dice **qué** paso lo rompió. El costo de bisecar supera con creces el de once corridas del gate.
   Ver el orden de §8.
2. **Refactorizar primero y escribir los tests después** ("total, si pasan los que ya hay…"). Descartada
   por definición del harness: contradice `red_modo: caracterizacion` y el CHECK 3d. Un test escrito
   después fija **lo que el código hace**, no lo que debía hacer; y aquí hay cuatro ramas hoy sin
   cobertura (`typeof res === 'string'`, `obj.message` no-string, `normalizarMensaje` con `Error`,
   `create` sin `active`) que son exactamente donde un refactor "inocuo" cambiaría comportamiento sin que
   nada gritara.
3. **Introducir una capa de repositorios propia (patrón Repository sobre TypeORM) o CQRS
   (`@nestjs/cqrs`).** Descartada: es un **rediseño de arquitectura**, no un refactor de comportamiento
   neutro; duplica lo que `Repository<T>` ya ofrece; agregaría una **dependencia nueva** (**D9**) que el
   criterio 3 de `acceptance` prohíbe sin aprobación explícita; y con una sola entidad y cinco consultas
   el costo de indirección no compra nada. Sería defendible con varias entidades y transacciones de
   varios pasos (**D10**) — hoy no existen.
4. **Mapear entidad→DTO con `class-transformer`** (`plainToInstance(UserDto, entity, {
   excludeExtraneousValues: true })` + `@Expose`), o con `ClassSerializerInterceptor`. Descartada aunque
   es idiomática en NestJS: la seguridad pasaría a depender de que **cada** campo tenga su `@Expose`, y un
   decorador olvidado **filtra en silencio** justo el campo nuevo (exactamente el modo de falla del
   acoplamiento 7). El mapeo explícito de `toDto` falla al revés: si olvidas un campo, **falta** en la
   respuesta y se nota. Además `ClassSerializerInterceptor` sería un tercer interceptor global
   compitiendo con el envoltorio (acoplamiento 3). Se anota como candidato a reconsiderar cuando existan
   muchos DTOs.
5. **Unificar el idioma renombrando identificadores en todo el repo.** Descartada como parte de esta
   feature (N6): diff enorme, valor funcional cero, toca specs congelados. Lo que sí se propone es
   **escribir la regla** (Q2) para que la mezcla deje de ser accidental.

---

## 8. Orden de GREEN (pasos pequeños, punto verde entre cada uno)

**Punto verde** = `npm run harness:verify` en **`[OK]`**, advertencias de deuda **iguales al baseline
vigente de `docs/verifications.md` §4**, y **cero** aserciones existentes modificadas. Después de cada
paso se anota en `progress/impl_refactor_buenas_practicas.md` (una línea por paso: qué se cambió, qué
reportó el gate).

### 8.1. Prerrequisitos (antes de la fase RED)

- **P0.** Feature **#5 `done`**. Releer su diseño y su `impl_` y **descartar de §4/§5 lo ya hecho** (§1.1).
- **P0b.** Gate en `[OK]` y **Nivel B de partida capturado**: `docker compose --profile app up -d --build
  --wait` + `npm run test:e2e:docker` + los casos B1-B9 de §9.2, con las respuestas JSON guardadas. Esa
  captura **es** la línea base contra la que se compara al final. Sin ella, "no cambió el comportamiento"
  es una afirmación, no una demostración.

### 8.2. Fase GREEN, paso por paso

| Paso | Qué se hace | Refactors | Cómo queda protegido |
|---|---|---|---|
| **G0** | Si la #5 no lo cerró: quitar el registro duplicado del interceptor en `test/app.e2e-spec.ts` | R16 | Nivel B (la e2e pasa a verde) |
| **G1** | Mover `JwtPayload` a `src/auth/interfaces/`; constante `EXPIRACION_TOKEN`. Sin cambios de lógica. | R1, R2 | 5 anclas de `jwt.strategy.spec.ts` + 3 de `auth.service.spec.ts` + typecheck |
| **G2** | `AuthResponseDto` + `@ApiResponse({ type })` en el login | R3 | T6 + e2e (B3) + Swagger en B7 |
| **G3** | Refactor del `HttpExceptionFilter` (helper privado + narrowing sin aserción) | R5 | **T14, T15** + los 6 `it()` existentes. **No se entra a este paso si T14/T15 no están en verde.** |
| **G4** | `NivelLog` en el logger propio | R7 | 6 `it()` + T13 |
| **G5** | `winston.config.ts`: `node:os` + enum `NodeEnvironment` | R8 | T9-T12 |
| **G6** | `UsersService`: `toListItemDto` + constante del `select` público | R10 | T16-T19 + las 4 anclas del archivo |
| **G7** | `app.module.ts`: `ConfigService` tipado con `infer`, quitar el `ConfigModule` redundante, `synchronize` contra el enum | R9 | CHECK 5/5b + **Nivel B obligatorio al terminar el paso** (la app arranca y conecta) |
| **G8** | Swagger/DTOs faltantes: `HealthDto`, `@ApiResponse` de `create`/`list` | R13 | `app.controller.spec.ts`, T20, T21, e2e B1 + B7 |
| **G9** | *(Q4)* Unificar el envoltorio en `src/common/interfaces/api-response.interface.ts` | R14 | typecheck de `src/` **y** `test/` + specs del interceptor y del filtro |
| **G10** | *(Q1)* `@CurrentUser()` + tipo `AuthenticatedRequest` | R12 | 2 anclas de `users.controller.spec.ts` (**aserciones intactas**, sólo cambia la preparación) + B4/B5 |
| **G11** | `import type` de `express` (lista blanca) y limpieza de comentarios/separadores | R6, R11 | typecheck + build + revisión |
| **G12** | *(último y opcional)* `main.ts`: extraer `configurarSwagger` | R15 | **sólo Nivel B** (B1, B7) |
| **G13** | Cierre: Nivel B completo comparado contra la captura de P0b; **trinquete de cobertura** en `feature_list.json` **y** `docs/verifications.md` §4 en la misma pasada; `progress/current.md` al día; regla de idioma en `CLAUDE.md` si Q2 se aprueba | — | Gate + `reviewer` |

Los pasos **G9, G10 y G12 son prescindibles**: si alguno se complica, se **saca** de la feature y se anota
como candidato de backlog. Nada en este inventario justifica pelear con el compilador.

### 8.3. Criterio de aborto (regla dura)

> **Si un refactor exige cambiar una aserción existente, ese refactor es un cambio de comportamiento y
> queda FUERA de alcance.** Se revierte el paso, se anota en `progress/impl_refactor_buenas_practicas.md`
> con el nombre del `it()` que lo delató y se registra como candidato de backlog con su disparador
> (D2/D3/D4/D9…).

Corolarios operativos:

1. **No se cambia el texto de ningún `it()` existente** (CHECK 3c, §2.2), ni se renombra ni se mueve
   ningún spec.
2. Ajustar la **preparación** de un test (cómo se construye el argumento) es admisible y se declara
   explícitamente en el `impl_` — sólo ocurre en G10.
3. Si un paso deja el gate en rojo y la causa no es obvia en **una** lectura, se revierte el paso. No se
   acumulan dos refactors en el mismo punto rojo.
4. Ningún `eslint-disable` nuevo, ningún `as any`, ninguna aserción de tipo para "hacer pasar" el
   typecheck (CHECKPOINTS.MD).

---

## 9. Verificación (Definición de Hecho)

### 9.1. Nivel A — `npm run harness:verify` en `[OK]`

Valores **leídos de `docs/verifications.md` §4 y de `feature_list.json → rules`** el 2026-09-04, no de
memoria:

- **Advertencias de deuda = baseline vigente: `0`.** Esta feature no debe introducir ninguna.
- **Piso de cobertura (`rules.cobertura_minima`):** líneas **76** · sentencias **76** · funciones **72** ·
  ramas **64**. Última medición registrada: líneas **80.08** · sentencias **80.45** · funciones **76.19** ·
  ramas **67.97**.
- **Efecto esperado de la batería:** entran a cobertura tres archivos que hoy están en 0 % o casi
  (`src/config/env.validation.ts`, `src/common/logger/winston.config.ts`, `src/auth/auth.controller.ts`) y
  se cierran cuatro ramas del filtro, del logger y de `UsersService`. La expectativa es holgura **muy por
  encima de los 5 puntos** que dispara el trinquete. **El piso nuevo se fija con el número que reporte el
  gate en la fase GREEN, dejando ~4 puntos de holgura, y se escribe en `feature_list.json` y en
  `docs/verifications.md` §4 en la misma pasada.** No se compromete aquí un número inventado.
- CHECK 3c (trazabilidad de los 4 criterios), 3d (evidencia RED **con una mutación por archivo**), 3e
  (`tdd: true`), 4 (higiene: sin `console.log`, sin `.only`, sin TODOs sin contexto), 5 (build), 5b
  (typecheck de `src/` **y** `test/`), 5c (lint `--max-warnings=0`), 6 (100 % de los tests), 6b (cobertura).
- Recordatorio del modo: con la feature en `red` y `red_modo: caracterizacion`, el gate **exige todo en
  verde**; la tolerancia de fallos es exclusiva del modo `nuevo`.

### 9.2. Nivel B — manual, contra PostgreSQL real (**se declara**, no se sustituye)

Comandos (de `docs/verifications.md` §1), con el Node de `.nvmrc` (24 LTS). La base de `compose.yaml` vive
en **tmpfs** y es desechable: **nunca se apunta a DEV/QA con datos**.

```
docker compose --profile app up -d --build --wait     # API + PostgreSQL (B1 y casos manuales)
npm run test:e2e:docker                               # B2: PostgreSQL desechable + suite e2e + limpieza
npm run test:e2e:docker -- --keep                     # deja la base arriba para los casos manuales
docker compose --profile app down -v                  # apaga y borra todo
```

**Se ejecuta dos veces: ANTES (P0b) y DESPUÉS (G13), y se comparan las salidas.** Ésa es la única prueba
real de que un refactor no cambió el comportamiento.

| # | Caso | Qué se comprueba | Refactors que valida |
|---|---|---|---|
| **B1** | `GET /api/` con la app en el contenedor | 200 y cuerpo **exactamente** `{"statusCode":200,"message":"OK","resource":{"msg":"Server is up and running"},"isError":false}` — envoltorio **simple**, no doble | R13, R15, R16 |
| **B2** | `npm run test:e2e:docker` | La suite completa en verde (4/4), antes y después | R16 y todo el conjunto |
| **B3** | `POST /api/auth/login` con la semilla | **200** (no 201) y `resource.token` presente | R3, R4 |
| **B4** | `POST /api/users` y `GET /api/users/me` **sin** token | 401 con `{ statusCode: 401, …, isError: true }` | R12, guard heredado de la #5 |
| **B5** | Ciclo real de invalidación: login → guardar token A → login otra vez → usar A | El token A responde **401** después del segundo login; el token B funciona | R1, R2 (regla crítica) |
| **B6** | `POST /api/users` con un campo no declarado en el DTO | **400** `'Validación fallida'` con `resource.errors` | R5, acoplamiento 2 |
| **B7** | `/api/docs` en el navegador | El botón *Authorize* aplica a los tres endpoints de `/api/users`; el login publica el schema de `AuthResponseDto`; `GET /api/` publica el de `HealthDto`; el esquema Bearer sigue llamándose `access-token` | R3, R13, R15 |
| **B8** | Provocar un 500 (detener el contenedor de la base y llamar `GET /api/users` con token) y revisar `logs/error-*.log` | Cuerpo genérico sin detalle interno (feature #4) y en el log **método, ruta, status y mensaje real**, sin cuerpo de la petición, sin `Authorization`, sin contraseñas ni datos de cliente | R5, R7, R8, acoplamiento 9 |
| **B9** | `\d users` en psql, antes y después | **Esquema idéntico**: ninguna columna nueva, renombrada ni eliminada (recordatorio: fuera de producción `synchronize` sincroniza solo, y renombrar una propiedad **borra la columna anterior con sus datos**) | Verifica que nadie tocó la entidad |

Si no hay Docker/PostgreSQL en la máquina de la sesión, el Nivel B **se declara con responsable
asignado** en `progress/impl_refactor_buenas_practicas.md`; **no se sustituye con mocks** y sin la
declaración el `reviewer` no aprueba.

### 9.3. Cobertura de los criterios de `acceptance`

| Criterio | Cubierto por |
|---|---|
| **1** — contratos y reglas de negocio intactos | Anclas de Nivel A (interceptor, `jwt.strategy`, `auth.service`, `users.controller`, filtro) + T6/T7/T8 + **Nivel B B1-B9 comparados antes/después** |
| **2** — caracterización previa (rojo por mutación) y cobertura que no baja | T1-T21 en disco + evidencia RED con una mutación por archivo (CHECK 3d) + CHECK 6b y el trinquete de §9.1 |
| **3** — cada refactor con su motivo y su prueba; sin dependencias nuevas | §4 de este documento + ancla de `framework-nestjs12.spec.ts` + revisión documental del `reviewer` sobre `package.json`/`package-lock.json` y el diff |
| **4** — sin `any`, sin duplicación, sin código muerto ni comentarios obsoletos; lint 0/0 y typecheck limpio | CHECK 5, 5b, 5c, 4 + revisión del `reviewer` (R10, R11, R14 son los que atacan la duplicación) |

---

## 10. Preguntas abiertas / decisiones a confirmar

Todas tienen **valor por omisión**: el `leader` puede proceder con él si el usuario no indica otra cosa.

1. **¿Se adopta el decorador `@CurrentUser()`?** (R12, paso G10.) — **Por omisión: sí**, en
   `src/auth/decorators/current-user.decorator.ts` con `createParamDecorator`, como **último** paso y
   ajustando sólo la *preparación* de los dos `it()` congelados de `users.controller.spec.ts`, nunca sus
   aserciones. **Alternativa más barata** si se prefiere riesgo cero: dejar `@Request()` y sólo reemplazar
   el tipo literal inline por una interfaz nombrada `AuthenticatedRequest { user: User }` en
   `src/auth/interfaces/` (misma ganancia de legibilidad, **sin** tocar la firma del método ni los specs).
2. **¿Se unifica el idioma de los nombres?** — **Por omisión: se escribe la regla, no se renombra.** Regla
   propuesta para `CLAUDE.md`: *identificadores orientados al framework y al contrato público en inglés
   (rutas, llaves de DTO, nombres de columna, clases, métodos públicos); comentarios, mensajes de negocio,
   textos de `it()` y helpers privados en español de negocios (México)*. Eso legitima lo que ya existe
   (`escribir`, `normalizarMensaje`, `construirHost`) y evita un diff de renombrado sin valor (N6).
   Alternativa: inglés estricto en **todos** los identificadores — se puede, pero es una feature de
   renombrado aparte, con su propio riesgo sobre los specs congelados.
3. **Índices, `@Unique` nuevos, cambios de tipo de columna, paginación de `GET /api/users`, `select`
   acotado en `findById`.** — **Por omisión: EXCLUIDOS de la #6.** Los tres primeros son **D4** (esquema,
   y sin carpeta de migraciones hay que decir cómo llega a producción); la paginación es **D2**; el
   `select` acotado es **D6 + D3**. Cada uno necesita su propia feature con diseño. ¿Se levantan como
   entradas de backlog ahora?
4. **¿Se unifica el envoltorio en `src/common/interfaces/api-response.interface.ts`?** (R14, paso G9.) —
   **Por omisión: sí**, porque es la duplicación de contrato más visible del repo; el costo es actualizar
   un import en `test/app.e2e-spec.ts`, y el CHECK 5b lo atrapa si se olvida.
5. **¿Dónde vive el catálogo de entornos?** (R8.) — **Por omisión: se queda `NodeEnvironment` en
   `src/config/env.validation.ts`** y `src/common/logger/winston.config.ts` lo importa. Alternativa:
   moverlo a `src/common/enums/node-environment.enum.ts` para invertir la dirección de la dependencia —
   se descarta por omisión porque toca el archivo que la **#5** está modificando.
6. **¿Se toca `src/main.ts`?** (R15, paso G12.) — **Por omisión: sólo si la #5 no lo dejó resuelto, y
   sólo extrayendo `configurarSwagger`.** Es el archivo con menor protección del repo (sin spec, excluido
   de la cobertura): todo lo que se cambie ahí se paga en Nivel B.
7. **Atomicidad del login** (si `sign` falla después de `updateLastTokenIssuedAt`, el usuario queda con
   sus tokens invalidados y sin token nuevo). — **Por omisión: no se toca en la #6** (es la regla de
   negocio crítica, **D3**). ¿Se registra como feature de backlog?
8. **Límites de longitud en `AuthCredentialsDto`** (hoy `username` sin límite y `password` sólo con
   `@MinLength(6)`, mientras `CreateUserDto` usa `@Length(6, 200)`). — **Por omisión: no se toca**:
   agregar un máximo cambia qué peticiones se rechazan con **400** (**D2**). ¿Se registra como backlog?
9. **Trinquete de cobertura.** — **Por omisión: sí**, se sube el piso al valor medido en la fase GREEN
   menos ~4 puntos de holgura, en `feature_list.json` **y** `docs/verifications.md` §4, en la misma pasada.

---

**Recordatorio de la regla de oro:** este diseño **no arranca la implementación**. La feature #6 permanece
en **`pending`** y `feature_list.json` **no fue modificado**.
**Esperando "go" del usuario para pasar a la fase RED del `implementer`** — y recordando que la fase RED de
esta feature **no toca una sola línea de producción**.

**Para el `leader`, con prioridad:** el hallazgo de §6.1 (doble registro del `ResponseInterceptor` en
`test/app.e2e-spec.ts`, que hoy haría fallar 2 de los 4 casos e2e) pertenece al camino crítico de la
**feature #5**, cuyo criterio 4 exige `npm run test:e2e:docker` en verde. Conviene pasarlo al diseño de la
#5 antes de que arranque su fase RED.
