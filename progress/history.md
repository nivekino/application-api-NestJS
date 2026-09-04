# Bitácora (append-only)

Resumen de features cerradas. Se agrega una entrada por feature al pasarla a `done`. No se edita ni
borra lo anterior.

<!-- Formato de entrada:
## [YYYY-MM-DD] #<id> <name> — <title>
- Resultado verificación: OK / observaciones
- Archivos clave: ...
- Veredicto reviewer: progress/review_<name>.md
-->

## [2026-06-29] #1 perfil_usuario_autenticado — Consultar el perfil del usuario autenticado
- **Resultado verificación:** `npm run harness:verify` → [OK] (build correcto, 18/18 tests en verde). Node 18 con WARN no bloqueante.
- **Archivos clave:** `src/users/users.controller.ts` (endpoint `GET /api/users/me` con `JwtAuthGuard` + Swagger), `src/users/users.service.ts` (`getProfile` → `findById` → `toDto` sin password), `src/users/users.controller.spec.ts` (nuevo), `src/users/users.service.spec.ts` (casos `getProfile`).
- **Ciclo:** implementer → reviewer (RECHAZADO: 1 test en rojo por `import()` dinámico en Node 18) → implementer (fix import estático) → re-verificación leader [OK] → reviewer APROBADO.
- **Veredicto:** progress/review_perfil_usuario_autenticado.md
- **Detalle impl:** progress/impl_perfil_usuario_autenticado.md

## [2026-09-03] Mantenimiento — toolchain a Node 24 / TypeORM 1.x / ESLint 10 y gate consciente de la fase RED
- **Alcance:** infraestructura y harness, sin features de negocio. Hecho directo (no es un ciclo de feature), verificado con el gate.
- **Defecto encontrado:** el `package-lock.json` versionado era inconsistente (`ts-jest@29.4.6` exige `typescript <6` junto a `typescript ^6.0.3`): **un clon limpio no podía `npm ci`**. Se regeneró desde cero.
- **Dependencias:** NestJS 11.0 → **11.2.3**; TypeORM 0.3.20 → **1.1.1** (único cambio de código: `select` como objeto en `UsersService.list`); Jest **30.5.1** + ts-jest **29.4.12**; ESLint 9 → **10.9.1** con typescript-eslint 8.69 y **eslint-plugin-jest** nuevo; Prettier **3.9.6**; `@types/node` **24**; TypeScript fijado en **~6.0.3**. `@eslint/eslintrc` eliminado. `overrides` para que `@nestjs/cli` use el TypeScript raíz (antes compilaba con una copia anidada 5.9.3).
- **Decisión NestJS 12 (12.0.1, 2026-08-27):** NO se adoptó. Es ESM puro, `nest-winston` no lo soporta (gremo/nest-winston#935), Jest solo lo carga desde CommonJS en Node ≥ 24.9 y el CLI 12 exige Node ≥ 24.15. Registrado como **feature #3** (`needs_design: true`, D9).
- **Node:** piso **24 LTS** (`engines >=24.11.0`, `.nvmrc` 24.20.0, `.npmrc engine-strict`). CHECK 2 pasa de advertencia a error por debajo del piso. Node 26 entra a LTS el 2026-10-28.
- **TypeScript:** 7.0.2 sigue bloqueado por typescript-eslint (`<6.1.0`) y ts-jest (`<7`). `tsconfig.json` limpia flags obligatorios en TS 6 y activa `noUncheckedIndexedAccess`.
- **Formato:** `.editorconfig` tenía `max_line_length = off`, que Prettier lee como ancho **infinito** (líneas de 170 caracteres sin queja). Ahora `printWidth` 100 y LF forzado con `.gitattributes` (el árbol estaba en CRLF por `core.autocrlf=true`).
- **Lint estricto:** `strictTypeChecked` + `stylisticTypeChecked` + jest. Se corrigieron 20 hallazgos de fondo: mocks `any` → `jest.Mocked<Pick<…>>`; `lastTokenIssuedAt` declarado `number | string | null` (bigint llega como string); e2e con semilla propia en vez de `expect` condicional; test sin aserción; asignaciones inútiles.
- **Gate (verify.mjs):** entra typecheck (5b), lint `--max-warnings=0` (5c), cobertura con piso-trinquete (6b), `.only`/skip en pruebas (4), `tdd: true` obligatorio con exenciones explícitas (3e), evidencia RED creíble (3d: menciona cada archivo, contiene un fallo real, describe la mutación en `caracterizacion`). El gate **entiende la fase RED**: en `red` modo `nuevo` tolera fallos solo en los archivos del `tdd_contract` y exige al menos uno. Prueba negativa en `docs/verifications.md` §5.
- **Piso de cobertura inicial:** líneas 60 / sentencias 60 / funciones 55 / ramas 55 (medido 62.2 / 62.9 / 57.6 / 57.2).
- **Backlog:** feature #2 (cerrar deuda D1/D2 con pruebas de caracterización) y #3 (NestJS 12). Baseline de advertencias sigue en **2** hasta cerrar la #2.
- **Nivel B:** no ejecutado en esta sesión (sin PostgreSQL local; Docker instalado pero el daemon apagado). Pendiente para una persona: `docker run -d --name pg-e2e -e POSTGRES_PASSWORD=<local> -p 5432:5432 postgres:17`, `.env` con `DB_*`/`JWT_SECRET`, `npm run test:e2e`. El e2e ahora siembra y borra su propio usuario.
- **CI:** `.github/workflows/gate.yml` corre `npm ci` + `npm run harness:verify` con el Node de `.nvmrc`.

## [2026-09-03] #2 pruebas_guard_401_y_formato_respuesta — Cerrar la deuda D1/D2 (caracterización)
- **Resultado verificación:** `npm run harness:verify` → [OK]; 23/23 tests; lint 0/0; cobertura 75.6/76.4/69.7/64.5 sobre piso nuevo 72/73/66/61; `[BASELINE] 0 == 0`.
- **Ciclo:** RED (`red_modo: caracterizacion`, 4 mutaciones restauradas) → puerta humana (aprobada por el usuario) → GREEN (sin código de producción; Nivel B declarado) → reviewer **RECHAZADO** (el estado en disco no reflejaba el cierre de D1/D2) → corrección del leader (contrato de la #1 → specs nuevos, baseline 2→0, exención legacy con motivo explícito, hallazgo D6 → feature #4) → reviewer **APROBADO** (2ª ronda).
- **Archivos clave:** `src/users/users.controller.guard.spec.ts`, `src/common/interceptors/response.interceptor.spec.ts`, `src/common/filters/http-exception.filter.spec.ts`, `feature_list.json`, `docs/verifications.md` §4.
- **Decisión registrada:** la exención legacy de la feature #1 permanece (sin evidencia RED retroactiva posible) pero ya sin deuda; el baseline queda en 0.
- **Nivel B:** declarado, pendiente de ejecutar por el usuario (sin PostgreSQL en la máquina de la sesión).
- **Veredicto:** progress/review_pruebas_guard_401_y_formato_respuesta.md · **Detalle impl:** progress/impl_pruebas_guard_401_y_formato_respuesta.md

## [2026-09-03] #4 error_500_sin_detalle_interno — HttpExceptionFilter no expone el mensaje interno de un Error no controlado
- **Resultado verificación:** `npm run harness:verify` → [OK]; 26/26 tests; lint 0/0; cobertura sobre el piso 72/73/66/61; `[BASELINE] 0 == 0`.
- **Ciclo:** planner (D5/D6) → RED (`red_modo: nuevo`, 3 `it()` nuevos en `http-exception.filter.spec.ts`, 1 en rojo por aserción) → puerta humana (aprobada por el usuario) → GREEN (único archivo de producción: `src/common/filters/http-exception.filter.ts`; el `message` real de un `Error` va solo al log, la respuesta lleva `'Internal server error'`) → reviewer **APROBADO**.
- **Origen:** hallazgo §5.2 del reviewer de la feature #2. Cerrado en `docs/verifications.md` §4.
- **Nivel B:** declarado (provocar un 500 real con la app arriba y comparar respuesta vs. `logs/error-*.log`), pendiente de ejecutar por el usuario.
- **Veredicto:** progress/review_error_500_sin_detalle_interno.md · **Detalle impl:** progress/impl_error_500_sin_detalle_interno.md · **Diseño:** progress/design_error_500_sin_detalle_interno.md

## [2026-09-04] #3 migracion_nestjs_12_esm — Migrar el framework a NestJS 12 (paquetes ESM)
- **Resultado verificación:** `npm run harness:verify` → [OK]; 34/34 tests; lint 0/0; cobertura 80.08/80.45/76.19/67.97 sobre el piso subido por trinquete a 76/76/72/64 (antes 72/73/66/61); `[BASELINE] 0 == 0`.
- **Ciclo:** planner (D9/D5/D8, 2026-09-03) → RED (`red_modo: nuevo`, 3 specs nuevos: `winston-logger.service.spec.ts`, `logger.module.spec.ts`, `framework-nestjs12.spec.ts`; dos sin compilar y uno rojo por aserción) → puerta humana (aprobada el 2026-09-04) → GREEN → reviewer **APROBADO**.
- **Qué cambió:** `@nestjs/*` 11 → 12.0.x (ESM puro) con el repo en **CommonJS** vía `require(esm)`; `nest-winston` reemplazado por un `LoggerService` propio (`src/common/logger/`: `WinstonLoggerService`, `LoggerModule` global, token `APP_LOGGER` con `useExisting`); `engines.node` `>=24.15.0` (`.nvmrc` 24.20.0). Sin cambios de esquema, contratos de API ni reglas de auth.
- **Hallazgos no previstos por el diseño:** (1) el `npm i` por grupos da ERESOLVE real por peers cruzados: se instalaron los once `@nestjs/*` en un solo comando, sin `--legacy-peer-deps`/`--force`; (2) Jest solo hace `require()` de ESM si existe `vm.SourceTextModule`, que Node 24.x no expone sin `--experimental-vm-modules`: los scripts `test*` y el CHECK 6 del gate invocan `node --experimental-vm-modules node_modules/jest/bin/jest.js`; (3) NestJS 12 instancia los guards de clase en `compile()`: `users.controller.spec.ts` usa `.overrideGuard(JwtAuthGuard)`.
- **Observación de proceso (reviewer):** el código G1/G2 llegó al árbol antes de registrarse la aprobación formal de la batería; se documentó retroactivamente. En adelante, respetar el orden formal de la puerta humana.
- **Nivel B:** declarado (B1–B7 en `impl_…md` §11.16: arranque, e2e, ciclo real de invalidación de JWT, Swagger, `ValidationPipe`, logger en disco sin datos sensibles, esquema sin cambios), **pendiente de ejecutar por una persona** con PostgreSQL desechable (sin `DB_*` ni Docker en la máquina).
- **Fuera del ciclo (misma sesión):** se retiraron todas las menciones a la marca corporativa del repositorio; el proyecto es de aprendizaje personal. Los comentarios el rótulo de seguridad con marca pasaron a "Seguridad de datos".
- **Veredicto:** progress/review_migracion_nestjs_12_esm.md · **Detalle impl:** progress/impl_migracion_nestjs_12_esm.md · **Diseño:** progress/design_migracion_nestjs_12_esm.md

## [2026-09-04] Mantenimiento — Nivel B reproducible: Docker (compose + imagen) y CI (e2e + smoke)
- **Qué se agregó:** `compose.yaml` (PostgreSQL 17 en tmpfs, desechable; perfil `app` con la API), `Dockerfile` (dos etapas sobre `node:24.20.0-bookworm-slim`, mismo Node que `.nvmrc`, usuario `node`, healthcheck con `fetch`), `.dockerignore`, `scripts/e2e-docker.mjs` (`npm run test:e2e:docker`: up db → e2e → down -v; `--keep` para los casos manuales), y en `.github/workflows/gate.yml` los trabajos `nivel-b-e2e` (e2e contra PostgreSQL efímero del runner) y `docker-smoke` (build + compose + `GET /api/`, `/api/docs`, 401 sin token). Documentado en `docs/verifications.md` §1, `README.md`, `CLAUDE.md`, `AGENTS.MD`.
- **Primera ejecución real del Nivel B (feature #3):** **B1 FALLA** (la app no arranca si `PORT` viene del entorno: `PORT = 3000` sin anotación de tipo → `design:type Object` → class-transformer no convierte la cadena) y **B2 FALLA** (bajo `@nestjs/passport` 12 `JwtAuthGuard` no resuelve `AuthModuleOptions` en `UsersModule`; el `.overrideGuard` del spec unitario lo ocultaba). B3–B7 no alcanzados. Detalle en `progress/impl_migracion_nestjs_12_esm.md` §11.16.1.
- **Consecuencia en el backlog:** feature **#5** `arranque_real_port_y_guard_passport12` (`needs_design`, D3/D8) hereda B1–B7; feature **#6** `refactor_buenas_practicas` (`needs_design`, D1/D5/D11, `red_modo: caracterizacion`) por petición del usuario, depende de la #5.
- **Lección:** el Nivel A en `[OK]` con 34/34 mide lo que los mocks dejan medir. El Nivel B sigue siendo declarado aunque CI ahora automatice B1/B2/B4.
- **Nota:** el pull de `postgres:17` y la construcción de la imagen se hicieron en local con Docker Desktop; nada se publicó a ningún registro.

## [2026-09-04] #5 arranque_real_port_y_guard_passport12 — Arranque real bajo NestJS 12: PORT desde el entorno y JwtAuthGuard resolvible en UsersModule
- **Resultado verificación:** `npm run harness:verify` → [OK] sin tolerancias; 43/43 tests; lint 0/0; cobertura 89.87/89.88/83.72/71.24 sobre el piso subido por trinquete a 85/85/79/67 (antes 76/76/72/64); `[BASELINE] 0 == 0`.
- **Ciclo:** planner (D3/D8) → RED (`red_modo: nuevo`; 3 specs nuevos `env.validation.spec.ts`, `users.module.spec.ts`, `jwt-auth.guard.spec.ts`; retiro del `.overrideGuard` en `users.controller.spec.ts` sin renombrar `it()`; E1/E2 en la e2e; 6 fallos reales) → puerta humana (aprobada "ok sigamos") → GREEN → reviewer **APROBADO** sin hallazgos bloqueantes.
- **Causa raíz del guard (verificada en `@nestjs/core`):** el injector lee `design:paramtypes` con `Reflect.getMetadata` (hereda del mixin `AuthGuard()`) pero `optional:paramtypes` con `getOwnMetadata` (no hereda): la dependencia opcional del padre se vuelve obligatoria en la subclase. Corrección: `JwtAuthGuard` declara su propio constructor con `super({ defaultStrategy: 'jwt' })` → `design:paramtypes []`. Ningún módulo ni provider cambió. Registrado como acoplamiento **13** en `.claude/agents/planner.md`. El diagnóstico erróneo de la #3 ("NestJS 12 instancia guards en compile()") quedó corregido con nota fechada.
- **PORT:** `readonly PORT: number = 3000` en `env.validation.ts`; el `readonly` evita que el autofix de `no-inferrable-types` del hook borre la anotación y reintroduzca el defecto.
- **Hallazgo colateral cerrado en RED:** la e2e registraba `ResponseInterceptor` dos veces (ya es `APP_INTERCEPTOR` en `AppModule`); se retiró del `beforeAll`.
- **Nivel B: EJECUTADO** contra `compose.yaml` (PostgreSQL 17 + imagen del `Dockerfile`): B1 `GET /api/` 200 con envoltorio estándar; B2/B3/B5 `npm run test:e2e:docker` 6/6 (incluye invalidación real de JWT y 400 del `ValidationPipe`, ahora casos permanentes); B4 Swagger con `access-token` en las tres rutas de `users`; B6 401 y 500 reales sin datos sensibles ni duplicados en `logs/`; B7 `\d users` idéntico a la entidad. Hereda y cierra los B1–B7 pendientes de la #3.
- **Pendientes anotados para la #6:** `readonly` en el resto de `EnvironmentVariables`; `main.ts` sigue leyendo `process.env.PORT` en vez del valor validado.
- **Veredicto:** progress/review_arranque_real_port_y_guard_passport12.md · **Detalle impl:** progress/impl_arranque_real_port_y_guard_passport12.md · **Diseño:** progress/design_arranque_real_port_y_guard_passport12.md

## [2026-09-04] #6 refactor_buenas_practicas — Refactorización y buenas prácticas del código existente, sin cambiar comportamiento
- **Resultado verificación:** `npm run harness:verify` → [OK]; 64/64 tests; lint 0/0; cobertura 99.22/98.95/97.82/81.59 sobre el piso subido por trinquete a 95/94/93/77 (antes 85/85/79/67); `[BASELINE] 0 == 0`.
- **Ciclo:** planner (D1/D5/D11) → RED (`red_modo: caracterizacion`: 21 `it()` nuevos en 7 archivos, dos specs nuevos `auth.controller.spec.ts` y `winston.config.spec.ts`; rojo demostrado por mutación en los 11 archivos Nivel A del contrato, cada uno restaurado byte a byte; captura de partida del Nivel B guardada antes de tocar nada) → puerta humana (aprobada) → GREEN en 13 pasos con punto verde entre cada uno → reviewer **APROBADO** sin hallazgos.
- **Refactors aplicados (R1–R18 del diseño):** `JwtPayload` a `src/auth/interfaces/`; constante `EXPIRACION_TOKEN`; `AuthResponseDto` y `HealthDto` con `@ApiProperty`; `auth.controller.spec.ts` nuevo; `HttpExceptionFilter` con helper privado y narrowing sin aserciones; `import type` de express solo en filtro e interceptor; `NivelLog` en el logger propio; `winston.config.ts` con `node:os` y el enum `NodeEnvironment`; `AppModule` con `ConfigService<EnvironmentVariables, true>` e `infer`, sin el `ConfigModule` redundante en `JwtModule`; `UsersService` con `toListItemDto` y `SELECT_PUBLICO` únicos; envoltorio unificado en `src/common/interfaces/api-response.interface.ts`; decorador `@CurrentUser()`; `readonly` en `EnvironmentVariables`; `main.ts` con `configurarSwagger` y `PORT` desde el `ConfigService` validado; separadores y etiquetas `CP-04` retirados.
- **Regla dura respetada:** ningún `it()` preexistente cambió de texto ni de aserción; en G10 solo cambió la preparación de los dos `it()` de `getMe`. Sin paquetes nuevos, sin `any`, sin `eslint-disable`.
- **"Optimizar", medido:** no había N+1, ni `await` en serie evitable, ni índices faltantes. La feature mejora tipado, duplicación y legibilidad; no rendimiento.
- **Nivel B: ejecutado dos veces** (antes y después) contra `compose.yaml`; única diferencia: los schemas `AuthResponseDto`/`HealthDto` nuevos en Swagger, esperada.
- **Documentación:** regla de idioma de identificadores y convención `@CurrentUser()` en `CLAUDE.md`.
- **Candidatos de backlog (no son features; cada uno requiere diseño propio):** `select` acotado en `findById` para no cargar el hash en `req.user` (D6+D3); paginación de `GET /api/users` (D2); índices/`@Unique`/tipos de columna (D4, sin carpeta de migraciones); atomicidad del login si `sign` falla tras `updateLastTokenIssuedAt` (D3); límites de longitud en `AuthCredentialsDto` (D2).
- **Veredicto:** progress/review_refactor_buenas_practicas.md · **Detalle impl:** progress/impl_refactor_buenas_practicas.md · **Diseño:** progress/design_refactor_buenas_practicas.md
