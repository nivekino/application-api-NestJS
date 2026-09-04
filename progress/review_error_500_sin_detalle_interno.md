# Revisión — Feature #4 `error_500_sin_detalle_interno`

> Revisor: `reviewer`. Fecha: 2026-09-03. Estado al entrar a revisión: `in_review`.
> Insumos: `feature_list.json` (feature #4 y `rules`), `progress/impl_error_500_sin_detalle_interno.md`,
> `progress/design_error_500_sin_detalle_interno.md`, `progress/current.md`, `docs/verifications.md` §4,
> `CHECKPOINTS.MD`, `src/common/filters/http-exception.filter.ts` y su spec.

## 1. Nivel A

Corrida propia, completa (no `--estructura`), sobre el repo en el estado entregado:

```
==> CHECK 5 - Compilacion (npm run build)          [OK]
==> CHECK 5b - Typecheck (src + test)              [OK] sin errores fuera de fase RED
==> CHECK 5c - Lint (--max-warnings=0)             [OK] 36 archivos, 0 errores, 0 advertencias
==> CHECK 6 - Pruebas unitarias (jest --coverage)  [OK] 9 suites / 26 tests, 26/26 en verde
==> CHECK 6b - Cobertura minima                    [OK] lineas 76.3% · sentencias 76.98% ·
                                                          funciones 69.69% · ramas 65.21%
[BASELINE] 0 advertencias de deuda == baseline 0 (docs/verifications.md §4, leído, no de memoria)
[OK] Entorno integro (Nivel A). 0 advertencia(s).
```

- **Baseline:** `0 == 0`, no se introdujo ninguna advertencia nueva. Coincide con lo que reporta el
  `impl_` en la fase GREEN.
- **Cobertura vs. piso** (`rules.cobertura_minima`: líneas 72 · sentencias 73 · funciones 66 · ramas
  61): la medida (76.3/76.98/69.69/65.21) queda por encima en las cuatro dimensiones. Holgura: líneas
  +4.3 · sentencias +3.98 · funciones +3.69 · ramas +4.21 — **ninguna llega a los 5 puntos** que exige
  el trinquete (`docs/verifications.md` §1, CHECK 6b), así que **no corresponde subir el piso** en esta
  pasada. El `impl_` lo declara correctamente y el gate no emitió el `[INFO]` de sugerencia de subida;
  correcto, no es una omisión.
- Gate en `[OK]`, exit 0. Ninguna tolerancia de fase RED activa (la feature ya está en `green`/
  `in_review`, así que el gate exige todo en verde sin excepción, y así lo cumplió).

## 2. Disciplina TDD

- **Evidencia RED presente y creíble:** `progress/impl_error_500_sin_detalle_interno.md` §3 pega la
  salida literal de `npx jest src/common/filters/http-exception.filter.spec.ts` con
  `FAIL src/common/filters/http-exception.filter.spec.ts`, `1 failed, 5 passed, 6 total`, y el diff de
  aserción exacto: esperaba `"Internal server error"`, recibió el mensaje interno del driver
  (`relation "users" does not exist en 10.0.0.7:5432`). Es el criterio 1, no un fallo incidental de
  otro archivo — coincide en fondo con la mutación de negocio que motiva la feature (D6). También pega
  la corrida del gate completo en fase RED (`Tests: 1 failed, 25 passed, 26 total`,
  `[OK] Fase RED: 1 fallo(s) esperado(s)`), mencionando el único archivo del `tdd_contract`.
- **`red_modo: nuevo` correctamente aplicado:** el gate toleró el único fallo dentro del archivo
  declarado y exigió al menos uno, cumplido. La cobertura no se evaluó en esa fase, consistente con la
  regla.
- **Trazabilidad verificada (no solo el CHECK 3c automático):** los 4 criterios de `tdd_contract`
  fueron releídos contra el texto real en `http-exception.filter.spec.ts`:
  - Criterio 1 → `it()` línea 100 (spec), texto exacto, y el `expect` compara el **cuerpo serializado**
    (`JSON.parse(JSON.stringify(...))`) contra el literal esperado, más un `not.toContain` sobre el
    mensaje interno. Prueba resultado real, no solo ausencia de excepción, y evita el hueco de
    `undefined` vs. clave ausente que señala el diseño §4.2.
  - Criterio 2 → `it()` línea 115, verifica `logger.error` con el mensaje real completo y
    `not.toHaveBeenCalledWith(expect.stringContaining('Sup3rSecreta!'))` sobre un cuerpo de petición con
    contraseña ficticia — cubre la exigencia "nunca el cuerpo de la petición".
  - Criterio 3 → `it()` línea 127, usa `InternalServerErrorException` (500 de negocio) en vez de un
    caso trivial: si la implementación hubiera genericizado por `statusCode === 500` en lugar de por
    `instanceof Error`, este test habría caído. Es la trampa correcta y está resuelta correctamente en
    producción (rama `HttpException` intacta, `mensajeInterno = message` al final).
  - Criterio 4 (ancla) → el texto citado en `tdd_contract` existe palabra por palabra en el spec (línea
    46) y **no fue tocado** por el `git diff` del archivo (confirmado abajo).
- **Los tests prueban resultado, no ausencia de excepción:** cada `it()` nuevo tiene `expect` sobre
  `status`, el cuerpo serializado o el argumento exacto de `logger.error`. Ninguno se limita a "no
  truena".
- **Mocks tipados sin `any`:** `LoggerMock = jest.Mocked<Pick<LoggerService, 'log' | 'error' | 'warn'>>`
  (preexistente, reutilizado); la captura del cuerpo usa `json.mock.calls[0] as [unknown]`, no `any`.
  Grep confirmó `\bany\b` sin resultados en el spec.
- **Sin `eslint-disable` nuevos:** grep sobre `src/common/filters/` sin resultados.

## 3. Hallazgos por criterio

| # | Criterio (`acceptance`) | Test que lo cubre | Veredicto |
|---|---|---|---|
| 1 | Cuerpo del 500 de un `Error` no controlado sin `message` interno ni `resource` | `it()` "no expone el message interno..." (`http-exception.filter.spec.ts:100`) | OK — cuerpo serializado exacto, `resource` ausente por `JSON.stringify`, mensaje interno no aparece ni como substring |
| 2 | Logger recibe método, ruta, status y `message` real; nunca el cuerpo de la petición | `it()` "registra en el logger el message real..." (`:115`) | OK — verifica el mensaje real completo y la ausencia del password |
| 3 | `HttpException` conservan su `message`, incluida validación de class-validator | `it()` "conserva el message de una HttpException..." (`:127`) + `it()` existente de validación (`:60`, sin tocar) | OK — caso 500 de negocio y caso 400 de validación, ambos preservan su `message` |
| 4 | Specs existentes de `http-exception.filter.spec.ts` siguen en verde | 3 `it()` preexistentes (`:46`, `:60`, `:78`) | OK — `git diff` confirma que quedaron intactos palabra por palabra; solo se amplió el import y se anexaron 3 `it()` nuevos al final |

## 4. Apego al diseño y desviaciones

- El único archivo de producción tocado es `src/common/filters/http-exception.filter.ts`. El
  `git diff HEAD` confirma exactamente el cambio descrito en el diseño §4.1: variable `mensajeInterno`
  nueva, inicializada igual que `message`; en la rama `HttpException` se fija `mensajeInterno = message`
  al final; en la rama `else if (exception instanceof Error)` solo se reasigna `mensajeInterno`
  (`message` queda en el literal genérico, `resource` sigue `undefined`); la llamada al logger pasa a
  interpolar `mensajeInterno`; JSDoc ampliado con una sola oración, no reescrito. Ningún otro archivo de
  `src/` cambió (confirmado con `git status --porcelain`: solo `feature_list.json`,
  `progress/current.md`, el spec y el filtro, más los dos `progress/*.md` nuevos).
- **Cero desviaciones** respecto al diseño, tal como declara `impl_` §7 y §7bis; no hay ninguna
  silenciosa que verificar.
- La pregunta abierta §9.1 del diseño (literal en inglés vs. castellanizado) se resolvió con el valor
  por omisión documentado (`'Internal server error'` se conserva), correcto porque cambiarlo habría roto
  el `it()` ancla del criterio 4.
- No hay cambio de esquema (D4 no aplica) ni de contrato Swagger; no corresponde exigir "cómo llega a
  producción".
- Sin datos sensibles en logs/respuestas/documentación: el mensaje del driver que queda en el log es
  detalle técnico (no dato de cliente), decisión declarada y razonada en `impl_` §10bis; el cuerpo de la
  petición (contraseña ficticia) nunca se interpola en `logger.error`, confirmado por el `it()` del
  criterio 2.

## 5. Nivel B

**Declarado:** sí, en `progress/impl_error_500_sin_detalle_interno.md` §9bis, con 3 casos concretos
(500 real deteniendo el contenedor de PostgreSQL y verificando cuerpo + log; no regresión de 401/400
con la base arriba; `npm run test:e2e`), comando por caso, base contra la que se prueba
(`postgres:17`), y resultado explícito: **pendiente de ejecutar por: el usuario (kevinmm)**, por falta
de Docker/PostgreSQL en la sesión. Cumple `CHECKPOINTS.MD` ("el caso se ejecutó o quedó asignado a una
persona"); no se sustituye con mocks.

## 6. Veredicto

**APROBADO.**

Motivo: Nivel A en `[OK]` sin tolerancia (feature fuera de fase RED), 26/26 tests, baseline 0==0,
cobertura sobre el piso vigente sin holgura suficiente para subirlo (correctamente no subido). Evidencia
RED creíble y con el fallo exacto que predice el diseño. Trazabilidad de los 4 criterios verificada en
fondo, no solo en forma: cada `it()` prueba el resultado correcto (cuerpo serializado, argumento exacto
del logger), incluida la trampa del criterio 3 (500 de negocio vs. 500 no controlado). Los 3 `it()`
preexistentes de la feature #2 quedaron intactos palabra por palabra, confirmado con `git diff`. El
único archivo de producción tocado sigue el diseño §4.1 literalmente; sin desviaciones, sin
`eslint-disable`, sin `any`, sin fuga de datos sensibles al log ni a la respuesta. Nivel B declarado con
responsable asignado. Sin pendientes que bloqueen el cierre.

**Acción recomendada al `leader`:** marcar la feature `done`, mover el resumen de `progress/current.md`
a `progress/history.md` y reflejar en `docs/verifications.md` §4 el cierre del hallazgo abierto
("Reviewer de la feature #2… Feature #4 `error_500_sin_detalle_interno`") como cerrado por esta
revisión, dejando constancia de que el Nivel B queda pendiente de ejecución por el usuario (kevinmm).

## 7. Re-revisión

No aplica: esta es la primera y única revisión de la feature; no hubo rechazo previo.
