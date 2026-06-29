# AGENTS.MD — Mapa de navegación del harness

Guía de **disclosure progresivo**: qué leer y cuándo, para no saturar el contexto. Aplica a cualquier
agente (humano o IA) que trabaje en este repositorio. Complementa a `CLAUDE.md` (que define el rol y
las convenciones). Idioma: **español de negocios (México)**.

## 1. Antes de empezar (obligatorio)

1. Corre `npm run harness:verify` para confirmar que el entorno está listo (Node>=20, build, tests).
2. Revisa `progress/current.md` para ver el estado de la sesión anterior.
3. Selecciona **una** feature `pending` de `feature_list.json` (la de menor `id`).

## 2. Estructura del repositorio (qué leer y cuándo)

| Archivo / carpeta | Para qué sirve | Cuándo leerlo |
|---|---|---|
| `CLAUDE.md` | Rol, patrón Leader→Implementer→Reviewer, convenciones, reglas de negocio | Siempre, al inicio |
| `AGENTS.MD` (este) | Mapa de navegación y reglas de proceso | Siempre, al inicio |
| `feature_list.json` | Backlog y estado de features | Al elegir/actualizar trabajo |
| `CHECKPOINTS.MD` | Definición de "Hecho" (criterios de éxito) | Implementer (antes) y reviewer (al validar) |
| `progress/current.md` | Estado de la sesión activa | Al arrancar y durante el trabajo |
| `progress/history.md` | Bitácora append-only de features cerradas | Al cerrar una feature |
| `docs/01-plan-migracion.md` | Roadmap y **tabla de mapeo de arquitectura** | Al diseñar una feature |
| `docs/00-analisis-proyectos.md` | Inventario funcional del proyecto origen | Si replicas lógica heredada |
| `docs/checkpoints/` | Historia de la migración (CP-00…CP-06) | Referencia histórica |
| `src/` y `test/` | Código de la API y pruebas | Al implementar/revisar |
| `.claude/agents/` | Definiciones de subagentes | Al delegar |

## 3. Reglas no negociables

- **Una feature por sesión.** Solo una en `in_progress` (lo valida `harness:verify`).
- **Pruebas obligatorias.** Una feature es `done` solo con el 100% de sus criterios cubiertos y en verde.
- **Documenta en el momento**, no al final: actualiza `progress/current.md` mientras trabajas.
- **Repo limpio:** sin archivos temporales, código de depuración ni TODOs sin contexto.
- **Datos sensibles:** nunca contraseñas/secretos/conexiones en logs, respuestas ni docs.

## 4. Selección de feature

Abre `feature_list.json`, filtra `status == "pending"`, toma la de **menor `id`**, cámbiala a
`in_progress` y registra hora de inicio + plan breve en `progress/current.md`.

## 5. Ciclo de vida de la sesión

1. **Arranque:** pasos de la sección 1.
2. **Trabajo:** implementer codifica + prueba; verifica con `harness:verify`; reviewer aprueba/rechaza.
3. **Cierre:** con veredicto APROBADO, cambia la feature a `done`, mueve el resumen de
   `progress/current.md` a `progress/history.md`, resetea `current.md` a su plantilla y confirma que
   no quedó código de depuración.

## 6. Protocolo de bloqueo

Si te atoras, primero consulta la documentación relevante (sección 2). Si una herramienta falla de
forma inesperada, **documenta el problema y detente**: deja la feature en `blocked` con la causa, en
lugar de inventar un workaround.
