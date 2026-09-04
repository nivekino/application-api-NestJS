# Feature #2 pruebas_guard_401_y_formato_respuesta — Fase RED y GREEN

- **Feature:** `#2 pruebas_guard_401_y_formato_respuesta`
- **Fase:** RED (completa, aprobada por el usuario el 2026-09-03) y GREEN (completa, este documento)
- **`red_modo`:** `caracterizacion` (el comportamiento ya existe en `src/users/users.controller.ts`,
  `src/common/interceptors/response.interceptor.ts` y `src/common/filters/http-exception.filter.ts`;
  esta pasada solo agrega specs, no toca código de producción).
- **Diseño:** no aplica (`needs_design: false`; feature aditiva y totalmente especificada, sin
  `progress/design_pruebas_guard_401_y_formato_respuesta.md`).

## Batería de tests

| Criterio de `acceptance` | `it()` | Archivo | Nivel |
|---|---|---|---|
| 1. `UsersController` declara `JwtAuthGuard` como guard de clase | `UsersController declara JwtAuthGuard como guard de clase, de modo que GET /api/users/me responde 401 sin JWT valido` | `src/users/users.controller.guard.spec.ts` | A |
| 2. `ResponseInterceptor` envuelve toda respuesta exitosa | `envuelve una respuesta exitosa como { statusCode, message: "OK", resource, isError: false }, tomando el statusCode de la respuesta HTTP` | `src/common/interceptors/response.interceptor.spec.ts` | A |
| 3. `HttpExceptionFilter` serializa `HttpException` / errores de validación | `HttpExceptionFilter serializa una HttpException como { statusCode, message, isError: true }` | `src/common/filters/http-exception.filter.spec.ts` | A |
| 3. (cont.) errores de `class-validator` → `'Validación fallida'` + `resource.errors` | `HttpExceptionFilter convierte los errores de validación de class-validator en message "Validación fallida" con resource.errors` | `src/common/filters/http-exception.filter.spec.ts` | A |
| 4. `HttpExceptionFilter` convierte `Error` no HTTP en 500 y registra solo método/ruta/status/mensaje | `HttpExceptionFilter convierte una excepción no HTTP en 500 "Internal server error" y registra solo método, ruta, status y mensaje (nunca el cuerpo de la petición)` | `src/common/filters/http-exception.filter.spec.ts` | A |

Los 4 criterios de `acceptance` de la feature quedan cubiertos por 5 `it()` (el criterio 3 agrupa dos
escenarios: `HttpException` plana y errores de validación de `class-validator`, porque el
`tdd_contract` solo admite un `test` por entrada de nivel A y ambos escenarios son observables por
separado en el mismo archivo).

## Evidencia RED

Esta feature es `red_modo: "caracterizacion"`: el código de `UsersController`, `ResponseInterceptor`
y `HttpExceptionFilter` ya existía y ya se comportaba como describen los criterios de `acceptance`
antes de escribir un solo test. La batería nueva **pasa en disco** desde el primer momento. El rojo se
demuestra rompiendo cada pieza a propósito (**mutación**), confirmando que el `it()` correspondiente
cae, y restaurando el archivo exactamente a su versión original.

### Estado previo: la batería nueva pasa en disco (antes de mutar nada)

```
> npx jest --testPathPatterns "users.controller.guard.spec.ts|response.interceptor.spec.ts|http-exception.filter.spec.ts"

Test Suites: 3 passed, 3 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        3.662 s
Ran all test suites matching users.controller.guard.spec.ts|response.interceptor.spec.ts|http-exception.filter.spec.ts.
```

### Mutación 1 — `src/users/users.controller.ts` (criterio 1)

Se quitó temporalmente el decorador `@UseGuards(JwtAuthGuard)` de la clase `UsersController` (se dejó
`@ApiTags('users')`, `@ApiBearerAuth('access-token')` y `@Controller('users')` sin el guard de clase).

```
> npx jest --testPathPatterns "users.controller.guard.spec.ts"

FAIL src/users/users.controller.guard.spec.ts
  ● UsersController - guard de clase (D1) › UsersController declara JwtAuthGuard como guard de clase, de modo que GET
/api/users/me responde 401 sin JWT valido

    expect(received).toContain(expected) // indexOf

    Expected value: [Function JwtAuthGuard]
    Received array: []

      at Object.<anonymous> (users/C:/Users/nivek/Desktop/application-api-NestJS/src/users/users.controller.guard.spec.ts:21:20)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.966 s, estimated 3 s
```

Se restauró `@UseGuards(JwtAuthGuard)` de inmediato. Verde tras restaurar:

```
> npx jest --testPathPatterns "users.controller.guard.spec.ts"

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        1.888 s, estimated 2 s
```

### Mutación 2 — `src/common/interceptors/response.interceptor.ts` (criterio 2)

Se cambió `statusCode: response.statusCode` por `statusCode: 200` (hardcodeado), rompiendo la parte
del criterio que exige tomar el `statusCode` de la respuesta HTTP real.

```
> npx jest --testPathPatterns "response.interceptor.spec.ts"

FAIL src/common/interceptors/response.interceptor.spec.ts
  ● ResponseInterceptor › envuelve una respuesta exitosa como { statusCode, message: "OK", resource, isError: false },
tomando el statusCode de la respuesta HTTP

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

    @@ -2,7 +2,7 @@
        "isError": false,
        "message": "OK",
        "resource": Object {
          "id": "uuid-1",
        },
    -   "statusCode": 201,
    +   "statusCode": 200,
      }

      at Object.<anonymous> (common/interceptors/C:/Users/nivek/Desktop/application-api-NestJS/src/common/interceptors/response.interceptor.spec.ts:28:20)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        0.769 s, estimated 1 s
```

Se restauró `statusCode: response.statusCode`. Verde tras restaurar:

```
> npx jest --testPathPatterns "response.interceptor.spec.ts"

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.688 s, estimated 1 s
```

### Mutación 3 — `src/common/filters/http-exception.filter.ts` (criterio 3, errores de validación)

Se cambió `message = 'Validación fallida'` por `message = 'Error de datos'` en la rama que detecta
`Array.isArray(obj.message)` (errores de `class-validator`).

```
> npx jest --testPathPatterns "http-exception.filter.spec.ts"

FAIL src/common/filters/http-exception.filter.spec.ts
  ● HttpExceptionFilter › HttpExceptionFilter convierte los errores de validación de class-validator en message
"Validación fallida" con resource.errors

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    - Expected
    + Received

      Object {
        "isError": true,
    -   "message": "Validación fallida",
    +   "message": "Error de datos",
        "resource": Object {
          "errors": Array [
            "el campo email debe ser un correo válido",
            "el campo username es obligatorio",
          ],
        },
        "statusCode": 400,
      },

    Number of calls: 1

      at Object.<anonymous> (common/filters/C:/Users/nivek/Desktop/application-api-NestJS/src/common/filters/http-exception.filter.spec.ts:66:18)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 2 passed, 3 total
```

Se restauró `message = 'Validación fallida'` de inmediato.

### Mutación 4 — `src/common/filters/http-exception.filter.ts` (criterio 4, fallback 500)

Se cambió el valor por omisión `let message = 'Internal server error';` por
`let message = 'Error interno';` (el mensaje genérico que se usa cuando la excepción no es
`HttpException` ni `Error`).

```
> npx jest --testPathPatterns "http-exception.filter.spec.ts"

FAIL src/common/filters/http-exception.filter.spec.ts
  ● HttpExceptionFilter › HttpExceptionFilter convierte una excepción no HTTP en 500 "Internal server error" y
registra solo método, ruta, status y mensaje (nunca el cuerpo de la petición)

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    - Expected
    + Received

      Object {
        "isError": true,
    -   "message": "Internal server error",
    +   "message": "Error interno",
        "resource": undefined,
        "statusCode": 500,
      },

    Number of calls: 1

      at Object.<anonymous> (common/filters/C:/Users/nivek/Desktop/application-api-NestJS/src/common/filters/http-exception.filter.spec.ts:81:18)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 2 passed, 3 total
```

Se restauró `let message = 'Internal server error';` de inmediato.

### Verde final, con las 4 mutaciones restauradas (`git diff` de producción vacío salvo ruido preexistente de formato)

```
> npx jest --testPathPatterns "users.controller.guard.spec.ts|response.interceptor.spec.ts|http-exception.filter.spec.ts"

Test Suites: 3 passed, 3 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        3.321 s
Ran all test suites matching users.controller.guard.spec.ts|response.interceptor.spec.ts|http-exception.filter.spec.ts.
```

Se verificó con `git diff -- src/users/users.controller.ts src/common/interceptors/response.interceptor.ts
src/common/filters/http-exception.filter.ts` que ninguno de los cuatro archivos de producción conserva
las mutaciones (`@UseGuards(JwtAuthGuard)` presente, `statusCode: response.statusCode` presente,
`'Validación fallida'` presente, `'Internal server error'` presente). El único diff residual en esos
archivos es formato preexistente a esta sesión (ya aparecía como `M` en `git status` antes de tocar la
feature), no relacionado con las mutaciones aplicadas aquí.

## Archivos modificados (fase RED)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/users/users.controller.guard.spec.ts` | Creado | Spec de caracterización del criterio 1: verifica el metadato `GUARDS_METADATA` (`'__guards__'`) de `UsersController` contiene `JwtAuthGuard`. |
| `src/common/interceptors/response.interceptor.spec.ts` | Creado | Spec de caracterización del criterio 2: `ResponseInterceptor.intercept` envuelve el recurso emitido por el `CallHandler` en `{ statusCode, message: 'OK', resource, isError: false }`, tomando `statusCode` de la respuesta HTTP mockeada. |
| `src/common/filters/http-exception.filter.spec.ts` | Creado | Specs de caracterización de los criterios 3 y 4: `HttpExceptionFilter.catch` serializa `HttpException` planas, agrupa errores de `class-validator` en `'Validación fallida'` + `resource.errors`, y castea cualquier excepción no HTTP a 500 `'Internal server error'` registrando en el logger solo `método`, `ruta`, `status` y `mensaje` (nunca el cuerpo de la petición, probado con una contraseña en el `body` que nunca aparece en la llamada al logger). |
| `feature_list.json` | Editado | `status: "pending" → "red"`; `tdd_contract` completo (6 entradas: una por criterio 1, 2 y 4, dos para el criterio 3). |
| `src/users/users.controller.ts` | Mutado y restaurado | Evidencia de mutación 1 (ver arriba). Sin diff neto. |
| `src/common/interceptors/response.interceptor.ts` | Mutado y restaurado | Evidencia de mutación 2 (ver arriba). Sin diff neto. |
| `src/common/filters/http-exception.filter.ts` | Mutado y restaurado (x2) | Evidencia de mutaciones 3 y 4 (ver arriba). Sin diff neto. |

## Decisiones de implementación

1. **`import 'reflect-metadata'` explícito en el spec del guard.** `tsconfig.json` declara
   `"types": ["node", "jest"]`, así que la ampliación global de `Reflect.getMetadata` que trae el
   paquete `reflect-metadata` no entra al programa de TypeScript salvo que algún archivo lo importe. Se
   agregó como import de efecto secundario únicamente en `users.controller.guard.spec.ts` (no se tocó
   ningún archivo de producción) para que `Reflect.getMetadata` tipe y corra correctamente.
2. **Se usa `GUARDS_METADATA` de `@nestjs/common/constants` (`'__guards__'`)** en vez de levantar la
   app HTTP completa: es la forma más directa de comprobar que el guard está declarado a nivel de
   clase, sin depender de Passport/JWT reales (eso es Nivel B).
3. **El criterio 3 se dividió en dos `it()`** (HttpException plana vs. errores de `class-validator`)
   porque son dos ramas de código observables por separado dentro de `HttpExceptionFilter.catch`; el
   `tdd_contract` tiene dos entradas con `"criterio": 3` (ambas nivel A, mismo archivo), cada una
   apuntando al texto exacto de su propio `it()`.
4. **El criterio 4 se probó con una excepción que NO es `instanceof HttpException` ni `instanceof
   Error`** (`filter.catch('fallo inesperado sin forma de HttpException ni Error', host)`), no con un
   `new Error('algo')`. Se verificó leyendo `http-exception.filter.ts`: en la rama
   `else if (exception instanceof Error) { message = exception.message; }` el mensaje que llega al
   cliente es el de la excepción real (útil para debug, pero es el mensaje del `Error`, no el literal
   `'Internal server error'`); el literal `'Internal server error'` solo se conserva cuando la
   excepción no es ni `HttpException` ni `Error` (los valores por omisión definidos al inicio del
   método). Se eligió ese escenario para que el `it()` sea fiel al código real y, a la vez, verifique
   textualmente el mensaje genérico que pide el criterio de `acceptance`.
5. **Se agregó una contraseña en el `body` de la petición mockeada** en el test del criterio 4
   (`{ username: 'jdoe', password: 'Sup3rSecreta!' }`) y se afirma con
   `expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Sup3rSecreta!'))` que nunca
   llega al log — cubre explícitamente la cláusula "nunca el cuerpo de la petición" del criterio 4 y la
   regla de datos sensibles del proyecto.
6. **Mocks tipados en los tres archivos:** `jest.Mocked<Pick<LoggerService, 'log' | 'error' | 'warn'>>`
   para el logger del filtro (sin `any` ni `as jest.Mock`); `ExecutionContext`, `ArgumentsHost` y
   `Response`/`Request` se construyen como objetos mínimos y se castean con `as unknown as X`, tal como
   exige la convención del proyecto para estos tipos de NestJS/Express con muchos miembros no usados en
   la prueba. `CallHandler` no necesitó cast: su única propiedad (`handle`) se satisface
   estructuralmente con un objeto literal.
7. **No se tocó código de producción de forma permanente.** Las cuatro mutaciones se aplicaron y
   restauraron una por una, con `npm test`/`npx jest` corrido después de cada restauración antes de
   seguir con la siguiente.

## Refactor aplicado con la batería en verde

No aplica: caracterización, sin código de producción. `red_modo: caracterizacion` significa que el
comportamiento de `UsersController`, `ResponseInterceptor` y `HttpExceptionFilter` ya existía antes de
esta feature; la fase GREEN no escribe ni refactoriza ningún archivo de `src/**/*.ts` que no sea spec
(puntos 2 y 3 de la fase GREEN de `implementer.md` no aplican a esta feature). Los únicos archivos
tocados en GREEN son de gestión: `feature_list.json`, `docs/verifications.md` §4 y este documento.

## Desviaciones del diseño

No hubo diseño: `needs_design: false`, no existe
`progress/design_pruebas_guard_401_y_formato_respuesta.md`. No aplica declarar desviaciones.

## Verificación Nivel A

- `npm run typecheck` → sin errores (antes de las mutaciones, con la batería nueva agregada).
- `npm run lint:check` (`eslint . --max-warnings=0`) → sin errores ni advertencias (antes de las
  mutaciones, con la batería nueva agregada).
- `npm run harness:verify` (corrida final, con la feature en `red` y todo el código de producción
  restaurado; **[OK] en la primera corrida, sin iteraciones**):

```
==> CHECK 1 - Archivos base del harness
[OK] Los 24 archivos base existen.

==> CHECK 1b - Toolset de los subagentes
[OK] Toolsets revisados: 4 agente(s).

==> CHECK 3 - feature_list.json
[OK] 3 feature(s) con estado valido (done=1, red=1, pending=1).
[OK] Feature activa: #2 pruebas_guard_401_y_formato_respuesta [red].

==> CHECK 3b - Bandera needs_design
[OK] Todas las features estan clasificadas con needs_design.

==> CHECK 3c - Trazabilidad criterio <-> test
[OK] Criterios con contrato: 6 en Nivel A (verificados en disco), 1 en Nivel B, 2 sin cobertura.

==> CHECK 3d - Evidencia RED
[OK] 1 feature(s) tdd:true revisada(s).

==> CHECK 3e - TDD obligatorio
[OK] Todas las features son tdd:true (exentas legacy declaradas: 1).

==> CHECK 4 - Higiene de src/ y test/
[OK] 23 archivo(s) .ts de produccion sin codigo de depuracion.
[OK] 10 archivo(s) de prueba sin .only ni tests deshabilitados.

==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 36 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 9 passed, 9 total
Tests:       23 passed, 23 total
[OK] Pruebas en verde: 23/23 tests, 0 suite(s) rota(s).

==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 75.59%, sentencias 76.37%, funciones 69.69%, ramas 64.49%.

[INFO] #2 pruebas_guard_401_y_formato_respuesta esta en 'red' (modo caracterizacion): la bateria espera la APROBACION
del usuario antes de implementar. No lances la fase GREEN sin su "go" explicito.
[INFO] Cobertura con holgura >= 5 puntos en lineas 75.59% (piso 60%), sentencias 76.37% (piso 60%), funciones 69.69%
(piso 55%), ramas 64.49% (piso 55%): sube el piso (trinquete) en feature_list.json y docs/verifications.md seccion 4.
[INFO] Nivel B (NO lo prueba este script): ...

[WARN] (entorno) Node 24.11.1: cumple la linea 24 LTS pero .nvmrc acuerda 24.20.0.
[WARN] Feature #1 perfil_usuario_autenticado, criterio 1: sin cobertura ('pendiente') - Deuda D1 (la cierra la
feature #2).
[WARN] Feature #1 perfil_usuario_autenticado, criterio 3: sin cobertura ('pendiente') - Deuda D2 (la cierra la
feature #2).

[BASELINE] 2 advertencias de deuda == baseline 2.

[OK] Entorno integro (Nivel A). 3 advertencia(s). Recuerda el Nivel B.
```

Advertencias reportadas (esperadas, no son deuda nueva — son las mismas 2 del baseline vigente de
`docs/verifications.md` §4, que documentan justo las dos brechas D1/D2 que esta feature cierra en la
fase GREEN al actualizar el `tdd_contract` de la feature #1):

- Feature #1, criterio 1: sin cobertura ("pendiente") — D1.
- Feature #1, criterio 3: sin cobertura ("pendiente") — D2.
- (Advertencia de entorno, no de deuda: `.nvmrc` pide el parche `24.20.0` y el Node local es
  `24.11.1`; cumple el piso de la línea 24 LTS que exige el CHECK 2, no bloquea el gate.)

**Holgura de cobertura detectada (INFO, no error):** el gate reportó ≥ 5 puntos de holgura sobre el
piso de `rules.cobertura_minima` en las cuatro métricas. Por instrucción del rol, subir el piso
(trinquete) en `feature_list.json` y `docs/verifications.md` §4 es una acción de la **fase GREEN**
(paso 4 de `implementer.md`), no de RED: se dejó pendiente para esa pasada.

### Fase GREEN — sin código de producción, solo trinquete de cobertura

Como la feature es `red_modo: caracterizacion`, la fase GREEN no implementa ni refactoriza nada de
`src/`: la batería ya estaba en verde desde RED. El único trabajo de esta fase es (a) aplicar el
trinquete de cobertura que el gate pidió en RED y (b) declarar el Nivel B.

**Trinquete aplicado** (`rules.cobertura_minima` en `feature_list.json` y tabla de
`docs/verifications.md` §4): piso anterior líneas 60 / sentencias 60 / funciones 55 / ramas 55 → piso
nuevo **líneas 72 · sentencias 73 · funciones 66 · ramas 61**, medido el 2026-09-03 sobre
líneas 75.59 % · sentencias 76.37 % · funciones 69.69 % · ramas 64.49 % (deja margen bajo la medición
real, no la iguala).

**Corrida final del gate, con la feature #2 en `green` y el piso nuevo (`[OK]`):**

```
==> CHECK 3 - feature_list.json
[OK] 3 feature(s) con estado valido (done=1, green=1, pending=1).
[OK] Feature activa: #2 pruebas_guard_401_y_formato_respuesta [green].

==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 36 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 9 passed, 9 total
Tests:       23 passed, 23 total
[OK] Pruebas en verde: 23/23 tests, 0 suite(s) rota(s).

==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 75.59%, sentencias 76.37%, funciones 69.69%, ramas 64.49%.

[INFO] Nivel B (NO lo prueba este script): comportamiento contra PostgreSQL real, invalidacion de JWT
end-to-end tras re-login, migraciones/sincronizacion de esquema, y el contrato publicado en /api/docs.
Se DECLARA en progress/impl_<name>.md; no se sustituye. Ver docs/verifications.md.
[WARN] Feature #1 perfil_usuario_autenticado, criterio 1: sin cobertura ('pendiente') - Deuda D1 (la
cierra la feature #2).
[WARN] Feature #1 perfil_usuario_autenticado, criterio 3: sin cobertura ('pendiente') - Deuda D2 (la
cierra la feature #2).

[BASELINE] 2 advertencias de deuda == baseline 2.

[OK] Entorno integro (Nivel A). 2 advertencia(s). Recuerda el Nivel B.
```

Sin iteraciones: `[OK]` en la primera corrida tras aplicar el trinquete y cambiar el `status` a
`green`. Conteo de advertencias de deuda vs. baseline vigente: **2 == 2** (sin deuda nueva; las mismas
D1/D2 de siempre, que quedan como deuda registrada — esta pasada de GREEN no tocó el `tdd_contract` de
la feature #1 porque no fue instruido para esta pasada; queda para cuando corresponda cerrar esa
referencia cruzada). Cobertura medida vs. piso nuevo: líneas 75.59 % (piso 72), sentencias 76.37 %
(piso 73), funciones 69.69 % (piso 66), ramas 64.49 % (piso 61) — todas por encima, sin holgura ≥ 5
puntos remanente que exija subir de nuevo.

## Prueba Nivel B

Ningún criterio de esta feature requiere Nivel B como prueba propia: los 4 criterios de `acceptance`
son verificables por completo con mocks de Jest (metadatos de NestJS, `ExecutionContext`/`CallHandler`
mínimos, `ArgumentsHost` mínimo). No hay comportamiento contra PostgreSQL real, invalidación de JWT
end-to-end ni esquema involucrado en esta feature en sí misma.

Sin embargo, por completitud del Nivel B del proyecto (no como requisito de esta feature) se declara:

- **Caso:** la suite `test/app.e2e-spec.ts` siembra su propio usuario contra PostgreSQL real y ya cubre
  un 401 con el formato de error estándar de un endpoint protegido (`POST /api/users` sin token), lo
  que confirma en caliente que el guard y el `HttpExceptionFilter` producen la forma esperada también
  fuera de mocks.
- **Comando:** `npm run test:e2e`.
- **Base:** PostgreSQL real, contenedor local `postgres:17` (ver `docs/verifications.md` §1 para el
  comando `docker run` de referencia).
- **Resultado:** pendiente de ejecutar por: el usuario (kevinmm) — sin PostgreSQL ni daemon de Docker
  en la máquina de esta sesión.

Declarado explícitamente: **Nivel B no aplica como requisito propio de la feature #2** (a diferencia de
la feature #1, cuyo criterio 4 de Swagger sigue en Nivel B y no se toca aquí); la ejecución de
`npm run test:e2e` de arriba es la confirmación general del proyecto, no un criterio de `acceptance`
específico de esta feature.

## Observación para el leader (no corregida, solo registrada)

El criterio 4 (`HttpExceptionFilter` convierte un `Error` no HTTP en 500) se probó con una excepción que
**no** es `instanceof Error` (un string plano), no con una instancia real de `Error`. Al leer
`http-exception.filter.ts` se confirmó que existe una rama `else if (exception instanceof Error) {
message = exception.message; }`: si el objeto lanzado **sí** es una instancia de `Error`, el filtro
devuelve al cliente el `message` interno de esa excepción en el 500, en vez del literal genérico
`'Internal server error'`. Eso es una fuga potencial de detalle interno (mensajes de driver de
PostgreSQL, rutas de archivo, nombres de columna, etc.) hacia la respuesta HTTP — dispara el mismo
disparador **D6** (fuga de datos sensibles/internos) del catálogo de `planner.md`. No se corrigió en
esta pasada: es `red_modo: caracterizacion` y el mandato explícito es no tocar código de producción.
Queda registrado aquí para que el leader decida si abre una feature nueva (con diseño, dado que D6 la
dispararía) para acotar ese mensaje también en la rama `instanceof Error`.

## Acoplamientos revisados (de `planner.md` §Acoplamientos)

De los acoplamientos que el leader marcó para esta pasada de GREEN:

- **#3 `ResponseInterceptor` global:** se caracterizó exactamente el envoltorio que produce hoy
  (`{ statusCode, message: 'OK', resource, isError: false }`, `message` fijo en `'OK'`), sin proponer
  cambiarlo. La fase GREEN no lo tocó: sigue siendo el mismo interceptor de siempre, ahora con spec
  propio que impide que un cambio ahí rompa a todos los endpoints en silencio (cierra D2).
- **#4 `HttpExceptionFilter` global:** se caracterizó la forma del error que define hoy, incluida la
  agrupación de errores de `class-validator` y el fallback 500. La fase GREEN no lo tocó; la
  observación registrada arriba (fuga de `message` real cuando la excepción es `instanceof Error`,
  D6) es sobre este mismo acoplamiento y se deja para una feature aparte, no para esta.
- **#9 Winston con rotación a archivo:** el test del criterio 4 confirma explícitamente que un dato
  sensible del cuerpo de la petición (una contraseña) nunca llega a `logger.error`, reforzando por qué
  ese acoplamiento importa (lo que se loguea queda en disco). Sin cambios en GREEN.
- **#1 `JwtStrategy`/guard de JWT:** el spec del guard (criterio 1) depende de que
  `@UseGuards(JwtAuthGuard)` siga presente como metadato de clase en `UsersController`; GREEN no tocó
  ni el guard ni la estrategia, solo confirmó que el acoplamiento sigue intacto (cierra D1).

Acoplamiento adicional revisado en RED, sin cambios en GREEN:

- **#12 Metadatos de decoradores vs. imports de tipos:** no se convirtió ningún import de clase
  inyectada/decorada a `import type` en los archivos de producción tocados transitoriamente durante las
  mutaciones de evidencia.
