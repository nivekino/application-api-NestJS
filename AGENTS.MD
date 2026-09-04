# AGENTS.MD — Mapa de navegación del harness

Guía de **disclosure progresivo**: qué leer y cuándo, para no saturar el contexto. Aplica a cualquier
agente (humano o IA) que trabaje en este repositorio. Complementa a `CLAUDE.md` (que define el rol y
las convenciones). Idioma: **español de negocios (México)**.

Este archivo es un **mapa, no una biblia**: lee sólo lo que necesites, cuando lo necesites.

## 1. Antes de empezar (obligatorio)

1. Corre `npm run harness:verify`. Si da `[FAIL]`, **detente y reporta**: no se trabaja sobre un
   entorno roto. (Con `node_modules` ausente: `npm ci` primero; falla si tu Node no cumple `engines`.)
2. Compara las advertencias de deuda contra el **baseline vigente de
   [docs/verifications.md](docs/verifications.md) sección 4**. ⚠️ **No lo cites de memoria.** Más
   advertencias que el baseline = algo nuevo se introdujo: investígalo antes de avanzar.
3. Revisa `progress/current.md`. Si hay una feature en estado activo, **retómala donde quedó**.
4. Si no, selecciona la `pending` de **menor `id`** de `feature_list.json`.

## 2. Estructura del repositorio (qué leer y cuándo)

| Archivo / carpeta | Para qué sirve | Cuándo leerlo |
|---|---|---|
| `CLAUDE.md` | Rol, patrón de trabajo, convenciones, reglas de negocio, stack vigente | Siempre, al inicio |
| `AGENTS.MD` (este) | Mapa de navegación y reglas de proceso | Siempre, al inicio |
| `feature_list.json` | Backlog, estados, banderas (`needs_design`, `tdd`, `red_modo`), `tdd_contract`, reglas, baseline y piso de cobertura | Al elegir o actualizar trabajo |
| `CHECKPOINTS.MD` | Definición de "Hecho" | Implementer (antes) y reviewer (al validar) |
| `docs/verifications.md` | **El gate de dos niveles, el baseline de advertencias y el piso de cobertura** (única fuente de verdad), techos del toolchain | Antes de correr o interpretar el gate |
| `.claude/agents/planner.md` | **Tabla de disparadores de diseño** y **acoplamientos ocultos del proyecto** (única fuente de verdad) | Al clasificar una feature y antes de implementar |
| `progress/current.md` | Estado de la sesión activa | Al arrancar y **durante** el trabajo |
| `progress/history.md` | Bitácora append-only de features cerradas y mantenimientos del harness | Al cerrar; y para no re-litigar decisiones |
| `docs/01-plan-migracion.md` | Roadmap y **tabla de mapeo de arquitectura** | Al diseñar una feature |
| `docs/00-analisis-proyectos.md` | Inventario funcional del proyecto origen Express | Si replicas lógica heredada |
| `docs/checkpoints/` | Historia de la migración (CP-00…CP-06) | Referencia histórica |
| `src/` y `test/` | Código de la API y pruebas | Al implementar o revisar |
| `.claude/agents/` | Definiciones de los cuatro roles | Al delegar |
| `scripts/harness/verify.mjs` | El gate (Nivel A). Sus comentarios explican el **por qué** de cada check | Si un check falla y no entiendes el motivo |
| `.nvmrc`, `.npmrc`, `.gitattributes`, `.prettierrc`, `eslint.config.mjs`, `tsconfig*.json` | Toolchain acordado (Node, engines, LF, formato, lint, compilador) | Al tocar configuración; cada uno explica sus decisiones |
| `compose.yaml`, `Dockerfile`, `scripts/e2e-docker.mjs`, `.github/workflows/gate.yml` | **Nivel B reproducible:** PostgreSQL desechable + imagen de la API, y lo que CI ejecuta (gate, e2e, smoke) | Al ejecutar o declarar el Nivel B |

## 3. El ciclo

```
pending ─→ [planner si needs_design] ─→ (implementer fase RED) ─→ red
                                                                   │
                                              ⏸ PUERTA HUMANA: se aprueba la batería
                                                                   │
   done ←── [reviewer] ←── in_review ←── green ←── (implementer fase GREEN)
```

| Rol | Qué hace | Qué NO hace |
|---|---|---|
| `leader` | Corre el gate, elige la feature, delega, cierra | No edita `src/` ni `test/` |
| `planner` (Opus) | Diseña: contrato, precedente a espejar, batería de tests con `red_modo`, acoplamientos | No implementa; no mueve el estado |
| `implementer` (Sonnet) | Fase RED: sólo tests + evidencia (por mutación si es caracterización) + gate en `[OK]`. Fase GREEN: código mínimo + refactor en verde | No marca `done`; no se autoaprueba |
| `reviewer` | Verdicto APROBADO/RECHAZADO contra `CHECKPOINTS.MD` | No corrige lo que revisa |

**Sólo con veredicto APROBADO** se marca `done`.

## 4. Reglas no negociables

- **Una feature activa a la vez** (`red` / `green` / `in_review`). Lo valida el gate.
- **Toda feature nace con `tdd: true`.** La única excepción es la lista explícita
  `rules.tdd_exentas_legacy`. Lo valida el CHECK 3e.
- **El test se escribe antes del código y se demuestra en rojo.** La *Evidencia RED* en
  `progress/impl_<name>.md` es obligatoria, menciona cada archivo de la batería, y el gate la exige
  desde el estado `red`. Si el código ya existe (`red_modo: caracterizacion`), el rojo se demuestra por
  **mutación** y la evidencia la describe.
- **El gate debe estar en `[OK]` también en `red`:** tolera fallos sólo dentro de la batería declarada.
- **No se salta la puerta humana.** La batería de tests es donde el alcance se decide de verdad; un
  test que nadie revisó define el comportamiento correcto por omisión.
- **`[OK]` no significa "probado":** significa "el Nivel A pasó". El Nivel B se **declara**.
- **Cada criterio tiene su prueba nombrada.** Sin entrada en `tdd_contract`, no hay cierre.
- **Lint limpio con `--max-warnings=0`, typecheck de `src/` y `test/`, cobertura sobre el piso.** El
  piso es un trinquete: si hay holgura, se sube en la misma pasada.
- **Documenta en el momento**, no al final: actualiza `progress/current.md` mientras trabajas.
- **No cites números de memoria** (baseline, piso de cobertura, salt rounds, conteos): léelos de su
  fuente de verdad.
- **Repo limpio:** sin archivos temporales, código de depuración, `.only`, tests deshabilitados ni
  TODOs sin contexto.
- **Datos sensibles:** nunca contraseñas, secretos ni cadenas de conexión en logs, respuestas ni docs.

## 5. Regla anti-"teléfono descompuesto"

Los subagentes **escriben sus hallazgos en archivos** (`progress/design_<name>.md`,
`impl_<name>.md`, `review_<name>.md`, `explore_<tema>.md`) y devuelven **una sola línea con la
referencia**, nunca el contenido completo por chat. El líder lee los archivos.

El estado vive en **disco, no en el contexto del modelo**: una sesión nueva reconstruye dónde iba
leyendo `feature_list.json` + `progress/current.md`.

## 6. Cierre de sesión

1. Corre `npm run harness:verify` → `[OK]`.
2. Con veredicto APROBADO: `status = done` en `feature_list.json`.
3. Mueve el resumen de `progress/current.md` al final de `progress/history.md`.
4. Resetea `progress/current.md` a su plantilla.
5. Si se resolvió deuda del baseline o el gate informó holgura de cobertura, actualízalo en
   `docs/verifications.md` sección 4 **y** en `feature_list.json`, en esta misma pasada.

## 7. Protocolo de bloqueo

Si te atoras, primero consulta la documentación relevante (sección 2). Si una herramienta falla de
forma inesperada, **documenta el problema y detente**: deja la feature en `blocked` con su causa, en
lugar de inventar un workaround.
