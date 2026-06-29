# Bitácora (append-only)

Resumen de features cerradas. Se agrega una entrada por feature al pasarla a `done`. No se edita ni
borra lo anterior.

<!-- Formato de entrada:
## [YYYY-MM-DD] #<id> <name> — <title>
- Resultado verificación: OK / observaciones
- Archivos clave: ...
- Veredicto reviewer: progress/review_<name>.md
-->

## [2026-06-29] #1 perfil_usuario_autenticado — Consultar el perfil del usuario autenticado
- **Resultado verificación:** `npm run harness:verify` → [OK] (build correcto, 18/18 tests en verde). Node 18 con WARN no bloqueante.
- **Archivos clave:** `src/users/users.controller.ts` (endpoint `GET /api/users/me` con `JwtAuthGuard` + Swagger), `src/users/users.service.ts` (`getProfile` → `findById` → `toDto` sin password), `src/users/users.controller.spec.ts` (nuevo), `src/users/users.service.spec.ts` (casos `getProfile`).
- **Ciclo:** implementer → reviewer (RECHAZADO: 1 test en rojo por `import()` dinámico en Node 18) → implementer (fix import estático) → re-verificación leader [OK] → reviewer APROBADO.
- **Veredicto:** progress/review_perfil_usuario_autenticado.md
- **Detalle impl:** progress/impl_perfil_usuario_autenticado.md
