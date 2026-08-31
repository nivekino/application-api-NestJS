---
description: Ejecuta el ciclo TDD completo de una feature (planner si needs_design → RED → puerta humana → GREEN → reviewer → cierre).
argument-hint: "[id o name de la feature; opcional]"
---

Ejecuta un ciclo **completo** de feature del harness. Si se indicó `$ARGUMENTS`, úsalo como la feature
objetivo (por `id` o `name`); si no, toma la `pending` de **menor `id`** (**nunca** una `blocked`).

Actúa como el agente [`leader`](../agents/leader.md) y sigue su flujo:

1. **Arranque:** corre `npm run harness:verify`. Si `[FAIL]`, detente y reporta. Compara las
   advertencias de deuda contra el baseline vigente de `docs/verifications.md` sección 4 — **no lo
   cites de memoria**; más advertencias que el baseline = algo nuevo se introdujo, investígalo antes
   de avanzar.

2. **Selección:** feature de `$ARGUMENTS` o la `pending` de menor `id`. Verifica que no haya otra en
   estado activo (`red` / `green` / `in_review`). Si ya hay una activa, **retómala donde quedó** en
   lugar de abrir otra.

3. **Diseño (por bandera, no por criterio propio):** lee `needs_design` de la feature.
   - `true` → delega al subagente [`planner`](../agents/planner.md) (Opus). Espera
     `diseño → progress/design_<name>.md`, léelo, preséntale al usuario las preguntas abiertas y
     **detente hasta su "go" explícito**. Atajo para sólo esta fase: [`/design`](design.md).
   - `false` → sáltate el paso.
   - **Ausente** → abre [`planner.md` §Disparadores](../agents/planner.md) (**única fuente de verdad**),
     evalúa la tabla, y escribe `needs_design` + `needs_design_motivo` en `feature_list.json` **antes**
     de seguir. Ante la duda, `true`.

4. **Fase RED (delegada):** lanza el subagente `implementer` en **fase RED**. Debe escribir **solo los
   tests**, correr `npm test`, pegar la salida en rojo en la sección *Evidencia RED*, escribir el
   `tdd_contract` en `feature_list.json` y dejar la feature en `red`. Espera
   `red → progress/impl_<name>.md`.

5. **⏸ PUERTA HUMANA:** léele al usuario la batería de tests (nombre de cada `it()` y qué criterio de
   `acceptance` cubre) y **detente hasta su aprobación explícita**. Es el único punto donde el ciclo se
   detiene solo: la batería de tests es donde el alcance se decide de verdad. Si pide más casos,
   re-delega la fase RED.

6. **Fase GREEN (delegada):** con el "go", lanza el `implementer` en **fase GREEN**. Debe implementar
   hasta que toda la batería pase, refactorizar en verde, correr el gate hasta `[OK]`, **declarar la
   prueba de Nivel B** y dejar la feature en `green`. Espera `green → progress/impl_<name>.md`.

7. **Revisión (delegada):** cambia la feature a `in_review` y lanza el subagente `reviewer`. Debe
   validar contra `CHECKPOINTS.MD`, verificar la evidencia RED y la trazabilidad, correr el gate y
   escribir el veredicto en `progress/review_<name>.md`. Léelo.

8. **Cierre:**
   - **APROBADO:** `status = done`, mueve el resumen a `progress/history.md`, resetea
     `progress/current.md`, corre `npm run harness:verify` → `[OK]`. Si se resolvió una advertencia del
     baseline, actualízalo en `docs/verifications.md` sección 4 **y** en `feature_list.json` en esta
     misma pasada.
   - **RECHAZADO:** regresa la feature a `green`, resume los cambios requeridos y pregunta si reintenta
     la fase GREEN o la marca `blocked`.

Recuerda el **gate de dos niveles**: no cierres si el `reviewer` no confirma que el **Nivel B**
(comportamiento contra PostgreSQL real) quedó declarado en `progress/impl_<name>.md`.

Regla anti-teléfono-descompuesto: los subagentes devuelven solo la **referencia al archivo** en
`progress/`, no el contenido. No edites `src/` ni `test/` directamente.

Feature objetivo (opcional): $ARGUMENTS
