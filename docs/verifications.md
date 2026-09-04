# Verificación — el gate de dos niveles

> **Regla de oro:** el agente no dice "funciona", lo **demuestra**. Y `[OK]` no significa "probado":
> significa "el Nivel A pasó". Lo que el script no puede probar no se sustituye, se **declara**.

Este documento es la **única fuente de verdad** de: qué verifica el gate, qué **no** verifica, cuál es
la **línea base** de advertencias vigente, cuál es el **piso de cobertura**, y qué techos tiene el
toolchain. Los agentes y los slash commands **apuntan aquí y no repiten los números**.

---

## 1. Los dos niveles

### Nivel A — automático (`npm run harness:verify` → `[OK]`)

Ejecutable, determinista, corre en cualquier máquina con el Node de `.nvmrc` (y en CI,
`.github/workflows/gate.yml`). Es la puerta que **nunca** se salta.

```
npm run harness:verify        # Nivel A completo (estructura + build + typecheck + lint + jest + cobertura)
npm run harness:estructura    # solo estructura: rápido, no necesita node_modules
```

`--estructura` sirve para **iterar** sobre el andamiaje del harness. **No cierra una feature:** build,
typecheck, lint, pruebas y cobertura no se ejecutaron, así que el Nivel A queda incompleto y el propio
gate lo advierte.

#### El gate entiende la fase RED

En TDD la batería **debe** estar en rojo entre la fase RED y la fase GREEN. Un gate que solo supiera
decir "hay tests fallando → `[FAIL]`" sería inútil durante la mitad del ciclo, y un gate inútil se deja
de correr. Por eso, con la feature activa en estado `red`:

| `red_modo` | Qué espera el gate | Qué sigue siendo error |
|---|---|---|
| **`nuevo`** (por omisión) | Fallos de typecheck, lint y jest **solo** en los archivos `nivel: "A"` del `tdd_contract`, y **al menos uno**. La cobertura no se evalúa. | Cualquier fallo fuera de esos archivos; una batería completamente verde ("o el test no prueba nada, o el comportamiento ya existía"). |
| **`caracterizacion`** | Todo en verde (el código ya existe). El rojo vive en la *Evidencia RED*, demostrado por **mutación**. | Una evidencia que no describa la mutación (CHECK 3d). |

Fuera de `red` (`green`, `in_review`, sin feature activa) no hay tolerancia alguna.

### Nivel B — manual, contra PostgreSQL real (**declarado**, no opcional)

El Nivel A corre con **mocks**. Hay cuatro cosas que por construcción no puede probar, y las cuatro son
justo donde este proyecto tiene su riesgo:

| Qué | Por qué el Nivel A no lo alcanza |
|---|---|
| **Invalidación de JWT end-to-end** | Los specs mockean el repositorio. Que `iat < lastTokenIssuedAt` rechace en un mock no prueba que un token viejo deje de servir después de un re-login real. |
| **Esquema y `synchronize`** | `synchronize: NODE_ENV !== 'production'` sincroniza solo fuera de producción. Renombrar una propiedad **elimina la columna anterior y sus datos** en DEV/QA, y ningún test unitario lo ve. En producción está apagado y **no hay carpeta de migraciones**: cada cambio de esquema debe declarar cómo llega a producción. TypeORM 1.x además cambió tipos y validaciones del `Repository`: los mocks no lo notan, la base sí. |
| **Contrato publicado en `/api/docs`** | Un endpoint sin `@ApiBearerAuth('access-token')` —con ese nombre exacto— compila, pasa los tests, y aparece roto en Swagger. |
| **Comportamiento de los guards e interceptores en la cadena real** | El 401 de un guard, el doble envoltorio del interceptor y la forma del error del `HttpExceptionFilter` solo se ven con la app arriba. |

**Cómo se ejecuta:**

```
npm run test:e2e:docker                              # B2 en un paso: levanta PostgreSQL 17 desechable (compose.yaml), corre la e2e y lo borra
npm run test:e2e:docker -- --keep                    # igual, pero deja la base arriba para los casos manuales
npm run test:e2e                                     # la suite sola, contra el PostgreSQL que indiquen DB_*/JWT_SECRET; se omite (skip) sin ellas
docker compose --profile app up -d --build --wait    # API (Dockerfile) + PostgreSQL, para B1 y los casos manuales (JWT, Swagger, ValidationPipe, logs, esquema)
docker compose --profile app down -v                 # apaga y borra todo
```

La suite **siembra y borra su propio usuario**, así que es determinista y no depende de datos previos.
La base de `compose.yaml` vive en **tmpfs** y muere con `down -v`: es desechable por construcción, y
sus credenciales por omisión son solo para ese contenedor (nunca se apunta a DEV/QA con datos).

**En CI** (`.github/workflows/gate.yml`) corren tres trabajos independientes: `nivel-a` (el gate),
`nivel-b-e2e` (la suite e2e contra un PostgreSQL 17 efímero del runner: **B2, B3 y B5** automáticos
desde la feature #5, 2026-09-04) y `docker-smoke` (construye la imagen y levanta API + base con el
mismo `compose.yaml` que en local, comprobando `GET /api/`, `/api/docs` y el 401 sin token: **B1 y B4**
automáticos, y la validación del despliegue en contenedor). Los casos que exigen inspeccionar el
sistema fuera de las respuestas HTTP (logs en disco, esquema de la base) siguen siendo manuales.

**Por qué el Nivel B sigue siendo declarado aunque CI corra parte de él:** el 2026-09-04, la primera
ejecución real del Nivel B (feature #3) encontró **dos defectos que el Nivel A en verde no veía**: la app
no arranca si `PORT` viene del entorno, y bajo `@nestjs/passport` 12 el `JwtAuthGuard` no resuelve sus
dependencias en `UsersModule` (un `.overrideGuard` en el spec unitario lo ocultaba). Registrados y
**cerrados el mismo 2026-09-04 por la feature #5** (`arranque_real_port_y_guard_passport12`): `PORT`
declara anotación de tipo explícita y `JwtAuthGuard` declara su propio constructor (ver acoplamiento 13
de [`.claude/agents/planner.md`](../.claude/agents/planner.md)). Es la demostración de que "43/43 en
verde" mide lo que los mocks dejan medir, no más — y la razón de fondo por la que el Nivel B **no se
sustituye, se ejecuta**: B1–B7 quedaron corridos y declarados en
`progress/impl_arranque_real_port_y_guard_passport12.md` §9, con **B3 y B5 ya automatizados** como
casos permanentes de `test/app.e2e-spec.ts` (antes eran manuales, ahora corren en cada
`npm run test:e2e:docker`).

⚠️ **Requiere el Node de `.nvmrc` (24 LTS)**: es el mismo piso que el CHECK 2 exige para el Nivel A. La
imagen del `Dockerfile` fija exactamente esa versión; al mover el piso se cambia ahí también (§6.1).

**Cómo se declara:** en `progress/impl_<name>.md`, sección *Prueba Nivel B* — qué caso, qué comando,
contra qué base, y el resultado (o el pendiente asignado a una persona). **Sin esa declaración el
reviewer no aprueba**, aunque el Nivel A esté en verde.

---

## 2. Catálogo de checks del Nivel A

| Check | Qué valida | Nivel |
|---|---|---|
| **1 — archivos base** | Existen los 24 archivos del andamiaje (harness + toolchain: `.nvmrc`, `.npmrc`, `.gitattributes`, `.prettierrc`, `eslint.config.mjs`, `tsconfig*`). Si falta uno, el gate no puede garantizar lo que promete. | `ERR` |
| **1b — toolset de subagentes** | Frontmatter de cada agente: prohíbe `Bash` (aquí el shell se llama `PowerShell`), exige los tools que el flujo de cada rol necesita, y **prohíbe** los que su rol no debe tener (`Edit` en `planner`, `reviewer` y `leader`). **La verificación más importante del harness: protege la capacidad de verificar.** | `ERR` |
| **2 — versión de Node** | Piso **24 LTS** (`NODE_MIN` en el gate = `engines` de `package.json`). Por debajo → `ERR`: el toolchain declarado no soporta esa versión y nada de lo que reporte el gate es confiable. En la línea correcta pero con parche menor al de `.nvmrc` → advertencia de **entorno** (no cuenta para el baseline). Línea posterior (26) → `INFO`. | `ERR` / `WARN` |
| **3 — `feature_list.json`** | Estados válidos, **una sola feature activa**, `red_modo` válido, y **reporta el conteo** por estado — sin esa línea el operador no sabe si el archivo se leyó. | `ERR` |
| **3b — bandera `needs_design`** | Toda feature está clasificada; si es `true`, su motivo **cita el disparador** (`D1`…`D11`) y existe `progress/design_<name>.md` cuando ya salió de `pending`. | `ERR` + `WARN` |
| **3c — trazabilidad criterio ↔ test** | Desde `red`: cada criterio de `acceptance` tiene entrada en `tdd_contract`, y para Nivel A el **texto exacto del `it()` se busca en el archivo declarado**. | `ERR` (features `tdd:true`) / `WARN` (exentas legacy) |
| **3d — evidencia RED creíble** | Desde `red`, features `tdd: true`: `progress/impl_<name>.md` tiene una sección *Evidencia RED* que (a) contiene un fallo reconocible de Jest o de `tsc`, (b) **menciona cada archivo** nivel A del contrato, y (c) en `caracterizacion` describe la **mutación**. Una sección vacía o pegada de otra feature no pasa. | `ERR` |
| **3e — TDD obligatorio** | Toda feature tiene `tdd: true`. Única excepción: `rules.tdd_exentas_legacy` (lista explícita `{ id, motivo }`). Una exención sobre una feature ya `tdd:true` es advertencia (quítala). | `ERR` |
| **4 — higiene de `src/` y `test/`** | Producción sin `console.log`/`console.debug` (el logger es Winston); `TODO`/`FIXME` informativos. Pruebas sin `.only(` (**error**: el verde miente) ni `xit`/`.skip(` (deuda: esconde un rojo). | `ERR` / `WARN` + `INFO` |
| **5 — build** | `npm run build` (`nest build`, solo producción). Debe pasar también en RED. | `ERR` |
| **5b — typecheck** | `tsc --noEmit` sobre `tsconfig.json` (src + specs) **y** `test/tsconfig.json` (e2e). Sin él, un e2e con error de tipos solo se descubre al correr el Nivel B. RED-aware. | `ERR` |
| **5c — lint** | `eslint . --max-warnings=0 --format json`, **sin `--fix`** (el gate verifica, no modifica). Reglas en `eslint.config.mjs`. RED-aware. | `ERR` |
| **6 — pruebas** | `jest --coverage --json`: se leen los resultados por archivo para distinguir **dónde** falló cada test. RED-aware (ver §1). | `ERR` |
| **6b — cobertura mínima** | Compara `coverage/coverage-summary.json` contra `rules.cobertura_minima` (§4). Trinquete: si la holgura es ≥ 5 puntos, `INFO` para subir el piso. No se evalúa en `red` modo `nuevo`. | `ERR` / `INFO` |
| **7 — recordatorio Nivel B** | Línea informativa con lo que el script **no** valida. Evita que `[OK]` se lea como "probado". | `INFO` |
| **baseline** | Compara las advertencias de **deuda** contra §4. No suma a la cuenta: informa. | `WARN` |

### Advertencias de **deuda** vs. de **entorno**

El baseline cuenta **solo la deuda del proyecto**. Las advertencias de entorno o de estado de sesión
(parche de Node distinto al de `.nvmrc`, "sin feature activa", "modo `--estructura`") se marcan
`(entorno)` y **no cuentan**.

El motivo es concreto: si contaran, el baseline cambiaría solo por no tener una feature en curso, y un
baseline que se mueve por sí solo es un baseline que nadie lee — que es exactamente el modo de falla
de §3.

---

## 3. Por qué el baseline vive en un solo lugar

En un harness hermano, `feature_list.json` y la documentación decían **9 advertencias**; los
agentes y el slash command seguían diciendo **6**, citando causas ya resueltas. Con ese número
obsoleto el `leader` se detiene diciendo *"algo nuevo se introdujo"* y el `reviewer` rechaza — **con el
repo en estado correcto**. El número se había movido 6 → 0 → 9 → 10 conforme se resolvía deuda y
entraban checks nuevos.

**Regla:** el baseline y el piso de cobertura viven en **§4 de este documento** y se reflejan en
`feature_list.json → rules.baseline_advertencias` y `rules.cobertura_minima`. Los agentes los **leen de
aquí**. La instrucción es explícita en las cuatro definiciones de rol: **no los cites de memoria.** Todo
check nuevo que mueva un número lo actualiza en la misma pasada.

---

## 4. Línea base vigente

**Medida el 2026-09-04** corriendo `npm run harness:verify` sobre el repo en estado limpio, tras cerrar
la fase GREEN de la feature #6 (`refactor_buenas_practicas`).

| | |
|---|---|
| **Advertencias de deuda** | **0** |
| **Errores** | 0 |
| **Advertencias de entorno** (no cuentan) | sin feature activa (según el momento del ciclo) |
| **Piso de cobertura** (`rules.cobertura_minima`) | líneas **95** · sentencias **94** · funciones **93** · ramas **77** (subido el 2026-09-04 en la fase GREEN de la feature #6, desde 85/85/79/67) |
| **Cobertura medida** | líneas 99.22 · sentencias 98.95 · funciones 97.82 · ramas 81.59 (2026-09-04, con T1-T21 de la feature #6 en disco: `env.validation.ts`, `winston.config.ts` y `auth.controller.ts` pasan de 0 %/casi 0 % a cubiertos, y se cierran ramas del filtro, del logger y de `UsersService`) |

### Histórico de la línea base

| Fecha | Cobertura medida (líneas/sentencias/funciones/ramas) | Piso resultante | Motivo |
|---|---|---|---|
| 2026-09-03 | 75.59 / 76.37 / 69.69 / 64.49 | 72 / 73 / 66 / 61 | Fase GREEN de la feature #2 (cierre D1/D2) |
| 2026-09-04 | 80.08 / 80.45 / 76.19 / 67.97 | 76 / 76 / 72 / 64 | Fase GREEN de la feature #3 (migración a NestJS 12 + logger propio) |
| 2026-09-04 | 89.87 / 89.88 / 83.72 / 71.24 | 85 / 85 / 79 / 67 | Fase GREEN de la feature #5 (`PORT` + `JwtAuthGuard` bajo passport 12) |
| 2026-09-04 | 99.22 / 98.95 / 97.82 / 81.59 | 95 / 94 / 93 / 77 | Fase GREEN de la feature #6 (refactor y buenas prácticas, T1-T21 de caracterización) |

### Historial de la deuda

| # | Origen | Hallazgo | Cierre |
|---|---|---|---|
| **D1** | CHECK 3c, feature #1 criterio 1 | Ningún test automático cubría el **401 de `GET /api/users/me`**; el e2e existente cubría otro endpoint. | **Cerrada el 2026-09-03** por la feature #2: `src/users/users.controller.guard.spec.ts` verifica el metadato de guards de `UsersController`. El criterio 1 de la feature #1 apunta a ese test. |
| **D2** | CHECK 3c, feature #1 criterio 3 | El envoltorio `{ statusCode, message, resource, isError }` lo aplicaban `ResponseInterceptor` y `HttpExceptionFilter` **sin spec propio**. | **Cerrada el 2026-09-03** por la feature #2: `response.interceptor.spec.ts` y `http-exception.filter.spec.ts`. El criterio 3 de la feature #1 apunta al del interceptor. |

Las dos eran deuda preexistente, no regresiones. Se cerraron con pruebas de caracterización
(`red_modo: caracterizacion`, rojo demostrado por mutación). **La exención legacy de la feature #1
permanece** en `rules.tdd_exentas_legacy`: su batería original no tiene evidencia RED y esa evidencia
no puede producirse retroactivamente; fabricarla sería peor que declararla ausente. La exención ya no
tiene deuda asociada.

### Hallazgos registrados fuera del baseline (no son advertencias del gate)

| Origen | Hallazgo | Dónde vive |
|---|---|---|
| Reviewer de la feature #2 (2026-09-03) | Con una excepción no controlada que es instancia de `Error`, `HttpExceptionFilter` devolvía al cliente el `message` interno en el 500 (fuga de detalle interno, D6). La caracterización lo documentó sin corregirlo, porque ese modo prohíbe tocar producción. | **Cerrado el 2026-09-03 por la feature #4 `error_500_sin_detalle_interno`** (diseño D5/D6, ciclo TDD completo): al cliente le llega siempre el literal genérico y el mensaje real va solo al log. |

### Cuando el conteo se mueve

- **Sube** → algo nuevo se introdujo. Investígalo **antes** de avanzar; no lo normalices subiendo el número.
- **Baja** → se resolvió deuda. **Actualiza §4 y `feature_list.json` en la misma pasada**, o el
  siguiente `leader` se detendrá con el repo correcto.
- **Cobertura con holgura ≥ 5 puntos** → sube el piso (`rules.cobertura_minima` y esta tabla). El piso
  solo sube; bajarlo requiere justificación escrita aquí.

---

## 5. Prueba negativa del gate

> Un check que nunca falla no protege nada.

Cada check nuevo se valida rompiendo algo a propósito y confirmando que el gate lo atrapa — **y** que
deja pasar los casos legítimos, porque un gate que grita siempre también se deja de leer.

### 5.1. Ejecutada el 2026-09-03 (checks 3d creíble, 3e, 4 `.only`, 5b, 5c, 6 RED-aware, 6b)

Guion: `negativa.mjs` (scratch, no versionado) rompe el repo por escenario, corre `verify.mjs`,
guarda la salida y restaura `feature_list.json`, los specs temporales y el `impl_` temporal. Se
verificó con `git status` que no quedaron residuos.

| Escenario | Se rompió | Esperado | Real |
|---|---|---|---|
| S1 (estructura) | `it.only(` en un spec + feature #2 con `tdd: false` sin exención | `ERR` ×2, exit 1 | ✅ *"'.only(' en una prueba: la bateria completa deja de correr y el verde miente"* + *"'tdd' no es true"* |
| S2 (completo) | Feature #2 en `red`/`nuevo`; spec del contrato falla | **`[OK]`**, exit 0, fallo listado como esperado | ✅ *"Fase RED: 1 fallo(s) esperado(s) dentro de la bateria"* |
| S3 (completo) | Igual que S2 pero el spec pasa | `ERR`, exit 1 | ✅ *"esta en 'red' (modo nuevo) pero TODA la bateria pasa"* |
| S4 (completo) | S2 + otro spec fallando **fuera** del contrato | `ERR`, exit 1, el fallo interno sigue tolerado | ✅ *"Pruebas en rojo fuera de la fase RED (1): src/fuera.spec.ts"* y el interno en `[OK]` |
| S5 (estructura) | `red`/`caracterizacion` con evidencia sin la palabra "mutación" | `ERR` CHECK 3d | ✅ *"exige que la Evidencia RED describa la MUTACION"* |
| S6 (estructura) | Evidencia que no menciona el archivo de la batería | `ERR` CHECK 3d | ✅ *"no menciona negativa.spec.ts"* |
| S7 (completo) | `red`/`caracterizacion` correcto: batería verde, mutación descrita | **`[OK]`**, exit 0, cobertura evaluada | ✅ 19/19 tests, cobertura sobre el piso |

Los checks 5b (typecheck RED-aware) y 6b (piso de cobertura) quedaron cubiertos indirectamente: en S2
el spec temporal compiló y el gate saltó la cobertura por estar en `nuevo`; en S7 la evaluó. Pendiente
de prueba negativa explícita: un spec del contrato que **no compile** (rojo por `tsc`) y una cobertura
por debajo del piso.

### 5.3. Cerrada el 2026-09-03/04 por la fase RED real de la feature #3 (spec que no compila)

La fase RED de la feature #3 (`red_modo: nuevo`) produjo, sin necesidad de un escenario sintético, el
caso pendiente de §5.2: `src/common/logger/winston-logger.service.spec.ts` y
`src/common/logger/logger.module.spec.ts` importaban `./winston-logger.service`, `./logger.module` y
`./logger.tokens`, que todavía no existían. `npm run harness:verify` corrió con la feature en `red` y:

| Se esperaba | Resultado real |
|---|---|
| CHECK 6 marca las dos suites como "no corrió: error de compilación/carga" y las cuenta como el/los fallo(s) esperado(s) del contrato | ✅ `Cannot find module './winston-logger.service'` / `Cannot find module './logger.module'`; el gate las listó como *"fallo(s) esperado(s) dentro de la bateria"* |
| CHECK 5b (typecheck) tolera el error **solo** por estar en los archivos del `tdd_contract`, sin afectar el resto de `src/`/`test/` | ✅ `[OK] Typecheck sin errores fuera de la fase RED` con `2`/`3` errores tolerados registrados como `[INFO]` |
| `npm run harness:verify` sigue en `[OK]` (exit 0) pese al rojo, porque el rojo vive donde el contrato lo declara | ✅ |

Queda cerrada la prueba negativa pendiente de §5.2. Sigue pendiente (no forzada todavía en ningún
ciclo): una cobertura medida por debajo del piso vigente.

### 5.2. Ejecutada el 2026-08-31 (checks 1b / 3c)

Los tres bugs se reintrodujeron a la vez:

| Se rompió | Resultado esperado | Resultado real |
|---|---|---|
| `leader.md` regresado a `tools: … Bash …` | `[ERR]` + exit 1 | ✅ dos errores (declara `Bash` + le falta `PowerShell`) |
| `reviewer.md` sin `Write` | `[ERR]` + exit 1 | ✅ |
| `tdd_contract` con el nombre de un `it()` que no existe | `[ERR]` + exit 1 | ✅ |

**Lo que esa prueba encontró en el gate mismo ⚠️:** los archivos rotos se escribieron con
`Set-Content -Encoding UTF8` de PowerShell 5.1, que **agrega BOM**. Con un BOM al inicio, el regex del
frontmatter no casaba y el CHECK 1b **degradaba a una advertencia** en lugar de detectar que al
`leader` le habían quitado el shell; `JSON.parse` tronaba y el CHECK 3 completo se caía. **El BOM
apagaba en silencio justo la verificación que existe para que nada se apague en silencio.**
Corrección: todo el gate lee por un único `leerAbs()` que quita el BOM (verificado con un tercer caso).

**Lección, la misma de siempre:** *ejecuta la verificación candidata contra el repo real y lee la
salida antes de dejarla fija.* Un hueco así no se ve leyendo el código del gate; se ve corriéndolo.

### 5.4. El Nivel B encuentra lo que el Nivel A no ve (feature #5, 2026-09-04)

> Un check que nunca falla no protege nada — y un Nivel A en verde tampoco, si nadie corre el Nivel B.

La fase RED de la feature #5 produjo, sola, la evidencia de que el Nivel A (mocks) y el Nivel B
(PostgreSQL + contenedor real) protegen cosas distintas. La mutación no hizo falta forzarla con un
guion aparte: **es la propia corrección revertida**.

| Mutación | Archivos que caen en rojo | Lo que prueba |
|---|---|---|
| Revertir `src/auth/guards/jwt-auth.guard.ts` a `export class JwtAuthGuard extends AuthGuard('jwt') {}` (sin constructor) | `src/auth/guards/jwt-auth.guard.spec.ts` (T9: `obligatorias` deja de ser `[]`), `src/users/users.module.spec.ts` (T8: `Nest can't resolve dependencies of the JwtAuthGuard`), `src/users/users.controller.spec.ts` (T10, los dos `it()` existentes) | El Nivel A por sí solo ya atrapa B2: el mismo `Nest can't resolve dependencies...` que tumbó el Nivel B real de la feature #3 el 2026-09-04. |
| Quitar la anotación `: number` de `PORT` en `src/config/env.validation.ts` (dejar `PORT = 3000` a secas) | `src/config/env.validation.spec.ts` (T1: `validateEnv` lanza con `PORT: '3000'`; T2: `design:type` vuelve a `Object`) | El Nivel A por sí solo ya atrapa B1: la app no arrancaría con `PORT` del entorno bajo `compose.yaml`. |

Esta es exactamente la evidencia RED capturada en
`progress/impl_arranque_real_port_y_guard_passport12.md` §3 (fase RED, `red_modo: nuevo`): los cuatro
archivos Nivel A del contrato fallaron **antes** de que existiera la corrección, con el mismo mensaje
de error que produjo el Nivel B real un día antes. La lectura correcta no es "ya no hace falta correr
el Nivel B" — es la contraria: **el Nivel A que hoy atrapa B1/B2 no existía cuando el Nivel B los
encontró**. La feature #5 demuestra el ciclo completo: Nivel B descubre → se escribe la prueba de
Nivel A que lo habría atrapado → **se ejecuta el Nivel B de nuevo** para confirmar que la corrección
funciona contra PostgreSQL y el contenedor reales, no solo contra el mock (B1–B7 ejecutados y
declarados en `progress/impl_arranque_real_port_y_guard_passport12.md` §9). Un Nivel A robusto no
vuelve opcional al Nivel B: reduce cuántas veces el Nivel B tiene que ser quien encuentre el defecto
por primera vez.

---

## 6. Toolchain: piso, techos y pendientes de entorno

Medido el **2026-09-03**, actualizado el **2026-09-04** (feature #3, migración a NestJS 12). No es
deuda de código: son decisiones de plataforma con su fecha de revisión.

1. **Node 24 LTS es el piso, `engines` en `>=24.15.0`** (subido desde `>=24.11.0` el 2026-09-04;
   `.nvmrc` sigue en `24.20.0`, `.npmrc` con `engine-strict` para que `npm ci` se niegue a instalar con
   otro Node). El CHECK 2 lo trata como error (no advertencia) porque TypeORM 1.x y ESLint 10 ya no
   soportan menos de la línea 24. Nota de medición: el `package.json` de `@nestjs/cli@12.0.0` declara
   `engines.node: ">= 20.11"` (más laxo de lo esperado); el piso `>=24.15.0` es una decisión de
   plataforma propia (Q1 del diseño de la feature #3), no una exigencia dura del CLI. **Node 26 entra a
   Active LTS el 2026-10-28** (Node 24 pasa a Maintenance el 2026-10-20): subir el piso es cambiar
   `.nvmrc`, `engines`, `NODE_MIN` en `verify.mjs` y esta sección en la misma pasada.
2. **TypeScript 6.0.x es el techo, fijado con `~6.0.3`.** TypeScript 7.0.2 (compilador nativo) está
   publicado desde el 2026-07-08, pero **typescript-eslint 8.69.0 declara `typescript <6.1.0`** y
   **ts-jest 29.4.12 declara `<7`**. Subir rompería el linter y las pruebas a la vez. Revisar cuando
   ambos publiquen soporte. Por lo mismo, `lib` se queda en `ES2024` sin las entradas `ESNext.*` de la
   base oficial de Node 24: typescript-eslint no conoce `es2025.iterator`.
3. **NestJS 12.0.1 (feature #3, cerrada el 2026-09-04).** NestJS 12 distribuye todos los `@nestjs/*`
   **solo como ESM**; el repositorio sigue siendo **CommonJS** y los consume con el `require(esm)`
   nativo de Node. Hallazgos de la migración:
   - `nest-winston` 1.10.2 (peer `@nestjs/common ^5..^11`, sin soporte v12) se **reemplazó** por
     `WinstonLoggerService` propio en `src/common/logger/` (mismos transports/rotación de
     `winston.config.ts`, sin cambios).
   - **`npm i` de los `@nestjs/*` 12 no se pudo hacer en dos comandos separados** (uno para
     `dependencies`, otro para `devDependencies`) como proponía el diseño original: mientras
     `@nestjs/testing`/`@nestjs/cli`/`@nestjs/schematics` seguían en 11 en `package.json`, su peer sobre
     `@nestjs/core`/`@nestjs/common` producía `ERESOLVE` real (no cosmético) en cualquier orden. Se
     resolvió con **un solo `npm i`** de los once paquetes a la vez (sin `--legacy-peer-deps` ni
     `--force`), y luego se corrigió a mano qué sección de `package.json` (`dependencies` vs.
     `devDependencies`) le correspondía a cada paquete, seguido de `npm install` (sin argumentos) para
     resincronizar el lockfile. `npm ls @nestjs/common` confirma una sola copia 12.0.1 deduplicada en
     todo el árbol.
   - **P1 confirmado a favor:** `nest build` (CLI 12.0.0) corre sin problema en Node 24.20.0 y deja
     `dist/main.js` en la raíz de `dist/`. No hizo falta el plan B (`tsc -p tsconfig.build.json`).
   - **P2 confirmado a favor:** `@nestjs/config` 12.0.0 sigue aceptando `validate: (config) => …` como
     función simple (`ConfigModuleOptions.validate` en sus `.d.ts`); no hizo falta Standard Schema ni
     agregar Zod/Valibot. `src/config/env.validation.ts` no cambió.
   - **P3 confirmado:** una sola copia de TypeScript, `6.0.3`, deduplicada (`npm ls typescript`).
     `@nestjs/cli@12.0.0` declara su propio `typescript: ~6.0.2`, compatible con la raíz sin necesidad
     del `overrides`; se **conserva** de todas formas porque sigue siendo inocuo (fuerza exactamente la
     versión que ya se resolvería por deduplicación) — ver punto 5.
   - **Hallazgo nuevo, no anticipado en el diseño:** Jest 30.5.1 solo puede `require()` los `@nestjs/*`
     (ESM puro) si Node expone `vm.SourceTextModule`, y esa API vive detrás de la bandera
     `--experimental-vm-modules` — Node no la habilita por defecto ni en 24.20.0. Sin ella, cualquier
     suite que importe `@nestjs/testing` o `@nestjs/common` falla con
     `Must use import to load ES Module` / `ERR_REQUIRE_ESM` aunque el runtime "soporte" `require(esm)`
     en el sentido de C6 del diseño. Los scripts `test`, `test:watch`, `test:cov`, `test:debug` y
     `test:e2e` de `package.json`, y el `CHECK 6` de `verify.mjs`, invocan
     `node --experimental-vm-modules node_modules/jest/bin/jest.js …` en vez de `jest`/`npx jest` a
     secas (mismo patrón que ya usaba `test:debug` para sus propias flags de Node).
   - `users.controller.spec.ts` (feature #1) necesitó `.overrideGuard(JwtAuthGuard).useValue({
     canActivate: () => true })`: a partir de NestJS 12, `Test.createTestingModule().compile()`
     instancia también los guards declarados con `@UseGuards()` a nivel de clase (antes se resolvían de
     forma perezosa solo al ejecutar una petición HTTP real), y `JwtAuthGuard` (`AuthGuard('jwt')` de
     Passport) exige `AuthModuleOptions`, que ese spec no registra a propósito (no ejercita el guard;
     eso lo cubre `users.controller.guard.spec.ts` por metadato).
     > ⚠️ **Nota del 2026-09-04 (feature #5):** el diagnóstico de arriba (*"a partir de NestJS 12,
     > `compile()` instancia también los guards"*) **no es la causa raíz**; `createInstancesOfInjectables`
     > no es nueva en NestJS 12. La causa real es una asimetría de lectura de metadatos en el injector
     > (`Reflect.getMetadata` vs. `Reflect.getOwnMetadata`, acoplamiento 13 de
     > [`.claude/agents/planner.md`](../.claude/agents/planner.md)): `JwtAuthGuard` hereda el
     > `design:paramtypes` del mixin `AuthGuard('jwt')` pero no hereda su `optional:paramtypes`, así que
     > una dependencia opcional del padre se vuelve obligatoria en la subclase. El `.overrideGuard` que
     > este párrafo describe ya **no existe** en `users.controller.spec.ts`: la feature #5 lo retiró al
     > corregir `JwtAuthGuard` con un constructor propio (`jwt-auth.guard.ts`), sin necesitar Passport
     > registrado en `UsersModule`. Ver el análisis completo en
     > `progress/design_arranque_real_port_y_guard_passport12.md` §3 y
     > `progress/impl_migracion_nestjs_12_esm.md` §11.7 (corregido con la misma nota).
4. **Sin carpeta de migraciones.** `synchronize` está apagado en producción, así que hoy ningún cambio
   de esquema tiene camino a producción. Cualquier feature que dispare **D4** debe resolverlo en su
   diseño.
5. **`@nestjs/cli` 12 compila con el TypeScript raíz** gracias a `overrides` en `package.json`. Aunque
   `@nestjs/cli@12.0.0` ya declara su propio `typescript: ~6.0.2` (compatible con la raíz `~6.0.3` sin
   el override), se conserva para no depender de que la deduplicación de npm siga eligiendo la copia
   correcta en instalaciones futuras.
6. **Lockfile:** el `package-lock.json` anterior era inconsistente (`ts-jest@29.4.6` exige
   `typescript <6` junto a `typescript ^6.0.3`) y **un clon limpio no podía `npm ci`**. Se regeneró desde
   cero el 2026-09-03 y de nuevo el 2026-09-04 al migrar a NestJS 12. CI corre `npm ci`, así que
   cualquier inconsistencia volvería a detectarse.
7. **Finales de línea:** el árbol de trabajo estaba en CRLF (`core.autocrlf=true`) con el índice en LF, y
   `.editorconfig` tenía `max_line_length = off`, que Prettier lee como ancho **infinito**. Ahora
   `.gitattributes` fuerza LF en checkout y `.prettierrc` fija `printWidth` 100 + `endOfLine` lf.
8. **Nivel B de la feature #3** (invalidación de JWT end-to-end, `ValidationPipe`, Swagger, esquema sin
   cambios, logger sin datos sensibles en disco): declarado en
   `progress/impl_migracion_nestjs_12_esm.md`. Ver el resultado ahí — no se repite el número aquí para
   no desincronizar dos documentos.
