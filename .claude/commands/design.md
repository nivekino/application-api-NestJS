---
description: Diseña una feature antes de implementarla (planner → progress/design_<name>.md). No escribe tests ni código.
argument-hint: "[id o name de la feature; opcional]"
---

Ejecuta **sólo la fase de planeación** del harness. Si se indicó `$ARGUMENTS`, úsalo como la feature
objetivo (por `id` o `name`); si no, toma la `pending` de **menor `id`** (**nunca** una `blocked`).

Actúa como el agente [`leader`](../agents/leader.md) limitado a su paso de diseño:

1. **Arranque:** corre `npm run harness:verify`. Si `[FAIL]`, detente y reporta. El baseline vigente de
   advertencias de deuda vive en `docs/verifications.md` sección 4 — **no lo cites de memoria**.

2. **Selección:** feature de `$ARGUMENTS` o la `pending` de menor `id`. **No** cambies su `status`
   (sigue `pending`).

3. **Clasificación:** si la feature no trae `needs_design`, evalúa
   [`planner.md` §Disparadores](../agents/planner.md) (**única fuente de verdad**) y escribe
   `needs_design` + `needs_design_motivo` citando el disparador por su clave (p. ej. `"D3 - ..."`).
   Ante la duda, `true`.

4. **Diseño:** delega al subagente [`planner`](../agents/planner.md) (Opus) vía la herramienta Agent.
   Espera `diseño → progress/design_<name>.md` y **lee ese archivo**.

5. **Cierre de la fase:** resume al usuario, en pocas líneas:
   - el alcance propuesto y el **precedente de la casa a espejar**;
   - la **batería de tests propuesta** (es lo que aprobará en la puerta humana del ciclo);
   - los **acoplamientos detectados** (invalidación de JWT, `ValidationPipe` con
     `forbidNonWhitelisted`, doble envoltura del interceptor, `synchronize` sin migraciones, la entidad
     que no debe salir por la API, datos sensibles en logs);
   - la **alternativa descartada** y por qué;
   - las **preguntas abiertas / PENDIENTES** que requieren decisión de negocio o de plataforma.

**Detente aquí.** No delegues la fase RED ni edites `src/` o `test/`. La implementación arranca sólo
con el **"go" explícito del usuario** — entonces se continúa con [`/feature`](feature.md), que ya
seguirá el diseño.

Feature objetivo (opcional): $ARGUMENTS
