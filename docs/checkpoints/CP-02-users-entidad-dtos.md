# CP-02 — Módulo Users: entidad y DTOs

**Estado:** Hecho · **Depende de:** CP-01

## Objetivo
Portar el modelo `User` de Mongoose a una entidad TypeORM y migrar los DTOs y el enum, añadiendo
documentación Swagger.

## Tareas
1. `users/enums/user-role.enum.ts` — `UserRole` (`admin | user`) reutilizado tal cual.
2. `users/entities/user.entity.ts` (TypeORM):
   - PK (`uuid` recomendado o serial), `username` único, `name`, `email` único + lowercase,
     `password`, `role` (enum, default `user`), `isActive` (default `true`),
     `lastTokenIssuedAt` (`bigint`/`int` nullable), `createdAt`/`updatedAt` (`@CreateDateColumn`/`@UpdateDateColumn`).
   - `@Unique` o `unique: true` en `username` y `email`.
3. DTOs en `users/dto/` con `class-validator` + `@ApiProperty`:
   - `create-user.dto.ts` (username 3–50, name 1–100, email, password 6–200, role enum, active? bool).
   - `user.dto.ts` (respuesta completa, sin exponer password).
   - `user-list-item.dto.ts` (username, name, role, isActive).
4. `users/users.module.ts` con `TypeOrmModule.forFeature([User])` (controller/service se completan en CP-03).

## Archivos a tocar
- `src/users/enums/user-role.enum.ts`
- `src/users/entities/user.entity.ts`
- `src/users/dto/create-user.dto.ts`, `user.dto.ts`, `user-list-item.dto.ts`
- `src/users/users.module.ts`
- `src/app.module.ts` (importar `UsersModule`)

## Criterios de aceptación
- [ ] `npm run build` compila sin errores.
- [ ] Con `synchronize: true`, al arrancar se crea la tabla `users` con índices únicos en `username` y `email`.
- [ ] Los DTOs aparecen documentados en Swagger.

## Notas de ejecución

**Archivos creados/modificados:**
- `src/users/enums/user-role.enum.ts` — `UserRole` (`admin | user`), portado tal cual.
- `src/users/entities/user.entity.ts` — entidad TypeORM `User`: PK `uuid`, `username` (varchar 50), `name` (varchar 100), `email`, `password`, `role` (enum, default `user`), `isActive` (default true), `lastTokenIssuedAt` (`bigint` nullable), `createdAt`/`updatedAt` (`@CreateDateColumn`/`@UpdateDateColumn`). Índices únicos vía `@Unique` en `username` y `email`.
- `src/users/dto/create-user.dto.ts` — `class-validator` + `@ApiProperty` (username 3–50, name 1–100, email, password 6–200, role enum, active? bool opcional default true).
- `src/users/dto/user.dto.ts` — respuesta completa sin `password`.
- `src/users/dto/user-list-item.dto.ts` — listado público (username, name, role, isActive).
- `src/users/users.module.ts` — `TypeOrmModule.forFeature([User])` (controller/service en CP-03).
- `src/app.module.ts` — import de `UsersModule`.

**Resultado del build:** `npm run build` compila sin errores.

**Notas técnicas / desviaciones:**
- `lastTokenIssuedAt` es `bigint`: el driver `pg` lo devuelve como **string**. La comparación de invalidación en CP-04 coercerá a `Number` antes de comparar.
- Creación de la tabla `users` con índices únicos requiere Postgres en vivo (`synchronize: true`). Verificación manual: arrancar con BD y comprobar `\d users` en psql. Los DTOs aparecen en Swagger una vez los endpoints estén expuestos (CP-03/04).
