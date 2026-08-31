# CP-03 — Users: service, repositorio y controller

**Estado:** Hecho · **Depende de:** CP-02

## Objetivo
Migrar la lógica de usuarios (crear y listar) y el hashing de contraseñas usando DI nativa de NestJS y
el repositorio de TypeORM. Replica `user.service.ts`, `password.service.ts` y `user.controller.ts` del origen.

## Tareas
1. `users/password.service.ts` (`@Injectable`): `hash(password)` y `compare(password, hash)` con bcrypt,
   **salt rounds = 10** (igual que el origen).
2. `users/users.service.ts` (`@Injectable`) con `@InjectRepository(User)`:
   - `create(dto)`: hashear password, persistir, devolver `UserDto` (sin password).
   - `list()`: devolver `UserListItemDto[]` (solo username, name, role, isActive).
   - Métodos de apoyo para CP-04: `findByUsername`, `findById`, `updateLastTokenIssuedAt`.
3. `users/users.controller.ts` (`@Controller('users')`):
   - `POST /api/users` → `create`.
   - `GET /api/users` → `list`.
   - Decoradores Swagger (`@ApiTags`, `@ApiOperation`, `@ApiResponse`).
   - *(Los guards JWT se añaden en CP-04.)*
4. Registrar provider/controller en `users.module.ts` y exportar `UsersService` para Auth.

## Archivos a tocar
- `src/users/password.service.ts`, `users.service.ts`, `users.controller.ts`
- `src/users/users.module.ts`

## Criterios de aceptación
- [ ] `npm run build` compila sin errores.
- [ ] `POST /api/users` crea un usuario y responde sin exponer el password.
- [ ] `GET /api/users` devuelve la lista pública (sin passwords).
- [ ] No queda nada de InversifyJS en estos archivos.

## Notas de ejecución

**Archivos creados/modificados:**
- `src/users/password.service.ts` — `@Injectable`, bcrypt con `SALT_ROUNDS = 10`, métodos `hash`/`compare` (idénticos al origen).
- `src/users/users.service.ts` — `@Injectable` con `@InjectRepository(User)` y `PasswordService`. `create` (hashea, persiste con `save`, devuelve `UserDto` sin password), `list` (devuelve `UserListItemDto[]`), y métodos de apoyo `findByUsername`, `findById`, `updateLastTokenIssuedAt` para CP-04.
- `src/users/users.controller.ts` — `@Controller('users')`, `POST /api/users` → `create`, `GET /api/users` → `list`, con `@ApiTags`/`@ApiOperation`/`@ApiResponse`. (Guards JWT en CP-04.)
- `src/users/users.module.ts` — registra `UsersController`, providers `UsersService` y `PasswordService`, y los **exporta** para AuthModule.

**Resultado del build:** `npm run build` compila sin errores.

**Decisiones / desviaciones:**
- InversifyJS eliminado por completo en estos archivos (sin `@injectable`/`@inject`/`container`/`TYPES`).
- El DTO trae `active?` mientras la entidad usa `isActive`. En el origen Mongoose el spread del payload no mapeaba `active`→`isActive` (quedaba en default true). Aquí se mapea explícitamente `isActive: payload.active ?? true` para respetar la intención del campo.
- `list` usa `select` para no traer `password` desde la BD. Los mensajes personalizados de respuesta del controller original (“Usuarios encontrados: N”, “Usuario creado”) se delegan al interceptor estándar de CP-05.
- Verificación funcional de los endpoints requiere Postgres en vivo; queda como verificación manual (o tests unitarios con repos simulados en CP-06).
