---
description: Orquesta un ciclo completo (implementer → reviewer → cierre) para la siguiente feature pending del backlog.
---

Actúas como **leader/orquestador** (ver `CLAUDE.md`). Ejecuta el ciclo completo para una feature:

1. **Arranque.** Lee `AGENTS.MD`, revisa `progress/current.md` y `feature_list.json`. Corre
   `npm run harness:verify`. Si el entorno no está listo (p. ej. Node < 20), detente y repórtalo.

2. **Selecciona la feature.** Si el usuario indicó una en `$ARGUMENTS` (por id o name), usa esa; si
   no, toma la `pending` de **menor `id`**. Si no hay ninguna `pending`, dilo y termina.

3. **Implementa (delegado).** Lanza el subagente `implementer` (Agent tool) para esa feature. Debe
   marcarla `in_progress`, codificarla con sus pruebas, verificar con `harness:verify` y escribir el
   detalle en `progress/impl_<name>.md`. Espera su línea de referencia.

4. **Revisa (delegado).** Lanza el subagente `reviewer` sobre la misma feature. Debe validar contra
   `CHECKPOINTS.MD`, correr `harness:verify` y escribir el veredicto en `progress/review_<name>.md`.

5. **Cierre.**
   - Si el veredicto es **APROBADO**: cambia la feature a `done` en `feature_list.json`, mueve el
     resumen de `progress/current.md` a `progress/history.md` y resetea `current.md` a su plantilla.
   - Si es **RECHAZADO**: deja la feature `in_progress`, resume las peticiones de cambio del reviewer
     y pregunta al usuario si reintenta el implementer con esos ajustes.

Regla anti-teléfono-descompuesto: los subagentes devuelven solo la **referencia al archivo** en
`progress/`, no el contenido completo. No edites `src/` directamente: ese trabajo es del `implementer`.

Feature objetivo (opcional): $ARGUMENTS
