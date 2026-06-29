# Implementación: perfil_usuario_autenticado (feature #1)

**Fecha:** 2026-06-29
**Estado al cerrar este documento:** implementación completa, pendiente de verificación por reviewer.

---

## Archivos modificados

| Archivo | Acción | Descripción |
|---|---|---|
| `feature_list.json` | Modificado | Estado cambiado de `pending` a `in_progress` |
| `progress/current.md` | Modificado | Plan documentado al inicio |
| `src/users/users.service.ts` | Modificado | Agregado import `NotFoundException`; nuevo método `getProfile(id)` |
| `src/users/users.controller.ts` | Modificado | Agregado import `Request` y `User`; nuevo endpoint `GET /users/me` con decoradores Swagger |
| `src/users/users.service.spec.ts` | Modificado | Agregado bloque `describe('getProfile')` con dos casos de prueba |
| `src/users/users.controller.spec.ts` | Creado | Spec del controlador con dos casos: perfil OK y 404 |

---

## Decisiones de diseño

1. **Reutilización de `UserDto`:** ya existe, tiene todos los campos necesarios con `@ApiProperty` y excluye `password`. No se creó ningún DTO nuevo.

2. **Reutilización de `JwtAuthGuard`:** el guard ya estaba aplicado a nivel de clase en `UsersController` (`@UseGuards(JwtAuthGuard)`). El nuevo endpoint `GET /users/me` lo hereda automáticamente. Sin token responde 401, cubriendo el criterio de aceptación #1.

3. **Extracción del usuario desde `req.user`:** `JwtStrategy.validate` devuelve el objeto `User` completo. El endpoint recibe `req: { user: User }` y extrae `req.user.id` para llamar a `getProfile`. No se usa el payload del JWT directamente; se resuelve el usuario real desde la base de datos, lo que garantiza que un usuario eliminado o modificado no obtenga respuesta válida.

4. **`getProfile` en `UsersService`:** delega a `findById` (ya existente) y lanza `NotFoundException` si retorna `null`. Llama a `toDto` (privado) para mapear a `UserDto` sin exponer `password`.

5. **Swagger:** el endpoint se documenta con `@ApiOperation`, `@ApiResponse` para 200/401/404, y hereda `@ApiBearerAuth('access-token')` del nivel de clase.

6. **Pruebas del servicio:** el `describe('getProfile')` se agregó dentro del suite existente de `UsersService` para mantener el contexto de setup (`repo`, `service`). `NotFoundException` se importa de forma estática desde `@nestjs/common` al inicio del archivo (corrección aplicada tras rechazo del reviewer; ver sección de verificación).

7. **Sin datos sensibles:** `password` nunca aparece en la respuesta del endpoint ni en los mocks de prueba de salida.

---

## Criterios de aceptación cubiertos

| # | Criterio | Cobertura |
|---|---|---|
| 1 | GET /api/users/me requiere JWT válido; sin token responde 401 | `JwtAuthGuard` heredado a nivel de clase; test del controlador verifica llamada con usuario resuelto |
| 2 | Devuelve usuario resuelto por `sub` usando `UserDto`, sin password | `getProfile` → `findById` → `toDto`; tests verifican ausencia de `password` |
| 3 | Formato `{ statusCode, message, resource, isError }` | Interceptor global `ResponseInterceptor` ya configurado en `main.ts`; no se reinventó |
| 4 | Documentado en Swagger con `@ApiBearerAuth` y `@ApiProperty` | `@ApiBearerAuth` en clase; `@ApiOperation`/`@ApiResponse` en método; `UserDto` tiene `@ApiProperty` |
| 5 | Pruebas: token válido devuelve perfil, usuario inexistente responde 404 | `users.controller.spec.ts` (2 casos) + `users.service.spec.ts` describe `getProfile` (2 casos) |

---

## Resultado de verificación

**Primera ejecución (rechazada por reviewer):** 1 test en rojo.
- Archivo: `src/users/users.service.spec.ts:138`
- Test: `UsersService › getProfile › lanza NotFoundException cuando el usuario no existe`
- Causa: `const { NotFoundException } = await import('@nestjs/common')` — import dinámico no soportado por ts-jest en Node 18 (`You need to run with a version of node that supports ES Modules in the VM API`).

**Corrección aplicada (única modificación):**
- Eliminado el `await import('@nestjs/common')` de línea 138.
- Agregado `import { NotFoundException } from '@nestjs/common'` como import estático en línea 2 de `src/users/users.service.spec.ts`.
- `NotFoundException` se usa directamente en `rejects.toBeInstanceOf(NotFoundException)`.

**Resultado tras corrección:** `npm run harness:verify` termina en `[OK]` — build correcto, todos los tests en verde.
