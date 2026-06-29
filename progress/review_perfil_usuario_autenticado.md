# Revisión: perfil_usuario_autenticado (feature #1)

**Fecha:** 2026-06-29
**Revisor:** reviewer (subagente) + confirmación ejecutable del leader.

## Verificación ejecutable (corrida por el leader)

`npm run harness:verify`:
- Node 18.16.1 → WARN (no bloqueante).
- Build: **OK**.
- Pruebas: **FAIL** → `Test Suites: 1 failed, 5 passed`; `Tests: 1 failed, 17 passed`.

### Prueba fallida (bloqueante)

`src/users/users.service.spec.ts:137` — `UsersService › getProfile › lanza NotFoundException cuando el usuario no existe`:

```
You need to run with a version of node that supports ES Modules in the VM API.
> 137 | const { NotFoundException } = await import('@nestjs/common');
```

El `await import('@nestjs/common')` dinámico no es soportado por ts-jest sobre Node 18. No es un
detalle de estilo: deja la prueba en rojo. **Acción:** reemplazar por import estático de
`NotFoundException` (ya se usa estático en otros specs del proyecto).

## Hallazgos por criterio (revisión estática del reviewer)

| # | Criterio | Resultado |
|---|---|---|
| 1 | GET /api/users/me requiere JWT; sin token 401 | Cubierto vía `JwtAuthGuard` a nivel de clase (`users.controller.ts:12`). |
| 2 | Devuelve usuario por `sub` con `UserDto`, sin password | Cubierto (`users.service.ts:50-56`, `toDto` excluye password). |
| 3 | Formato `{ statusCode, message, resource, isError }` | Cubierto por interceptor/filtro globales existentes. |
| 4 | Swagger `@ApiBearerAuth` + `@ApiProperty` | Cubierto (`users.controller.ts:11`, `user.dto.ts`). |
| 5 | Pruebas (perfil OK / 404) | Presentes, pero **una en rojo** (ver arriba). |

Arquitectura y reglas de negocio (estructura por features, DI nativa, prefijo `/api`, invalidación
JWT, bcrypt salt 10, sin datos sensibles): **conformes**.

## VEREDICTO (1ª ronda): RECHAZADO

Motivo bloqueante: `harness:verify` con **1 prueba en rojo**. No se aprueba con tests en rojo.
Cambio requerido (1): import estático de `NotFoundException` en `src/users/users.service.spec.ts`.

## Re-revisión (2ª ronda): APROBADO

El implementer reemplazó el `await import('@nestjs/common')` por import estático. El leader confirmó
con `npm run harness:verify`: **`[OK] Entorno listo`** — build correcto y pruebas en verde (18/18).
Los 5 criterios de aceptación quedan cubiertos y verificados; arquitectura y reglas de negocio
conformes.

**VEREDICTO: APROBADO**
