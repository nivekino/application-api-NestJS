# Revisión — Feature #6 `refactor_buenas_practicas`

> Veredicto del `reviewer` contra `CHECKPOINTS.MD`. Insumos: `progress/design_refactor_buenas_practicas.md`
> (incluida la adenda del leader §1.1.1), `progress/impl_refactor_buenas_practicas.md` (RED §1-§10, GREEN
> §11), `progress/current.md`, `feature_list.json`, `docs/verifications.md` §4.

## 1. Nivel A — `npm run harness:verify`

Corrido por el `reviewer` el 2026-09-04 sobre el árbol de trabajo tal cual está (sin tocar nada):

```
CHECK 1        [OK] 24 archivos base
CHECK 1b       [OK] toolsets de subagentes
CHECK 2        [OK] Node 24.20.0
CHECK 3        [OK] 6 features, estado valido; activa #6 [green]
CHECK 3b       [OK] needs_design clasificado
CHECK 3c       [OK] 19 criterios Nivel A verificados en disco, 6 Nivel B, 0 sin cobertura
CHECK 3d       [OK] evidencia RED de las 5 features tdd:true
CHECK 3e       [OK] todas tdd:true (1 exencion legacy declarada)
CHECK 4        [OK] higiene src/ (31 archivos) y test/ (18 archivos)
CHECK 5        [OK] build (nest build)
CHECK 5b       [OK] typecheck src/ + test/
CHECK 5c       [OK] lint 0 errores / 0 advertencias, 53 archivos
CHECK 6        [OK] 64/64 tests, 17/17 suites
CHECK 6b       [OK] cobertura: lineas 99.22% / sentencias 98.95% / funciones 97.82% / ramas 81.59%
BASELINE       [OK] 0 advertencias de deuda == baseline 0
```

Exit 0, `[OK]`. **No es una corrida `--estructura`**: build, typecheck, lint, jest y cobertura corrieron
todos.

**Advertencias de deuda vs. baseline vigente** (`docs/verifications.md` §4, leído del documento, no de
memoria): baseline documentado = **0**; medido = **0**. Coincide.

**Cobertura vs. piso:** cobertura medida por el gate (99.22/98.95/97.82/81.59) coincide con lo declarado
en `impl_` §11.3 y en `docs/verifications.md` §4 ("Cobertura medida"). El piso vigente en
`feature_list.json → rules.cobertura_minima` (95/94/93/77) y en `docs/verifications.md` §4 ("Piso de
cobertura") coinciden entre sí, y ambos fueron subidos en esta misma pasada de GREEN con la holgura de
~4 puntos que fijó Q9 del diseño. No hay holgura pendiente de trinquete: al subir el piso a estos
valores, `harness:verify` ya no reporta `[INFO]` de holgura adicional (confirmado en la corrida propia).

## 2. Disciplina TDD

- **Evidencia RED (§3 de `impl_`):** cubre una mutación por cada uno de los **11 archivos Nivel A** del
  contrato (`response.interceptor.spec.ts`, `jwt.strategy.spec.ts`, `auth.service.spec.ts`,
  `auth.controller.spec.ts`, `env.validation.spec.ts`, `winston.config.spec.ts`,
  `http-exception.filter.spec.ts`, `users.service.spec.ts`, `users.controller.spec.ts`,
  `winston-logger.service.spec.ts`, `framework-nestjs12.spec.ts`), con el fallo real de Jest pegado, la
  restauración confirmada y el verde de vuelta. Es creíble: cada mutación ataca exactamente el
  comportamiento que su `it()` afirma (invertir el ternario del nivel de log, invertir la comparación de
  `iat`, envolver la respuesta del controller, vaciar el criterio de `update`, etc.), no un cambio
  cosmético en otro archivo.
- **`red_modo: caracterizacion` correctamente aplicado:** el diseño exige "todo verde + mutación descrita"
  (no tolerancia de fase RED), y eso es lo que muestra `impl_` §3 y §3.12 (comparación byte a byte de los
  11 archivos mutados contra el original, build/typecheck/lint en verde tras restaurar).
- **Dos desviaciones documentadas con motivo técnico verificable** (`impl_` §7): la mutación literal de T4
  (agregar el valor de la propiedad que falla) no producía rojo porque `JWT_SECRET`/`DB_PASS` solo fallan
  por `@IsNotEmpty` (vacío, sin nada que filtrar); la sustituta (agregar el `config` crudo completo al
  mensaje) sí demuestra la misma garantía D6. Mismo patrón con T14. Ambas están razonadas, no son atajos.
- **Trazabilidad (CHECK 3c + verificación de fondo):** se leyeron los 19 archivos de Nivel A citados en
  `tdd_contract` y en cada uno el `it()` existe con el texto exacto y el `expect` prueba el resultado
  correcto (no solo ausencia de excepción): p. ej. `updateLastTokenIssuedAt ...` afirma
  `toHaveBeenCalledWith('uuid-1', { lastTokenIssuedAt: 12345 })` (el criterio TypeORM 1.x de criterio no
  vacío), `buildWinstonOptions no agrega por omision mas metadatos...` afirma el conjunto exacto de llaves
  de `defaultMeta`, `HttpExceptionFilter usa como message el texto de una HttpException construida con un
  string` afirma el `message` real, no solo que no truena.
- **Ningún mock donde el criterio exige realidad:** el criterio 1 (contratos intactos) se apoya en
  anclas de Nivel A + Nivel B (B1-B9) comparado antes/después contra Docker + PostgreSQL real, no
  simulado.
- **Sin `eslint-disable` nuevos que apaguen reglas prohibidas:** revisado con grep sobre `src/`, la única
  ocurrencia de la palabra "eslint-disable" es un comentario explicativo en
  `src/auth/decorators/current-user.decorator.ts:11` (no una directiva real). El único
  `eslint-disable`/`eslint-enable` real en el árbol tocado está en `test/app.e2e-spec.ts:67-76`
  (`no-require-imports`), preexistente (documentado con su motivo en el comentario del propio archivo,
  necesario por la carga diferida para el `skip` sin BD) y no introducido por esta feature.
- **Mocks tipados** en todos los specs nuevos revisados (`jest.Mocked<Pick<...>>`), sin `as jest.Mock`.
- **Puerta humana respetada:** "ok hagamos todo hasta que termines de hacer commits" (2026-09-04),
  documentada en `progress/current.md` y en `impl_` §11.

## 3. Hallazgos por criterio

| Criterio (`acceptance`) | Test / evidencia que lo cubre | Veredicto |
|---|---|---|
| 1. Contratos públicos y reglas de negocio intactos | Anclas Nivel A (`response.interceptor.spec.ts`, `jwt.strategy.spec.ts` con la coerción bigint-string y `iat < lastTokenIssuedAt`, `auth.service.spec.ts` con `expiresIn: '8h'` y payload `{sub, username, role, iat}`) + T6-T8 nuevos (`auth.controller.spec.ts`) + Nivel B B1-B9 comparado contra P0b | OK. Verificado leyendo el código actual: `EXPIRACION_TOKEN = '8h'`, payload idéntico, `JwtStrategy.validate` conserva `payload.iat < lastIssued` y la coerción `Number(user.lastTokenIssuedAt)`. `AuthController.login` sigue devolviendo `{token}` sin envolver, `@HttpCode(HttpStatus.OK)` intacto. |
| 2. Código refactorizado cubierto antes por caracterización; cobertura no baja | T1-T21 en disco, evidencia RED con mutación por archivo (§2), cobertura subió de 89.87/89.88/83.72/71.24 (piso previo) a 99.22/98.95/97.82/81.59 medido | OK. |
| 3. Inventario de refactors con motivo y prueba; sin dependencias nuevas | `impl_` §4 y §11.1 bitácora G1-G13; ancla `framework-nestjs12.spec.ts` | OK. `git diff` de `package.json` contra `c52e811` solo muestra los cambios de versión de las features #3/#5 (11→12, `engines`, scripts `--experimental-vm-modules`, `nest-winston` retirado) y `test:e2e:docker` (de #5); ningún paquete nuevo atribuible a la #6. Cada refactor R1-R18 del inventario del diseño aparece con su paso G1-G12 en `impl_` §11.1 y su archivo coincide con lo leído en disco (ver §4 de esta revisión). |
| 4. Sin `any`, sin duplicación, sin código muerto ni comentarios obsoletos; lint 0/0, typecheck limpio | CHECK 4/5/5b/5c del gate + revisión manual | OK. `grep` de `: any`/`as any`/`<any>` en `src/` → 0 coincidencias. `grep` de `CP-04` y de la marca corporativa en `src/` → 0 coincidencias (los separadores de sección heredados y las etiquetas `(CP-04)` fueron retirados de `users.service.ts` y `users.module.ts`, confirmado leyendo ambos archivos). La duplicación del envoltorio (`ApiResponse`/`ErrorBody`) y del mapeo entidad→DTO de `list()` quedó unificada (`api-response.interface.ts`, `toListItemDto` + `SELECT_PUBLICO`). |

### 3.1. Verificación puntual de los puntos de especial cuidado del leader

- **`@CurrentUser()` sin `any` ni `eslint-disable`:** confirmado (`current-user.decorator.ts`), con
  `AuthenticatedRequest extends Request { user: User }` como narrowing tipado explícito.
- **`import type` de `express` solo en filtro e interceptor:** confirmado; `http-exception.filter.ts`
  importa `{ Request, Response }` y `response.interceptor.ts` importa `{ Response }`, ambos como
  `import type`. No se encontró ningún otro archivo de `src/` con `import type` de `express`.
- **`api-response.interface.ts` sin cambiar la forma del envoltorio:** `{ statusCode, message, resource?,
  isError }` — misma forma que documentan los specs del interceptor y del filtro; ambos consumidores la
  usan sin alterar el JSON de salida (confirmado también por B7 del Nivel B: sin diferencia en el cable).
- **`main.ts` con `PORT` desde `ConfigService` y `configurarSwagger` sin alterar el orden:** confirmado.
  El orden `setGlobalPrefix` → `useGlobalPipes` → `enableCors` → `helmet()` → `configurarSwagger` →
  `listen` se conserva; `PORT` se obtiene con
  `app.get<ConfigService<EnvironmentVariables, true>>(ConfigService).get('PORT', { infer: true })`.
- **`app.module.ts` con `ConfigService` tipado y sin el `ConfigModule` redundante:**
  `TypeOrmModule.forRootAsync` usa `ConfigService<EnvironmentVariables, true>` con `{ infer: true }` en
  cada `get`; se revisó `src/auth/auth.module.ts` y `JwtModule.registerAsync` ya **no** importa
  `ConfigModule` (solo `inject: [ConfigService]`), confirmando R9b.
- **Ajustes de lint no planeados (§11.2):** ambos están razonados y no son aserciones de tipo
  innecesarias: (a) retirar `res !== null` en el narrowing del filtro se apoya en que
  `HttpException.getResponse(): string | object` — el `object` de TypeScript excluye `null`, así que la
  comparación era redundante, no una supresión de un caso real; (b) las constantes `DEVELOPMENT`/`TEST`
  ancladas a `string` con anotación de tipo (no `as`) son una anotación de variable, no una aserción de
  tipo sobre un valor ya calculado. Ninguna de las dos oculta un caso `null`/`undefined` real ni introduce
  un `any` disfrazado.

## 4. Nivel B — declarado y ejecutado

`progress/impl_refactor_buenas_practicas.md` §9 (captura de partida P0b, antes de escribir cualquier
spec) y §11.4 (cierre, comparado contra P0b) declaran: caso, comando exacto
(`docker compose --profile app up -d --build --wait`, `npm run test:e2e:docker`, consultas manuales con
`curl`/`psql`), base contra la que se probó (PostgreSQL 17 en tmpfs de `compose.yaml`, desechable,
sembrado y borrado por la propia prueba) y resultado. B1-B9 quedaron ejecutados dos veces (antes/después)
con una sola diferencia, **esperada y documentada**: `AuthResponseDto`/`HealthDto` nuevos en
`GET /api/docs-json` (B7), consecuencia directa de R3/R13 (Swagger ahora publica schema donde antes no
publicaba nada; el JSON del cable no cambió). B8 (500 real, detalle solo en el log) se **re-verificó
explícitamente** en el cierre, no solo se heredó de la #5, justamente porque G3-G5 tocaron el filtro y el
logger.

Cumple el requisito: la declaración está completa y es creíble; no se sustituye con mocks.

## 5. Veredicto: **APROBADO**

El Nivel A está en `[OK]` sin tolerancias de fase RED (la feature ya salió de `red`), las advertencias de
deuda igualan el baseline vigente (0), el piso de cobertura subió en la misma pasada con la holgura que
fijó el diseño, y la cobertura medida está muy por encima de él. La evidencia RED por mutación es
completa, creíble y cubre los 11 archivos de Nivel A del contrato, con las dos desviaciones documentadas
y técnicamente justificadas. Los `it()` congelados de las features #1/#2/#4/#5 (guard, envoltorio, filtro,
JWT, `getMe`) se verificaron línea por línea: ningún texto ni aserción cambió; la única excepción
permitida por el diseño (G10, ajuste de la *preparación* de `getMe` para pasar de `@Request()` a
`@CurrentUser()`) es exactamente lo que se documentó, sin tocar las aserciones. El inventario de refactors
R1-R18 se verificó contra el código en disco, uno por uno, y coincide con lo descrito en `impl_` §11.1: sin
paquetes nuevos, sin `any`, sin `eslint-disable` nuevos que apaguen reglas prohibidas, sin comentarios ni
etiquetas obsoletas de `CP-04`, sin menciones de la marca corporativa en el árbol tocado. El Nivel B está
declarado con el detalle exigido (comando, base, resultado) y ejecutado dos veces con una única diferencia
esperada. La regla de idioma de identificadores (Q2) y la convención de `@CurrentUser()` quedaron escritas
en `CLAUDE.md`, y los cinco candidatos de backlog descartados por criterio de aborto (§8.3 del diseño)
quedaron listados en `impl_` §11.6 como candidatos, no como features nuevas.

No se detectaron hallazgos que ameriten cambios. Puede marcarse `done` una vez el `leader` complete el
cierre operativo (mover el resumen a `progress/history.md`, resetear `progress/current.md`, commit).

## 6. Re-revisión

No aplica: esta es la primera y única revisión de esta feature; no hubo rechazo previo.
