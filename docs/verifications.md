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
npm run test:e2e     # test/app.e2e-spec.ts contra PostgreSQL real; se omite (skip) sin DB_*/JWT_SECRET
```

La suite **siembra y borra su propio usuario**, así que es determinista y no depende de datos previos.
Sin PostgreSQL local, la forma más corta de tener uno de prueba es un contenedor:

```
docker run -d --name pg-e2e -e POSTGRES_PASSWORD=<solo-local> -e POSTGRES_DB=application_api -p 5432:5432 postgres:17
```

⚠️ **Requiere el Node de `.nvmrc` (24 LTS)**: es el mismo piso que el CHECK 2 exige para el Nivel A.

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

En un harness hermano de Kata, `feature_list.json` y la documentación decían **9 advertencias**; los
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

**Medida el 2026-09-03** corriendo `npm run harness:verify` sobre el repo en estado limpio, tras subir
el toolchain (Node 24, TypeORM 1.x, ESLint 10), ampliar el gate y cerrar la deuda D1/D2 con la
feature #2.

| | |
|---|---|
| **Advertencias de deuda** | **0** |
| **Errores** | 0 |
| **Advertencias de entorno** (no cuentan) | sin feature activa (según el momento del ciclo) |
| **Piso de cobertura** (`rules.cobertura_minima`) | líneas **72** · sentencias **73** · funciones **66** · ramas **61** (subido el 2026-09-03 en la fase GREEN de la feature #2, desde 60/60/55/55) |
| **Cobertura medida** | líneas 75.59 · sentencias 76.37 · funciones 69.69 · ramas 64.49 (2026-09-03, con la batería de la feature #2 en disco) |

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

### Hallazgos abiertos que NO son advertencias del gate

| Origen | Hallazgo | Dónde vive |
|---|---|---|
| Reviewer de la feature #2 (2026-09-03) | Con una excepción no controlada que es instancia de `Error`, `HttpExceptionFilter` devuelve al cliente el `message` interno en el 500 (posible fuga de detalle interno, D6). La caracterización lo documentó sin corregirlo, porque ese modo prohíbe tocar producción. | **Feature #4 `error_500_sin_detalle_interno`** (`needs_design: true`, D5/D6) en `feature_list.json`. Se cierra por el ciclo normal, no como advertencia del baseline. |

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
por debajo del piso. Se harán en la primera feature `nuevo` real; anótalo aquí al hacerlo.

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

---

## 6. Toolchain: piso, techos y pendientes de entorno

Medido el **2026-09-03**. No es deuda de código: son decisiones de plataforma con su fecha de revisión.

1. **Node 24 LTS es el piso** (`engines >=24.11.0`, `.nvmrc` 24.20.0, `.npmrc` con `engine-strict`
   para que `npm ci` se niegue a instalar con otro Node). Fue advertencia; ahora el CHECK 2 lo trata
   como error porque TypeORM 1.x (`>=24.11.0` en la línea 24) y ESLint 10 (`>=24`) ya no soportan
   menos. **Node 26 entra a Active LTS el 2026-10-28** (Node 24 pasa a Maintenance el 2026-10-20): subir
   el piso es cambiar `.nvmrc`, `engines`, `NODE_MIN` en `verify.mjs` y esta sección en la misma pasada.
2. **TypeScript 6.0.x es el techo, fijado con `~6.0.3`.** TypeScript 7.0.2 (compilador nativo) está
   publicado desde el 2026-07-08, pero **typescript-eslint 8.69.0 declara `typescript <6.1.0`** y
   **ts-jest 29.4.12 declara `<7`**. Subir rompería el linter y las pruebas a la vez. Revisar cuando
   ambos publiquen soporte. Por lo mismo, `lib` se queda en `ES2024` sin las entradas `ESNext.*` de la
   base oficial de Node 24: typescript-eslint no conoce `es2025.iterator`.
3. **NestJS 11.2 y no 12.** NestJS 12.0.1 (2026-08-27) distribuye todos los `@nestjs/*` **solo como
   ESM**. Bloqueos medidos: `nest-winston` 1.10.2 declara peer `@nestjs/common ^5..^11` y no tiene
   soporte v12 (gremo/nest-winston#935, abierto el 2026-09-01); Jest solo soporta `require()` de ESM en
   Node ≥ 24.9 (Jest 30.4+); el CLI 12 exige Node ≥ 24.15 para `nest new/generate/upgrade`. Es la
   **feature #3** del backlog, con diseño previo (D9).
4. **Sin carpeta de migraciones.** `synchronize` está apagado en producción, así que hoy ningún cambio
   de esquema tiene camino a producción. Cualquier feature que dispare **D4** debe resolverlo en su
   diseño.
5. **`@nestjs/cli` 11 compila con el TypeScript raíz** gracias a `overrides` en `package.json`. Sin el
   override npm instalaba una copia anidada 5.9.3 y `nest build` compilaba con una versión distinta a la
   de ts-jest y del editor.
6. **Lockfile:** el `package-lock.json` anterior era inconsistente (`ts-jest@29.4.6` exige
   `typescript <6` junto a `typescript ^6.0.3`) y **un clon limpio no podía `npm ci`**. Se regeneró desde
   cero el 2026-09-03. CI corre `npm ci`, así que volvería a detectarse.
7. **Finales de línea:** el árbol de trabajo estaba en CRLF (`core.autocrlf=true`) con el índice en LF, y
   `.editorconfig` tenía `max_line_length = off`, que Prettier lee como ancho **infinito**. Ahora
   `.gitattributes` fuerza LF en checkout y `.prettierrc` fija `printWidth` 100 + `endOfLine` lf.
8. **Nivel B pendiente de ejecutar por una persona** tras esta actualización: TypeORM 1.x se validó
   con la batería unitaria (mocks) y el build; el comportamiento real contra PostgreSQL (esquema con
   `synchronize`, `bigint` como string, e2e con semilla) no se corrió porque la máquina no tenía
   PostgreSQL ni el daemon de Docker activo. Comando y contenedor en §1.
