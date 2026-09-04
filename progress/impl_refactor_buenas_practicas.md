# Implementación — #6 `refactor_buenas_practicas`

## 1. Feature y fase

- **Feature:** `#6 refactor_buenas_practicas` — Refactorización y buenas prácticas del código
  existente, sin cambiar comportamiento.
- **Fase:** **RED** (esta pasada). Puerta humana: **pendiente de aprobación del usuario**.
- **`red_modo`:** `caracterizacion` (el comportamiento ya existe; el rojo se demuestra por
  **mutación**, restaurando el código después de cada una).
- **Diseño seguido:** `progress/design_refactor_buenas_practicas.md` (autor: `planner`,
  2026-09-04), con la **adenda del leader §1.1.1** (2026-09-04, con la #5 ya `done`) ya aplicada:
  `PORT` con anotación de tipo + `readonly` y `JwtAuthGuard` con constructor propio (feature #5,
  R9/R12 descartados de esta feature), R16/G0 descartados (la e2e de la #5 ya quitó el doble
  registro del interceptor), la e2e tiene 6 casos.
- **Precondición de secuencia:** feature #5 `done` antes de empezar (verificado en
  `feature_list.json`); no había otra feature activa.

## 2. Batería de tests

| Criterio (`acceptance`) | `it()` — nombre exacto | Archivo | Nivel |
|---|---|---|---|
| 2 | `validateEnv devuelve una instancia de EnvironmentVariables con los valores del entorno convertidos a su tipo` (T1) | `src/config/env.validation.spec.ts` | A |
| 2 | `validateEnv aplica development como NODE_ENV cuando la variable no viene en el entorno` (T2) | `src/config/env.validation.spec.ts` | A |
| 2 | `validateEnv lanza un Error que nombra la propiedad y la restriccion cuando falta una variable obligatoria` (T3) | `src/config/env.validation.spec.ts` | A |
| 2 | `validateEnv no incluye el valor de JWT_SECRET ni de DB_PASS en el mensaje de error` (T4) | `src/config/env.validation.spec.ts` | A |
| 2 | `validateEnv rechaza un NODE_ENV que no esta en el catalogo de entornos` (T5) | `src/config/env.validation.spec.ts` | A |
| 1 | `login delega en AuthService y devuelve el token sin envolverlo, porque el envoltorio lo aplica el ResponseInterceptor` (T6) | `src/auth/auth.controller.spec.ts` (nuevo) | A |
| 1 | `AuthController declara HttpCode 200 en POST /auth/login y no el 201 por omision de @Post` (T7) | `src/auth/auth.controller.spec.ts` (nuevo) | A |
| 1 | `AuthController no declara guard de clase: POST /auth/login queda publico` (T8) | `src/auth/auth.controller.spec.ts` (nuevo) | A |
| 2 | `buildWinstonOptions usa nivel debug en development e info en cualquier otro entorno` (T9) | `src/common/logger/winston.config.spec.ts` (nuevo) | A |
| 2 | `buildWinstonOptions baja la consola a nivel error cuando NODE_ENV es test` (T10) | `src/common/logger/winston.config.spec.ts` (nuevo) | A |
| 2 | `buildWinstonOptions arma tres transportes: consola, archivo rotado de error y archivo rotado de aplicacion` (T11) | `src/common/logger/winston.config.spec.ts` (nuevo) | A |
| 2 | `buildWinstonOptions no agrega por omision mas metadatos que service y hostname` (T12) | `src/common/logger/winston.config.spec.ts` (nuevo) | A |
| 2 | `error registra el message de un Error recibido como mensaje, sin serializar el objeto completo` (T13) | `src/common/logger/winston-logger.service.spec.ts` | A |
| 2 | `HttpExceptionFilter usa como message el texto de una HttpException construida con un string` (T14) | `src/common/filters/http-exception.filter.spec.ts` | A |
| 2 | `HttpExceptionFilter recurre a exception.message cuando el cuerpo de la HttpException no trae un message de tipo string` (T15) | `src/common/filters/http-exception.filter.spec.ts` | A |
| 2 | `findByUsername consulta por la columna username y devuelve la entidad completa, porque el login necesita el hash` (T16) | `src/users/users.service.spec.ts` | A |
| 2 | `findById devuelve la entidad completa, incluido lastTokenIssuedAt, que la regla de invalidacion de JWT necesita` (T17) | `src/users/users.service.spec.ts` | A |
| 2 | `updateLastTokenIssuedAt actualiza solo esa columna usando el id del usuario como criterio no vacio` (T18) | `src/users/users.service.spec.ts` | A |
| 2 | `create marca isActive en true cuando el DTO no trae el campo active` (T19) | `src/users/users.service.spec.ts` | A |
| 2 | `create delega en UsersService.create y devuelve el UserDto sin envolverlo` (T20) | `src/users/users.controller.spec.ts` | A |
| 2 | `list delega en UsersService.list y devuelve el arreglo de UserListItemDto tal cual` (T21) | `src/users/users.controller.spec.ts` | A |

**Anclas** (existentes, no se tocan, deben seguir en verde todo el ciclo): `response.interceptor.spec.ts`
(1), `jwt.strategy.spec.ts` (5), `auth.service.spec.ts` (3), `framework-nestjs12.spec.ts` (1),
`users.controller.guard.spec.ts` (1), `users.controller.spec.ts` (2 preexistentes), `users.service.spec.ts`
(4 preexistentes), `password.service.spec.ts` (3), `logger.module.spec.ts` (1), `app.controller.spec.ts` (1),
`test/app.e2e-spec.ts` (6, Nivel B).

`tdd_contract` en `feature_list.json` copia §5.9 del diseño (19 entradas Nivel A + 6 entradas Nivel B,
distribuidas en los 4 criterios de `acceptance`). **P1 resuelto a favor:** se confirmó leyendo
`node_modules/@nestjs/common/constants.js` que `HTTP_CODE_METADATA` **sí** está exportado
(`export const HTTP_CODE_METADATA = '__httpCode__';`), así que T7 se quedó en Nivel A tal cual el
diseño (no hizo falta la sustitución por T8 que preveía el diseño si la constante no existiera).

## 3. Evidencia RED

**Modo `caracterizacion`:** todo el código de producción **ya existía** antes de escribir estos specs.
La batería completa (64 `it()`, 43 preexistentes + 21 nuevos) **pasa en disco** desde que se escribió
(confirmado con `npm test`: `Test Suites: 17 passed, 17 total` / `Tests: 64 passed, 64 total`). El rojo
se demuestra rompiendo **a propósito** cada uno de los 11 archivos Nivel A del `tdd_contract` (uno a la
vez), corriendo solo ese spec, pegando el fallo, **restaurando** el archivo de producción exacto, y
confirmando el verde de vuelta. Se verificó al final que ningún archivo de producción quedó modificado
(§4 y comparación byte a byte contra la lectura original de cada archivo, hecha antes de mutar nada).

A continuación, una mutación por cada uno de los **11 archivos Nivel A** del contrato:

### 3.1. `src/common/interceptors/response.interceptor.spec.ts` (ancla)

**Mutación:** en `src/common/interceptors/response.interceptor.ts`, `message: 'OK'` → `message: 'OK-MUTADO'`.

```
FAIL src/common/interceptors/response.interceptor.spec.ts
  ● ResponseInterceptor › envuelve una respuesta exitosa como { statusCode, message: "OK", resource, isError: false }, tomando el statusCode de la respuesta HTTP
    expect(received).toEqual(expected) // deep equality
    - Expected  - 1
    + Received  + 1
      Object {
        "isError": false,
    -   "message": "OK",
    +   "message": "OK-MUTADO",
        "resource": Object { "id": "uuid-1" },
        "statusCode": 201,
      }
Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
```

Restaurado (`message: 'OK'`). Verde de vuelta: `Test Suites: 1 passed, 1 total` / `Tests: 1 passed, 1 total`.

### 3.2. `src/auth/strategies/jwt.strategy.spec.ts` (ancla)

**Mutación:** en `src/auth/strategies/jwt.strategy.ts`, invertir la comparación de invalidación de JWT:
`if (payload.iat < lastIssued)` → `if (payload.iat > lastIssued)`.

```
FAIL src/auth/strategies/jwt.strategy.spec.ts
  ● JwtStrategy (regla de invalidación de tokens) › rechaza el token previo si iat < lastTokenIssuedAt (re-login)
    expect(received).rejects.toBeInstanceOf()
    Received promise resolved instead of rejected
  ● JwtStrategy (regla de invalidación de tokens) › coerce bigint-string de pg al comparar
    expect(received).rejects.toBeInstanceOf()
    Received promise resolved instead of rejected
Test Suites: 1 failed, 1 total
Tests:       2 failed, 3 passed, 5 total
```

Restaurado (`<` de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` / `Tests: 5 passed, 5 total`.

### 3.3. `src/auth/auth.service.spec.ts` (ancla)

**Mutación:** en `src/auth/auth.service.ts`, `{ expiresIn: '8h' }` → `{ expiresIn: '4h' }`.

```
FAIL src/auth/auth.service.spec.ts
  ● AuthService › login exitoso firma el token y actualiza lastTokenIssuedAt
    expect(jest.fn()).toHaveBeenCalledWith(...expected)
    - Expected
    + Received
      {"iat": 1788547158, "role": "user", "sub": "uuid-1", "username": "jdoe"},
      Object {
    -   "expiresIn": "8h",
    +   "expiresIn": "4h",
      },
Test Suites: 1 failed, 1 total
Tests:       1 failed, 2 passed, 3 total
```

Restaurado (`'8h'` de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` / `Tests: 3 passed, 3 total`.

### 3.4. `src/auth/auth.controller.spec.ts` (T6, T7, T8 — nuevos)

**Mutación:** en `src/auth/auth.controller.ts`, quitar `@HttpCode(HttpStatus.OK)` del método `login`.

```
FAIL src/auth/auth.controller.spec.ts
  ● AuthController › AuthController declara HttpCode 200 en POST /auth/login y no el 201 por omision de @Post
    expect(received).toBe(expected) // Object.is equality
    Expected: 200
    Received: undefined
Test Suites: 1 failed, 1 total
Tests:       1 failed, 2 passed, 3 total
```

Restaurado (`@HttpCode(HttpStatus.OK)` de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` /
`Tests: 3 passed, 3 total`.

### 3.5. `src/config/env.validation.spec.ts` (T1-T5 — nuevos, más los T1-T7 de la #5)

**Mutación:** en `src/config/env.validation.ts`, la línea de detalle del error deja de reportar solo
propiedad+restricción y **agrega el config crudo completo recibido** (`:: config=${JSON.stringify(config)}`)
— la variante real de "añadir el valor al detalle" que sí filtra `JWT_SECRET`/`DB_PASS` (con el mutante
más literal del diseño, "agregar `e.value` solo de la propiedad que falla", **T4 no cae** porque
`JWT_SECRET`/`DB_PASS` sólo pueden fallar por estar vacíos —el único validador es `@IsNotEmpty`— y un
valor vacío no revela nada; se documenta como ajuste en §7).

```
FAIL src/config/env.validation.spec.ts
  ● validateEnv › el mensaje de error de validateEnv nombra la propiedad y la restriccion, nunca el valor recibido
    expect(received).not.toContain(expected) // indexOf
    Expected substring: not "70000"
    Received string: "Validacion de variables de entorno fallida -> PORT: PORT must not be greater than 65535 :: config={...,"PORT":"70000"}"
  ● validateEnv › validateEnv no incluye el valor de JWT_SECRET ni de DB_PASS en el mensaje de error
    expect(received).not.toContain(expected) // indexOf
    Expected substring: not "valor-de-prueba-no-es-un-secreto"
    Received string: "Validacion de variables de entorno fallida -> DB_HOST: DB_HOST should not be empty :: config={...,"DB_PASS":"valor-de-prueba-no-es-un-secreto",...,"JWT_SECRET":"valor-de-prueba-no-es-un-secreto"}"
Test Suites: 1 failed, 1 total
Tests:       2 failed, 10 passed, 12 total
```

Restaurado (detalle sin el `config=` agregado). Verde de vuelta: `Test Suites: 1 passed, 1 total` /
`Tests: 12 passed, 12 total`. Comparado byte a byte con la lectura original: idéntico.

### 3.6. `src/common/logger/winston.config.spec.ts` (T9-T12 — nuevo)

**Mutación:** en `src/common/logger/winston.config.ts`, invertir el ternario del nivel:
`env === 'development' ? 'debug' : 'info'` → `env === 'development' ? 'info' : 'debug'`.

```
FAIL src/common/logger/winston.config.spec.ts
  ● buildWinstonOptions › buildWinstonOptions usa nivel debug en development e info en cualquier otro entorno
    expect(received).toBe(expected) // Object.is equality
    Expected: "debug"
    Received: "info"
Test Suites: 1 failed, 1 total
Tests:       1 failed, 3 passed, 4 total
```

Restaurado (ternario original). Verde de vuelta: `Test Suites: 1 passed, 1 total` / `Tests: 4 passed, 4 total`.

### 3.7. `src/common/filters/http-exception.filter.spec.ts` (T14, T15 — nuevos)

**Mutación 1 (T14):** rama `typeof res === 'string'` deja de usar el texto real: `message = res;` →
`message = 'literal generico';`.

```
FAIL src/common/filters/http-exception.filter.spec.ts
  ● HttpExceptionFilter › HttpExceptionFilter usa como message el texto de una HttpException construida con un string
    expect(jest.fn()).toHaveBeenCalledWith(...expected)
    - Expected
    + Received
      Object {
        "isError": true,
    -   "message": "texto plano",
    +   "message": "literal generico",
        "resource": undefined,
        "statusCode": 418,
      },
Test Suites: 1 failed, 1 total
Tests:       1 failed, 7 passed, 8 total
```

Restaurado. Verde de vuelta.

**Mutación 2 (T15):** `?? exception.message` → `?? ''`.

```
FAIL src/common/filters/http-exception.filter.spec.ts
  ● HttpExceptionFilter › HttpExceptionFilter recurre a exception.message cuando el cuerpo de la HttpException no trae un message de tipo string
    expect(jest.fn()).toHaveBeenCalledWith(...expected)
    Expected: ObjectContaining {"message": "Http Exception", "statusCode": 418}
    Received: {"isError": true, "message": "", "resource": undefined, "statusCode": 418}
Test Suites: 1 failed, 1 total
Tests:       1 failed, 7 passed, 8 total
```

Restaurado (`?? exception.message` de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` /
`Tests: 8 passed, 8 total`. Comparado byte a byte con la lectura original: idéntico (los 6 `it()`
existentes de las features #2/#4 no se tocaron).

### 3.8. `src/users/users.service.spec.ts` (T16-T19 — nuevos)

**Mutación (T18):** en `src/users/users.service.ts`, `updateLastTokenIssuedAt` pasa a usar un criterio
vacío: `this.userRepository.update(id, {...})` → `this.userRepository.update({}, {...})`.

```
FAIL src/users/users.service.spec.ts
  ● UsersService › updateLastTokenIssuedAt actualiza solo esa columna usando el id del usuario como criterio no vacio
    expect(jest.fn()).toHaveBeenCalledWith(...expected)
    - Expected
    + Received
    - "uuid-1",
    + {},
      {"lastTokenIssuedAt": 12345},
Test Suites: 1 failed, 1 total
Tests:       1 failed, 7 passed, 8 total
```

Restaurado (`update(id, ...)` de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` /
`Tests: 8 passed, 8 total`.

### 3.9. `src/users/users.controller.spec.ts` (T20, T21 — nuevos)

**Mutación (T20):** en `src/users/users.controller.ts`, `create` envuelve la respuesta:
`return this.usersService.create(dto);` → `const resource = await this.usersService.create(dto); return { resource };`.

```
FAIL src/users/users.controller.spec.ts
  ● UsersController - GET /users/me › create delega en UsersService.create y devuelve el UserDto sin envolverlo
    expect(received).toEqual(expected) // deep equality
    - Expected  - 0
    + Received  + 2
      Object {
    +   "resource": Object { "createdAt": ..., "email": "juan@example.com", ... },
      }
Test Suites: 1 failed, 1 total
Tests:       1 failed, 3 passed, 4 total
```

Restaurado (`create` sin envoltorio de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` /
`Tests: 4 passed, 4 total`.

### 3.10. `src/common/logger/winston-logger.service.spec.ts` (T13 — nuevo)

**Mutación:** en `src/common/logger/winston-logger.service.ts`, `normalizarMensaje` deja de distinguir
`Error`: se quita la rama `if (message instanceof Error) { return message.message; }` y siempre hace
`return String(message)`.

```
FAIL src/common/logger/winston-logger.service.spec.ts
  ● WinstonLoggerService › error registra el message de un Error recibido como mensaje, sin serializar el objeto completo
    expect(jest.fn()).toHaveBeenCalledWith(...expected)
    Expected: "error", "fallo al conectar con el servicio externo"
    Received: "error", "Error: fallo al conectar con el servicio externo"
Test Suites: 1 failed, 1 total
Tests:       1 failed, 6 passed, 7 total
```

Restaurado (rama `instanceof Error` de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` /
`Tests: 7 passed, 7 total`.

### 3.11. `src/framework-nestjs12.spec.ts` (ancla)

Este spec lee `package.json`, no una superficie de comportamiento en memoria; la mutación equivalente es
sobre el **dato leído**: en `package.json`, `"@nestjs/common": "^12.0.1"` → `"@nestjs/common": "^11.0.1"`.

```
FAIL src/framework-nestjs12.spec.ts
  ● Plataforma NestJS 12 › package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS
    expect(received).toEqual(expected) // deep equality
    - Expected  - 1
    + Received  + 3
    - Array []
    + Array [
    +   "@nestjs/common@^11.0.1",
    + ]
Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
```

Restaurado (`^12.0.1` de vuelta). Verde de vuelta: `Test Suites: 1 passed, 1 total` / `Tests: 1 passed, 1 total`.

### 3.12. Confirmación final: batería completa en verde, cero producción modificada

```
> npm test
Test Suites: 17 passed, 17 total
Tests:       64 passed, 64 total
```

Comparación byte a byte de cada uno de los 12 archivos que se mutaron temporalmente
(`src/common/interceptors/response.interceptor.ts`, `src/auth/strategies/jwt.strategy.ts`,
`src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `src/config/env.validation.ts`,
`src/common/logger/winston.config.ts`, `src/common/filters/http-exception.filter.ts`,
`src/users/users.service.ts`, `src/users/users.controller.ts`,
`src/common/logger/winston-logger.service.ts`, `package.json`) contra la lectura hecha **antes** de
empezar la fase RED: **idénticos**. `npm run build`, `npm run typecheck` y `npm run lint:check` en verde
después de restaurar todo.

## 4. Archivos modificados (fase RED)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/config/env.validation.spec.ts` | Modificado (se agregan `it()`) | T1-T5: instancia devuelta, `NODE_ENV` por omisión, error con propiedad faltante, secretos fuera del mensaje, `NODE_ENV` fuera de catálogo. Se agregan **después** de los 7 `it()` de la #5, sin tocarlos. |
| `src/auth/auth.controller.spec.ts` | Nuevo | T6-T8: delegación sin envoltorio, `HttpCode` 200, ausencia de guard de clase. Mocks tipados (`jest.Mocked<Pick<AuthService, 'login'>>`). |
| `src/common/logger/winston.config.spec.ts` | Nuevo | T9-T12: nivel por entorno, consola en `test`, los tres transportes, `defaultMeta` sin metadatos extra. Guarda/restaura `process.env.NODE_ENV` en `afterEach`. |
| `src/common/logger/winston-logger.service.spec.ts` | Modificado (se agrega 1 `it()`) | T13: `normalizarMensaje` con un `Error`. Los 6 `it()` existentes no se tocaron. |
| `src/common/filters/http-exception.filter.spec.ts` | Modificado (se agregan 2 `it()`) | T14-T15: rama string y rama `obj.message` no-string. Los 6 `it()` existentes (features #2/#4) no se tocaron. |
| `src/users/users.service.spec.ts` | Modificado (se agregan 4 `it()`) | T16-T19: `findByUsername`, `findById`, `updateLastTokenIssuedAt`, `create` sin `active`. Los 4 `it()` existentes no se tocaron. |
| `src/users/users.controller.spec.ts` | Modificado (se agregan 2 `it()`) | T20-T21: `create` y `list` sin envoltorio. Los 2 `it()` existentes (feature #1/#5) no se tocaron ni en texto ni en aserciones. |
| `feature_list.json` | Modificado | Feature #6: `status` → `"red"`, `tdd_contract` completo (19 entradas Nivel A + 6 Nivel B, copiado de §5.9 del diseño, P1 resuelto a favor). |
| `progress/current.md` | Modificado | Plan de la fase RED, batería, evidencia capturada. |
| `progress/impl_refactor_buenas_practicas.md` | Nuevo | Este documento. |

No se modificó ningún archivo de producción de forma permanente: los 11 mutados durante la
demostración del rojo (§3) quedaron **restaurados byte a byte** (verificado en §3.12).

## 5. Decisiones de implementación

1. **P1 resuelto leyendo el paquete instalado**, no asumido: `HTTP_CODE_METADATA` está exportado por
   `@nestjs/common/constants` (`node_modules/@nestjs/common/constants.js:31`), así que T7 permanece en
   Nivel A tal cual §5.9 del diseño.
2. **`Object.getOwnPropertyDescriptor` en vez de `AuthController.prototype.login`** para leer el
   metadato de `@HttpCode`: acceder directamente al método como valor dispara
   `jest/unbound-method`, y el descriptor (tipado explícitamente `as object`, no `any`) evita tanto ese
   error como `no-unsafe-argument`, sin `eslint-disable`.
3. **T4 (secretos fuera del mensaje) construido con `DB_HOST` vacío, no con `JWT_SECRET`/`DB_PASS`
   vacíos**: el único validador de esos dos campos es `@IsNotEmpty`, así que la única forma de que
   fallen es estar vacíos — y un valor vacío filtrado no demuestra nada. Construir el error con otra
   propiedad y verificar que los *valores reales* de `JWT_SECRET`/`DB_PASS` (que sí viajan en el
   `config` completo) no aparecen en el mensaje protege la garantía real (D6). Ver también el ajuste de
   mutación en §7.
4. **`winston.config.spec.ts`: la ruta completa de los archivos rotados se arma con `dirname + '/' +
   filename`**, no con el string literal `'./logs/error-%DATE%.log'` directo en `.filename`: en
   runtime, `winston-daily-rotate-file` separa `dirname` (`'./logs'`) de `filename`
   (`'error-%DATE%.log'`) aunque en el código fuente se escriban juntos. Confirmado ejecutando el
   spec contra el código real antes de fijar la aserción (evita un falso rojo por una suposición no
   verificada).
5. **`buildUser`/`baseUser` de cada spec se reutilizan tal cual** (N7 del diseño: DAMP en pruebas), sin
   crear una fixture compartida.
6. **Ningún `it()` existente cambió de texto ni de aserción.** Los `it()` nuevos se agregaron siempre
   **después** de los existentes en cada archivo modificado.
7. **P0b se ejecutó con Docker Desktop encendido** antes de escribir cualquier spec (§6), tal como
   exige el orden del diseño (§8.1).

## 6. Refactor aplicado con la batería en verde

No aplica: es fase RED. El diseño (§8.2, G1-G13) es el plan de la fase GREEN, que no arrancó.

## 7. Desviaciones del diseño

| Punto del diseño | Desviación | Motivo |
|---|---|---|
| §5.1, mutación de T4 ("Añadir el valor al detalle (`${e.property}: ${String(e.value)} …`)") | La mutación probada primero (agregar `e.value` solo de la propiedad que falla) **no** hace caer T4, porque `JWT_SECRET`/`DB_PASS` sólo pueden fallar por `@IsNotEmpty` (vacíos) y un valor vacío no revela nada. Se usó en su lugar una mutación equivalente y más realista: agregar el **config crudo completo** (`JSON.stringify(config)`) al mensaje, que sí expone `JWT_SECRET`/`DB_PASS` reales sin importar cuál propiedad falló. | Investigado interactivamente (§3.5): se confirmó con un script aislado que `enableImplicitConversion: true` coacciona cualquier valor no vacío a string vía `String()`, así que un campo `@IsString` nunca puede fallar con un valor "sensible" reconocible — sólo con vacío o ausente. La mutación sustituta demuestra la MISMA garantía (D6: los secretos nunca llegan al mensaje) de forma efectivamente comprobable. |
| §5.5, mutación de T14 ("Eliminar la rama `typeof res === 'string'`") | Eliminar literalmente esa rama (`if (false) { message = res as string; } else { ... }`) **no** hace caer T14 con `new HttpException('texto plano', 418)`, porque `exception.message` (el fallback de la rama `else`) resulta ser el mismo texto (`'texto plano'`) para una `HttpException` construida con un string — confirmado ejecutando el código real. Se usó en su lugar la mutación equivalente descrita en §3.7 (la rama string ignora el texto real y usa un literal genérico), que sí produce una diferencia observable y protege el mismo comportamiento (el mensaje de una `HttpException` con cuerpo string se respeta tal cual). | Mismo método: se probó primero la mutación literal, se observó que no producía rojo, se investigó la causa real (`exception.message` coincide con `res` en este caso concreto de NestJS) y se documentó el hallazgo en vez de forzar una mutación que no demuestra nada. |

Ningún otro punto del diseño se desvió: los 21 `it()` nuevos, los 2 archivos nuevos, y el `tdd_contract`
siguen literalmente §5 y §5.9 del diseño.

## 8. Verificación Nivel A (fase RED)

`npm run harness:verify` (feature en `red`, modo `caracterizacion`) terminó en **`[OK]`** (exit 0), todo
en verde (sin tolerancias de fase RED, porque en modo `caracterizacion` el gate exige la batería
completa en verde):

```
==> CHECK 3c - Trazabilidad criterio <-> test
[OK] Criterios con contrato: 19 en Nivel A (verificados en disco), 6 en Nivel B, 0 sin cobertura.

==> CHECK 3d - Evidencia RED
[OK] 5 feature(s) tdd:true revisada(s).

==> CHECK 3e - TDD obligatorio
[OK] Todas las features son tdd:true (exentas legacy declaradas: 1).

==> CHECK 4 - Higiene de src/ y test/
[OK] 26 archivo(s) .ts de produccion sin codigo de depuracion.
[OK] 18 archivo(s) de prueba sin .only ni tests deshabilitados.

==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 48 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 17 passed, 17 total
Tests:       64 passed, 64 total
[OK] Pruebas en verde: 64/64 tests, 0 suite(s) rota(s).

==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 100%, sentencias 99.62%, funciones 100%, ramas 82.35%.

[INFO] Cobertura con holgura >= 5 puntos en lineas 100% (piso 85%), sentencias 99.62% (piso 85%),
funciones 100% (piso 79%), ramas 82.35% (piso 67%): sube el piso (trinquete) en feature_list.json y
docs/verifications.md seccion 4.

[BASELINE] 0 advertencias de deuda == baseline 0.

[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

**Advertencias de deuda vs. baseline vigente** (`docs/verifications.md` §4): **0 == 0**, sin cambios.

**Cobertura:** líneas 100 % · sentencias 99.62 % · funciones 100 % · ramas 82.35 %, muy por encima del
piso vigente (85/85/79/67). El gate reporta holgura ≥ 5 puntos en los cuatro indicadores y sugiere subir
el piso — **no se hace en esta pasada**: instrucción explícita del `leader` es que en RED no se mueve
el piso (eso corresponde a la fase GREEN, cuando el código de producción realmente cambie y se mida la
cobertura final del refactor). Queda anotado aquí para que la fase GREEN lo retome.

Una sola corrida del gate fue necesaria tras completar la batería y las 11 mutaciones; no hizo falta
iterar sobre errores de tipo, lint o build.

## 9. Prueba Nivel B (captura de partida — P0b)

Ejecutado **antes** de escribir cualquier spec, con Docker Desktop encendido, contra la base
**desechable** de `compose.yaml` (PostgreSQL 17 en tmpfs, nunca DEV/QA). Esta captura es la línea base
contra la que se comparará el Nivel B al cierre de la fase GREEN (§8.1 del diseño, criterio de "el
comportamiento no cambió").

**B2 — `npm run test:e2e:docker`:**

```
==> docker compose up -d --wait db
 Container application-api-nestjs-db-1 Healthy
==> jest e2e contra PostgreSQL en 127.0.0.1:5432
error: POST /api/users -> 401: Unauthorized {...}
error: POST /api/auth/login -> 401: Contraseña incorrecta {...}
error: GET /api/users/me -> 401: Unauthorized {...}
error: POST /api/users -> 400: Validación fallida {...}
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
==> docker compose down -v
```

6/6 en verde (los `error:` son el logger registrando los 401/400 esperados por la propia suite, no
fallos).

**B1 — `GET /api/` con la app en el contenedor** (`docker compose --profile app up -d --build --wait`):

```json
{"statusCode":200,"message":"OK","resource":{"msg":"Server is up and running"},"isError":false}
```

**B4 (401 sin token) — `POST /api/users` sin `Authorization`:**

```
Status: 401
{"statusCode":401,"message":"Unauthorized","isError":true}
```

**B7 (Swagger) — `GET /api/docs-json`:**

- `paths`: `/api`, `/api/users/me`, `/api/users`, `/api/auth/login`.
- `components.securitySchemes`: `{"access-token":{"scheme":"bearer","bearerFormat":"JWT","type":"http"}}`.

**B3 (login + `/api/users/me` + `/api/users` con token)** — usuario desechable sembrado directo en la
base (hash bcrypt generado dentro del contenedor, `INSERT` vía `psql`, sin secretos reales), login,
consulta autenticada y borrado del usuario al terminar:

```json
// POST /api/auth/login
{"statusCode":200,"message":"OK","resource":{"token":"eyJhbGci...(recortado, 240 caracteres)"},"isError":false}
// GET /api/users/me con Bearer <token>
{"statusCode":200,"message":"OK","resource":{"id":"40043f4b-90bf-454d-87b3-ec4b59a93dd0","username":"partida-b3","name":"Partida B3","email":"partida-b3@example.com","role":"admin","isActive":true,"createdAt":"2026-09-04T18:29:53.380Z","updatedAt":"2026-09-04T18:29:59.719Z"},"isError":false}
// GET /api/users con Bearer <token>
{"statusCode":200,"message":"OK","resource":[{"username":"partida-b3","name":"Partida B3","role":"admin","isActive":true}],"isError":false}
```

Usuario `partida-b3` borrado con `DELETE FROM users WHERE username='partida-b3'` antes de cerrar.

**B9 (esquema) — `\d users`:**

```
                                       Table "public.users"
      Column       |            Type             | Collation | Nullable |         Default
-------------------+-----------------------------+-----------+----------+-------------------------
 id                | uuid                        |           | not null | uuid_generate_v4()
 username          | character varying(50)       |           | not null |
 name              | character varying(100)      |           | not null |
 email             | character varying           |           | not null |
 password          | character varying           |           | not null |
 role              | users_role_enum             |           | not null | 'user'::users_role_enum
 isActive          | boolean                     |           | not null | true
 lastTokenIssuedAt | bigint                      |           |          |
 createdAt         | timestamp without time zone |           | not null | now()
 updatedAt         | timestamp without time zone |           | not null | now()
Indexes:
    "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY, btree (id)
    "UQ_users_email" UNIQUE CONSTRAINT, btree (email)
    "UQ_users_username" UNIQUE CONSTRAINT, btree (username)
```

Cierre: `docker compose --profile app down -v` (contenedores, red y volúmenes tmpfs eliminados).

**Pendientes de repetir en el cierre de GREEN (§9.2 del diseño), comparados contra esta captura:**

| # | Caso | Estado en esta captura de partida |
|---|---|---|
| B1 | `GET /api/` con envoltorio estándar | ✅ capturado arriba |
| B2 | `npm run test:e2e:docker` (6/6) | ✅ capturado arriba |
| B3 | Login + `/api/users/me` + `/api/users` con token | ✅ capturado arriba |
| B4 | `POST /api/users`/`GET /api/users/me` sin token → 401 | ✅ capturado arriba (POST) |
| B5 | Ciclo real de invalidación de JWT | Automatizado dentro de B2 (`test/app.e2e-spec.ts`, caso de la #5) |
| B6 | `POST /api/users` con campo no declarado → 400 | Automatizado dentro de B2 |
| B7 | `/api/docs` — Swagger y esquema `access-token` | ✅ capturado arriba (`docs-json`) |
| B8 | Logger sin datos sensibles en 401/500 reales | Pendiente de repetir en GREEN (ya verificado por la #5 el 2026-09-04, sin cambios de código de por medio en esta fase RED) |
| B9 | Esquema sin cambios | ✅ capturado arriba |

## 10. Acoplamientos revisados

En esta fase RED **no se tocó ningún código de producción de forma permanente** (§4), así que ningún
acoplamiento se "respeta" activamente todavía en el código — se respetaron en el **diseño de la
batería**, que es lo que protegerá cada uno en la fase GREEN:

- **1 (invalidación de JWT):** T17 (`findById` devuelve la entidad completa) y la mutación de §3.2
  confirmaron que la regla `iat < lastTokenIssuedAt` sigue intacta y protegida.
- **3 (`ResponseInterceptor` global):** T6, T20, T21 y sus mutaciones (§3.4, §3.9) confirmaron que
  ningún controller arma su propio envoltorio hoy.
- **4 (`HttpExceptionFilter` global):** T14, T15 y sus mutaciones (§3.7) fijaron las dos ramas sin
  cobertura antes de que R5 (fase GREEN) las toque.
- **9 (logs en disco):** T13 y su mutación (§3.10) protegen contra que un `Error` de dominio se
  serialice completo al log.
- **11 (TypeORM 1.x, criterio vacío en `update`/`delete`):** T18 y su mutación (§3.8) confirmaron que
  `updateLastTokenIssuedAt` usa el `id` como criterio, nunca un objeto vacío.
- **6 (base desechable, nunca DEV/QA):** respetado en P0b (§9): `compose.yaml` con tmpfs, usuario
  sembrado y borrado, sin tocar ninguna base con datos reales.

## 11. Fase GREEN (2026-09-04)

Puerta humana aprobada el 2026-09-04 ("ok hagamos todo hasta que termines de hacer commits"). Se siguió
el orden G1-G13 de `progress/design_refactor_buenas_practicas.md` §8.2, con un punto verde
(`npm test`, y `npm run typecheck` + `npm run lint:check` en los pasos con riesgo de tipos) entre cada
paso. Los 21 `it()` nuevos y las 4 anclas explícitas de §5.9 quedaron **con el mismo texto y las mismas
aserciones** durante todo el ciclo; **G10 es la única excepción permitida por el diseño** (ajuste de
*preparación*, nunca de aserción). `npm test` terminó en `64/64` después de cada paso, sin excepción.

### 11.1. Bitácora paso a paso

| Paso | Qué se hizo | Archivos | Resultado del gate |
|---|---|---|---|
| **G1** | `JwtPayload` movido de `auth.service.ts` a `src/auth/interfaces/jwt-payload.interface.ts` (R1). `EXPIRACION_TOKEN = '8h'` como constante de módulo en `auth.service.ts` (R2), con el mismo comentario de regla de negocio que `PasswordService.SALT_ROUNDS`. | `src/auth/auth.service.ts`, `src/auth/interfaces/jwt-payload.interface.ts` (nuevo), `src/auth/strategies/jwt.strategy.ts` (solo el import), `src/auth/strategies/jwt.strategy.spec.ts` (solo el import) | `npm test`: 64/64. Anclas de `jwt.strategy.spec.ts` (5) y `auth.service.spec.ts` (3, incluida la que afirma `{ expiresIn: '8h' }`) intactas en texto y aserción. |
| **G2** | `AuthResponseDto` (nuevo, espeja `UserDto`) como tipo de retorno de `AuthService.login` y `AuthController.login`; `@ApiResponse({ status: 200, type: AuthResponseDto })` (R3). El cable no cambia: sigue siendo `{ token }`. | `src/auth/dto/auth-response.dto.ts` (nuevo), `src/auth/auth.service.ts`, `src/auth/auth.controller.ts` | `npm test`: 64/64. T6 (`auth.controller.spec.ts`) intacto. |
| **G3** | `HttpExceptionFilter.catch` reducido a 3 líneas + `private extraerDeHttpException` (tabla de decisión de 3 ramas: string, objeto con `message`, y el resto). Narrowing con `typeof res === 'object' && 'message' in res` en vez de `res as Record<string, unknown>` (R5). Solo se tocó **después** de confirmar T14/T15 en verde (condición dura del diseño). | `src/common/filters/http-exception.filter.ts` | `npm test`: 64/64 (los 6 `it()` existentes + T14 + T15 sin tocar). `npm run lint:check` marcó `no-unnecessary-condition` en `res !== null` (redundante: `HttpException.getResponse()` devuelve `string \| object`, y `object` de TS excluye `null`) — corregido quitando esa comparación; ver §11.2. |
| **G4** | `type NivelLog = 'info' \| 'error' \| 'warn' \| 'debug' \| 'verbose'` en `winston-logger.service.ts`, usado en `WinstonLike.log` y en el parámetro `nivel` de `escribir` (R7). | `src/common/logger/winston-logger.service.ts` | `npm test`: 64/64 (6 `it()` existentes + T13). |
| **G5** | `import * as os from 'node:os'`; `NodeEnvironment.Development` / `NodeEnvironment.Test` importados de `env.validation.ts` en vez de los literales `'development'` / `'test'` (R8). | `src/common/logger/winston.config.ts` | `npm run lint:check` marcó `no-unsafe-enum-comparison` al comparar `env: string` contra el enum directo — resuelto con dos constantes de módulo `DEVELOPMENT`/`TEST` anchadas explícitamente a `string` (§11.2). `npm test`: 64/64 (T9-T12). |
| **G6** | `SELECT_PUBLICO` (constante de módulo, mismo valor literal) usada por `list()`; `private toListItemDto(u: User)` junto a `toDto`, y `list()` la usa (R10). La lista de columnas consultadas y la de campos mapeados ya no pueden divergir. | `src/users/users.service.ts` | `npm test`: 64/64. La aserción existente `toHaveBeenCalledWith({ select: { username: true, ... } })` sigue pasando (deep-equal contra la constante `as const`). |
| **G7** | `TypeOrmModule.forRootAsync` tipa el factory como `ConfigService<EnvironmentVariables, true>` y lee con `{ infer: true }`; `synchronize` compara contra `NodeEnvironment.Production` (R9a, R9c). `AuthModule.JwtModule.registerAsync` deja de importar `ConfigModule` (ya es `isGlobal: true` desde `AppModule`) (R9b). | `src/app.module.ts`, `src/auth/auth.module.ts` | `npm run build` + `npm run typecheck` + `npm run lint:check` + `npm test` (64/64) en verde. **Nivel B inmediato** (obligatorio: `*.module.ts` está excluido de cobertura): `docker compose --profile app up -d --build --wait` → contenedores `Healthy`; `GET /api/` devolvió exactamente `{"statusCode":200,"message":"OK","resource":{"msg":"Server is up and running"},"isError":false}`, idéntico a la captura de partida P0b (§9). `docker compose --profile app down -v`. |
| **G8** | `HealthDto` (nuevo, espeja `UserDto`) como tipo de retorno de `AppService.getHealth()`/`AppController.getHealth()`, con `@ApiOperation` + `@ApiResponse({ status: 200, type: HealthDto })` (R13). `@ApiResponse({ status: 401, ... })` agregado a `create` y `list` de `UsersController` (Swagger faltante). | `src/app/dto/health.dto.ts` (nuevo), `src/app.service.ts`, `src/app.controller.ts`, `src/users/users.controller.ts` | `npm test`: 64/64 (`app.controller.spec.ts` sigue afirmando el mismo literal `'Server is up and running'`). |
| **G9** | *(Q4, se adoptó)* `ApiResponse<T>` unificado en `src/common/interfaces/api-response.interface.ts` (antes declarado dos veces: `ApiResponse` en `response.interceptor.ts` y `ErrorBody` en `http-exception.filter.ts`, con dos tipos de `isError`). Ambos archivos importan la interfaz compartida (R14). | `src/common/interfaces/api-response.interface.ts` (nuevo), `src/common/interceptors/response.interceptor.ts`, `src/common/filters/http-exception.filter.ts`, `test/app.e2e-spec.ts` (solo el import) | `npm run typecheck` (src/ **y** test/) + `npm test`: 64/64. Specs del interceptor y del filtro intactos. |
| **G10** | *(Q1, se adoptó)* `@CurrentUser()` (`createParamDecorator`) + `AuthenticatedRequest` (interfaz que estrecha `Request.user` de `Express.User \| undefined` a `User`, sin `any` ni `eslint-disable`) en `src/auth/decorators/current-user.decorator.ts`. `UsersController.getMe` pasa de `@Request() req: { user: User }` a `@CurrentUser() user: User` (R12). | `src/auth/decorators/current-user.decorator.ts` (nuevo), `src/users/users.controller.ts`, `src/users/users.controller.spec.ts` (**solo preparación**, ver abajo) | `npm run typecheck` + `npm run lint:check` + `npm test`: 64/64. |
| **G11** | `import type { Request, Response } from 'express'` en `http-exception.filter.ts` y `import type { Response } from 'express'` en `response.interceptor.ts` (lista blanca estricta, R6). Comentarios de sección obsoletos retirados: `// ---- Perfil del usuario autenticado ----`, `// ---- Métodos de apoyo para Auth (CP-04) ----` en `users.service.ts`; etiqueta `(CP-04)` en `users.module.ts` (R11). | `src/common/filters/http-exception.filter.ts`, `src/common/interceptors/response.interceptor.ts`, `src/users/users.service.ts`, `src/users/users.module.ts` | `npm run build` + `npm run typecheck` + `npm run lint:check` + `npm test`: 64/64. |
| **G12** | *(opcional, se adoptó)* `configurarSwagger(app)` extraída de `bootstrap()` en `main.ts` (R15). **R18** (adenda del leader): `main.ts` toma `PORT` de `ConfigService<EnvironmentVariables, true>` (`app.get<ConfigService<...>>(ConfigService)` + `config.get('PORT', { infer: true })`) en vez de `process.env.PORT ?? 3000`; mismo valor por omisión (3000), ahora protegido por la validación de `env.validation.ts` en vez de leerse crudo. | `src/main.ts` | `npm run build` + `npm run typecheck` + `npm run lint:check` + `npm test`: 64/64. **Nivel B**: `docker compose --profile app up -d --build --wait` → `Healthy`; `GET /api/` y `GET /api/docs-json` (paths y `securitySchemes.access-token`) idénticos a P0b. `down -v`. |
| **G13** | Cierre: gate completo, trinquete de cobertura, Nivel B completo comparado, documentación. Ver §11.3-§11.5. | `feature_list.json`, `docs/verifications.md`, `CLAUDE.md`, `progress/current.md` | Ver abajo. |

**G10 — ajuste de preparación (única excepción permitida por el diseño):** los dos `it()` congelados de
`users.controller.spec.ts` (*"getMe devuelve el DTO del usuario autenticado sin campo password"*,
*"getMe propaga NotFoundException cuando el usuario no existe"*) **no cambiaron su texto ni sus
aserciones**. Solo cambió cómo se construye el argumento que se pasa a `controller.getMe(...)`:
antes `const req = { user: buildUser(id) }; ...controller.getMe(req)`, ahora
`...controller.getMe(buildUser(id))` — porque `getMe` deja de recibir un `Request` simulado y pasa a
recibir directamente el `User` que el decorador (que no se ejercita al invocar el método a mano en el
spec) habría extraído. Las aserciones `expect(usersService.getProfile).toHaveBeenCalledWith('uuid-1')`,
`expect(result).toEqual(baseUserDto)`, `expect(result).not.toHaveProperty('password')` y
`expect(controller.getMe(...)).rejects.toBeInstanceOf(NotFoundException)` son **literalmente las
mismas**.

### 11.2. Dos ajustes de lint no previstos por el diseño (ninguno con `eslint-disable` ni `any`)

1. **G3:** `typeof res === 'object' && res !== null && 'message' in res` disparó
   `@typescript-eslint/no-unnecessary-condition` (`res !== null`): confirmado leyendo
   `node_modules/@nestjs/common/exceptions/http.exception.d.ts` que `getResponse(): string | object`, y
   el tipo `object` de TypeScript en modo estricto **excluye** `null`. Se quitó la comparación
   redundante; el comportamiento no cambia (T14/T15 y los 6 `it()` existentes siguen en verde).
2. **G5:** comparar `env: string` (de `process.env.NODE_ENV`, sin validar) contra un miembro del enum
   `NodeEnvironment` directo dispara `@typescript-eslint/no-unsafe-enum-comparison`; envolver el
   miembro en una plantilla literal (`` `${NodeEnvironment.Development}` ``) lo esquiva pero el hook
   `eslint --fix` de `PostToolUse` la simplifica de vuelta (`no-useless-template-literals`), y
   `String(NodeEnvironment.Development)` dispara a su vez `no-unnecessary-type-conversion` (el valor
   del enum ya es `string` en tiempo de compilación). Se resolvió con dos constantes de módulo
   (`DEVELOPMENT`, `TEST`) **anchadas explícitamente a `string` mediante anotación de tipo** (no
   conversión en runtime): `const DEVELOPMENT: string = NodeEnvironment.Development;`. Ninguna de las
   dos soluciones es un `eslint-disable`, un `any` ni una aserción de tipo (`as`); ambas son ajustes de
   tipado legítimos documentados con comentario al lado.

### 11.3. Verificación Nivel A (cierre, `npm run harness:verify`)

Una sola corrida en `[OK]` tras el trinquete de cobertura (no hizo falta iterar sobre fallos):

```
==> CHECK 3c - Trazabilidad criterio <-> test
[OK] Criterios con contrato: 19 en Nivel A (verificados en disco), 6 en Nivel B, 0 sin cobertura.
==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.
==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.
==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 53 archivo(s) (0 errores, 0 advertencias).
==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 17 passed, 17 total
Tests:       64 passed, 64 total
[OK] Pruebas en verde: 64/64 tests, 0 suite(s) rota(s).
==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 99.22%, sentencias 98.95%, funciones 97.82%, ramas 81.59%.
[BASELINE] 0 advertencias de deuda == baseline 0.
[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

**Trinquete de cobertura (Q9, aplicado en esta misma pasada):** medido 99.22 % líneas / 98.95 %
sentencias / 97.82 % funciones / 81.59 % ramas (holgura ≥ 4 puntos sobre el piso anterior 85/85/79/67
en los cuatro indicadores). Piso subido a **líneas 95 · sentencias 94 · funciones 93 · ramas 77** en
`feature_list.json → rules.cobertura_minima` y en `docs/verifications.md` §4 (tabla "Línea base
vigente" + fila nueva en "Histórico de la línea base"). Tras subir el piso, `npm run harness:verify`
se corrió de nuevo y siguió en `[OK]` sin el aviso `[INFO]` de holgura (el margen quedó por debajo de
los 5 puntos que dispararían una nueva subida).

**Advertencias de deuda vs. baseline vigente:** 0 == 0, sin cambios.

**"Optimizar" (criterio 3, §4.3 del diseño):** confirmado que esta feature no mejora rendimiento medible
(no hay N+1, no hay `await` en serie evitable, no hay índice faltante que agregar); mejora legibilidad,
tipado y ausencia de duplicación, demostrado por el gate y por la batería, no por una afirmación de
desempeño. `package.json`/`package-lock.json` no sumaron ninguna dependencia en esta sesión (el diff
frente a `HEAD` que muestra `git diff --stat` corresponde a cambios previos de las features #3/#5, ya
en el árbol de trabajo antes de que esta sesión empezara, no a algo introducido aquí); ancla
`framework-nestjs12.spec.ts` sigue en verde.

### 11.4. Nivel B completo (cierre, comparado contra la captura de partida P0b de §9)

Docker Desktop encendido durante toda la verificación.

| # | Caso | Resultado en el cierre | Comparación contra P0b |
|---|---|---|---|
| **B1** | `GET /api/` (`docker compose --profile app up -d --build --wait`) | `{"statusCode":200,"message":"OK","resource":{"msg":"Server is up and running"},"isError":false}` | **Idéntico byte a byte** a P0b. |
| **B2** | `npm run test:e2e:docker` | `Test Suites: 1 passed, 1 total` / `Tests: 6 passed, 6 total`; mismos 4 `error:` esperados en el log (401×3, 400×1) | **Idéntico** a P0b (6/6). |
| **B3** | Login + `GET /api/users/me` + `GET /api/users` con un usuario desechable sembrado directo en la base (`partida-b3-cierre`, hash bcrypt generado dentro del contenedor, sin secretos reales) | `POST /api/auth/login` → 200 con `resource.token`; `GET /api/users/me` → 200 con el mismo shape de campos (sin `password`); `GET /api/users` → 200, arreglo sin `password` ni `email` | **Misma forma** que P0b (usuario, IDs y timestamps distintos por ser una siembra nueva, como se espera). Usuario borrado al terminar (`DELETE FROM users WHERE username='partida-b3-cierre'`). |
| **B4** | `POST /api/users` sin `Authorization` | `{"statusCode":401,"message":"Unauthorized","isError":true}` | **Idéntico byte a byte** a P0b. |
| **B5** | Ciclo de invalidación de JWT | Automatizado dentro de B2 (`test/app.e2e-spec.ts`, caso de la #5) — en verde | Sin cambios (R1/R2 de esta feature no tocaron la lógica, solo movieron `JwtPayload` y extrajeron la constante de expiración). |
| **B6** | `POST /api/users` con campo no declarado → 400 | Automatizado dentro de B2 — en verde | Sin cambios. |
| **B7** | `GET /api/docs-json` | `paths`: `/api`, `/api/users/me`, `/api/users`, `/api/auth/login` (los mismos 4); `components.securitySchemes`: `{"access-token":{"scheme":"bearer","bearerFormat":"JWT","type":"http"}}` (mismo nombre); `components.schemas` ahora incluye `AuthResponseDto` y `HealthDto` además de los 4 ya existentes | **Diferencia esperada y documentada** (G2/G8 publican schema donde antes no había: el cable JSON no cambió, solo lo que Swagger documenta). Todo lo demás, idéntico. |
| **B8** | Provocar un 500 real (detener el contenedor `db` con un token/sesión ya autenticada e intentar login) y revisar la respuesta al cliente + `docker compose logs app` | Cliente: `{"statusCode":500,"message":"Internal server error","isError":true}` (sin detalle interno). Log: `error: POST /api/auth/login -> 500: relation "users" does not exist {...}` (método, ruta, status y el mensaje REAL del driver; sin cuerpo de la petición, sin contraseñas) | **Re-verificado explícitamente en esta fase** (no solo heredado de la #5) porque G3/G4/G5 tocaron exactamente `http-exception.filter.ts` y el logger: el comportamiento post-refactor es **idéntico** al documentado en el diseño y a la garantía de la feature #4. |
| **B9** | `\d users` | Mismas 10 columnas, mismos tipos, mismos 3 índices (`PK_...`, `UQ_users_email`, `UQ_users_username`) | **Idéntico** a P0b: ninguna columna nueva, renombrada ni eliminada. |

`docker compose --profile app down -v` al final de cada bloque de pruebas manuales; ningún contenedor
ni volumen quedó vivo al cerrar la sesión.

### 11.5. Documentación actualizada

- **`CLAUDE.md`** (Convenciones NestJS): se agregó la regla de idioma de identificadores (Q2, la
  decisión fue "se escribe la regla, no se renombra") y una línea sobre `@CurrentUser()`.
- **`docs/verifications.md` §4**: línea base vigente actualizada (piso, cobertura medida, motivo) y
  fila nueva en el histórico.
- **`feature_list.json`**: `status` → `"green"`; `rules.cobertura_minima` y `rules.cobertura_nota`
  actualizados en la misma pasada.
- **`README.md`**: revisado, sin cambios — ningún script, puerto, ruta pública ni estructura de
  carpetas de primer nivel cambió.
- **`.claude/agents/planner.md`**: revisado, sin cambios — ningún acoplamiento oculto **nuevo** salió a
  la luz en esta feature (los tocados, acoplamientos 1/2/3/4/5/7/9/11/12, ya estaban documentados y se
  siguieron tal cual; ver §10 de este documento).

### 11.6. Candidatos de backlog (NO se crean features; se deja constancia para que el `leader` los
registre en `progress/history.md`)

De §4.3 y §10 del diseño (Q3, Q7, Q8), ninguno se tocó en esta feature:

| Candidato | Disparador | Por qué queda fuera |
|---|---|---|
| `select` acotado en `UsersService.findById` (hoy trae la entidad completa, incluido el hash bcrypt, en cada petición autenticada vía `JwtStrategy.validate`) | **D6 + D3** | Exige cambiar la aserción existente `expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } })`; es decisión de diseño (qué columnas necesita cada guard futuro), no un ajuste de esta pasada (criterio de aborto §8.3). |
| Paginación de `GET /api/users` (hoy devuelve la tabla completa) | **D2** | Cambia el contrato de salida del endpoint. |
| Índices nuevos, `@Unique` adicionales, cambios de tipo de columna | **D4** | Cambio de esquema; sin carpeta de migraciones (`synchronize` solo fuera de producción), hay que decidir cómo llega a producción. |
| Atomicidad del login (si `jwtService.sign` fallara después de `updateLastTokenIssuedAt`, el usuario queda con tokens invalidados y sin token nuevo) | **D3** | Toca la regla de negocio crítica de invalidación de JWT; invertir el orden cambia un modo de falla por otro. |
| Límites de longitud en `AuthCredentialsDto` (`username` sin máximo; `password` solo `@MinLength(6)`, mientras `CreateUserDto` usa `@Length(6, 200)`) | **D2** | Agregar un máximo cambia qué peticiones se rechazan con 400 hoy. |

### 11.7. Estado final

`status: "green"` en `feature_list.json`. Gate Nivel A en `[OK]` sin tolerancias de fase RED (feature ya
no está en `red`). Nivel B completo (B1-B9) ejecutado y comparado contra la captura de partida P0b, con
una diferencia **esperada y documentada** (schemas nuevos de Swagger en B7). No se marca `done`: queda
para el veredicto del `reviewer`. No se hizo commit.
