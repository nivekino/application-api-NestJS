# Implementación — Feature #4 `error_500_sin_detalle_interno`

## 1. Feature y fase

- **Feature:** `#4 error_500_sin_detalle_interno`.
- **Fase:** RED (completada, aprobada por el usuario) → **GREEN (completada)**.
- **`red_modo`:** `nuevo` (el comportamiento correcto para el criterio 1 no existía; la batería
  falló en disco antes de tocar producción).
- **Diseño seguido:** `progress/design_error_500_sin_detalle_interno.md`. Se siguió §4.1 (cambio de
  producción), §4.2 y §5 (batería) al pie de la letra; la pregunta abierta §9.1 se resolvió con su
  valor por omisión: se conserva el literal `'Internal server error'`.

## 2. Batería de tests

| Criterio `acceptance` | `it()` (texto exacto) | Archivo | Nivel |
|---|---|---|---|
| 1 — cuerpo sin detalle interno ni `resource` | `HttpExceptionFilter no expone el message interno de un Error no controlado: responde 500 con "Internal server error" y sin resource` | `src/common/filters/http-exception.filter.spec.ts` | A |
| 2 — el log conserva el mensaje real, nunca el cuerpo | `HttpExceptionFilter registra en el logger el message real del Error no controlado, sin el cuerpo de la petición` | `src/common/filters/http-exception.filter.spec.ts` | A |
| 3 — las `HttpException` conservan su `message` | `HttpExceptionFilter conserva el message de una HttpException lanzada a propósito, incluso cuando su status es 500` | `src/common/filters/http-exception.filter.spec.ts` | A |
| 4 — los specs existentes siguen en verde (ancla, `it()` ya existente, no se toca) | `HttpExceptionFilter serializa una HttpException como { statusCode, message, isError: true }` | `src/common/filters/http-exception.filter.spec.ts` | A |

Los 3 `it()` existentes del archivo (criterios 1, 3 y 4 de la feature #2) quedaron **intactos**, palabra
por palabra: solo se agregaron 3 `it()` nuevos al final del `describe('HttpExceptionFilter')`,
reutilizando el `beforeEach` y el helper `construirHost` ya presentes.

## 3. Evidencia RED

Comando: `npx jest src/common/filters/http-exception.filter.spec.ts`, corrido **antes** de tocar
`src/common/filters/http-exception.filter.ts` (que sigue sin modificarse en esta fase).

```
FAIL src/common/filters/http-exception.filter.spec.ts
  ● HttpExceptionFilter › HttpExceptionFilter no expone el message interno de un Error no controlado: responde 500 con "Internal server error" y sin resource

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Object {
        "isError": true,
    -   "message": "Internal server error",
    +   "message": "relation \"users\" does not exist en 10.0.0.7:5432",
        "statusCode": 500,
      }

      at Object.<anonymous> (common/filters/C:/Users/nivek/Desktop/application-api-NestJS/src/common/filters/http-exception.filter.spec.ts:107:75)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 5 passed, 6 total
Snapshots:   0 total
Time:        0.855 s, estimated 1 s
Ran all test suites matching src/common/filters/http-exception.filter.spec.ts.
```

**Lectura de la evidencia (todo en el único archivo de la batería,
`src/common/filters/http-exception.filter.spec.ts`):**

- El `it()` del **criterio 1** falla exactamente como predice el diseño §5: el código actual (rama
  `else if (exception instanceof Error) { message = exception.message; }`) hace que el cuerpo enviado al
  cliente lleve el `message` interno del driver (`relation "users" does not exist en 10.0.0.7:5432`) en
  vez del literal genérico `'Internal server error'`. Esto **es** la fuga D6 que motiva la feature.
- Los `it()` de los **criterios 2 y 3** nacen en verde: fijan comportamiento que hoy ya es correcto (el
  logger ya recibe el mensaje real vía la misma variable `message`, y las `HttpException` con status 500
  ya conservan su `message`) y que **no debe romperse** con el cambio de la fase GREEN. Es correcto y
  suficiente según la regla del gate: "al menos uno falla", no "todos fallan" (`docs/verifications.md`
  §1).
- El **criterio 4** (ancla al `it()` existente `HttpExceptionFilter serializa una HttpException como {
  statusCode, message, isError: true }`) también está en verde: no se tocó ni se rompió.
- Total: **1 failed, 5 passed, 6 total** — 3 `it()` preexistentes + 3 `it()` nuevos, con exactamente el
  fallo esperado en el criterio 1 y ninguno fuera del archivo de la batería.

## 4. Archivos modificados (fase RED)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/common/filters/http-exception.filter.spec.ts` | Modificado | Se agregó el import de `InternalServerErrorException` y 3 `it()` nuevos al `describe('HttpExceptionFilter')` existente (criterios 1, 2 y 3 de la feature #4). Los 3 `it()` preexistentes no se tocaron. |
| `feature_list.json` | Modificado | `status` de la feature #4 pasó de `pending` a `red`; se escribió el `tdd_contract` con los 4 criterios (3 con `it()` nuevo + 1 ancla al `it()` existente). |
| `progress/current.md` | Modificado | Plan de la sesión, batería de tests y estado de evidencia RED. |
| `progress/impl_error_500_sin_detalle_interno.md` | Creado | Este documento. |

**No se tocó** `src/common/filters/http-exception.filter.ts` (código de producción) ni ningún otro
archivo de `src/` — conforme a la regla de la fase RED.

## 5. Decisiones de implementación

1. **Literal público conservado:** `'Internal server error'` (inglés), por el valor por omisión de la
   pregunta abierta §9.1 del diseño: cambiarlo tocaría el `it()` existente del criterio 4 de la feature
   #2, que este contrato exige mantener en verde.
2. **Comparación del cuerpo serializado, no del mock crudo:** el `it()` del criterio 1 usa
   `JSON.parse(JSON.stringify(cuerpoEnviadoAlCliente))` en vez de comparar el objeto capturado
   directamente, porque `toHaveBeenCalledWith`/`toEqual` tratan una clave con valor `undefined` (como
   `resource: undefined`, que hoy sigue produciendo el código) igual que la clave ausente — y el criterio
   habla de lo que viaja **por el cable**, donde `JSON.stringify` sí omite esa clave. Nota de
   implementación tomada literalmente del diseño §4.2.
3. **Tipado de la captura del cuerpo sin `any`:** `json.mock.calls[0] as [unknown]` (aserción a una
   tupla `[unknown]`, no a `any`), tal como sugiere el diseño §4.2, para evitar `no-unsafe-*` de
   `strictTypeChecked` sin recurrir a `eslint-disable`.
4. **Escenario del criterio 3 con `InternalServerErrorException`:** se usó explícitamente una excepción
   con `statusCode` 500 lanzada a propósito por la app (`Servicio externo no disponible`), no
   un mensaje genérico, para que el caso distinga "500 de negocio" de "500 por excepción no controlada"
   — la trampa que el diseño señala en §5.3: una implementación que mire `statusCode === 500` en vez del
   tipo de la excepción rompe justo en este `it()`.
5. **Dato sensible ficticio:** el criterio 2 reutiliza el patrón ya existente en el archivo
   (`{ username: 'jdoe', password: 'Sup3rSecreta!' }`), un valor obviamente de prueba, nunca una
   contraseña real.
6. **No se creó ningún `it()` para el criterio 4:** conforme al diseño §5, el criterio 4 se satisface
   citando el `it()` ya existente en el `tdd_contract`, sin duplicarlo.

## 6. Refactor aplicado con la batería en verde

No aplica en esta fase (RED): no se refactorizó nada; solo se agregaron tests. El refactor de
producción, si lo hay, se documentará en la fase GREEN.

## 7. Desviaciones del diseño

Ninguna. La batería, los textos de los `it()`, el `tdd_contract` y el manejo de la pregunta abierta
§9.1 siguen el diseño §4.2 y §5 literalmente.

## 8. Verificación Nivel A

`npm run harness:verify` (corrida completa, no `--estructura`):

```
==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 36 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
FAIL src/common/filters/http-exception.filter.spec.ts
  ● HttpExceptionFilter › HttpExceptionFilter no expone el message interno de un Error no controlado: responde 500 con "Internal server error" y sin resource

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Object {
        "isError": true,
    -   "message": "Internal server error",
    +   "message": "relation \"users\" does not exist en 10.0.0.7:5432",
        "statusCode": 500,
      }

      at Object.<anonymous> (common/filters/C:/Users/nivek/Desktop/application-api-NestJS/src/common/filters/http-exception.filter.spec.ts:107:75)

Test Suites: 1 failed, 8 passed, 9 total
Tests:       1 failed, 25 passed, 26 total
Snapshots:   0 total
Time:        6.243 s
Ran all test suites.
Test results written to: coverage\harness\jest.json
[OK] Fase RED: 1 fallo(s) esperado(s) dentro de la bateria:
  src/common/filters/http-exception.filter.spec.ts -> "HttpExceptionFilter HttpExceptionFilter no expone el message interno de un Error no controlado: responde 500 con "Internal server error" y sin resource"

==> CHECK 6b - Cobertura minima

[INFO] #4 error_500_sin_detalle_interno esta en 'red' (modo nuevo): la bateria espera la APROBACION del usuario antes de implementar. No lances la fase GREEN sin su "go" explicito.
[INFO] Fase RED (nuevo): typecheck, lint y jest toleran fallos SOLO en los archivos del tdd_contract: src/common/filters/http-exception.filter.spec.ts.
[INFO] Fase RED: cobertura no evaluada (lineas 76.07%, sentencias 76.79%, funciones 69.69%, ramas 65.21%); se exige al pasar a green.
[INFO] Nivel B (NO lo prueba este script): comportamiento contra PostgreSQL real, invalidacion de JWT end-to-end tras re-login, migraciones/sincronizacion de esquema, y el contrato publicado en /api/docs. Se DECLARA en progress/impl_<name>.md; no se sustituye. Ver docs/verifications.md.

[BASELINE] 0 advertencias de deuda == baseline 0.

[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

Sin iteraciones: el gate dio `[OK]` en la primera corrida completa. El único fallo (`Tests: 1 failed,
25 passed, 26 total`) cae exactamente en el `it()` del criterio 1 dentro de
`src/common/filters/http-exception.filter.spec.ts`, el único archivo del `tdd_contract`; ningún otro
archivo salió en rojo. Advertencias de deuda: `0`, igual al baseline vigente
(`docs/verifications.md` §4). Cobertura: no se evalúa en fase RED modo `nuevo` (se exige al pasar a
`green`); la corrida la reporta a título informativo (líneas 76.07 % · sentencias 76.79 % · funciones
69.69 % · ramas 65.21 %).

## 9. Prueba Nivel B

No aplica evaluarla en esta fase: la feature está en `red`, no en `green`. Queda declarada para la fase
GREEN según el diseño §8 (Nivel B, casos 1-3, contra el PostgreSQL de prueba `postgres:17` con
`npm run test:e2e` y una prueba manual de un 500 real deteniendo el contenedor).

## 10. Acoplamientos revisados

De la lista de `.claude/agents/planner.md` citada en el diseño §6, en esta fase RED (solo tests, sin
tocar producción) se tuvo presente:

- **Acoplamiento 4** (`HttpExceptionFilter` global): el `it()` del criterio 3 se escribió a propósito
  para blindar contra una implementación que genericice por `statusCode === 500` en vez de por tipo de
  excepción, que silenciaría mensajes de negocio legítimos en toda la API.
- **Acoplamiento 9** (Winston con rotación a archivo, retención 30 días): el `it()` del criterio 2
  reafirma que el cuerpo de la petición (`cuerpoSensible`, con una contraseña ficticia) nunca llega al
  logger, para que ese hallazgo no se pierda cuando se reescriba la llamada a `logger.error` en la fase
  GREEN.
- **Acoplamiento 6 / D6** (qué dato sale por la API vs. el log): es el objeto mismo de la feature; el
  `it()` del criterio 1 es la prueba que hoy falla porque ese acoplamiento está roto.

---

## Fase GREEN

### 4bis. Archivos modificados (fase GREEN)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/common/filters/http-exception.filter.ts` | Modificado | Único archivo de producción tocado, conforme al diseño §4.1: se desdobló `message` en `message` (cuerpo de la respuesta) y `mensajeInterno` (solo logger). Se amplió el JSDoc de seguridad de datos con la línea que aclara que el mensaje interno de una excepción no controlada va solo al log. |
| `feature_list.json` | Modificado | `status` de la feature #4 pasó de `red` a `green`. `tdd_contract` sin cambios (ya se escribió en RED). |
| `progress/current.md` | Modificado | Se marcó la fase GREEN como completada, aprobada por el usuario y con el Nivel B declarado. |
| `progress/impl_error_500_sin_detalle_interno.md` | Modificado | Esta sección y las siguientes (fase GREEN). |

No se tocó `src/main.ts`, `src/app.module.ts`, ningún controller, DTO, entidad ni
`src/common/logger/winston.config.ts` — conforme al diseño §1 ("Qué NO toca").

### 5bis. Decisiones de implementación (GREEN)

1. **Variable `mensajeInterno` separada de `message`**, inicializada también en `'Internal server
   error'` (mismo valor por omisión que `message`, para que el escenario "ni `HttpException` ni
   `Error`" siga logueando el literal genérico, tal como exige el `it()` existente del criterio 4 de
   la feature #2).
2. **Rama `HttpException`:** al final del bloque se fija `mensajeInterno = message`, de modo que el
   log y el cuerpo público coincidan siempre para excepciones lanzadas a propósito por la app
   (criterio 3), incluida la rama de validación de `class-validator` (criterio 4 / ancla feature #2).
3. **Rama `else if (exception instanceof Error)`:** solo se reasigna `mensajeInterno =
   exception.message`. `message` **no se toca** y queda en el literal genérico; `resource` sigue
   `undefined`. Esto satisface el criterio 1 (cuerpo sin detalle interno ni `resource`) sin construir
   el objeto `body` de forma condicional — tal como recomienda el diseño §4.1, para no introducir
   complejidad sin beneficio observable.
4. **La llamada al logger** pasa de interpolar `message` a interpolar `mensajeInterno`; es el único
   cambio en esa línea. Esto preserva el criterio 2 (el log conserva el `message` real del `Error`)
   sin alterar el formato `MÉTODO ruta -> status: mensaje` que ya fijaba el `it()` existente.
5. **JSDoc ampliado, no reescrito:** se agregó una sola oración al bloque de seguridad de datos que ya
   encabezaba el archivo, tal como pide el diseño §4.1 y §3 (precedente a espejar).
6. **Sin `import type` nuevo ni cambios de dependencias:** el diseño confirmó que el acoplamiento 12
   (metadatos de decoradores) no aplica; no se tocó ninguna clase inyectada.

### 6bis. Refactor aplicado con la batería en verde

Con los 6 `it()` en verde tras el cambio mínimo, se revisó si convenía extraer la lógica de
`mensajeInterno` a un método privado (p. ej. `private resolverMensajes(exception: unknown)`), pero se
descartó: el método `catch` sigue siendo corto (menos de 45 líneas), la duplicación es de una sola
asignación (`mensajeInterno = message` en la rama `HttpException`) y extraerlo habría obligado a
devolver una tupla o un objeto intermedio sin ganar legibilidad. Se corrió `npx jest
src/common/filters/http-exception.filter.spec.ts` después de la única edición y los 6 tests siguieron
en verde sin más cambios; no hubo refactor adicional que aplicar.

### 7bis. Desviaciones del diseño (fase GREEN)

Ninguna. El cambio en `http-exception.filter.ts` sigue el diseño §4.1 literalmente (misma tabla de
variables, misma condición por rama, misma plantilla de log, mismo JSDoc ampliado).

### 8bis. Verificación Nivel A (fase GREEN)

`npm run harness:verify`, corrida completa después de implementar (feature en `green`):

```
==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 36 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 9 passed, 9 total
Tests:       26 passed, 26 total
Snapshots:   0 total
Time:        7.821 s
Ran all test suites.
Test results written to: coverage\harness\jest.json
[OK] Pruebas en verde: 26/26 tests, 0 suite(s) rota(s).

==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 76.3%, sentencias 76.98%, funciones 69.69%, ramas 65.21%.

[INFO] Nivel B (NO lo prueba este script): comportamiento contra PostgreSQL real, invalidacion de JWT end-to-end tras re-login, migraciones/sincronizacion de esquema, y el contrato publicado en /api/docs. Se DECLARA en progress/impl_<name>.md; no se sustituye. Ver docs/verifications.md.

[BASELINE] 0 advertencias de deuda == baseline 0.

[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

- **Sin iteraciones:** el gate dio `[OK]` en la primera corrida completa tras el cambio de producción
  y el cambio de `status` a `green`.
- **26/26 tests en verde** (los 3 `it()` preexistentes + los 3 nuevos de esta feature): el criterio 1
  ya no falla.
- **Advertencias de deuda:** `0`, igual al baseline vigente (`docs/verifications.md` §4). No se
  introdujo ningún `eslint-disable` nuevo.
- **Cobertura medida:** líneas 76.3 % · sentencias 76.98 % · funciones 69.69 % · ramas 65.21 %, todas
  sobre el piso vigente (líneas 72 · sentencias 73 · funciones 66 · ramas 61,
  `rules.cobertura_minima`). **Holgura:** líneas +4.3 · sentencias +3.98 · funciones +3.69 · ramas
  +4.21 — **ninguna alcanza los 5 puntos** que exige el trinquete, así que el piso **no se sube** en
  esta pasada (se deja constancia para la próxima feature que mida holgura mayor).

### 9bis. Prueba Nivel B (declaración, GREEN)

El Nivel A corre con mocks del `Response` de Express y del `LoggerService`: no prueba la serialización
real de `res.json()` ni que Winston escriba a disco. Casos a probar, tal como fija el diseño §8:

1. **Provocar un 500 real no controlado.** Con la app levantada contra el PostgreSQL de prueba
   (contenedor `postgres:17`) y un token válido, detener el contenedor y llamar `GET /api/users`.
   - **Comando:** levantar la app (`npm run start:dev` o equivalente) contra la base de prueba,
     detener el contenedor de PostgreSQL, y hacer la petición con un cliente HTTP (curl/Postman).
   - **Resultado esperado:** `500` con cuerpo exactamente
     `{"statusCode":500,"message":"Internal server error","isError":true}` (sin `resource`, sin
     nombre de tabla, sin host/puerto, sin SQL) y una entrada en `logs/error-<fecha>.log` con
     `GET /api/users -> 500: <mensaje real del driver>`, sin cuerpo de la petición ni cabecera
     `Authorization`.
2. **No regresión de errores legítimos, con la base arriba:** `POST /api/users` sin token → `401`;
   `POST /api/users` con un campo no declarado en el DTO → `400` `'Validación fallida'` con
   `resource.errors`.
   - **Comando:** peticiones HTTP directas contra la app levantada.
3. **`npm run test:e2e`** (`test/app.e2e-spec.ts`) contra PostgreSQL real, para confirmar que la
   suite existente sigue en verde con el filtro modificado.

**Resultado:** **pendiente de ejecutar por: el usuario (kevinmm)**. Esta sesión no tiene Docker/
PostgreSQL disponible para levantar el contenedor de prueba; el Nivel A (mocks) está en verde, pero el
Nivel B contra PostgreSQL real, tal como exige la regla del harness, **se declara, no se sustituye**.

### 10bis. Acoplamientos revisados (GREEN)

- **Acoplamiento 4** (`HttpExceptionFilter` global, `@Catch()` sin argumentos): el cambio se acotó
  estrictamente a la rama `else if (exception instanceof Error)`; la rama `HttpException` (que cubre
  4xx y 5xx de negocio, incluida `InternalServerErrorException`) no cambió su lógica de decisión —
  solo se le agregó `mensajeInterno = message` al final, sin alterar qué `message` calcula. El `it()`
  del criterio 3 confirma que un 500 de negocio (`InternalServerErrorException('Servicio externo no
  disponible')`) sigue devolviendo su `message` real, no el genérico.
- **Acoplamiento 9** (Winston, rotación a archivo `logs/error-%DATE%.log`, retención 30 días): el
  cambio mueve el `message` interno del `Error` **al log exclusivamente**; el cuerpo de la petición
  (`request.body`) nunca se interpola en la llamada a `logger.error`, tal como confirma el `it()` del
  criterio 2 con `cuerpoSensible` (`password: 'Sup3rSecreta!'`). Ese mensaje interno queda en disco 30
  días — aceptado conscientemente porque es detalle técnico de infraestructura (driver/ORM), no dato
  de cliente.
- **Acoplamiento 6 / D6** (qué dato sale por la API vs. el log): cerrado por este cambio. El cuerpo
  serializado que recibe el cliente en un 500 no controlado ya no contiene el mensaje del driver de
  PostgreSQL (verificado con `JSON.stringify` en el `it()` del criterio 1, que confirma que ni
  siquiera aparece como substring en el cuerpo enviado).
