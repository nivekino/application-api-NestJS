# CHECKPOINTS.MD — Definición de "Hecho"

Criterios de éxito que **toda feature debe cumplir** antes de marcarse como `done`. El `reviewer` usa
esta lista como puerta de aceptación; el `implementer` la usa como objetivo. Una feature que no
cumple todos los puntos aplicables **no se aprueba**.

## Puerta de verificación (ejecutable)

- [ ] `npm run harness:verify` termina en `[OK]` (Node>=20, `feature_list.json` válido, **build** y **tests** en verde).
- [ ] `nest build` compila sin errores.
- [ ] `eslint` sin errores en los archivos tocados.

## Cobertura de la feature

- [ ] Existe una prueba (Jest `*.spec.ts`) por **cada criterio de aceptación** de la feature en `feature_list.json`.
- [ ] Las pruebas cubren el camino feliz y al menos un caso de error/borde relevante.

## Convenciones de arquitectura

- [ ] La feature vive en `src/<feature>/` con su `*.module.ts`, `*.controller.ts`, `*.service.ts` y `dto/` (y `entities/`/`enums/` si aplica). Transversal en `src/common/`.
- [ ] DI nativa de NestJS (`@Injectable`, `@Module`, `@InjectRepository`). Sin InversifyJS.
- [ ] DTOs con `class-validator` + `class-transformer` + `@ApiProperty`. La validación la hace el `ValidationPipe` global.
- [ ] Endpoints nuevos respetan el prefijo `/api`, devuelven el formato `{ statusCode, message, resource, isError }` y están documentados en Swagger (`/api/docs`).
- [ ] Entidades TypeORM con `@Unique`/enums/timestamps según corresponda.

## Reglas de negocio (no romper)

- [ ] **Invalidación de JWT** intacta: `JwtStrategy` rechaza `payload.iat < user.lastTokenIssuedAt`; login actualiza `lastTokenIssuedAt`; exp **8h**.
- [ ] Contraseñas con bcrypt **salt rounds = 10**.
- [ ] Sin datos sensibles (contraseñas, secretos, conexiones) en logs, respuestas de API ni documentación.

## Higiene

- [ ] Sin código de depuración (`console.log` temporales) ni TODOs sin contexto.
- [ ] `progress/current.md` actualizado; al cerrar, resumen movido a `progress/history.md`.
