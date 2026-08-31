# Verificación — el gate de dos niveles

> **Regla de oro:** el agente no dice "funciona", lo **demuestra**. Y `[OK]` no significa "probado":
> significa "el Nivel A pasó". Lo que el script no puede probar no se sustituye, se **declara**.

Este documento es la **única fuente de verdad** de: qué verifica el gate, qué **no** verifica, y cuál
es la **línea base** de advertencias vigente. Los agentes y los slash commands **apuntan aquí y no
repiten el número**.

---

## 1. Los dos niveles

### Nivel A — automático (`npm run harness:verify` → `[OK]`)

Ejecutable, determinista, corre en cualquier máquina con Node. Es la puerta que **nunca** se salta.

```
npm run harness:verify        # Nivel A completo (estructura + build + pruebas)
npm run harness:estructura    # solo estructura: rápido, no necesita node_modules
```

`--estructura` sirve para **iterar** sobre el andamiaje del harness. **No cierra una feature:** build y
pruebas no se ejecutaron, así que el Nivel A queda incompleto y el propio gate lo advierte.

### Nivel B — manual, contra PostgreSQL real (**declarado**, no opcional)

El Nivel A corre con **mocks**. Hay cuatro cosas que por construcción no puede probar, y las cuatro son
justo donde este proyecto tiene su riesgo:

| Qué | Por qué el Nivel A no lo alcanza |
|---|---|
| **Invalidación de JWT end-to-end** | Los specs mockean el repositorio. Que `iat < lastTokenIssuedAt` rechace en un mock no prueba que un token viejo deje de servir después de un re-login real. |
| **Esquema y `synchronize`** | `synchronize: NODE_ENV !== 'production'` sincroniza solo fuera de producción. Renombrar una propiedad **elimina la columna anterior y sus datos** en DEV/QA, y ningún test unitario lo ve. En producción está apagado y **no hay carpeta de migraciones**: cada cambio de esquema debe declarar cómo llega a producción. |
| **Contrato publicado en `/api/docs`** | Un endpoint sin `@ApiBearerAuth('access-token')` —con ese nombre exacto— compila, pasa los tests, y aparece roto en Swagger. |
| **Comportamiento de los guards e interceptores en la cadena real** | El 401 de un guard, el doble envoltorio del interceptor y la forma del error del `HttpExceptionFilter` solo se ven con la app arriba. |

**Cómo se ejecuta:**

```
npm run test:e2e     # test/app.e2e-spec.ts contra PostgreSQL real
```

⚠️ **Requiere Node 22 LTS como mínimo; 24 LTS recomendado** (lo verifica el CHECK 2). Por debajo del
mínimo la app no arranca: TypeORM lanza `crypto is not defined` al inicializar, así que **el Nivel B es
inejecutable** — no "falla", simplemente no se puede correr. Ver §6.

**Cómo se declara:** en `progress/impl_<name>.md`, sección *Prueba Nivel B* — qué caso, qué comando,
contra qué base, y el resultado (o el pendiente asignado a una persona). **Sin esa declaración el
reviewer no aprueba**, aunque el Nivel A esté en verde.

---

## 2. Catálogo de checks del Nivel A

| Check | Qué valida | Nivel |
|---|---|---|
| **1 — archivos base** | Existen los 15 archivos del andamiaje. Si falta uno, el harness está incompleto. | `ERR` |
| **1b — toolset de subagentes** | Frontmatter de cada agente: prohíbe `Bash` (aquí el shell se llama `PowerShell`), exige los tools que el flujo de cada rol necesita, y **prohíbe** los que su rol no debe tener (`Edit` en `planner`, `reviewer` y `leader`). **La verificación más importante del harness: protege la capacidad de verificar.** | `ERR` |
| **2 — versión de Node** | Mínimo **22 LTS**, recomendado **24 LTS** (constantes `NODE_MIN` / `NODE_RECOMENDADO` en el gate). Advertencia de **entorno**, no de deuda: no cuenta para el baseline. El piso lo fijan las líneas LTS vigentes, no la máquina de quien corre el gate. | `WARN` |
| **3 — `feature_list.json`** | Estados válidos, **una sola feature activa** (`red`/`green`/`in_review`), y **reporta el conteo** por estado — sin esa línea el operador no sabe si el archivo se leyó. | `ERR` |
| **3b — bandera `needs_design`** | Toda feature está clasificada; si es `true`, su motivo **cita el disparador** (`D1`…`D11`) y existe `progress/design_<name>.md` cuando ya salió de `pending`. | `ERR` + `WARN` |
| **3c — trazabilidad criterio ↔ test** | Cada criterio de `acceptance` tiene entrada en `tdd_contract`, y para Nivel A el **texto exacto del `it()` se busca en el archivo declarado**. Un contrato que nadie comprueba se desincroniza del código. | `ERR` (features `tdd:true`) / `WARN` (legacy) |
| **3d — evidencia RED** | Las features `tdd: true` con código tienen en `progress/impl_<name>.md` una sección *Evidencia RED* con la salida de Jest fallando **antes** de implementar. | `ERR` |
| **4 — higiene de `src/`** | Sin `console.log`/`console.debug` en código de producción (el logger es Winston). Lista los `TODO`/`FIXME` como informativos. | `WARN` + `INFO` |
| **5 — build** | `npm run build` (`nest build`). Detecta explícitamente `node_modules` ausente en vez de reportar un fallo de compilación falso. | `ERR` |
| **6 — pruebas** | `npm test` (Jest). | `ERR` |
| **7 — recordatorio Nivel B** | Línea informativa con lo que el script **no** valida. Evita que `[OK]` se lea como "probado". | `INFO` |
| **baseline** | Compara las advertencias de **deuda** contra §4. No suma a la cuenta: informa. | `WARN` |

### Advertencias de **deuda** vs. de **entorno**

El baseline cuenta **solo la deuda del proyecto**. Las advertencias de entorno o de estado de sesión
(Node < 20, "sin feature activa", "modo `--estructura`") se marcan `(entorno)` y **no cuentan**.

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

**Regla:** el baseline vive en **§4 de este documento** y se refleja en
`feature_list.json → rules.baseline_advertencias`. Los agentes lo **leen de aquí**. La instrucción es
explícita en las cuatro definiciones de rol: **no lo cites de memoria.** Todo check nuevo que mueva el
baseline lo actualiza en la misma pasada.

---

## 4. Línea base vigente

**Medida el 2026-08-31** corriendo `npm run harness:estructura` sobre el repo en estado limpio.

| | |
|---|---|
| **Advertencias de deuda** | **2** |
| **Errores** | 0 |
| **Advertencias de entorno** (no cuentan) | Node 18.16.1; sin feature activa |

### Composición de las 2 advertencias

Las dos son **deuda preexistente** que el harness anterior no podía ver, no regresiones. Entran como
`WARN` a propósito, para que se prioricen sin que el gate quede en rojo.

| # | Origen | Hallazgo | Cómo se cierra |
|---|---|---|---|
| **D1** | CHECK 3c, feature #1 criterio 1 | Ningún test automático cubre el **401 de `GET /api/users/me`**. El e2e existente cubre `POST /api/users sin token devuelve 401`, que es **otro endpoint**: la protección de `/users/me` está afirmada, no probada. | Un caso e2e `GET /api/users/me sin token devuelve 401` (Nivel B), o un spec que verifique el metadato del guard en el controller (Nivel A). |
| **D2** | CHECK 3c, feature #1 criterio 3 | El formato `{ statusCode, message, resource, isError }` lo aplica `ResponseInterceptor` **globalmente y no tiene spec propio**. Un cambio ahí rompe *todos* los endpoints a la vez y ningún test lo detecta. | Un spec de `ResponseInterceptor` que verifique la forma del envoltorio, y otro de `HttpExceptionFilter` para la forma del error. |

Ambas están registradas en el `tdd_contract` de la feature #1 con `nivel: "pendiente"` y su nota. La
feature está marcada `tdd: false` porque **se cerró antes de este upgrade**: el CHECK 3d no le exige
evidencia RED, y sus brechas se reportan como advertencia y no como error. Las features nuevas nacen
con `tdd: true` y ahí un criterio sin cobertura **es error**.

### Cuando el conteo se mueve

- **Sube** → algo nuevo se introdujo. Investígalo **antes** de avanzar; no lo normalices subiendo el número.
- **Baja** → se resolvió deuda. **Actualiza §4 y `feature_list.json` en la misma pasada**, o el
  siguiente `leader` se detendrá con el repo correcto.

---

## 5. Prueba negativa del gate

> Un check que nunca falla no protege nada.

Cada check nuevo se valida rompiendo algo a propósito y confirmando que el gate lo atrapa.

**Ejecutada el 2026-08-31**, al adoptar los CHECK 1b / 3c. Los tres bugs se reintrodujeron a la vez:

| Se rompió | Resultado esperado | Resultado real |
|---|---|---|
| `leader.md` regresado a `tools: … Bash …` | `[ERR]` + exit 1 | ✅ dos errores (declara `Bash` + le falta `PowerShell`) |
| `reviewer.md` sin `Write` | `[ERR]` + exit 1 | ✅ |
| `tdd_contract` con el nombre de un `it()` que no existe | `[ERR]` + exit 1 | ✅ |

### 5.1. Bitácora

```
--- CASO 1: los tres bugs reintroducidos (exit=1) ---
[ERR ] Agente 'leader' declara 'Bash': en este harness el tool de shell se llama
       'PowerShell'. Declarar 'Bash' NO da un shell alterno, deja al agente SIN
       shell y sin poder correr este gate. Cambialo a 'PowerShell'.
[ERR ] Agente 'leader': su flujo exige PowerShell pero no lo declara en 'tools:'.
[ERR ] Agente 'reviewer': su flujo exige Write pero no lo declara en 'tools:'.
[ERR ] Feature #1 perfil_usuario_autenticado, criterio 2: el test declarado NO existe
       en src/users/users.controller.spec.ts -> "getMe devuelve un perfil bonito".
       El contrato quedo desincronizado del codigo: renombraron el it() o el test se borro.
[BASELINE] 2 advertencias de deuda == baseline 2.
[FAIL] 4 error(es), 5 advertencia(s). El entorno NO esta listo.

--- RESTAURADO: corrida limpia (exit=0) ---
[OK] Toolsets revisados: 5 agente(s).
[OK] Criterios con contrato: 2 en Nivel A (verificados en disco), 1 en Nivel B, 2 sin cobertura.
[BASELINE] 2 advertencias de deuda == baseline 2.
[OK] Entorno integro (Nivel A parcial). 5 advertencia(s). Recuerda el Nivel B.
```

### 5.2. Lo que la prueba negativa encontró en el gate mismo ⚠️

**El primer intento de esta prueba destapó un hueco real en `verify.mjs`, no en los agentes.**

Los archivos rotos se escribieron con `Set-Content -Encoding UTF8` de PowerShell 5.1, que **agrega
BOM**. Con un BOM al inicio, el regex del frontmatter no casa y el CHECK 1b **degradaba a una
advertencia** —*"Agente 'leader': sin frontmatter YAML delimitado por ---; no se pudo validar su
toolset"*— en lugar de detectar que al `leader` le habían quitado el shell. En paralelo, `JSON.parse`
tronaba con `Unexpected token ﻿ in JSON at position 0` y el CHECK 3 completo se caía.

O sea: **el BOM apagaba en silencio justo la verificación que existe para que nada se apague en
silencio.** Y en Windows el BOM no es un caso exótico: cualquier editor lo agrega al guardar.

**Corrección:** todo el gate lee por un único `leerAbs()` que quita el BOM. Verificado con un tercer
caso de prueba negativa:

```
--- CASO 2: leader.md CON BOM y contenido correcto (exit=0) ---
BOM presente en leader.md: True
[OK] Toolsets revisados: 5 agente(s).      <-- valida el toolset en vez de degradar
[OK] Entorno integro (Nivel A parcial). 5 advertencia(s).
```

**Lección, la misma de siempre:** *ejecuta la verificación candidata contra el repo real y lee la
salida antes de dejarla fija.* Este hueco no se ve leyendo el código del gate; se ve corriéndolo.

---

## 6. Pendientes de entorno (no son deuda de código)

1. **Actualizar Node a 24 LTS** (mínimo 22). Por debajo del mínimo el build y las pruebas unitarias
   corren, pero la app **no arranca** y el **Nivel B es imposible de ejecutar**. Es el bloqueo más
   importante del repo: sin él, la mitad del gate no existe.
2. **Sin carpeta de migraciones.** `synchronize` está apagado en producción, así que hoy ningún cambio
   de esquema tiene camino a producción. Cualquier feature que dispare **D4** debe resolverlo en su
   diseño.
3. **Techo del `target` de TypeScript: lo pone el linter, no el compilador.** TypeScript 6.0.3 acepta
   `target: es2025` (la base oficial de Node 26), pero typescript-eslint 8.69.0 no conoce los valores
   de `lib` que TS 6 deriva de ahí y falla con *"Invalid value for lib provided: es2025.iterator"* en
   **todos** los archivos. Hasta que typescript-eslint publique soporte, el máximo utilizable es
   `es2024` (base de Node 24). Medido el 2026-08-31.
4. **TypeScript 7 está bloqueado por el toolchain**, no por el código: `ts-jest` declara
   `typescript >=4.3 <7` y `typescript-eslint` declara `>=4.8.4 <6.1.0`. Subir a 7 rompería las pruebas
   y el linter a la vez. Revisar cuando ambos publiquen soporte.
5. **18 hallazgos de eslint preexistentes** (8 de formato `prettier`, 10 de `no-unsafe-*` sobre `any` en
   specs y e2e). No están en el baseline porque el gate **no corre eslint**: es una brecha entre lo que
   `CHECKPOINTS.MD` exige y lo que el gate verifica. Antes de meterlos al gate hay que limpiarlos, o
   entrarían como un check que grita desde el día uno.
