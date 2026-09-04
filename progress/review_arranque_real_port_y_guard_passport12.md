# Revisión — #5 `arranque_real_port_y_guard_passport12`

**Veredicto: APROBADO**

Fecha de revisión: 2026-09-04 · Rol: `reviewer` · Estado de la feature al revisar: `green`.

---

## 1. Nivel A

`npm run harness:verify` corrido por el propio reviewer (no solo citado del `impl_`):

```
CHECK 1        [OK] 24 archivos base
CHECK 1b       [OK] toolsets (4 agentes)
CHECK 2        [OK] Node 24.20.0
CHECK 3        [OK] 6 features, activa: #5 [green]
CHECK 3b       [OK] needs_design clasificado
CHECK 3c       [OK] 16 criterios Nivel A verificados en disco, 5 Nivel B, 0 sin cobertura
CHECK 3d       [OK] evidencia RED (4 features tdd:true)
CHECK 3e       [OK] todas tdd:true (1 exenta legacy)
CHECK 4        [OK] higiene src/test
CHECK 5        [OK] build
CHECK 5b       [OK] typecheck (tsconfig + test/tsconfig)
CHECK 5c       [OK] lint 0 errores / 0 advertencias (46 archivos)
CHECK 6        [OK] 43/43 tests, 15/15 suites
CHECK 6b       [OK] cobertura 89.87 / 89.88 / 83.72 / 71.24 sobre piso 85/85/79/67
[BASELINE]     0 advertencias de deuda == baseline vigente (docs/verifications.md §4)
exit code: 0
```

**Advertencias de deuda vs. baseline:** 0 == 0, leído de `docs/verifications.md` §4 (no de memoria). Sin
cambios.

**Cobertura vs. piso:** el piso vigente en `feature_list.json → rules.cobertura_minima` (85/85/79/67) y
en `docs/verifications.md` §4 coinciden exactamente. La holgura entre el piso anterior (76/76/72/64) y lo
medido en GREEN (89.87/89.88/83.72/71.24) es de 13.87/13.88/11.72/7.24 puntos — muy por encima del umbral
de 5 que dispara el trinquete — y el nuevo piso (85/85/79/67) queda, como en las dos subidas anteriores,
unos 4-5 puntos por debajo de lo medido, dejando margen operativo. Trinquete aplicado correctamente en la
misma pasada (`feature_list.json` y `docs/verifications.md` §4 se actualizaron juntos).

No hubo ninguna corrida con `--estructura` sustituyendo al Nivel A.

## 2. Disciplina TDD

- **Evidencia RED (CHECK 3d, §3 de `impl_`):** creíble. Se pegó la salida literal de `npm test` con los
  cuatro archivos del Nivel A del contrato fallando por la razón exacta que cada criterio afirma: T1
  (`validateEnv` lanza con `PORT: '3000'`), T2 (`design:type` es `Object`, no `Number`), T8/T9 (`Nest
  can't resolve dependencies of the JwtAuthGuard (?)` / `obligatorias` no vacío), y los dos `it()`
  existentes de `users.controller.spec.ts` cayendo con el mismo error de DI tras retirar el
  `.overrideGuard`. Ningún test pasó por accidente; el resto de la suite (37 `it()`) seguía en verde.
- **`red_modo: nuevo`:** correcto. No hay ningún caso de `caracterizacion` en esta feature (no aplicaba
  describir mutación) y el gate lo confirmó en la propia fase RED (`impl_` §8): tolerancia solo en los
  cuatro archivos del `tdd_contract`, con al menos un fallo.
- **Trazabilidad (CHECK 3c) verificada en el fondo, no solo en la forma:** se leyeron los cuatro archivos
  nuevos/modificados y los `expect()` prueban lo que el criterio afirma, no solo ausencia de excepción:
  - T1/T2 (`env.validation.spec.ts`): `expect(config.PORT).toBe(3000)` y
    `expect(Reflect.getMetadata('design:type', ..., 'PORT')).toBe(Number)` — resultado concreto, no un
    "no truena".
  - T9 (`jwt-auth.guard.spec.ts`): reproduce las dos lecturas reales del injector
    (`Reflect.getMetadata`/`getOwnMetadata`) y afirma `obligatorias === []` — fija la causa raíz como
    invariante ejecutable, no un mock que garantiza el resultado.
  - T8 (`users.module.spec.ts`): compila `UsersModule` **real** (solo se sobreescribe el repositorio de
    `User`, no el guard) y afirma `moduleRef.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard)` — es
    exactamente el test que reproduce el modo de falla real de B2, con DI real, no simulada.
  - T10 (`users.controller.spec.ts`): confirmado que el `.overrideGuard` fue retirado (`grep` sin
    coincidencias de una llamada real; las dos únicas menciones de la palabra son el nombre del `it()` y
    un comentario descriptivo) y que los dos `it()` conservan su texto exacto, citado por las features #1
    y #2.
  - E1/E2 (`test/app.e2e-spec.ts`, Nivel B): E1 espera >1s entre logins (documentado y justificado contra
    la resolución en segundos de `iat`) y afirma 401 con el token viejo / 200 con el nuevo; E2 afirma 400
    ante un campo no declarado. Ambos contra la app real, sin mocks — correcto para un criterio de Nivel
    B que depende del ciclo completo de JWT y del `ValidationPipe`.
- **Nada de mocks donde el criterio exige realidad:** T8 y T9 ejercitan DI real de NestJS (no se mockea
  el guard ni el injector); E1/E2 corren contra PostgreSQL real vía `test:e2e:docker`. Correcto.
- **Sin `eslint-disable` nuevos** que apaguen `no-unsafe-*`/`no-explicit-any`/`no-conditional-expect`: el
  único `eslint-disable` en el árbol tocado (`app.e2e-spec.ts`, `no-require-imports`) es preexistente al
  patrón de carga diferida de la suite, no nuevo de esta feature, y no es de la familia prohibida.
- **Mocks tipados:** `jest.Mocked<Pick<Repository<User>, 'find' | 'findOne'>>` en `users.module.spec.ts`;
  sin `any`.

## 3. Hallazgos por criterio

| Criterio (`acceptance`) | Test que lo cubre | Veredicto |
|---|---|---|
| 1. `validateEnv` acepta `PORT` como cadena numérica, conserva el valor por omisión, rechaza fuera de rango/no numérico | `env.validation.spec.ts` T1-T7 | OK. `readonly PORT: number = 3000` es la única propiedad tocada; las otras siete quedaron intactas (confirmado leyendo `env.validation.ts`), tal como pedía la Q4 del diseño. `dist/config/env.validation.js` emite `__metadata("design:type", Number)` para `PORT` (verificado por el reviewer, no solo citado). |
| 2. `UsersModule` compila sin `overrideGuard`; `JwtAuthGuard` resuelve bajo passport 12; sin duplicar config de Passport fuera de `src/auth/` | `users.module.spec.ts` T8, `jwt-auth.guard.spec.ts` T9, `users.controller.spec.ts` T10 (ancla) | OK. `jwt-auth.guard.ts` solo agrega un constructor explícito con `super({ defaultStrategy: 'jwt' })`; `dist/auth/guards/jwt-auth.guard.js` emite `__metadata("design:paramtypes", [])` (verificado). Cero cambios en `@Module`, providers o imports de módulos (confirmado con `git diff` acotado a esta feature): `auth.module.ts` no se tocó, la config de Passport sigue en un solo lugar. |
| 3. La API arranca en el contenedor de `compose.yaml` y `GET /api/` responde 200 con el envoltorio estándar | Nivel B — B1 | OK, declarado y ejecutado (§11.8 de `impl_`): contenedor `Healthy`, `GET /api/` → `{"statusCode":200,"message":"OK","resource":{"msg":"Server is up and running"},"isError":false}`. |
| 4. `npm run test:e2e:docker` en verde; B3-B7 ejecutados y declarados | E1/E2 (Nivel A del contrato solo referencia el texto del `it()`; el nivel real es B) + Nivel B B2-B7 | OK. 6/6 en la suite e2e (incluye E1, invalidación real de JWT, y E2, `ValidationPipe`); B4, B6, B7 manuales ejecutados y documentados con comandos y salidas. |

Ningún criterio quedó en `pendiente`.

## 4. Nivel B

**Declarado y EJECUTADO**, no solo declarado (`impl_` §11.8, con comandos y salidas reales, revisados por
el reviewer):

- **B1:** `docker compose --profile app up -d --build --wait` → contenedor `Healthy`; `GET /api/` → 200
  con el envoltorio estándar exacto. Corrige el defecto que existía antes de esta feature.
- **B2/B3/B5:** `npm run test:e2e:docker` → 6/6 (incluye E1 y E2). Los `error:` en la salida son el logger
  registrando los 401/400 esperados por la propia suite, no un fallo — lectura correcta.
- **B4:** `/api/docs` 200; `/api/docs-json` con `securitySchemes.access-token` aplicado a las tres rutas
  de `users`.
- **B6:** 401 provocado y **500 real** provocado (violación de unicidad de `email`, cae en la rama de la
  feature #4). Logs revisados explícitamente por la ausencia de `valor-de-prueba`, `JWT_SECRET`,
  `solo-local` y el hash bcrypt sembrado; la aparición del mismo mensaje en dos archivos de log distintos
  se explica correctamente por los dos transports de Winston (no es una duplicación real dentro de un
  mismo archivo).
- **B7:** `\d users` con columnas idénticas a la entidad `User`; sin cambio de esquema, consistente con
  "Qué NO toca" del diseño (no hay migración que declarar).

Cierre limpio: `docker compose --profile app down -v`.

**Consistencia de la evidencia pegada:** las fechas (2026-09-04), el nombre del contenedor
(`application-api-nestjs-app-1`, `application-api-nestjs-db-1`), los conteos (6/6 tests e2e, 43/43
unitarios) y las columnas de `\d users` son coherentes entre sí y con lo que arroja el gate corrido de
forma independiente por este reviewer. No hay señales de fabricación (números redondos sospechosos,
timestamps incoherentes, salidas que no casan con el comando invocado).

## 5. Apego al diseño

- El desglose de §4 del diseño (`design_arranque_real_port_y_guard_passport12.md`) se siguió literalmente
  en ambas correcciones (PORT y guard); el "plan A" de §4.2 funcionó a la primera, sin necesitar el plan B
  documentado como contingencia.
- **Desviación documentada correctamente:** el retiro de `app.useGlobalInterceptors(new
  ResponseInterceptor())` en `test/app.e2e-spec.ts` (adenda §5.5.1 del diseño, hallazgo del leader) está
  anotado como desviación en `impl_` §7 con su motivo, y verificado en el archivo real: no queda esa
  línea, y `useGlobalPipes` sigue presente por la razón correcta (`AppModule` no registra `APP_PIPE`).
  Ningún `it()` cambió de aserción por este ajuste.
- **Q4 del diseño respetada:** no se extendió `readonly` a las otras siete propiedades de
  `EnvironmentVariables`; queda anotado para la feature #6, como corresponde.
- **Ningún `@Module`, provider o import de módulo cambió** fuera de lo descrito: confirmado leyendo
  `src/auth/guards/jwt-auth.guard.ts` (solo agrega constructor) y con `git diff --stat` (no aparecen
  `*.module.ts` entre los archivos tocados por esta feature).
- **Documentación (§8.3 del diseño), todo verificado en disco por el reviewer:**
  - `.claude/agents/planner.md` — acoplamiento **13** agregado con el texto completo y preciso (línea
    144), más la nota de la trampa de `no-inferrable-types` (línea 135).
  - `CLAUDE.md` — "doce" → "trece" modos de falla silenciosa (línea 108).
  - `docs/verifications.md` §1 (párrafo "Por qué el Nivel B sigue siendo declarado" cerrado y actualizado
    con B3/B5 automatizados), §4 (piso 85/85/79/67 + histórico con la fila de la feature #5), §5.4 (nueva,
    prueba negativa con la mutación exacta: revertir el guard / quitar la anotación de `PORT`).
  - `progress/impl_migracion_nestjs_12_esm.md` §11.7 — nota fechada 2026-09-04 que corrige el diagnóstico
    erróneo ("a partir de NestJS 12, `compile()` instancia también los guards") sin borrar el texto
    original, apuntando a la causa real (asimetría `getMetadata`/`getOwnMetadata`).
  - Cada número vive en su fuente única: no se encontró repetición desincronizada entre estos documentos.
- **Alcance del árbol de trabajo:** `git diff --stat`/`git status` muestran cambios adicionales
  (`src/app.module.ts`, `src/common/filters/http-exception.filter.ts`, `src/common/logger/**`,
  `src/main.ts`, `Dockerfile`, `compose.yaml`, `package.json`, etc.) que corresponden a las features #3 y
  #4 (ya `done`) y al mantenimiento de infraestructura Docker/CI del 2026-09-04, ambos documentados en
  `progress/history.md`. No pertenecen a la #5 y no se penalizan aquí.
- **Sin menciones a "Kata"/"Formiik"** en ningún archivo de `src/`, `test/` ni en los documentos tocados
  por esta feature; la única coincidencia de "kata" en el repo es un falso positivo dentro de un hash de
  integridad de `package-lock.json` (`sha512-vKatAh4...`), ya señalado y explicado en revisiones previas.

## 6. Higiene

Sin `console.log`, `.only`, tests deshabilitados ni TODOs sin contexto en los archivos tocados por esta
feature (confirmado por CHECK 4 y por lectura directa). El comentario de dos líneas que reemplaza al
`.overrideGuard` en `users.controller.spec.ts` es explicativo, no código muerto.

## Veredicto

**APROBADO.** Gate en `[OK]` sin tolerancias de fase RED (feature en `green`), 0 advertencias de deuda
contra el baseline vigente, cobertura sobre el piso ya actualizado por trinquete en la misma pasada,
evidencia RED creíble con trazabilidad verificada en el fondo (no solo en la forma), Nivel B ejecutado
(no solo declarado) con salidas consistentes y revisadas, causa raíz del guard verificada de forma
independiente en `dist/`, alcance del cambio correctamente acotado a lo que el diseño describía, y
documentación (acoplamiento 13, CLAUDE.md, verifications.md, corrección fechada del diagnóstico previo)
completa y consistente entre sus fuentes.

Sin hallazgos que bloqueen el paso a `done`.
