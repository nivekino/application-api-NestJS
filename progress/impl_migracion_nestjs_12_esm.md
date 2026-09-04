# Implementación — #3 `migracion_nestjs_12_esm`

## 1. Feature y fase

- **Feature:** `#3 migracion_nestjs_12_esm` — Migrar el framework a NestJS 12 (paquetes ESM).
- **Fase:** RED (completada 2026-09-04, puerta humana aprobada el 2026-09-04) → **GREEN (completada
  2026-09-04)**. Ver la sección **11** en adelante para el detalle de la fase GREEN.
- **`red_modo`:** `nuevo` (el comportamiento no existe: los tres archivos nuevos fallan en disco).
- **Diseño seguido:** `progress/design_migracion_nestjs_12_esm.md` (autor: `planner`, 2026-09-03).
  Se sigue el desglose §4 (contrato del logger propio), la batería §5 con los `it()` exactos T1–T9, y
  el mapa `acceptance` ↔ `tdd_contract` de §5.5.
- **Precondición de secuencia (diseño §1):** la feature #2 (`pruebas_guard_401_y_formato_respuesta`)
  y la #4 (`error_500_sin_detalle_interno`) ya están `done` al momento de arrancar esta fase RED. No
  hay otra feature activa.
- **Punto de partida (G0):** `git rev-parse HEAD` → `c52e81161702654bcf2393602d9c9be9daec44f5`.

## 2. Batería de tests

| Criterio (`acceptance`) | `it()` — nombre exacto | Archivo | Nivel |
|---|---|---|---|
| 1 | `package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS` (T8) | `src/framework-nestjs12.spec.ts` | A |
| 1 (complemento) | Lo demuestra el propio gate en GREEN (build + typecheck + lint + jest sobre el árbol instalado en 12) + arranque manual `npm run start:dev` + `GET /api/`. El "sin `--legacy-peer-deps` ni `--force`" queda en la bitácora del `npm i` que se pegará en la fase GREEN. | — | B |
| 2 | `log delega en winston con nivel info y pasa el contexto de NestJS como metadato` (T1, representa T1–T6) | `src/common/logger/winston-logger.service.spec.ts` | A |
| 2 | `LoggerModule expone APP_LOGGER y HttpExceptionFilter se resuelve por DI sin nest-winston` (T7) | `src/common/logger/logger.module.spec.ts` | A |
| 2 (segunda mitad) | `HttpExceptionFilter convierte una excepción no HTTP en 500 "Internal server error" y registra solo método, ruta, status y mensaje (nunca el cuerpo de la petición)` (T9, regresión heredada de la feature #2, **no se escribe ni se modifica aquí**) | `src/common/filters/http-exception.filter.spec.ts` | A |
| 3 | `npm run test:e2e` contra PostgreSQL (base desechable) con el Node de `.nvmrc`. Un script no puede probar el ciclo completo contra PostgreSQL real. | — | B |
| 4 | Revisión documental del `reviewer` contra la lista de §8.3 del diseño (`CLAUDE.md`, `docs/verifications.md` §6, `.claude/agents/*.md`, `README.md`, `docs/01-plan-migracion.md`, etc.). | — | B |

Detalle de T1–T6 (todas viven en `winston-logger.service.spec.ts`, un `it()` cada una salvo T4 que
cubre dos métodos con un mismo camino de código):

| # | `it()` |
|---|---|
| T1 | `log delega en winston con nivel info y pasa el contexto de NestJS como metadato` |
| T2 | `error delega en winston con nivel error e incluye el stack que NestJS envia como segundo parametro` |
| T3 | `warn delega en winston con nivel warn` |
| T4 | `debug y verbose delegan en winston con sus niveles equivalentes` |
| T5 | `fatal se registra en winston con nivel error marcado como fatal` |
| T6 | `sin contexto registra solo el mensaje, sin metadatos adicionales` |

## 3. Evidencia RED

Corrida completa de `npm test`, **antes de escribir ningún código de producción**. Los tres archivos
nuevos de la batería (`winston-logger.service.spec.ts`, `logger.module.spec.ts`,
`framework-nestjs12.spec.ts`) fallan; el resto de la suite (incluida
`http-exception.filter.spec.ts`, la regresión heredada T9) sigue en verde.

```
> application-api-nestjs@0.1.0 test
> jest

FAIL src/common/logger/winston-logger.service.spec.ts
  ● Test suite failed to run

    Cannot find module './winston-logger.service' from 'common/logger/winston-logger.service.spec.ts'

      at Resolver._throwModNotFoundError (../node_modules/jest-resolve/build/index.js:1031:11)
      at Object.<anonymous> (common/logger/C:/Users/nivek/Desktop/application-api-NestJS/src/common/logger/winston-logger.service.spec.ts:2:1)

FAIL src/framework-nestjs12.spec.ts
  ● Plataforma NestJS 12 › package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS

    expect(received).toEqual(expected) // deep equality

    - Expected  -  1
    + Received  + 13

    - Array []
    + Array [
    +   "@nestjs/common@^11.2.3",
    +   "@nestjs/config@^4.0.4",
    +   "@nestjs/core@^11.2.3",
    +   "@nestjs/jwt@^11.0.2",
    +   "@nestjs/passport@^11.0.5",
    +   "@nestjs/platform-express@^11.2.3",
    +   "@nestjs/swagger@^11.4.7",
    +   "@nestjs/typeorm@^11.0.3",
    +   "@nestjs/cli@^11.0.24",
    +   "@nestjs/schematics@^11.1.0",
    +   "@nestjs/testing@^11.2.3",
    + ]

      at Object.<anonymous> (C:/Users/nivek/Desktop/application-api-NestJS/src/framework-nestjs12.spec.ts:32:26)

FAIL src/common/logger/logger.module.spec.ts
  ● Test suite failed to run

    Cannot find module './logger.module' from 'common/logger/logger.module.spec.ts'

      at Resolver._throwModNotFoundError (../node_modules/jest-resolve/build/index.js:1031:11)
      at Object.<anonymous> (common/logger/C:/Users/nivek/Desktop/application-api-NestJS/src/common/logger/logger.module.spec.ts:3:1)


Test Suites: 3 failed, 9 passed, 12 total
Tests:       1 failed, 26 passed, 27 total
Snapshots:   0 total
Time:        5.313 s
Ran all test suites.
```

**`http-exception.filter.spec.ts` — PASA (verde):** regresión heredada de la feature #2 (T9), no forma
parte del rojo de esta feature. Corrida aislada para dejarlo explícito:

```
npx jest src/common/filters/http-exception.filter.spec.ts

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        0.74 s, estimated 1 s
Ran all test suites matching src/common/filters/http-exception.filter.spec.ts.
```

Lectura de la evidencia:

- `winston-logger.service.spec.ts` y `logger.module.spec.ts` fallan por `error TS2307`/`Cannot find
  module` porque importan `./winston-logger.service`, `./logger.module` y `./logger.tokens`, que
  todavía no existen. Ese fallo de compilación/carga **es** el rojo (regla del rol: "si el test no
  compila porque el método no existe, ese fallo de compilación es el rojo").
- `framework-nestjs12.spec.ts` sí compila y corre, pero **falla en la aserción**: `package.json`
  todavía declara los `@nestjs/*` en la línea 11 (`^11.2.3`, `^11.0.2`, `^11.4.7`, `^11.0.3`,
  `^11.0.24`, `^11.1.0`), así que `desalineados` no es `[]`.
- Ningún test de la batería nueva pasó por accidente: los tres fallan por la razón exacta que el
  criterio afirma que hoy no se cumple.

## 4. Archivos modificados (fase RED)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/common/logger/winston-logger.service.spec.ts` | Nuevo | Batería T1–T6: mapeo de niveles Nest → winston (`log`→`info`, `error`→`error` con stack, `warn`, `debug`/`verbose`, `fatal`→`error` con `{ fatal: true }`) y la regla de seguridad de datos (sin contexto, sin metadato extra). Mock tipado `jest.Mocked<Pick<WinstonLike, 'log'>>`. |
| `src/common/logger/logger.module.spec.ts` | Nuevo | T7: compila `LoggerModule` real con `Test.createTestingModule`, sobreescribe `WinstonLoggerService` con un doble tipado (`jest.Mocked<Pick<LoggerService, 'log' \| 'error' \| 'warn'>>`) para no escribir en `./logs/`, y afirma que `HttpExceptionFilter` se resuelve por DI y que `module.get(APP_LOGGER)` es ese mismo doble. |
| `src/framework-nestjs12.spec.ts` | Nuevo | T8: lee `package.json` en disco, filtra las llaves `@nestjs/*` de `dependencies`+`devDependencies` y afirma que todas casan con `/^\^?12\./`; cierra con `expect(typeof Injectable).toBe('function')` sobre un import estático real de `@nestjs/common`. |
| `feature_list.json` | Modificado | Feature #3: `status` → `"red"`, `"red_modo": "nuevo"`, `tdd_contract` completo (7 entradas: 2 Nivel A + 1 Nivel B para el criterio 1, 3 Nivel A para el criterio 2, 1 Nivel B para el criterio 3, 1 Nivel B para el criterio 4), copiado de §5.5 del diseño. |
| `progress/current.md` | Modificado | Plan de la fase RED, batería, evidencia capturada, verificación del gate. |

No se tocó ningún archivo de producción: ni `src/common/logger/winston.config.ts`, ni
`src/common/filters/http-exception.filter.ts`, ni `src/app.module.ts`, ni `src/main.ts`, ni
`package.json`, tal como exige la fase RED del diseño (§1 "Qué SÍ toca" distingue explícitamente las
"Baterías nuevas" de las modificaciones puntuales, que son trabajo de GREEN).

## 5. Decisiones de implementación (fase RED)

1. **Un solo `it()` de la batería del logger se copió al `tdd_contract` (T1) representando T1–T6**,
   tal como indica el mapa §5.5 del diseño: el criterio 2 tiene múltiples entradas válidas en el
   contrato (el CHECK 3c del gate admite varias entradas con el mismo `criterio`), y T1 es la que se
   usa como ancla textual porque el resto (T2–T6) verifica el mismo contrato con distintos niveles.
2. **T9 se declaró en el `tdd_contract` sin tocar el archivo.** `http-exception.filter.spec.ts` ya
   existe (feature #2) y sigue en verde; se referencia tal cual, con nota explicando que es una
   regresión heredada.
3. **Los criterios 3 y 4 son Nivel B puro** (sin `test`/`archivo`), con la nota exacta que pidió el
   líder: para el criterio 3, `npm run test:e2e` contra PostgreSQL con el Node de `.nvmrc`; para el
   criterio 4, "revisión documental del reviewer".
4. **El criterio 1 tiene una entrada Nivel A (T8) y una Nivel B** (arranque real + `npm i` sin flags),
   porque "la app arranca... sin `--legacy-peer-deps` ni `--force`" no se puede demostrar solo con un
   test unitario: T8 ancla la mitad verificable en disco (versiones + `require(esm)` bajo Jest); el
   resto es Nivel B.
5. **Mocks tipados en las dos suites nuevas del logger:** `WinstonMock` como
   `jest.Mocked<Pick<WinstonLike, 'log'>>` y `LoggerDouble` como
   `jest.Mocked<Pick<LoggerService, 'log' | 'error' | 'warn'>>`, sin `any` ni `as jest.Mock`, siguiendo
   el precedente de `http-exception.filter.spec.ts`.
6. **No se creó ningún archivo de producción vacío para que los specs "casi" compilaran.** El fallo de
   `Cannot find module` es exactamente el rojo que exige la fase RED en modo `nuevo`.

## 6. Refactor aplicado con la batería en verde

No aplica: la fase RED no escribe código de producción, así que no hay refactor.

## 7. Desviaciones del diseño

Ninguna. Los tres archivos nuevos, sus `it()` y el `tdd_contract` siguen literalmente §5 y §5.5 del
diseño.

## 8. Verificación Nivel A (fase RED)

`npm run harness:verify` (feature en `red`, modo `nuevo`) terminó en `[OK]` (exit 0) en una sola
corrida, sin iteraciones, tolerando fallos de typecheck/lint/jest únicamente en los tres archivos
nuevos declarados en el `tdd_contract`. Salida real (checks 3–6b, con el detalle de Jest en medio):

```
==> CHECK 3 - feature_list.json
[OK] 4 feature(s) con estado valido (done=3, red=1).
[OK] Feature activa: #3 migracion_nestjs_12_esm [red].

==> CHECK 3b - Bandera needs_design
[OK] Todas las features estan clasificadas con needs_design.

==> CHECK 3c - Trazabilidad criterio <-> test
[OK] Criterios con contrato: 14 en Nivel A (verificados en disco), 3 en Nivel B, 0 sin cobertura.

==> CHECK 3d - Evidencia RED
[OK] 3 feature(s) tdd:true revisada(s).

==> CHECK 3e - TDD obligatorio
[OK] Todas las features son tdd:true (exentas legacy declaradas: 1).

==> CHECK 4 - Higiene de src/ y test/
[OK] 23 archivo(s) .ts de produccion sin codigo de depuracion.
[OK] 13 archivo(s) de prueba sin .only ni tests deshabilitados.

==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 39 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
FAIL src/common/logger/winston-logger.service.spec.ts
  ● Test suite failed to run

    Cannot find module './winston-logger.service' from 'common/logger/winston-logger.service.spec.ts'

      at Resolver._throwModNotFoundError (../node_modules/jest-resolve/build/index.js:1031:11)
      at Object.<anonymous> (common/logger/C:/Users/nivek/Desktop/application-api-NestJS/src/common/logger/winston-logger.service.spec.ts:2:1)

FAIL src/framework-nestjs12.spec.ts
  ● Plataforma NestJS 12 › package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS

    expect(received).toEqual(expected) // deep equality
    - Expected  -  1
    + Received  + 13
    - Array []
    + Array [
    +   "@nestjs/common@^11.2.3",
    +   "@nestjs/config@^4.0.4",
    +   "@nestjs/core@^11.2.3",
    +   "@nestjs/jwt@^11.0.2",
    +   "@nestjs/passport@^11.0.5",
    +   "@nestjs/platform-express@^11.2.3",
    +   "@nestjs/swagger@^11.4.7",
    +   "@nestjs/typeorm@^11.0.3",
    +   "@nestjs/cli@^11.0.24",
    +   "@nestjs/schematics@^11.1.0",
    +   "@nestjs/testing@^11.2.3",
    + ]

      at Object.<anonymous> (C:/Users/nivek/Desktop/application-api-NestJS/src/framework-nestjs12.spec.ts:32:26)

FAIL src/common/logger/logger.module.spec.ts
  ● Test suite failed to run

    Cannot find module './logger.module' from 'common/logger/logger.module.spec.ts'

      at Resolver._throwModNotFoundError (../node_modules/jest-resolve/build/index.js:1031:11)
      at Object.<anonymous> (common/logger/C:/Users/nivek/Desktop/application-api-NestJS/src/common/logger/logger.module.spec.ts:3:1)

Test Suites: 3 failed, 9 passed, 12 total
Tests:       1 failed, 26 passed, 27 total
Snapshots:   0 total
Time:        6.56 s
Ran all test suites.
Test results written to: coverage\harness\jest.json
[OK] Fase RED: 3 fallo(s) esperado(s) dentro de la bateria:
  src/common/logger/winston-logger.service.spec.ts (la suite no corrio: error de compilacion o de carga)
  src/framework-nestjs12.spec.ts -> "Plataforma NestJS 12 package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS"
  src/common/logger/logger.module.spec.ts (la suite no corrio: error de compilacion o de carga)

==> CHECK 6b - Cobertura minima
[INFO] Fase RED (nuevo): typecheck, lint y jest toleran fallos SOLO en los archivos del tdd_contract: src/framework-nestjs12.spec.ts, src/common/logger/winston-logger.service.spec.ts, src/common/logger/logger.module.spec.ts, src/common/filters/http-exception.filter.spec.ts.
[INFO] Fase RED: 3 error(es) de tipos en src/common/logger/logger.module.spec.ts (tolerado: es parte de la bateria en rojo).
[INFO] Fase RED: 2 error(es) de tipos en src/common/logger/winston-logger.service.spec.ts (tolerado: es parte de la bateria en rojo).
[INFO] Fase RED: 17 hallazgo(s) de lint en archivos de la bateria (tolerados).
[INFO] Fase RED: cobertura no evaluada (lineas 76.3%, sentencias 76.98%, funciones 69.69%, ramas 65.21%); se exige al pasar a green.

[BASELINE] 0 advertencias de deuda == baseline 0.

[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

Advertencias de deuda vs. baseline vigente (`docs/verifications.md` §4, `rules.baseline_advertencias`):
**0 == 0**, sin cambios (los 17 hallazgos de lint en los archivos nuevos son tolerados por estar dentro
del `tdd_contract` en fase RED y no cuentan como deuda). Cobertura: no se evalúa en fase RED modo
`nuevo` (CHECK 6b); el gate reporta de forma informativa 76.3/76.98/69.69/65.21%, medida sobre la
batería existente antes de que exista código nuevo de producción.

## 9. Prueba Nivel B

Pendiente de la fase GREEN, tal como define el ciclo (el Nivel B se declara y ejecuta en GREEN, contra
el árbol ya migrado a NestJS 12). Casos que quedarán pendientes de ejecutar, listados en el diseño §8.2
(B1–B7): arranque de la app, suite e2e completa, ciclo real de invalidación de JWT, Swagger publicado,
`ValidationPipe` intacto, el logger propio escribiendo en disco sin datos sensibles, y esquema sin
cambios. Por decisión del leader (§9 Q5 del diseño, valor por omisión "correrlo"), se ejecutará en la
fase GREEN levantando el contenedor `postgres:17` de `docs/verifications.md` §1; si el entorno no lo
permite en ese momento, se declarará explícitamente como pendiente asignado a una persona.

## 10. Acoplamientos revisados

De los acoplamientos ocultos de `.claude/agents/planner.md` que aplican a esta feature (diseño §6):
en esta fase RED no se tocó ningún código de producción, así que ninguno se "respetó" activamente
todavía. Los que la fase GREEN deberá atender explícitamente son los ocho listados en el diseño
(1 invalidación de JWT, 2 `ValidationPipe`, 3 `ResponseInterceptor`, 4 `HttpExceptionFilter`, 5 prefijo
`/api` y Swagger, 6 `synchronize` sin migraciones, 9 Winston con rotación a archivo, 12 metadatos de
decoradores vs. `import type`). El único que esta fase RED sí determina de antemano es el **9**: la
batería del logger (T6 en particular) fija por contrato que `WinstonLoggerService` nunca debe adjuntar
metadatos no solicitados, precisamente para que la implementación de GREEN no pueda "colarse" un
`JSON.stringify(message)` cómodo que termine escribiendo datos de cliente en `./logs/`.

---

# Fase GREEN

Puerta humana superada el **2026-09-04**. Punto de partida real al arrancar esta fase (verificado por
el leader antes de delegar): Node de la máquina ya en **24.20.0** (= `.nvmrc`), G0 del diseño cumplido.
**G1 y G2 del diseño (§4.5) ya estaban en el árbol de trabajo, sin commit, antes de que se registrara la
aprobación de la batería**: el logger propio (`WinstonLoggerService`, `LoggerModule`, `APP_LOGGER`) y el
cableado de `app.module.ts`/`main.ts`/`http-exception.filter.ts`/`winston.config.ts` ya usaban el logger
propio, y `nest-winston` ya no estaba en `package.json`, `package-lock.json` ni `node_modules`. Las dos
suites del logger pasaban en verde; solo `src/framework-nestjs12.spec.ts` seguía en rojo. Esta sección
documenta ese código heredado (11.1) y continúa desde G3 (11.2 en adelante).

## 11.1. G1/G2 — código ya presente al arrancar GREEN (documentado retroactivamente)

| Archivo | Estado al arrancar GREEN | Qué hace |
|---|---|---|
| `src/common/logger/logger.tokens.ts` | Nuevo (sin commit) | Exporta `APP_LOGGER = 'APP_LOGGER'`, el token de inyección del logger. |
| `src/common/logger/winston-logger.service.ts` | Nuevo (sin commit) | `WinstonLoggerService implements LoggerService`, con el método privado `escribir()` que centraliza el mapeo de niveles Nest → winston, la regla de contexto/stack y la normalización del mensaje (`message instanceof Error ? message.message : String(message)`, nunca `JSON.stringify`). |
| `src/common/logger/logger.module.ts` | Nuevo (sin commit) | `@Global() @Module` con el provider por fábrica (`useFactory: () => new WinstonLoggerService(winston.createLogger(buildWinstonOptions()))`) y `{ provide: APP_LOGGER, useExisting: WinstonLoggerService }`, exportando ambos. |
| `src/common/logger/winston.config.ts` | Modificado (sin commit) | Ya no importa `WinstonModuleOptions` de `nest-winston`; retorna `winston.LoggerOptions`. Transports, niveles y rotación sin cambios. |
| `src/common/filters/http-exception.filter.ts` | Modificado (sin commit) | `@Inject(APP_LOGGER)` en vez de `@Inject(WINSTON_MODULE_NEST_PROVIDER)`; el tipo del parámetro sigue siendo `LoggerService` (no la clase concreta), tal como exige §2 regla 6 del diseño para no romper el spec de la feature #2. |
| `src/app.module.ts` | Modificado (sin commit) | `LoggerModule` en `imports` en vez de `WinstonModule.forRoot(buildWinstonOptions())`. |
| `src/main.ts` | Modificado (sin commit) | `app.useLogger(app.get(WinstonLoggerService))` en vez de `app.get(WINSTON_MODULE_NEST_PROVIDER)`; `setDescription` ya decía "NestJS 12". |

Verificado en disco al leer el código (no se modificó nada de esta lista durante la fase GREEN): coincide
literalmente con el contrato de `logger.tokens.ts`/`winston-logger.service.ts`/`logger.module.ts` del
diseño §4.1–§4.3 y con las modificaciones puntuales de §4.4. `grep -r "nest-winston" src/ test/` → 0
resultados. Las suites `winston-logger.service.spec.ts` (T1–T6) y `logger.module.spec.ts` (T7) pasaban
en verde antes de tocar nada más.

## 11.2. G3 — instalar `@nestjs/*` 12

**El plan de dos comandos separados del diseño (§4.5, uno para `dependencies` y otro para
`devDependencies`) no fue viable.** Se intentó en el orden propuesto y también invertido, y ambos
terminaron en `ERESOLVE` real (no cosmético): mientras `@nestjs/testing`/`@nestjs/cli`/`@nestjs/schematics`
seguían declarados en `^11.2.3`/`^11.0.24`/`^11.1.0` en `package.json`, su peer sobre
`@nestjs/core`/`@nestjs/common` chocaba con la mitad del árbol ya en 12. Esto no es un desvío de
alcance: es que la premisa "npm resuelve el árbol una vez por grupo" no se sostiene cuando los dos
grupos son mutuamente interdependientes por peers.

Bitácora real (sin `--legacy-peer-deps` ni `--force`, tal como exige el criterio 1 de `acceptance`):

```
$ npm i "@nestjs/common@^12.0.1" "@nestjs/core@^12.0.1" "@nestjs/platform-express@^12.0.1" "@nestjs/config@^12.0.0" "@nestjs/jwt@^12.0.1" "@nestjs/passport@^12.0.0" "@nestjs/swagger@^12.0.1" "@nestjs/typeorm@^12.0.1"
npm error code ERESOLVE
npm error ERESOLVE could not resolve
... (conflicto real: @nestjs/testing@11.2.3 exige peer @nestjs/core ^11.0.0, y la raiz pide @nestjs/core@^12.0.1)

$ npm i -D "@nestjs/testing@^12.0.1" "@nestjs/cli@^12.0.0" "@nestjs/schematics@^12.0.0"   # orden invertido, mismo resultado
npm error ERESOLVE unable to resolve dependency tree
npm error peer @nestjs/common@"^12.0.0" from @nestjs/testing@12.0.1 ... Found: @nestjs/common@11.2.3
```

**Resolución:** un solo `npm i` con los once paquetes a la vez (todavía sin flags prohibidos), y luego
se corrigió a mano en `package.json` a qué sección (`dependencies` vs. `devDependencies`) pertenece cada
uno — porque `npm i pkg1 pkg2 -D` con paquetes mezclados los manda **todos** a `devDependencies`, lo que
habría dejado el runtime (`@nestjs/common`, `@nestjs/core`, etc.) fuera de una instalación de producción
(`npm ci --omit=dev`). Tras corregir el `package.json`, `npm install` (sin argumentos) resincronizó
`package-lock.json` sin volver a tocar el árbol:

```
$ npm i "@nestjs/common@^12.0.1" ... "@nestjs/testing@^12.0.1" "@nestjs/cli@^12.0.0" "@nestjs/schematics@^12.0.0" -D --save
added 22 packages, removed 59 packages, changed 52 packages, and audited 727 packages in 21s
found 0 vulnerabilities
# (sin ERESOLVE; los ocho paquetes de runtime quedaron temporalmente en devDependencies, corregido a mano)

$ npm install
up to date, audited 727 packages in 2s
found 0 vulnerabilities
# (sin ERESOLVE, tras mover @nestjs/common/core/jwt/passport/platform-express/swagger/typeorm/config
#  de vuelta a "dependencies" en package.json)
```

Verificación de deduplicación:

```
$ npm ls @nestjs/common @nestjs/core @nestjs/testing typescript
application-api-nestjs@0.1.0
+-- @nestjs/cli@12.0.0
|   `-- typescript@6.0.3 deduped
+-- @nestjs/common@12.0.1
+-- @nestjs/core@12.0.1
|   `-- @nestjs/common@12.0.1 deduped
... (todas las entradas de @nestjs/common y @nestjs/core deduplican a 12.0.1; typescript deduplica a 6.0.3)
+-- @nestjs/testing@12.0.1
|   +-- @nestjs/common@12.0.1 deduped
|   `-- @nestjs/core@12.0.1 deduped
```

Ninguna copia duplicada de `@nestjs/common`, `@nestjs/core` ni `typescript` en el árbol.

## 11.3. G3b — P2: `@nestjs/config` 12 y `validate:`

`node_modules/@nestjs/config/dist/interfaces/config-module-options.interface.d.ts` declara:

```ts
validate?: (config: Record<string, any>) => Record<string, any>;
```

**P2 confirmado a favor:** sigue aceptando una función simple. `src/app.module.ts` (`ConfigModule.forRoot({
isGlobal: true, validate: validateEnv })`) y `src/config/env.validation.ts` no cambiaron. No hizo falta
el plan B de Standard Schema ni agregar Zod/Valibot (Q3 del diseño no se activó).

## 11.4. G4 — P3: una sola copia de TypeScript

`npm ls typescript` (ver 11.2) confirma una sola copia `6.0.3`, deduplicada. `npm info @nestjs/cli@12.0.0
dependencies.typescript` devuelve `~6.0.2`: el propio CLI ya trae una dependencia de TypeScript
compatible con la raíz (`~6.0.3` satisface `~6.0.2`... en realidad es al revés: la raíz fija `~6.0.3` y
el CLI pide `~6.0.2`, y `6.0.3` satisface `~6.0.2`), así que el `overrides` de `package.json` **ya no es
estrictamente necesario** para evitar una copia anidada — pero es **inocuo** (fuerza exactamente la
versión que la deduplicación ya elegiría) y se **conserva** tal como anticipaba el diseño en G4 para no
depender de que un futuro cambio de versiones vuelva a producir una copia anidada silenciosamente.

## 11.5. G5 — P1: `nest build`

```
$ npm run build
> nest build
(sin salida de error)
$ Test-Path dist/main.js
True
```

**P1 confirmado a favor:** `nest build` (CLI 12.0.0) corre sin problema en Node 24.20.0 y `dist/main.js`
queda en la raíz de `dist/`. No hizo falta el plan B (`tsc -p tsconfig.build.json`). Nota de medición
para `docs/verifications.md` §6: `@nestjs/cli@12.0.0` declara `engines.node: ">= 20.11"` en su propio
`package.json` — más laxo que el `>= 24.15` que asumía el diseño (C7) para `nest new/generate/upgrade`.
No se encontró evidencia de que `nest build` en particular exija 24.15; aun así, se aplicó la
recomendación de Q1 (engines del repo a `>=24.15.0`) como decisión de plataforma propia, no como
requisito duro medido del CLI.

## 11.6. G6 — `require(esm)` bajo Jest: hallazgo no anticipado

Paso 1 del diseño (aislado, en el Node de la máquina, sin Jest):

```
$ node -e "console.log(typeof require('@nestjs/common').Injectable)"
function
```

Paso 2 (spec mínimo bajo Jest, **sin** ninguna bandera adicional):

```
$ npx jest src/app.controller.spec.ts
FAIL src/app.controller.spec.ts
  ● Test suite failed to run
    Must use import to load ES Module: .../node_modules/@nestjs/testing/index.js
    ... Use Node v24.9+ where Jest supports require(esm) natively ...
```

**Esto contradice el supuesto C6 del diseño tal como estaba escrito** ("Jest 30.5.1 soporta `require()`
de módulos ES en `jest-runtime` con Node ≥ 24.9"): la máquina ya corre Node 24.20.0 (≥ 24.9) y aun así
Jest rechazó el `require(esm)`. Investigación en
`node_modules/jest-runtime/build/index.js`: `jest-runtime` solo toma la rama de `require(esm)` nativo si
`vm.SourceTextModule` existe (`supportsSyncEvaluate = typeof vm.SourceTextModule?.prototype.hasAsyncGraph
=== 'function'`), y esa API de `node:vm` está **detrás de la bandera experimental
`--experimental-vm-modules`** — Node no la expone por defecto en ninguna versión 24.x:

```
$ node -e "console.log(typeof require('vm').SourceTextModule)"
undefined
$ node --experimental-vm-modules -e "console.log(typeof require('vm').SourceTextModule)"
function
$ $env:NODE_OPTIONS="--experimental-vm-modules"; npx jest src/app.controller.spec.ts
Test Suites: 1 passed, 1 total
```

Esto **no** es uno de los criterios de aborto del diseño (§7.1: "Jest no puede cargar `@nestjs/common`
... con Node 24.20.0 y Jest 30.5.1" describe justamente este síntoma, pero la causa tiene solución
documentada por Node/Jest, no es una incompatibilidad sin salida). La solución es la bandera oficial de
Node para exponer `vm.SourceTextModule`/`vm.SyntheticModule`, la misma que la documentación de Jest cita
para su soporte de ESM. Se aplicó **sin agregar dependencias nuevas** (no se instaló `cross-env`, para no
disparar un D9 no planeado por un detalle de invocación): se cambiaron los scripts `test`, `test:watch`,
`test:cov`, `test:debug` y `test:e2e` de `package.json` para invocar
`node --experimental-vm-modules node_modules/jest/bin/jest.js ...` en vez de `jest`/`npx jest` a secas —
mismo patrón que ya usaba `test:debug` para sus propias banderas de Node (`--inspect-brk`,
`-r tsconfig-paths/register`) — y se aplicó el mismo cambio al `CHECK 6` de `scripts/harness/verify.mjs`.
Esto es portable entre shells (PowerShell/cmd/bash) porque no depende de sintaxis de variable de entorno
inline, que difiere entre ellos.

Con el fix, la batería completa (paso 3 del diseño) pasa:

```
$ npm test
> node --experimental-vm-modules node_modules/jest/bin/jest.js
Test Suites: 1 failed, 11 passed, 12 total
Tests:       2 failed, 32 passed, 34 total
```

Quedó **un** fallo real, no relacionado con `require(esm)`: `src/users/users.controller.spec.ts` (feature
#1, fuera del `tdd_contract` de esta feature) — ver 11.7.

## 11.7. Fallo colateral fuera del `tdd_contract`: `users.controller.spec.ts`

```
● UsersController - GET /users/me › getMe devuelve el DTO del usuario autenticado sin campo password
  Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument
  AuthModuleOptions at index [0] is available in the RootTestModule module.
```

**Causa:** a partir de NestJS 12, `Test.createTestingModule({ controllers: [UsersController], ... }).compile()`
instancia también los guards declarados con `@UseGuards()` a nivel de clase (en NestJS 11 se resolvían
de forma perezosa solo al ejecutar una petición HTTP real a través de la app completa). `JwtAuthGuard`
(`AuthGuard('jwt')` de `@nestjs/passport`) exige `AuthModuleOptions` en su constructor, y ese spec no
registra `AuthModule` a propósito: no ejercita el guard (eso ya lo cubre, por metadato,
`users.controller.guard.spec.ts`, sin compilar módulo alguno), solo llama `controller.getMe(req)`
directamente.

**Esto no es un criterio de aborto** (§7.1 del diseño): no exige reescribir `JwtStrategy` ni los DTOs,
es un ajuste puntual y estándar de la propia API de testing de NestJS. **Fix aplicado** (código mínimo,
no de producción): se agregó `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` a la
construcción del `TestingModule` en `src/users/users.controller.spec.ts`, con un comentario que explica
el porqué del cambio de comportamiento entre versiones. Tras el fix, la batería completa queda en verde
(34/34, 12/12 suites) — ver 11.9.

> ⚠️ **Nota del 2026-09-04 (feature #5, `arranque_real_port_y_guard_passport12`): el diagnóstico de
> "Causa" de arriba es INCORRECTO.** `createInstancesOfInjectables` no es nueva en NestJS 12; los
> guards de clase ya se instanciaban en `compile()` en versiones anteriores, así que "a partir de
> NestJS 12, `compile()` instancia también los guards" no explica el defecto. La causa real,
> investigada leyendo `node_modules/@nestjs/core/injector/injector.js` y
> `node_modules/@nestjs/passport/dist/auth.guard.js`: `JwtAuthGuard` (subclase de
> `AuthGuard('jwt')`) **hereda** el `design:paramtypes` del mixin porque el injector lo lee con
> `Reflect.getMetadata` (camina la cadena de prototipos), pero **no hereda** el `optional:paramtypes`
> porque esa lectura usa `Reflect.getOwnMetadata` (solo la clase propia). Una dependencia
> **opcional** del mixin (`AuthModuleOptions`) se vuelve **obligatoria** en la subclase — con
> cualquier versión de NestJS que tenga esa misma asimetría en el injector, no solo la 12. Detalle
> completo en `progress/design_arranque_real_port_y_guard_passport12.md` §3 y acoplamiento 13 de
> `.claude/agents/planner.md`. El `.overrideGuard` descrito arriba **se retiró** en la feature #5: la
> corrección definitiva fue darle a `JwtAuthGuard` su propio constructor (`super({ defaultStrategy:
> 'jwt' })`), sin necesitar `AuthModuleOptions` en `UsersModule`. Se deja el diagnóstico original sin
> borrar porque documentar un error y su corrección es más útil que reescribir la historia.

## 11.8. G7 — typecheck y lint

```
$ npm run typecheck
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p test/tsconfig.json
(sin salida: 0 errores)

$ npm run lint:check
> eslint . --max-warnings=0
(sin salida: 0 errores, 0 advertencias)
```

Ningún ajuste de tipos fue necesario más allá del fix puntual de 11.7 (que ni siquiera es un ajuste de
tipos, es de comportamiento de testing). No se disparó el criterio de aborto de tipos del diseño §7.1.

## 11.9. G6 (cont.) — batería completa en verde

```
$ npm test
> node --experimental-vm-modules node_modules/jest/bin/jest.js
Test Suites: 12 passed, 12 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        6.31 s
```

## 11.10. `npm run harness:verify` con la feature en `green`

Tras confirmar la batería completa en verde, se cambió `feature_list.json` → feature #3 `status`:
`"red"` → `"green"` (el gate exige esto explícitamente: con la batería 100% verde y la feature todavía
en `red`/`nuevo`, CHECK 6b lo marca como error — "o el test no prueba lo que crees, o el comportamiento
ya existía" — porque una batería verde en `red`/`nuevo` no es TDD).

```
==> CHECK 1 - Archivos base del harness
[OK] Los 24 archivos base existen.
==> CHECK 1b - Toolset de los subagentes
[OK] Toolsets revisados: 4 agente(s).
==> CHECK 2 - Version de Node
[OK] Node 24.20.0 (piso: 24 LTS; acordado en .nvmrc: 24.20.0).
==> CHECK 3 - feature_list.json
[OK] 4 feature(s) con estado valido (done=3, green=1).
[OK] Feature activa: #3 migracion_nestjs_12_esm [green].
==> CHECK 3b - Bandera needs_design
[OK] Todas las features estan clasificadas con needs_design.
==> CHECK 3c - Trazabilidad criterio <-> test
[OK] Criterios con contrato: 14 en Nivel A (verificados en disco), 3 en Nivel B, 0 sin cobertura.
==> CHECK 3d - Evidencia RED
[OK] 3 feature(s) tdd:true revisada(s).
==> CHECK 3e - TDD obligatorio
[OK] Todas las features son tdd:true (exentas legacy declaradas: 1).
==> CHECK 4 - Higiene de src/ y test/
[OK] 26 archivo(s) .ts de produccion sin codigo de depuracion.
[OK] 13 archivo(s) de prueba sin .only ni tests deshabilitados.
==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.
==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.
==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 42 archivo(s) (0 errores, 0 advertencias).
==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 12 passed, 12 total
Tests:       34 passed, 34 total
[OK] Pruebas en verde: 34/34 tests, 0 suite(s) rota(s).
==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 80.08%, sentencias 80.45%, funciones 76.19%, ramas 67.97%.
[INFO] Cobertura con holgura >= 5 puntos ... sube el piso (trinquete) en feature_list.json y docs/verifications.md seccion 4.
[BASELINE] 0 advertencias de deuda == baseline 0.
[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

**G8 — trinquete de cobertura aplicado en la misma pasada:** holgura ≥ 5 puntos en las cuatro métricas
(80.08-72=8.08, 80.45-73=7.45, 76.19-66=10.19, 67.97-61=6.97). Piso subido en `feature_list.json →
rules.cobertura_minima` y en `docs/verifications.md` §4: líneas 72→**76**, sentencias 73→**76**,
funciones 66→**72**, ramas 61→**64**. Re-verificado: sin el `[INFO]` de holgura, `[OK]` limpio.

## 11.11. Archivos modificados (fase GREEN, además de 11.1)

| Archivo | Acción | Descripción |
|---|---|---|
| `package.json` | Modificado | `@nestjs/*` 11→12 (common/config/core/jwt/passport/platform-express/swagger/typeorm en `dependencies`; cli/schematics/testing en `devDependencies`); `engines.node` `>=24.11.0`→`>=24.15.0` (Q1 del diseño); scripts `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` invocan `node --experimental-vm-modules node_modules/jest/bin/jest.js` en vez de `jest` a secas. |
| `package-lock.json` | Regenerado | Por `npm i`/`npm install` (sin `--legacy-peer-deps` ni `--force`). |
| `scripts/harness/verify.mjs` | Modificado | CHECK 6 invoca `node --experimental-vm-modules node_modules/jest/bin/jest.js ...` en vez de `npx jest ...`, con comentario explicando por qué (`vm.SourceTextModule` detrás de la bandera experimental). |
| `src/users/users.controller.spec.ts` | Modificado | `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` en la construcción del `TestingModule`, con comentario del cambio de comportamiento de NestJS 12 (11.7). No es parte del `tdd_contract` de esta feature; es un fix colateral necesario para que Nivel A pase completo. |
| `feature_list.json` | Modificado | Feature #3 `status`: `red`→`green`; `rules.cobertura_minima` subido (trinquete, G8); `rules.cobertura_nota` con la medición del 2026-09-04; `description` del proyecto ("NestJS 11"→"NestJS 12"). |
| `docs/verifications.md` | Modificado | §4 (línea base + histórico de cobertura), §5 (5.3: cierre de la prueba negativa "spec que no compila" con la fase RED real de esta feature), §6 (puntos 1, 3, 5 reescritos con los hallazgos P1/P2/P3 y el hallazgo no anticipado de `--experimental-vm-modules`; punto 8 apunta a este documento para el Nivel B). |
| `CLAUDE.md` | Modificado | "Stack vigente" → NestJS 12.0.1 + nota CommonJS/`require(esm)`; sección *Verificación*: el punto "NestJS 11.2, no 12" reemplazado por el estado real (ESM puro, CommonJS del lado del repo, `--experimental-vm-modules`); `engines` a `>=24.15.0`. |
| `README.md` | Modificado | Título (NestJS 11→12), nota CommonJS/ESM, piso de Node en la tabla de requisitos. |
| `docs/README.md` | Modificado | Línea de encabezado (NestJS 11→12.0.1). |
| `docs/01-plan-migracion.md` | Modificado | Título genérico (sin fijar versión, documento histórico); fila de Winston en la tabla de mapeo actualizada (`nest-winston`→`WinstonLoggerService` propio). |
| `.claude/agents/planner.md` | Modificado | Header (NestJS 11.2→12.0.1); acoplamiento 9 reescrito (logger propio, ya no `nest-winston`); acoplamiento 12 ampliado (CommonJS a propósito bajo NestJS 12 ESM). |
| `.claude/agents/leader.md` | Modificado | Header (NestJS 11.2→12.0.1). |
| `.claude/agents/reviewer.md` | Modificado | Header (NestJS 11.2→12.0.1). |
| `.claude/agents/implementer.md` | Modificado | Header (NestJS 11.2→12.0.1). |

Esta feature no editó `docs/checkpoints/*` (histórico, fuera del alcance por regla explícita de
`CLAUDE.md`). El único cambio que `git diff` muestra ahí (`CP-05-cross-cutting.md`, "Seguridad Kata" →
"Seguridad de datos") lo hizo el leader el 2026-09-04 como parte de la limpieza de marca registrada en
`progress/history.md`, fuera de esta feature (Hallazgo A del reviewer). No se reintrodujo ninguna
mención a "Kata"/"Kata Software"/"Formiik" en ningún archivo tocado.

## 11.12. Decisiones de implementación (fase GREEN)

1. **El `npm i` en dos comandos por grupo del diseño no era viable** (11.2): se documentó la bitácora
   real de ambos intentos fallidos (orden propuesto e invertido) antes de resolver con un solo `npm i`
   de los once paquetes y la corrección manual de qué sección de `package.json` le corresponde a cada
   uno. No se usó `--legacy-peer-deps` ni `--force` en ningún momento (criterio 1 de `acceptance`).
2. **`--experimental-vm-modules` es un hallazgo no anticipado por el diseño** (C6 estaba incompleto, no
   equivocado: Node 24.9+ es condición necesaria pero no suficiente). Se resolvió con la bandera oficial
   de Node/Jest, sin agregar dependencias (`cross-env` no se instaló), reutilizando el patrón que
   `test:debug` ya usaba para pasar flags a `node` directamente en vez de a través de sintaxis de shell.
3. **El `overrideGuard` en `users.controller.spec.ts` es el único cambio a un spec fuera del
   `tdd_contract`** de esta feature, y es obligatorio para que Nivel A pase completo: NestJS 12 cambió
   cuándo se instancian los guards declarados por decorador durante `.compile()`. Se documentó el
   porqué en el propio spec y aquí, para que quede trazable como efecto colateral de la migración y no
   como un cambio de comportamiento de negocio.
4. **El `overrides` de `@nestjs/cli`/TypeScript se conservó** (11.4) aunque ya no es estrictamente
   necesario, porque es inocuo y evita depender de que la deduplicación de npm siga eligiendo la copia
   correcta en instalaciones futuras — decisión explícita del diseño en G4.
5. **`engines.node` subió a `>=24.15.0`** (Q1, valor por omisión "sí"), aunque la medición real muestra
   que `@nestjs/cli@12.0.0` solo declara `>=20.11` en su propio `package.json`: es una decisión de
   plataforma propia (alinearse con la única combinación completamente confirmada), no una exigencia
   dura descubierta en esta pasada. Se documentó la discrepancia con el supuesto C7 del diseño en
   `docs/verifications.md` §6.
6. **El piso de cobertura subió por trinquete** (G8): holgura ≥ 5 puntos en las cuatro métricas tras
   sumar el logger propio (~40 líneas cubiertas al 100 % por T1–T6) y el resto de la batería con
   NestJS 12 en disco. Subido en `feature_list.json` y `docs/verifications.md` §4 en la misma pasada.
7. **No se tocó ninguna regla de negocio crítica**: `JwtStrategy`, `PasswordService` (bcrypt salt 10),
   el formato de respuesta estándar, el prefijo `/api`, ni el esquema (TypeORM sigue en `1.1.1`). El
   único cambio de comportamiento observado fue el de instanciación de guards en testing (11.7), que es
   de la API de pruebas de NestJS, no de la aplicación en sí.

## 11.13. Refactor aplicado con la batería en verde

No se aplicó refactor adicional más allá de los cambios ya descritos (fix del `overrideGuard`, ajuste de
scripts de Jest): el código de producción del logger (G1/G2) ya estaba limpio al llegar a esta fase, y
el resto de los cambios de GREEN son de configuración/dependencias, no de diseño interno.

## 11.14. Desviaciones del diseño (fase GREEN)

| Punto del diseño | Desviación | Motivo |
|---|---|---|
| §4.5 G3, comandos en dos grupos separados | Se ejecutó como **un solo** `npm i` con los once paquetes, seguido de una corrección manual de secciones en `package.json` y un `npm install` de resincronización | El plan de dos comandos producía `ERESOLVE` real en cualquier orden (11.2): los paquetes de `devDependencies` (`@nestjs/testing`/`cli`/`schematics`) y los de `dependencies` son mutuamente interdependientes por peers, así que no se pueden actualizar en dos pasos independientes cuando ambos grupos cambian de versión mayor a la vez |
| C6 del diseño (§2, tabla de contrato) | Confirmado parcialmente: Node ≥ 24.9 es necesario pero no suficiente; además hace falta `--experimental-vm-modules` | Hallazgo de esta fase (11.6), no estaba en el diseño. Se corrigió sin desviarse del alcance (sin dependencias nuevas, sin tocar producción) |
| `users.controller.spec.ts` (fuera del §1 "Qué SÍ toca" del diseño) | Se modificó este spec, que el diseño no listaba | Efecto colateral real de NestJS 12 sobre la API de testing (11.7), necesario para que Nivel A pase completo; no es un cambio de alcance de negocio |
| Q1 (piso de Node) | Se aplicó el valor por omisión (`>=24.15.0`) aunque la medición muestra que el CLI 12 solo exige `>=20.11` en su `package.json` | Documentado como decisión de plataforma explícita, no como hallazgo técnico forzoso (11.5, `docs/verifications.md` §6 punto 1) |

## 11.15. Verificación Nivel A (fase GREEN)

`npm run harness:verify` → **`[OK]`** (exit 0), con la feature en `green`. Iteraciones: la primera
corrida completa (tras G3–G7) dio `[OK]` con `[INFO]` de holgura de cobertura; tras subir el piso
(G8) y volver a correr, `[OK]` limpio, sin `[INFO]` de holgura. Detalle completo de ambas corridas en
11.10.

- **Build:** `[OK]`.
- **Typecheck:** `[OK]`, 0 errores fuera de la fase RED (que ya no aplica, la feature está en `green`).
- **Lint:** `[OK]`, 0 errores, 0 advertencias, 42 archivos.
- **Jest:** `[OK]`, 34/34 tests, 12/12 suites.
- **Cobertura:** líneas 80.08 % / sentencias 80.45 % / funciones 76.19 % / ramas 67.97 %, sobre el piso
  ya subido (76/76/72/64).
- **Baseline de advertencias de deuda:** 0 == 0 (`docs/verifications.md` §4).

## 11.16. Prueba Nivel B (declaración final)

Casos B1–B7 de §8.2 del diseño. **No se pudieron ejecutar en esta sesión**: no existe `.env` en el
repositorio (`Test-Path .env` → `False`, no hay variables `DB_*`/`JWT_SECRET` en el entorno) y el
demonio de Docker Desktop no está activo (`docker info` devuelve solo la sección `Client`, sin
`Server`, con error de conexión). Se declaran **pendientes, asignados a una persona**, con el comando
exacto y la base contra la que deben correr (base **desechable**, nunca DEV/QA con datos, acoplamiento 6):

| # | Caso | Comando / acción | Estado |
|---|---|---|---|
| B1 | La app arranca con NestJS 12 y responde `GET /api/` | `npm run start:dev` (con `.env` completo) | **Pendiente** — requiere `.env` y PostgreSQL |
| B2 | Suite e2e completa en verde | `npm run test:e2e` con `.env` (`DB_*`, `JWT_SECRET`) | **Pendiente** — sin `.env` ni PostgreSQL en esta máquina |
| B3 | Ciclo real de invalidación de JWT (login→token A; re-login→token B; A da 401, B da 200) | Manual contra la app arriba con B1/B2 satisfechos | **Pendiente** |
| B4 | Swagger publicado, *Authorize* con `access-token` aplica a endpoints protegidos | Navegar `/api/docs` con la app arriba | **Pendiente** |
| B5 | `ValidationPipe` intacto (`POST /api/users` con campo no declarado → 400) | Manual/`curl` contra la app arriba | **Pendiente** |
| B6 | El logger propio escribe en disco sin datos sensibles ni líneas duplicadas | Provocar un 401 y un 500; revisar `logs/application-*.log` y `logs/error-*.log` | **Pendiente** |
| B7 | Esquema sin cambios (columnas de `users` antes/después con `synchronize` activo, base desechable) | Comparar `\d users` en PostgreSQL antes/después del arranque | **Pendiente** |

### 11.16.1. Ejecución del Nivel B — 2026-09-04 (leader, con Docker Desktop activo)

Se ejecutó **después** del cierre en `done` (el veredicto aprobó con el Nivel B declarado, no
ejecutado), sobre el entorno desechable nuevo: `compose.yaml` (PostgreSQL 17 en tmpfs + imagen de la
API del `Dockerfile`) y el script `npm run test:e2e:docker`. Resultado real, sin maquillar:

| # | Caso | Resultado | Evidencia |
|---|---|---|---|
| B1 | La app arranca en el contenedor y responde `GET /api/` | **FALLA** | `Error: Validacion de variables de entorno fallida -> PORT: PORT must not be greater than 65535, PORT must not be less than 0, PORT must be an integer number`. Causa: `PORT = 3000` en `env.validation.ts` no tiene anotación de tipo → `design:type Object` → class-transformer no convierte `"3000"` a número. Cualquier `PORT` en el entorno (compose, `.env.example`) rompe el arranque. **Defecto previo a NestJS 12**, no lo introdujo esta feature; nunca se había ejecutado el Nivel B. |
| B2 | Suite e2e completa en verde | **FALLA** (4/4 en rojo) | `Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument AuthModuleOptions at index [0] is available in the UsersModule module.` Bajo `@nestjs/passport` 12 el guard de clase se instancia en `UsersModule`, que no importa `PassportModule.register(...)` (solo lo hace `AuthModule`). El `.overrideGuard` de §11.7 **ocultó este fallo en el Nivel A**: exactamente el riesgo que señaló el reviewer. |
| B3–B7 | — | **No alcanzados** | Dependen de que la app arranque (B1) y de que `AppModule` compile (B2). |

**Consecuencia:** ambos defectos se registraron como **feature #5** (`arranque_real_port_y_guard_passport12`,
`needs_design: true`, D3/D8) en `feature_list.json`. B1–B7 de esta feature quedan asignados a la #5,
que debe dejarlos ejecutados y declarados. La infraestructura para repetirlos ya existe:
`npm run test:e2e:docker` (B2) y `docker compose --profile app up -d --build --wait` (B1, B3–B7). CI
(`.github/workflows/gate.yml`) ejecuta B2 y un smoke de B1/B4 en cada push/PR.

**Preparación mínima para quien retome el Nivel B** (no ejecutada en esta sesión, solo referencia):

```
docker run -d --name pg-e2e -e POSTGRES_PASSWORD=<solo-local> -e POSTGRES_DB=application_api -p 5432:5432 postgres:17
cp .env.example .env   # completar DB_*, JWT_SECRET
npm run start:dev      # B1, B3, B4, B5, B6
npm run test:e2e       # B2
```

Debe correr con el Node de `.nvmrc` (24.20.0) — mismo piso que exige el CHECK 2 del Nivel A. **El
reviewer no aprueba `done` sin que alguien complete B1–B7** (o los repita si cambian
`.env`/infraestructura); el leader debe saber que la feature queda en `green` con el Nivel B **abierto**.

## 11.17. Acoplamientos revisados (fase GREEN)

De los ocho acoplamientos del diseño §6:

| # | Acoplamiento | Cómo se respetó en GREEN |
|---|---|---|
| **1** | Invalidación de JWT | No se tocó `JwtStrategy`/`AuthService`/el payload. Suben `@nestjs/jwt` y `@nestjs/passport` a 12; el typecheck y la batería unitaria (`jwt.strategy.spec.ts`, `auth.service.spec.ts`) siguen en verde sin cambios de código. El ciclo real (B3) queda declarado como Nivel B pendiente (11.16): es el de mayor riesgo y no se puede dar por bueno sin ejecutarlo. |
| **2** | `ValidationPipe` global | No se tocó `main.ts` en esa parte. B5 queda declarado como pendiente de Nivel B. |
| **3** | `ResponseInterceptor` global | No se tocó. Cubierto por `response.interceptor.spec.ts` (verde, fuera del alcance de esta feature). |
| **4** | `HttpExceptionFilter` global | Ya migrado en G1 (11.1): token `APP_LOGGER`, tipo del parámetro sin cambiar. `http-exception.filter.spec.ts` (T9, regresión heredada) sigue en verde durante toda la fase GREEN, verificado en cada corrida del gate (11.10). |
| **5** | Prefijo `/api` y Swagger `'access-token'` | No se tocó la configuración de `DocumentBuilder`/`addBearerAuth` más allá de actualizar el texto de `setDescription` (ya decía "NestJS 12" al llegar a GREEN). B4 queda declarado como pendiente de Nivel B. |
| **6** | `synchronize` sin migraciones | No se tocó el esquema: `typeorm` sigue en `1.1.1`, ninguna entidad cambió. B7 (comparar columnas antes/después) queda declarado como pendiente de Nivel B, para confirmarlo contra una base **desechable**, nunca DEV/QA. |
| **9** | Winston con rotación a archivo | El logger propio (G1) ya cumplía la regla de no serializar objetos arbitrarios (T6). B6 (revisar `logs/*.log` en busca de datos sensibles y de líneas duplicadas por doble instancia) queda declarado como pendiente de Nivel B. |
| **12** | Metadatos de decoradores vs. `import type` | Se verificó que ningún cambio de esta fase convirtió a `import type` una clase inyectada: `LoggerService` seguía siendo `import type` (es una interfaz) y `Injectable`/`Module`/`Global`/`Inject` no. El proyecto permanece CommonJS (`tsconfig.json` sin tocar); documentado explícitamente en `CLAUDE.md` y `.claude/agents/planner.md` (acoplamiento 12) como parte de esta feature. |
