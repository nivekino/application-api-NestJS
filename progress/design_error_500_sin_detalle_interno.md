# Diseño — Feature #4 `error_500_sin_detalle_interno`

> **HttpExceptionFilter no expone el mensaje interno de un `Error` no controlado en el 500.**
> Estado de la feature: **`pending`** (no se modificó `feature_list.json`).
> **Esperando "go" del usuario para pasar a la fase RED del `implementer`.**

## 1. Encabezado y alcance

- **Feature:** `#4 error_500_sin_detalle_interno` (`needs_design: true`, motivo **D5** + **D6**;
  `tdd: true`, `red_modo: nuevo`).
- **Origen del hallazgo:** `progress/review_pruebas_guard_401_y_formato_respuesta.md` §5.2 (reviewer de
  la feature #2, 2026-09-03), recogido en `docs/verifications.md` §4 → *"Hallazgos abiertos que NO son
  advertencias del gate"*. El implementer de la #2 no pudo corregirlo porque `red_modo: caracterizacion`
  prohíbe tocar producción.
- **Módulos afectados:** `src/common/` (transversal).

| Archivo | Qué pasa con él |
|---|---|
| `src/common/filters/http-exception.filter.ts` | **SÍ se toca** (único archivo de producción). Cambio acotado al método `catch`. |
| `src/common/filters/http-exception.filter.spec.ts` | **SÍ se toca**: 3 `it()` **nuevos**; los 3 existentes quedan **intactos**, palabra por palabra. |

**Qué NO toca (explícito):**

- `src/common/logger/winston.config.ts` — el formato de los transportes, la rotación y los niveles no
  cambian. Solo cambia **el texto** que el filtro le pasa a `logger.error(...)`.
- `src/common/interceptors/response.interceptor.ts` — la ruta de error no pasa por el interceptor; no
  hay riesgo de doble envoltura en este cambio.
- `test/app.e2e-spec.ts` — no se agrega caso e2e (provocar un 500 real de forma determinista exigiría
  un endpoint de prueba o apagar la base a media suite; se cubre como **Nivel B manual**, §8).
- `src/main.ts`, controllers, DTOs, entidades, `feature_list.json`, esquema, dependencias, variables de
  entorno. **Sin cambio de esquema (D4 no aplica): no hay pregunta de "cómo llega a producción".**

**Prerrequisito de secuencia (para el `leader`, no es parte del diseño técnico):** la regla
`una_feature_a_la_vez` sigue vigente y la feature **#2 está en `in_review`**. La #4 no puede pasar a
`red` hasta que la #2 quede `done` (o vuelva a un estado no activo).

## 2. Contrato confirmado (y PENDIENTES)

No hay endpoint nuevo ni cambio de ruta/verbo/DTO. Lo que cambia es **el valor del campo `message` del
cuerpo de error** en un único escenario, y **el texto que se escribe al log**.

### 2.1. Comportamiento por escenario (tabla de decisión)

| Excepción capturada por `@Catch()` | Hoy → cuerpo al cliente | **Después** → cuerpo al cliente | Hoy → `logger.error(...)` | **Después** → `logger.error(...)` |
|---|---|---|---|---|
| `HttpException` (`res` string) | `{ statusCode, message: <res>, isError: true }` | **igual** | `MÉTODO ruta -> status: <res>` | **igual** |
| `HttpException` (`res` objeto con `message` string), **incluida `InternalServerErrorException` 500** | `{ statusCode, message: <obj.message>, isError: true }` | **igual** | `... -> status: <obj.message>` | **igual** |
| `HttpException` con `message` array (class-validator) | `{ statusCode: 400, message: 'Validación fallida', resource: { errors }, isError: true }` | **igual** | `... -> 400: Validación fallida` | **igual** |
| **`Error` no HTTP** (rama `else if (exception instanceof Error)`) | `{ statusCode: 500, message: <exception.message>, isError: true }` ⚠️ **fuga D6** | `{ statusCode: 500, message: 'Internal server error', isError: true }` (**sin `resource`**) | `... -> 500: <exception.message>` | **igual** (`... -> 500: <exception.message>`) |
| Ni `HttpException` ni `Error` (string, objeto suelto, `null`) | `{ statusCode: 500, message: 'Internal server error', isError: true }` | **igual** | `... -> 500: Internal server error` | **igual** |

### 2.2. Firma exacta del texto del log (la fija la batería)

Se conserva la plantilla actual, cambiando **solo la fuente del último segmento**:

```
`${request.method} ${request.url} -> ${statusCode}: ${mensajeInterno}`
```

donde `mensajeInterno` es:

- `exception.message` cuando la excepción es `instanceof Error` y **no** es `HttpException`;
- el **mismo** `message` público en todos los demás casos (así el escenario "ni `HttpException` ni
  `Error`" sigue produciendo `POST /api/users -> 500: Internal server error`, que es exactamente lo
  que afirma el `it()` existente del criterio 4 de la feature #2).

Ejemplo literal que la batería fijará:
`POST /api/users -> 500: relation "users" does not exist`.

### 2.3. Confirmado vs. PENDIENTE

| Elemento | Estado |
|---|---|
| Forma del cuerpo `{ statusCode, message, resource?, isError: true }` (`interface ErrorBody`) | **Confirmado** en `http-exception.filter.ts`. No cambia. |
| Literal público `'Internal server error'` (en inglés, valor por omisión actual de la variable `message`) | **Confirmado** en el código y en el `it()` existente. Se conserva (ver §9, pregunta 1). |
| Plantilla del log `MÉTODO ruta -> status: mensaje` | **Confirmado** en el código y afirmado por el `it()` existente. |
| Filtro registrado como global (`@Catch()` sin argumentos, atrapa todo) | **Confirmado** por el decorador `@Catch()` y por su registro como filtro global. |
| ¿Se agrega `correlationId`/`errorId` a la respuesta para ligar 500 ↔ log? | **PENDIENTE de confirmar** — valor por omisión: **no** (§9, pregunta 2). |
| ¿Se registra el `stack` del `Error` en el log? | **PENDIENTE de confirmar** — valor por omisión: **no** (§9, pregunta 3). |

## 3. Precedente de la casa a ESPEJAR (no inventar)

**La propia rama de validación del filtro**, en `HttpExceptionFilter.catch`:

```ts
if (Array.isArray(obj.message)) {
  message = 'Validación fallida';
  resource = { errors: obj.message };
}
```

Ese es el precedente exacto de la casa: **el filtro reescribe el mensaje que sale al cliente en lugar
de propagar el crudo del framework**, con un literal fijo y controlado. La feature #4 aplica el mismo
patrón a la rama `instanceof Error`, con la diferencia de que ahí **no** se publica ningún `resource`
(el detalle no se degrada: se retira de la respuesta y se conserva en el log).

Precedente secundario a espejar: el **bloque JSDoc de seguridad Kata** que ya encabeza el archivo
(*"solo se registran método, ruta, status y mensaje. NUNCA se loguea el cuerpo de la petición…"*). Se
amplía con una línea, no se reescribe.

## 4. Desglose exacto del cambio

### 4.1. `src/common/filters/http-exception.filter.ts` (único archivo de producción)

Dentro de `catch(exception, host)`, se **desdobla la variable `message` en dos**:

| Variable | Destino | Valor inicial |
|---|---|---|
| `message` (existente) | **cuerpo de la respuesta** (`ErrorBody.message`) | `'Internal server error'` |
| `mensajeInterno` (nueva, `string`) | **solo el logger** | `'Internal server error'` |

- Rama `exception instanceof HttpException`: al final de la rama, `mensajeInterno = message` (los dos
  coinciden, incluido el caso de validación).
- Rama `else if (exception instanceof Error)`: **solo** `mensajeInterno = exception.message`. `message`
  **ya no se reasigna** y queda en el literal genérico; `resource` queda `undefined`.
- Sin rama `else`: el caso "ni `HttpException` ni `Error`" conserva ambos valores por omisión.
- La llamada al logger pasa a
  `` this.logger.error(`${request.method} ${request.url} -> ${statusCode}: ${mensajeInterno}`) ``.
- El objeto `body: ErrorBody` **no cambia de forma**: `resource` sigue siendo `undefined` en esta rama
  y `res.json()` (JSON.stringify) omite las claves `undefined`, de modo que **el cuerpo que viaja por
  el cable no lleva `resource`** — que es lo que exige el criterio 1. No se introduce construcción
  condicional del objeto (sería complejidad sin beneficio observable).
- **JSDoc:** agregar una línea al bloque de seguridad ya existente, del tipo *"El mensaje interno de una
  excepción no controlada va únicamente al log (diagnóstico, queda en disco); al cliente se le devuelve
  siempre el literal genérico."*

**No se agregan providers, decoradores de Swagger, imports nuevos ni dependencias.** No hay
`import type` que convertir (acoplamiento 12 no aplica: no se toca ninguna clase inyectada).

### 4.2. `src/common/filters/http-exception.filter.spec.ts`

Se **agregan** 3 `it()` al `describe('HttpExceptionFilter')` existente, reutilizando el
`beforeEach` y el helper `construirHost` que ya viven en el archivo. Los 3 `it()` existentes **no se
tocan** (criterio 4).

Notas de implementación para el `implementer` (no son el contrato, son la trampa conocida):

- Para afirmar que el cuerpo **que recibe el cliente** no trae `resource` ni el detalle interno,
  serializa y compara: `JSON.parse(JSON.stringify(<cuerpo capturado>))` y `toEqual({ statusCode: 500,
  message: 'Internal server error', isError: true })`. Comparar directo con `toHaveBeenCalledWith` no
  distingue la clave ausente de la clave con `undefined` (Jest las considera iguales), y el criterio 1
  habla de lo que sale por el cable.
- `json.mock.calls[0]?.[0]` es `any` bajo `strictTypeChecked` → `no-unsafe-*`. Tipa la captura (helper
  local con aserción a `[unknown]`, o `jest.fn()` tipado), **sin** `eslint-disable` ni `as any`.

## 5. Batería de tests (el plan de trabajo — esto es lo que se aprueba en la puerta humana)

**Archivo único:** `src/common/filters/http-exception.filter.spec.ts` · **Todos Nivel A** (Jest con
mocks tipados; no hay nada aquí que requiera PostgreSQL) · **`red_modo: nuevo`**.

| # criterio `acceptance` | `it()` — texto exacto | Nivel | Estado en RED |
|---|---|---|---|
| **1** — cuerpo sin detalle interno ni `resource` | `HttpExceptionFilter no expone el message interno de un Error no controlado: responde 500 con "Internal server error" y sin resource` | A | **FALLA en disco** (hoy devuelve `exception.message`) |
| **2** — el log conserva el mensaje real | `HttpExceptionFilter registra en el logger el message real del Error no controlado, sin el cuerpo de la petición` | A | pasa (fija comportamiento que **no debe** perderse con el cambio) |
| **3** — las `HttpException` conservan su `message` | `HttpExceptionFilter conserva el message de una HttpException lanzada a propósito, incluso cuando su status es 500` | A | pasa (regresión: impide "genericizar" por `statusCode === 500`) |
| **4** — los specs existentes siguen en verde | **ancla al `it()` ya existente**: `HttpExceptionFilter serializa una HttpException como { statusCode, message, isError: true }` | A | pasa (no se reescribe; se cita tal cual) |

### Contenido de cada caso

1. **Criterio 1.** `filter.catch(new Error('relation "users" does not exist en 10.0.0.7:5432'), host)`
   con `host` de `POST /api/users`. Afirma: `status` llamado con `500`; el cuerpo serializado
   `toEqual({ statusCode: 500, message: 'Internal server error', isError: true })` (sin `resource` y sin
   el texto interno); y `expect(JSON.stringify(cuerpo)).not.toContain('relation "users" does not exist')`.
2. **Criterio 2.** Mismo `Error`, con `body: { username: 'jdoe', password: 'Sup3rSecreta!' }` en el
   request (espeja el escenario sensible que ya usa el `it()` existente del criterio 4 de la feature #2).
   Afirma: `expect(logger.error).toHaveBeenCalledWith('POST /api/users -> 500: relation "users" does not
   exist')` y `expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Sup3rSecreta!'))`.
3. **Criterio 3.** `filter.catch(new InternalServerErrorException('Saldo no disponible en el core
   bancario'), host)` con `host` de `GET /api/users`. Afirma: `status` con `500`, cuerpo con
   `message: 'Saldo no disponible en el core bancario'`, y el log
   `'GET /api/users -> 500: Saldo no disponible en el core bancario'`. Este caso es el que distingue
   "500 lanzado a propósito por la app" de "500 por excepción no controlada": una implementación que
   mire el `statusCode` en vez del **tipo** de la excepción rompe justo aquí.
   *(Los errores de `class-validator` ya están cubiertos por el `it()` existente del criterio 3 de la
   feature #2, que no se toca.)*
4. **Criterio 4.** Sin `it()` nuevo: se declara como ancla el existente, palabra por palabra. El CHECK
   3c valida que ese texto exista en el archivo declarado, y el CHECK 6 valida que siga pasando.

### `tdd_contract` a copiar a `feature_list.json` (fase RED, lo escribe el `implementer`)

Cuatro entradas, todas con `"nivel": "A"` y
`"archivo": "src/common/filters/http-exception.filter.spec.ts"`, una por criterio, con los textos de la
tabla de arriba.

### Evidencia RED (CHECK 3d)

- `red_modo: **nuevo**`. La evidencia debe mencionar **ese único archivo**
  (`src/common/filters/http-exception.filter.spec.ts`) y contener el `FAIL` real del criterio 1
  mostrando el `message` interno recibido donde se esperaba `'Internal server error'`.
- El gate, con la feature en `red` y modo `nuevo`, **tolera fallos de typecheck, lint y jest sólo en los
  archivos del `tdd_contract`** (aquí: uno solo) y **exige al menos uno**
  (`docs/verifications.md` §1). Los criterios 2, 3 y 4 nacen en verde: eso es correcto y suficiente,
  porque la regla es "al menos uno falla", no "todos fallan". Un rojo en cualquier otro archivo es
  `[FAIL]`.
- La cobertura no se evalúa en `red` modo `nuevo`.

## 6. Acoplamientos y riesgos

De la lista de acoplamientos de `.claude/agents/planner.md`, aplican tres:

| # | Acoplamiento | Consecuencia concreta si se ignora |
|---|---|---|
| **4** | **`HttpExceptionFilter` global define la forma del error.** Está registrado con `@Catch()` sin argumentos: atrapa **todas** las excepciones de **todos** los endpoints. | Un cambio mal acotado (p. ej. genericizar por `statusCode === 500` en vez de por tipo) silencia mensajes legítimos de negocio en toda la API a la vez —incluidos los 4xx—, y ningún test de controller lo nota porque los controllers lanzan, no serializan. Lo blinda el criterio 3. |
| **9** | **Winston con rotación a archivo** (`winston.config.ts`): el transporte `error` escribe `./logs/error-%DATE%.log`, `zippedArchive`, `maxFiles: '30d'`. **Los logs no son efímeros.** | El mensaje interno que movemos al log **queda 30 días en disco**. Es una decisión consciente y aceptable (el `message` de un `Error` de driver/ORM es detalle técnico, no dato de cliente), pero obliga a que la batería fije que **el cuerpo de la petición nunca entra al log** (criterio 2): si mañana alguien "enriquece" el log con `request.body`, ahí quedarían contraseñas y datos de crédito en archivo, comprimidos y rotados. |
| **6 (D6)** | **Datos sensibles: el cambio redefine qué sale por la API y qué queda sólo en el log.** | Es el objeto mismo de la feature. Hoy un `QueryFailedError` de TypeORM devuelve al consumidor externo el SQL, el nombre de la tabla/columna y a veces el host — reconocimiento gratuito para un atacante en un dominio de banca de microcréditos. |

**Riesgo de contrato (no dispara D2, pero se declara):** la **forma** del cuerpo de error no cambia
(mismas claves, mismo `statusCode`), pero el **valor** de `message` en el escenario de 500 no controlado
sí. Un consumidor (app móvil, front) que hoy muestre `message` al usuario final pasará a ver el literal
genérico. Esto es intencional y es la mejora; se menciona para que quede en el registro de la feature.

**Acoplamientos que NO aplican y por qué:** 1 (JWT) — no se toca `auth`; 2 (`ValidationPipe`) — no se
toca ningún DTO, y la ruta de validación queda idéntica; 3 (`ResponseInterceptor`) — la ruta de error no
pasa por el interceptor, no hay doble envoltura; 5 (Swagger/`access-token`) — no hay endpoint nuevo; 6
(`synchronize`)/D4 — **no se toca el esquema**; 7 (entidad→DTO), 8 (bcrypt), 10 (CORS), 11 (TypeORM
1.x), 12 (metadatos de decoradores) — sin relación con el cambio.

## 7. Alternativa descartada

**(A) Exponer el `message` interno sólo fuera de producción (`NODE_ENV !== 'production'`).** Descartada:

1. Produce **comportamiento distinto por entorno** en el punto exacto donde el equipo depura: el modo de
   falla se valida en DEV con un cuerpo que en producción nunca existirá, y la ausencia del detalle se
   descubre justo cuando se necesita (durante un incidente).
2. El repo ya arrastra una bifurcación por `NODE_ENV` con consecuencias serias (`synchronize:
   NODE_ENV !== 'production'`); agregar una segunda hace que la respuesta a "¿qué devuelve la API?"
   dependa de una variable de entorno, y eso no se ve leyendo el controller.
3. En Kata, DEV/QA **no son entornos inocuos**: llevan datos de prueba de flujos de crédito y cobranza y
   son accesibles a más personas que producción.
4. Haría el spec dependiente de `process.env`, con fuga de estado entre pruebas y un `it()` que pasa o
   falla según cómo se corrió Jest.
5. **No aporta nada**: el diagnóstico ya queda íntegro en `logs/error-*.log`, que es su lugar.

**(B) Devolver un `errorId`/`correlationId` en el cuerpo y loguearlo junto al mensaje interno.** Es la
solución de largo plazo (permite que soporte ligue el 500 del cliente con la línea exacta del log), pero
**amplía el contrato público** (clave nueva en el cuerpo de error → D2) y exige generador de id y
posiblemente propagación por request. Fuera del alcance acotado de esta feature; se propone como
candidato de backlog (§9, pregunta 2).

## 8. Verificación (Definición de Hecho)

### Nivel A — `npm run harness:verify` en `[OK]`

Valores **leídos de `docs/verifications.md` §4** (medidos el 2026-09-03), no de memoria:

- **Advertencias de deuda = baseline vigente: `0`.** Este cambio **no** debe introducir ninguna.
- **Piso de cobertura (`rules.cobertura_minima`):** líneas **72** · sentencias **73** · funciones **66**
  · ramas **61**. Última medición del repo: líneas 75.59 · sentencias 76.37 · funciones 69.69 · ramas
  64.49.
- La batería nueva sube la cobertura de `http-exception.filter.ts` (hoy 91.66 % líneas / 83.33 % ramas
  según §3 de la revisión de la feature #2), previsiblemente al 100 %. **Trinquete:** si en la fase
  GREEN el gate informa holgura ≥ 5 puntos, se sube el piso en `feature_list.json` **y** en
  `docs/verifications.md` §4 **en la misma pasada**.
- CHECK 5 (build), 5b (typecheck src + test), 5c (lint `--max-warnings=0`, sin `eslint-disable` nuevos),
  6 (100 % de los tests), 3c (trazabilidad de los 4 criterios), 3d (evidencia RED creíble), 3e
  (`tdd: true`).
- Al cerrar: retirar el hallazgo de `docs/verifications.md` §4 → *"Hallazgos abiertos que NO son
  advertencias del gate"*, dejando constancia de que lo cerró la feature #4.

### Nivel B — manual, con la app arriba (**se declara en `progress/impl_error_500_sin_detalle_interno.md`**)

El Nivel A corre con mocks del `Response` de Express y del `LoggerService`: no prueba ni la
serialización real de `res.json()` ni que Winston escriba a disco. Casos concretos:

1. **Provocar un 500 real no controlado.** Con la app levantada contra el PostgreSQL de prueba
   (contenedor `postgres:17`, §1 de `docs/verifications.md`) y un token válido, detener el contenedor y
   llamar `GET /api/users`. El driver lanza un `Error` que no es `HttpException`.
   - **Respuesta esperada:** `500` con cuerpo **exactamente**
     `{"statusCode":500,"message":"Internal server error","isError":true}` — sin `resource`, sin nombre
     de tabla, sin host, sin puerto, sin SQL.
   - **Log esperado:** en `logs/error-<fecha>.log`, una entrada con
     `GET /api/users -> 500: <mensaje real del driver>` y **sin** cuerpo de la petición ni cabecera
     `Authorization`.
2. **No regresión de los errores legítimos, con la base arriba:** `POST /api/users` sin token → `401`
   con su `message` de siempre; `POST /api/users` con un campo no declarado en el DTO → `400`
   `'Validación fallida'` con `resource.errors`.
3. `npm run test:e2e` (`test/app.e2e-spec.ts`) sigue en verde contra PostgreSQL real.

⚠️ Requiere el Node de `.nvmrc` (24 LTS). Si no hay PostgreSQL/Docker en la máquina de la sesión, el
Nivel B **se declara con responsable asignado**, no se sustituye con mocks.

### Cobertura de los criterios de `acceptance`

| Criterio | Cubierto por |
|---|---|
| 1 — cuerpo sin `message` interno ni `resource` | Nivel A, `it()` del criterio 1 + Nivel B caso 1 |
| 2 — logger con método, ruta, status y `message` real, nunca el cuerpo | Nivel A, `it()` del criterio 2 + Nivel B caso 1 |
| 3 — `HttpException` conservan su `message` (incl. validación) | Nivel A, `it()` del criterio 3 + los `it()` existentes + Nivel B caso 2 |
| 4 — los specs existentes siguen en verde | Nivel A, CHECK 6 (los 3 `it()` existentes, sin modificar) |

## 9. Preguntas abiertas / decisiones a confirmar

Todas tienen valor por omisión; el `leader` puede proceder con él si el usuario no indica otra cosa.

1. **Literal público del 500.** ¿Se conserva `'Internal server error'` (inglés, como hoy) o se
   castellaniza a `'Error interno del servidor'`? — **Por omisión: se conserva `'Internal server
   error'`.** Cambiarlo tocaría el `it()` existente del criterio 4 de la feature #2 (que el criterio 4
   de esta feature exige mantener en verde) y alteraría lo que hoy ven los consumidores.
2. **`errorId`/`correlationId` en la respuesta** para que soporte ligue el 500 del cliente con la línea
   del log. — **Por omisión: no en esta feature** (amplía el contrato público, D2); se registra como
   candidato de backlog (alternativa B, §7).
3. **`stack` del `Error` en el log.** ¿Se agrega para diagnóstico? — **Por omisión: no.** Cambiaría el
   formato del log y llevaría rutas del servidor a un archivo que vive 30 días en disco; el `message`
   basta para el diagnóstico que motivó esta feature.

---

**Recordatorio de la regla de oro:** este diseño **no arranca la implementación**.
**Esperando "go" del usuario para pasar a la fase RED del `implementer`.** La feature #4 permanece en
`pending` y `feature_list.json` no fue modificado.
