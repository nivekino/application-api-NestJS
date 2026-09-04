# Revisión — #3 `migracion_nestjs_12_esm`

> Revisor: `reviewer`. Fecha: 2026-09-04. Feature en `status: green` al momento de la revisión.

---

## 1. Nivel A — `npm run harness:verify`

Corrida propia (no la del implementer), repo en el estado actual del árbol de trabajo:

```
[OK] Los 24 archivos base existen.
[OK] Toolsets revisados: 4 agente(s).
[OK] Node 24.20.0 (piso: 24 LTS; acordado en .nvmrc: 24.20.0).
[OK] 4 feature(s) con estado valido (done=3, green=1). Feature activa: #3 [green].
[OK] Todas las features estan clasificadas con needs_design.
[OK] Criterios con contrato: 14 en Nivel A (verificados en disco), 3 en Nivel B, 0 sin cobertura.
[OK] 3 feature(s) tdd:true revisada(s).
[OK] Todas las features son tdd:true (exentas legacy declaradas: 1).
[OK] 26 archivo(s) .ts de produccion sin codigo de depuracion.
[OK] 13 archivo(s) de prueba sin .only ni tests deshabilitados.
[OK] Build correcto.
[OK] Typecheck sin errores fuera de la fase RED.
[OK] Lint limpio en 42 archivo(s) (0 errores, 0 advertencias).
[OK] Pruebas en verde: 34/34 tests, 0 suite(s) rota(s).
[OK] Cobertura sobre el minimo: lineas 80.08%, sentencias 80.45%, funciones 76.19%, ramas 67.97%.
[BASELINE] 0 advertencias de deuda == baseline 0.
[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

**`[OK]` limpio, exit 0. Sin `[INFO]` de holgura de cobertura** (el trinquete ya se aplicó en la misma
pasada: piso subido de 72/73/66/61 a **76/76/72/64** en `feature_list.json` **y** en
`docs/verifications.md` §4, coincidiendo exactamente con la medición 80.08/80.45/76.19/67.97 — no hay
desalineación entre los dos documentos).

**Baseline de advertencias de deuda:** `docs/verifications.md` §4 vigente registra **0**, medido el
2026-09-04 sobre este mismo estado del repo. El gate confirma 0 == 0. Sin advertencias nuevas.

## 2. Puntos de especial cuidado pedidos por el leader

**(1) Instalación sin `--legacy-peer-deps`/`--force`, deduplicación, `nest-winston` fuera.**
Confirmado en disco, no solo en la bitácora:
- `package-lock.json`: una sola entrada `node_modules/@nestjs/common` → `12.0.1` (grep, sin duplicados).
- `grep -c "nest-winston" package-lock.json` → 0 coincidencias reales (la única coincidencia
  case-insensitive de "Kata" en el lockfile es un falso positivo dentro de un hash de integridad
  —`vKatAh4Sl...`—, no una mención real).
- `package.json`: `dependencies` con los ocho paquetes de runtime en 12.x y `devDependencies` con
  `cli`/`schematics`/`testing` en 12.x; ninguno quedó mal clasificado (`nest build` y `npm run
  harness:verify` lo confirman indirectamente: si `@nestjs/common` estuviera en `devDependencies`, un
  `npm ci --omit=dev` real rompería, pero eso queda fuera del alcance de un `npm ci` de desarrollo — es
  Nivel B/operativo, aceptable como declaración).
- La bitácora del `npm i` (§11.2 del impl) documenta con honestidad que el plan de dos comandos del
  diseño **no funcionó** (`ERESOLVE` real en ambos órdenes) y que la resolución fue un solo `npm i` de
  once paquetes + corrección manual de secciones. Es una desviación **documentada** del diseño (§11.14),
  no oculta, y no usa los flags prohibidos en ningún punto de la bitácora pegada.

**Veredicto del punto 1: OK.**

**(2) `--experimental-vm-modules` en scripts `test*` y CHECK 6.**
Justificado con evidencia reproducible: el propio impl (§11.6) muestra que Node 24.20.0 (≥ 24.9, la
condición que asumía el diseño en C6) **no basta**: `vm.SourceTextModule` vive detrás de la bandera
experimental y sin ella `npx jest src/app.controller.spec.ts` falla con
`Must use import to load ES Module`. La solución (bandera de Node, sin dependencias nuevas como
`cross-env`) es la misma que documentan Node/Jest para este caso, y reutiliza el patrón que
`test:debug` ya usaba. Coherencia verificada:
- `package.json` → `test`, `test:watch`, `test:cov`, `test:debug`, `test:e2e` invocan
  `node --experimental-vm-modules node_modules/jest/bin/jest.js ...`. ✅
- `scripts/harness/verify.mjs` CHECK 6 (línea ~873) invoca la misma forma, con comentario explicando el
  porqué. ✅
- `.github/workflows/gate.yml` solo invoca `npm run harness:verify` (no invoca Jest directo), así que
  no necesita cambio propio: hereda el fix vía el script. ✅ Coherente.
- `test/jest-e2e.json` no declara ninguna invocación de Jest por sí mismo (es config, no script); el
  script `test:e2e` de `package.json` ya antepone la bandera. ✅ Coherente.
- `docs/verifications.md` §6 punto 3 documenta el hallazgo con el mismo nivel de detalle que el impl.

**Veredicto del punto 2: OK, justificado y documentado en el lugar correcto.**

**(3) `overrideGuard` en `users.controller.spec.ts`.**
Motivo real y verificable: a partir de NestJS 12, `Test.createTestingModule().compile()` instancia los
guards de clase, y `JwtAuthGuard` (`AuthGuard('jwt')`) exige `AuthModuleOptions` que ese spec no
registra a propósito. Confirmado leyendo el archivo (`src/users/users.controller.spec.ts:51-64`): el
comentario explica el cambio de comportamiento entre versiones, y el `overrideGuard` solo afecta **ese**
`TestingModule** (no es un cambio global). La cobertura del guard sigue viva e intacta en
`src/users/users.controller.guard.spec.ts`, que **no fue tocado**, sigue verificando
`GUARDS_METADATA` sobre la clase real `UsersController` con `JwtAuthGuard` sin ningún doble. No hay
debilitamiento de esa prueba. Está documentado como desviación en `progress/impl_migracion_nestjs_12_esm.md`
§11.7, §11.12.3 y §11.14, y en `docs/verifications.md` §6 punto 3.

**Veredicto del punto 3: OK.**

**(4) Código G1/G2 llegado antes de la puerta humana.**
El impl (§11 intro y §11.1) es explícito y no intenta esconder la secuencia real: el logger propio y el
cableado de `app.module.ts`/`main.ts`/`http-exception.filter.ts`/`winston.config.ts` ya estaban en el
árbol de trabajo (sin commit) cuando arrancó la fase GREEN, documentados retroactivamente. Se verificó:
- La *Evidencia RED* de §3 del impl (previa, con hash de partida `c52e811...` en §1) **no fue alterada**:
  el fallo de `framework-nestjs12.spec.ts` contra `package.json` en 11.x y el `Cannot find module` de
  los dos specs del logger son el rojo real, capturado antes de que ese código existiera.
- El código de `winston-logger.service.ts`/`logger.module.ts`/`logger.tokens.ts` coincide literalmente
  con el contrato §4.1–§4.3 del diseño (verificado leyendo los tres archivos).
- Es una desviación de **proceso** (el orden formal "primero aprobación, después código" no se respetó
  al pie de la letra para G1/G2), pero está declarada con honestidad, no oculta ni disfrazada de otra
  cosa, y el contenido técnico es correcto y trazable. No encuentro una forma en que esto haya
  contaminado el veredicto de la batería: la evidencia RED sigue siendo creíble porque el comportamiento
  que prueba (T1–T7) es el mismo que el diseño pactó, y el reviewer puede verificar el código resultante
  independientemente de cuándo se escribió.

**Veredicto del punto 4: observación de proceso, no bloqueante.** Se registra como hallazgo de
disciplina (el orden formal de la puerta humana debe respetarse a futuro incluso cuando el código
"ya está ahí"), pero no invalida la evidencia RED ni el contrato.

**(5) Trinquete de cobertura.** Verificado arriba (Nivel A): `feature_list.json` y
`docs/verifications.md` §4 coinciden en 76/76/72/64, y la medición del gate (80.08/80.45/76.19/67.97) no
deja holgura ≥ 5 puntos sin subir. **OK.**

**(6) Criterio 4 — Nivel B documental.** Contrastado archivo por archivo contra la lista de §8.3 del
diseño:

| Documento | Actualizado | Verificado |
|---|---|---|
| `CLAUDE.md` | Sí | "NestJS 12 publica todos los `@nestjs/*` como ESM puro" (línea 11), stack vigente y sección Verificación con `engines >=24.15.0` |
| `README.md` | Sí | "NestJS 12 + TypeORM 1.x + PostgreSQL" (línea 4), nota CommonJS/ESM (línea 7) |
| `docs/README.md` | Sí | "`application-api-NestJS` (NestJS 12, hoy 12.0.1...)" (línea 4) |
| `docs/01-plan-migracion.md` | Sí | Fila de Winston reescrita: "`nest-winston` no soporta NestJS 12 y se reemplazó por un adaptador propio" |
| `docs/verifications.md` §4/§5/§6 | Sí | §4 línea base e histórico; §5.3 cierra la prueba negativa pendiente ("spec que no compila"); §6 puntos 1/3/5 con P1/P2/P3 y el hallazgo `--experimental-vm-modules` |
| `.claude/agents/planner.md`, `leader.md`, `reviewer.md`, `implementer.md` | Sí | Los cuatro encabezados dicen "NestJS 12.0.1"; `planner.md` acoplamientos 9 y 12 reescritos |
| `feature_list.json` (description del proyecto) | Sí | "API NestJS 12 + TypeORM 1.x/PostgreSQL..." |
| `src/main.ts` (Swagger) | Sí | `.setDescription('API migrada desde Express hacia NestJS 12.')` |
| `docs/checkpoints/*` | **Tocado parcialmente** (ver §4 de este veredicto) | Solo una palabra en `CP-05-cross-cutting.md` (ver hallazgo abajo); el contenido histórico de la migración no se alteró |

**Veredicto del punto 6: sustancialmente OK**, con una imprecisión documental menor (ver Hallazgo A).

**(7) Nivel B.** Declarado en `progress/impl_migracion_nestjs_12_esm.md` §11.16 (y resumido en
`progress/current.md`): casos B1–B7 con comando exacto, base exigida (desechable, nunca DEV/QA), y
motivo verificable de por qué no se ejecutó en esta sesión (`Test-Path .env` → `False`, `docker info`
sin sección `Server`). Asignado explícitamente como pendiente para una persona, con la preparación
mínima (`docker run ... postgres:17`, `cp .env.example .env`, comandos). **Cumple el requisito de
CHECKPOINTS.MD: "el Nivel B no se sustituye, se declara"**. No rechazo por no haberse ejecutado.

**(8) Menciones a Kata/Formiik.** `grep -ri "Kata|Formiik"` sobre todo el repo devuelve solo:
`progress/current.md`, `progress/impl_migracion_nestjs_12_esm.md` (las notas de bitácora que registran
la propia limpieza, permitidas explícitamente por el encargo) y una coincidencia dentro de un hash
base64 de `package-lock.json` (`vKatAh4Sl...`, falso positivo, no es texto). **No se reintrodujo ninguna
mención real en `src/`, `docs/`, `.claude/`, `README.md` ni `package.json`.**

⚠️ **Nota para el humano, fuera del alcance técnico de esta revisión:** verifiqué el hecho solicitado
(no quedan menciones), pero señalo que el encargo describe este repositorio como "proyecto personal de
aprendizaje" y pide retirar toda referencia a Kata Software, mientras que el contexto operativo con el
que trabajo como revisor de Kata Software describe explícitamente este mismo dominio (crédito y
cobranza para banca de microcréditos en LATAM) como trabajo de Kata. No me corresponde resolver esa
tensión ni bloquear la revisión técnica por ella —la decisión de branding la tomó el usuario y quedó
registrada en `progress/current.md`—, pero la dejo explícita para que el equipo confirme que el retiro
de marca es la decisión correcta antes de que este repositorio salga de un entorno de trabajo interno.

## 3. Disciplina TDD

- **Evidencia RED (§3 del impl):** creíble. Menciona los tres archivos nuevos (`winston-logger.service.spec.ts`,
  `logger.module.spec.ts`, `framework-nestjs12.spec.ts`) con su fallo real (`Cannot find module` para
  los dos primeros, `expect(desalineados).toEqual([])` fallando contra los paquetes en 11.x para el
  tercero) y declara explícitamente que `http-exception.filter.spec.ts` (T9, ancla heredada) sigue en
  verde — exactamente la "trampa del gate" que el propio diseño advertía en §5.4. `red_modo: nuevo` es
  correcto: el comportamiento no existía.
- **Trazabilidad (CHECK 3c + verificación de fondo):** los `it()` de T1, T7, T8 y T9 existen con el
  texto exacto en sus archivos (confirmado leyendo cada spec) y **prueban lo que dicen**: T1–T6 afirman
  con `toHaveBeenCalledWith` el nivel de winston y el metadato exacto (no solo que no truena); T7 compila
  el módulo real vía `Test.createTestingModule` y verifica `moduleRef.get(HttpExceptionFilter)` +
  `moduleRef.get(APP_LOGGER)` — exactamente el modo de falla (dependencia sin resolver) que el diseño
  identificó como el de mayor riesgo; T8 verifica igualdad exacta de versiones y que `Injectable` resuelva
  como función real bajo `require(esm)`.
- **Sin mocks donde el criterio exige realidad:** T7 no mockea el módulo, lo compila; la superficie
  ESM/CommonJS (T8) se prueba con un `import` estático real, no un mock.
- **Mocks tipados:** `jest.Mocked<Pick<WinstonLike, 'log'>>`, `jest.Mocked<Pick<LoggerService, 'log' |
  'error' | 'warn'>>`. Sin `any` ni `as jest.Mock`.
- **Sin `eslint-disable` nuevos:** `grep -r "eslint-disable" src/` → 0 coincidencias.
- **Refactor con la batería en verde:** no aplicó refactor adicional; documentado como tal (§11.13).

## 4. Hallazgos por criterio

| Criterio | Test / evidencia | Veredicto |
|---|---|---|
| 1 — App arranca con `@nestjs/*` 12 sin flags prohibidos | T8 (`framework-nestjs12.spec.ts`) + bitácora `npm i`/`npm ls` (Nivel B declarado + verificado en lockfile) | OK |
| 2 — Logger Winston sigue operando; filtro sigue registrando método/ruta/status | T1–T6 (`winston-logger.service.spec.ts`), T7 (`logger.module.spec.ts`), T9 en verde (`http-exception.filter.spec.ts`) | OK |
| 3 — Nivel B `test:e2e` contra PostgreSQL con Node de `.nvmrc` | Declarado como pendiente asignado a una persona (§11.16), con comando y base exactos | Cumple el requisito de declaración; **queda abierto para producción** |
| 4 — Documentación refleja versiones y piso de Node | Revisión documental (ver tabla §2.6 arriba) | OK, con la nota menor del Hallazgo A |

Ningún criterio queda en `pendiente` sin cobertura declarada.

## 5. Hallazgos y observaciones (no bloqueantes)

- **Hallazgo A (menor):** `progress/impl_migracion_nestjs_12_esm.md` línea 611 afirma *"No se editó
  `docs/checkpoints/*` (histórico, fuera del alcance por regla explícita de `CLAUDE.md`)"*. Es
  **inexacto**: `docs/checkpoints/CP-05-cross-cutting.md` sí se modificó (una palabra: "Seguridad Kata"
  → "Seguridad de datos", parte de la limpieza de marca registrada en `progress/current.md`, no de esta
  feature). El contenido histórico no se alteró en su sustancia, pero la afirmación del impl debería
  corregirse para no quedar en desacuerdo con `git diff`. **Acción sugerida:** ajustar esa línea en la
  próxima pasada de documentación (no requiere reabrir el ciclo).
- **Observación de proceso (punto 4 del leader):** G1/G2 llegaron al árbol antes de que se registrara
  la aprobación formal de la batería en rojo. La disciplina de la puerta humana debe respetarse en el
  orden formal en futuras features, aun cuando el código de una fase previa ya esté presente en el
  árbol de trabajo.
- Los cambios adicionales fuera del `tdd_contract` no listados explícitamente en `impl_migracion_nestjs_12_esm.md`
  §11.11 (`eslint.config.mjs`, `docs/00-analisis-proyectos.md`, `docs/checkpoints/CP-05-cross-cutting.md`,
  `progress/design_error_500_sin_detalle_interno.md`, `progress/impl_error_500_sin_detalle_interno.md`,
  `progress/impl_pruebas_guard_401_y_formato_respuesta.md`, `src/common/filters/http-exception.filter.spec.ts`)
  se verificaron uno por uno con `git diff`: **todos son la limpieza de marca "Kata" → texto genérico**,
  sin cambio de comportamiento ni de contenido técnico. Están explicados en `progress/current.md` como
  una acción del leader "fuera del ciclo", separada de esta feature. No representan una desviación de
  alcance de la feature #3.

## 6. Veredicto

# APROBADO

El gate de dos niveles pasa en `[OK]` limpio (sin holgura de cobertura pendiente), la disciplina TDD es
creíble y trazable (evidencia RED real, `it()` que prueban resultado, sin mocks donde el diseño exigía
compilar el módulo real), las cuatro desviaciones señaladas por el leader están documentadas con motivo
verificable y ninguna debilita una prueba existente, el Nivel B está correctamente declarado con
comando y base exactos para quien lo retome, y la documentación del criterio 4 está prácticamente
completa (Hallazgo A es una imprecisión de una línea, no una omisión de fondo).

**Antes de mover la feature a `done`, dejar constancia (no bloqueante para este veredicto):**
1. Corregir la línea de `progress/impl_migracion_nestjs_12_esm.md` que afirma que `docs/checkpoints/*`
   no se tocó (Hallazgo A).
2. Alguien debe ejecutar B1–B7 (Nivel B) contra una base desechable antes de considerar cerrado el
   riesgo real de invalidación de JWT, `ValidationPipe`, Swagger y logger en runtime — la feature puede
   pasar a `done` con el Nivel B declarado, pero el riesgo operativo señalado en `progress/current.md`
   ("el leader debe saber que cierra la feature con el riesgo abierto") sigue siendo válido hasta que
   alguien lo corra.
