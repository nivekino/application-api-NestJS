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
