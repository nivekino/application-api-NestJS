# Revisión — Feature #2 `pruebas_guard_401_y_formato_respuesta`

- **Estado al revisar:** `in_review` (`red_modo: caracterizacion`, `tdd: true`).
- **Insumos leídos:** `CHECKPOINTS.MD`, `feature_list.json` (feature #1 y #2, `rules`),
  `progress/impl_pruebas_guard_401_y_formato_respuesta.md`, `progress/current.md`,
  `docs/verifications.md` §4, los tres specs nuevos y el código que caracterizan
  (`src/users/users.controller.ts`, `src/common/interceptors/response.interceptor.ts`,
  `src/common/filters/http-exception.filter.ts`).

## 1. Nivel A

Corrida de `npm run harness:verify` sobre el repo en el estado entregado (feature en `in_review`):

```
CHECK 1        [OK] 24 archivos base
CHECK 1b       [OK] Toolsets (4 agentes)
CHECK 2        [OK] Node 24.20.0
CHECK 3        [OK] 3 features estado válido; activa #2 [in_review]
CHECK 3b       [OK] needs_design clasificado
CHECK 3c       [OK] 6 criterios Nivel A verificados en disco, 1 Nivel B, 2 sin cobertura (feature #1)
CHECK 3d       [OK] Evidencia RED revisada
CHECK 3e       [OK] tdd:true (1 exención legacy declarada)
CHECK 4        [OK] higiene src/ y test/
CHECK 5        [OK] build
CHECK 5b       [OK] typecheck (src + test)
CHECK 5c       [OK] lint 0 errores / 0 advertencias, 36 archivos
CHECK 6        [OK] 23/23 tests, 9/9 suites
CHECK 6b       [OK] cobertura líneas 75.59% · sentencias 76.37% · funciones 69.69% · ramas 64.49%
               (piso 72/73/66/61)
BASELINE       2 advertencias de deuda == baseline 2 (docs/verifications.md §4)
Resultado      [OK], exit 0
```

**Gate en `[OK]`, sin deuda nueva, cobertura sobre el piso vigente.** (Nota: el `Tee-Object`/redirección
de PowerShell sobre la salida nativa de `jest` imprime un `NativeCommandError` cosmético en la
terminal; no afecta el exit code ni el veredicto del script — el propio gate reporta `[OK]`.)

Cobertura por archivo (`coverage/coverage-summary.json`), confirmando que las pruebas nuevas sí
ejercitan el código caracterizado (no es un `expect` vacío que "pasa igual"):

| Archivo | Líneas | Ramas |
|---|---|---|
| `src/common/interceptors/response.interceptor.ts` | 100% | 100% (0 ramas) |
| `src/common/filters/http-exception.filter.ts` | 91.66% | 83.33% |
| `src/users/users.controller.ts` | 86.66% | 75% |

## 2. Disciplina TDD

- **Evidencia RED (caracterización):** creíble. `progress/impl_..._respuesta.md` documenta 4
  mutaciones (una por criterio 1, 2, 3-validación, 4), cada una con el `FAIL` real de Jest mostrando el
  `it()` correcto cayendo, y la restauración con verde confirmado después de cada una. Verificado
  además de forma independiente:
  - `git diff -- src/users/users.controller.ts src/common/interceptors/response.interceptor.ts` → **sin
    diferencias** contra `HEAD`.
  - `git diff -- src/common/filters/http-exception.filter.ts` → sólo dos cambios cosméticos/de lint,
    **no relacionados con las mutaciones**: reformateo del `import` (Prettier) y colapso de
    `else if (res && typeof res === 'object')` a `else` (la anotación de tipo de `getResponse()` hace
    esa condición redundante bajo `strictTypeChecked`; con `NotFoundException`/`BadRequestException` el
    comportamiento observable es idéntico). Este diff ya figuraba como `M` en `git status` antes de
    tocar la feature (parte de la actualización de toolchain de la misma sesión, fuera del alcance de
    esta revisión) y no reintroduce ninguna de las 4 mutaciones documentadas. Código de producción de
    la feature: **idéntico en su comportamiento**.
- **Trazabilidad:** las 5 entradas de `tdd_contract` de la feature #2 tienen su `it()` con el **texto
  exacto** en el archivo declarado (verificado leyendo los tres specs línea por línea contra
  `feature_list.json`).
- **Mocks tipados, sin `any`:** `jest.Mocked<Pick<LoggerService, 'log' | 'error' | 'warn'>>` en
  `http-exception.filter.spec.ts:6`; `ExecutionContext`/`ArgumentsHost`/`Response`/`Request` se
  construyen como objetos mínimos y se castean con `as unknown as X` (convención ya usada en el resto
  del repo para tipos de NestJS/Express con muchos miembros no usados). Sin `eslint-disable` nuevos
  (`grep` sobre `src/` no encontró ninguno).
- **Los tests prueban resultado, no ausencia de excepción:** cada `it()` afirma la forma exacta del
  cuerpo serializado (`json`/`status` en el filtro, el objeto envuelto en el interceptor, el metadato de
  guards en el controller), no sólo que la llamada no truene.

## 3. Hallazgos por criterio

| Criterio (`acceptance` feature #2) | Test | Veredicto |
|---|---|---|
| 1. `UsersController` declara `JwtAuthGuard` como guard de clase | `users.controller.guard.spec.ts:18` | OK — lee `GUARDS_METADATA` real de la clase, coincide con `@UseGuards(JwtAuthGuard)` en `users.controller.ts:12`. |
| 2. `ResponseInterceptor` envuelve toda respuesta exitosa, tomando `statusCode` de la respuesta HTTP | `response.interceptor.spec.ts:13` | OK — usa `statusCode: 201` en el mock y afirma que el resultado lo conserva; la mutación 2 (hardcodear `200`) tumbó justo este test. |
| 3. `HttpExceptionFilter` serializa `HttpException` / errores de `class-validator` | `http-exception.filter.spec.ts:42` y `:56` | OK — ambos escenarios verifican `status`/`json` completos, incluido `resource.errors` para validación. |
| 4. `HttpExceptionFilter` convierte un `Error` no HTTP en 500 y registra sin datos sensibles | `http-exception.filter.spec.ts:74` | **Observación (no bloqueante para esta feature, ver §5.2)** — el escenario usado es un `string` plano (`'fallo inesperado...'`), no una instancia real de `Error`. Es fiel a la letra del criterio y al `red_modo: caracterizacion` (no se puede tocar `http-exception.filter.ts`), pero **no caracteriza la rama `else if (exception instanceof Error) { message = exception.message; }`** (`http-exception.filter.ts:59-60`), que es el caso más común en producción (cualquier excepción no controlada) y que hoy **sí filtra el mensaje interno de la excepción al cliente** — riesgo D6 ya detectado y registrado por el propio implementer en `progress/impl_..._respuesta.md` ("Observación para el leader"). La cláusula "nunca el cuerpo de la petición" sí quedó probada (con contraseña en `body`, nunca llega al logger). |

## 4. Nivel B

**Declarado**, correctamente, en `progress/impl_pruebas_guard_401_y_formato_respuesta.md` §"Prueba
Nivel B": los 4 criterios de la feature son 100% Nivel A (mocks), sin dependencia de PostgreSQL real, lo
cual es razonable dado lo que caracterizan (metadatos de NestJS, envoltura de interceptor, filtro de
excepciones). Por completitud del proyecto se declara además `npm run test:e2e` (suite
`test/app.e2e-spec.ts`, contenedor `postgres:17` local) como confirmación general, **pendiente de
ejecutar por: el usuario (kevinmm)** — sin PostgreSQL/Docker en la máquina de la sesión. Cumple
CHECKPOINTS.MD (caso + comando + base + responsable asignado).

## 5. Veredicto: **RECHAZADO**

El Nivel A está en verde, la disciplina TDD de caracterización es sólida y trazable, y los 4 criterios
de `acceptance` de la feature #2 están cubiertos con tests que sí prueban el resultado. El rechazo **no**
es por la calidad de la batería en sí, sino porque la feature deja **incompleto su propio objeto**, tal
como lo define su `title`/`description` y, de forma normativa, `rules.tdd_exentas_legacy` en
`feature_list.json`:

### 5.1. Motivo principal (bloqueante)

El título de la feature es *"Cerrar la deuda D1/D2..."* y su `description` promete explícitamente: *"Al
cerrarla, el `tdd_contract` de la feature #1 apunta a estos tests en sus criterios 1 y 3, el baseline de
advertencias baja a 0 y la exención legacy de la feature #1 se retira."* La regla
`rules.tdd_exentas_legacy[0].motivo` (fuente normativa, no sólo prosa descriptiva) dice lo mismo: *"las
brechas D1/D2 que destapó se cierran con la feature #2, y entonces esta exención desaparece junto con la
deuda del baseline."*

Nada de eso ocurrió en esta pasada de GREEN:

- `feature_list.json → features[0].tdd_contract` (feature #1) sigue con **criterio 1 y criterio 3 en
  `"nivel": "pendiente"`**, sin apuntar a `users.controller.guard.spec.ts` ni a
  `response.interceptor.spec.ts`/`http-exception.filter.spec.ts`.
- `rules.baseline_advertencias` sigue en **2**, no en 0.
- `rules.tdd_exentas_legacy` sigue listando la exención de la feature #1 como vigente.
- El propio gate, corrido ahora, **sigue emitiendo las mismas 2 advertencias D1/D2** como deuda
  abierta ("Feature #1 ..., criterio 1: sin cobertura ('pendiente')" / "criterio 3: sin cobertura
  ('pendiente')") — el comportamiento ya está probado por la feature #2, pero el archivo de estado no
  lo refleja, así que el sistema sigue reportándolo como brecha.

Esto es precisamente el modo de falla que el propio harness documenta y busca evitar
(`docs/verifications.md` §3: *"un baseline que se mueve por sí solo es un baseline que nadie lee"* / CLAUDE.md:
*"el estado vive en archivos, no en el contexto del modelo"*). Marcar esta feature `done` sin esa
actualización deja una promesa escrita en `rules` sin cumplir y sin ningún gatillo que la retome: el
baseline seguiría reportando D1/D2 como deuda indefinidamente aunque la cobertura real ya exista.

**Corrección accionable para la siguiente iteración (implementer, no reviewer):**

1. En `feature_list.json`, feature #1 (`perfil_usuario_autenticado`) → `tdd_contract`: cambiar
   `criterio 1` a `"nivel": "A"`, `"test": "UsersController declara JwtAuthGuard como guard de clase, de
   modo que GET /api/users/me responde 401 sin JWT valido"`, `"archivo":
   "src/users/users.controller.guard.spec.ts"`; cambiar `criterio 3` a `"nivel": "A"` apuntando al test
   de `response.interceptor.spec.ts` (formato de éxito) — y considerar citar también
   `http-exception.filter.spec.ts` si el criterio 3 de la feature #1 se interpreta como formato de éxito
   y de error.
2. Bajar `rules.baseline_advertencias` a `0` en `feature_list.json` **y** actualizar
   `docs/verifications.md` §4 (tabla "Línea base vigente" y "Composición de las advertencias") en la
   misma pasada.
3. Retirar la entrada de la feature #1 en `rules.tdd_exentas_legacy` (o dejar constancia explícita de
   por qué sigue exenta, si el equipo decide que `tdd: false` de la feature #1 se mantiene por motivos
   distintos a D1/D2).
4. Volver a correr `npm run harness:verify` y confirmar `[BASELINE] 0 advertencias de deuda == baseline
   0`.

### 5.2. Hallazgo secundario (no bloqueante para esta feature, para decisión del leader)

El criterio 4 se probó con un valor que no es `instanceof Error`, evitando así la rama del filtro que
hoy expone el `message` real de una excepción no controlada (`http-exception.filter.ts:59-60`). Dado que
`red_modo: caracterizacion` prohíbe tocar producción, el implementer no podía "arreglar" esto en esta
pasada, y lo registró con transparencia. Sin embargo, mientras esa observación viva sólo en
`progress/impl_...md` y no en `docs/verifications.md` §4 (el único lugar que el resto de agentes lee
como fuente de deuda), el riesgo D6 queda invisible para el próximo `leader`/`reviewer`. Recomendación:
que el `leader`, junto con esta corrección, decida entre (a) agregar esta fuga como una **tercera
advertencia de deuda explícita** en `docs/verifications.md` §4 (con su propio identificador, p. ej. D6),
subiendo el baseline a 1 en vez de a 0, o (b) abrir de una vez una feature nueva con `needs_design: true`
(dispara D6 del catálogo de `planner.md`) que acote el mensaje también en la rama `instanceof Error`.
Cualquiera de las dos es aceptable; lo que no es aceptable es dejarlo sólo como una nota de sesión que
se pierde si nadie la relee.

### Qué SÍ está aprobado sin reservas

La batería de tests en sí (los 3 specs nuevos), la disciplina TDD de caracterización, la ausencia de
cambios funcionales en producción, los mocks tipados y la declaración de Nivel B. Cuando se resuelva el
punto 5.1 (y, a criterio del leader, el 5.2), esta feature está lista para `done` sin necesidad de tocar
de nuevo los specs.

## 6. Re-revisión (2ª ronda)

- **Fecha:** 2026-09-03. **Insumo adicional:** los cuatro puntos de corrección aplicados por el leader
  directamente sobre `feature_list.json` y `docs/verifications.md` (no se tocó `src/` ni `test/`; la
  batería de specs de la feature #2 permanece intacta, sin necesidad de re-verificar TDD/mocks/mutación,
  que ya se confirmaron sólidos en la 1ª ronda).

### 6.1. Nivel A — gate reejecutado

```
CHECK 1        [OK] 24 archivos base
CHECK 1b       [OK] Toolsets (4 agentes)
CHECK 2        [OK] Node 24.20.0
CHECK 3        [OK] 4 feature(s) estado valido (done=1, in_review=1, pending=2); activa #2 [in_review]
CHECK 3b       [OK] needs_design clasificado
CHECK 3c       [OK] 8 criterios en Nivel A (verificados en disco), 1 en Nivel B, 0 sin cobertura
CHECK 3d       [OK] Evidencia RED revisada (1 feature tdd:true)
CHECK 3e       [OK] tdd:true (1 exención legacy declarada)
CHECK 4        [OK] higiene src/ y test/ (23 producción, 10 pruebas)
CHECK 5        [OK] build
CHECK 5b       [OK] typecheck (src + test)
CHECK 5c       [OK] lint 0 errores / 0 advertencias, 36 archivos
CHECK 6        [OK] 23/23 tests, 9/9 suites
CHECK 6b       [OK] cobertura líneas 75.59% · sentencias 76.37% · funciones 69.69% · ramas 64.49%
               (piso 72/73/66/61, sin cambio — no aplica trinquete nuevo en esta pasada)
BASELINE       [OK] 0 advertencias de deuda == baseline 0 (docs/verifications.md §4)
Resultado      [OK], exit 0
```

CHECK 3c pasó de "6 en Nivel A / 2 sin cobertura" a **"8 en Nivel A / 0 sin cobertura"**: confirma en
disco, sin depender de lo que declara el implementer, que los dos criterios de la feature #1 que
estaban en `"pendiente"` (D1 y D2) ahora tienen entrada verificable. Ningún error ni advertencia nueva.

### 6.2. Verificación punto por punto de la corrección exigida en §5.1

1. **`feature_list.json → features[0].tdd_contract` (feature #1):**
   - Criterio 1: `"nivel": "A"`, `"test": "UsersController declara JwtAuthGuard como guard de clase, de
     modo que GET /api/users/me responde 401 sin JWT valido"`, `"archivo":
     "src/users/users.controller.guard.spec.ts"`, con `"nota": "Deuda D1 cerrada por la feature #2
     (2026-09-03)."` — coincide exactamente con lo pedido.
   - Criterio 3: `"nivel": "A"`, apunta a `src/common/interceptors/response.interceptor.spec.ts`, con
     `"nota": "Deuda D2 cerrada por la feature #2 (2026-09-03). La forma del error la cubre
     src/common/filters/http-exception.filter.spec.ts."` — cumple y además atiende la sugerencia
     opcional de citar también el spec del filtro para la parte de error.
   - Verificado con `Read` línea por línea de ambos specs (`users.controller.guard.spec.ts:18` y
     `response.interceptor.spec.ts:13`): el **texto exacto del `it()`** coincide con el `"test"`
     declarado en ambas entradas. No es sólo una cita de archivo: el gate (CHECK 3c) y esta revisión
     manual confirman lo mismo.
   - **OK**, punto 1 cerrado tal como se pidió.

2. **Baseline:** `feature_list.json → rules.baseline_advertencias` = `0`. `docs/verifications.md` §4
   reescrita: tabla "Línea base vigente" reporta **0** advertencias de deuda, 0 errores, piso de
   cobertura 72/73/66/61 con su historial de subida, y una tabla nueva "Historial de la deuda" que
   documenta el cierre de D1 y D2 citando los archivos exactos y la fecha. El gate reejecutado confirma
   `[BASELINE] 0 advertencias de deuda == baseline 0` — no es sólo lo que dicen los documentos, es lo
   que el script mide de forma independiente. **OK**, punto 2 cerrado.

3. **`rules.tdd_exentas_legacy`:** el leader **no la retiró**; la mantuvo con un motivo reescrito:
   *"la exención PERMANECE porque la evidencia RED de sus tests originales no puede producirse
   retroactivamente, y fabricarla sería peor que declararla ausente"*, aclarando que ya **no tiene
   deuda asociada** (D1/D2 cerradas). Esto es exactamente la alternativa que mi punto 3 dejaba abierta:
   *"o dejar constancia explícita de por qué sigue exenta"*. Evalúo esa decisión:
   - Es coherente con la regla del propio harness (CLAUDE.md, CHECK 3d): la evidencia RED es un
     artefacto que se produce **en el momento** de escribir el test; no existe manera honesta de
     fabricarla para una feature cerrada el 2026-06-29, antes de que el ciclo TDD existiera siquiera.
     Forzar una "evidencia RED" post-hoc (p. ej. revertir el código, ver caer un test, y llamarlo
     "evidencia original") sería una ficción — precisamente el tipo de manipulación que el CHECK 3d
     busca detectar en otras features, y sería inconsistente aplicarla aquí sólo para poder borrar una
     línea de `rules`.
   - La motivación distingue con precisión dos cosas que la redacción anterior (la que yo rechacé)
     confundía: la **deuda de cobertura** (D1/D2, ya resuelta, medible por el gate) y la **deuda de
     procedencia** (falta de evidencia RED original, no resoluble, pero tampoco bloqueante una vez que
     el comportamiento SÍ tiene test real hoy). `tdd_nota` de la feature #1 (línea 46) hace la misma
     distinción: *"Su contrato se levantó retroactivamente leyendo los specs reales; las brechas D1/D2
     que destapó las cerró la feature #2... Deuda: 0."*
   - No queda "flotando" como nota de sesión: vive en tres lugares consistentes y con motivo idéntico
     (`rules.tdd_exentas_legacy[0].motivo`, `features[0].tdd_nota`, `docs/verifications.md` §4 "Historial
     de la deuda"), cumpliendo la regla anti-desincronización de CLAUDE.md de que cada hecho vive en un
     solo lugar de referencia y los demás apuntan sin repetir números.
   - CHECK 3e sigue en `[OK]` con la exención declarada explícitamente, que es justo el mecanismo que el
     propio gate provee para este caso (no es un hueco no contemplado).
   - **Conclusión: aceptable.** Es preferible a fabricar evidencia falsa, y la motivación actualizada ya
     no promete algo que no se cumplió (a diferencia de la redacción original de la feature #2, que sí
     prometía "se retira" sin condición). La `description` de la feature #2 y el `tdd_nota` de la #1
     fueron corregidos en el mismo sentido, cerrando la inconsistencia que motivó el rechazo original.

4. **Gate reejecutado:** confirmado en §6.1 — `[BASELINE] 0 advertencias de deuda == baseline 0`, exit 0.

### 6.3. Hallazgo secundario §5.2 — verificación de la resolución elegida

El leader eligió la opción **(b)**: se registró **feature #4 `error_500_sin_detalle_interno`**
(`needs_design: true`, motivo cita **D5** y **D6** explícitamente, `red_modo: "nuevo"`, `status:
"pending"`, `tdd_contract: []` vacío como corresponde a una feature aún no diseñada). Verificaciones:

- **No se sumó al baseline:** `rules.baseline_advertencias` permanece en 0 y `docs/verifications.md` §4
  documenta el hallazgo bajo el encabezado explícito **"Hallazgos abiertos que NO son advertencias del
  gate"**, con una tabla que lo referencia a la feature #4 por nombre. Correcto: es deuda de producto a
  resolver por el ciclo normal, no deuda de "algo se rompió sin que nadie se diera cuenta", que es lo
  que el baseline mide.
- **`progress/design_error_500_sin_detalle_interno.md`:** confirmado que **no existe** (`Glob` sin
  resultados). Esto es correcto y no bloquea nada: el CHECK 3b sólo exige `progress/design_<name>.md`
  cuando la feature **ya salió de `pending`**; la #4 sigue en `pending`. El propio CHECK 3b, reejecutado
  en §6.1, confirma `[OK]` sin quejarse de la #4.
- **Acceptance de la feature #4** describe correctamente el comportamiento deseado (500 genérico al
  cliente, `message` real sólo al logger, HttpException intactas, specs existentes en verde) y cierra
  el círculo con el hallazgo original de esta revisión (§5.2/§3 de la 1ª ronda). **OK.**

### 6.4. Alcance ignorado a propósito

Por instrucción explícita de esta ronda, no se auditó el volumen grande de archivos modificados por la
actualización de toolchain de la sesión (Node 24, TypeScript 6.0.x, ESLint 10, Jest 30, etc.) más allá
de confirmar que el gate los tolera y da `[OK]`. Esa actualización es una decisión de plataforma
documentada en `docs/verifications.md` §6, fuera del objeto de la feature #2.

### 6.5. Veredicto final: **APROBADO**

Los cuatro puntos de la corrección exigida en el motivo bloqueante (§5.1) se verificaron en disco, no
sólo en la narrativa del leader: `tdd_contract` de la feature #1 apunta a los dos specs reales con el
texto exacto del `it()`, el baseline bajó a 0 y el gate lo confirma de forma independiente
(`[BASELINE] 0 == 0`), y la exención legacy quedó con motivo explícito y consistente en sus tres fuentes
en vez de una promesa incumplida de "se retira". El hallazgo secundario D6 quedó registrado como feature
nueva con su disparador de diseño correcto, sin inflar el baseline y sin perderse como nota de sesión.
El Nivel A completo (build, typecheck, lint, 23/23 tests, cobertura sobre el piso) sigue en verde sin
tocar la batería de la feature #2. No quedan pendientes bloqueantes.

**La feature #2 `pruebas_guard_401_y_formato_respuesta` puede marcarse `done`.**
