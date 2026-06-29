# Documentación de migración Express → NestJS

Migración de la API **`application-api`** (Node.js/Express 5, DDD, MongoDB) hacia este proyecto
**`application-api-NestJS`** (NestJS 11) usando **PostgreSQL + TypeORM**.

## Índice

| Documento | Contenido |
|---|---|
| [`00-analisis-proyectos.md`](00-analisis-proyectos.md) | Análisis comparativo de ambos proyectos: stack, arquitectura, inventario funcional y modelo de datos. |
| [`01-plan-migracion.md`](01-plan-migracion.md) | Roadmap, mapeo de arquitectura Express→NestJS, estructura destino y verificación end-to-end. |
| [`checkpoints/`](checkpoints/) | Tareas de migración (CP-00 a CP-06), cada una con objetivo, archivos, criterios de aceptación y estado. |

## Agente especializado

La migración la ejecuta el subagente [`nestjs-migrator`](../.claude/agents/nestjs-migrator.md),
que procesa los checkpoints en orden, uno a la vez, validando con `nest build` antes de avanzar.

Para lanzarlo desde Claude Code:

> Usa el agente **nestjs-migrator** para ejecutar el siguiente checkpoint pendiente de `docs/checkpoints/`.

## Estado de los checkpoints

| CP | Título | Estado |
|---|---|---|
| CP-00 | Dependencias y bootstrap | Hecho |
| CP-01 | ConfigModule + conexión Postgres | Hecho |
| CP-02 | Users: entidad y DTOs | Hecho |
| CP-03 | Users: service, repo y controller | Hecho |
| CP-04 | Auth: JWT + Guard | Hecho |
| CP-05 | Respuestas, errores y logging | Hecho |
| CP-06 | Tests y verificación e2e | Hecho (e2e con BD: manual) |

## Decisiones clave

- **Base de datos:** PostgreSQL + TypeORM (se elimina MongoDB/Mongoose). Base limpia, sin migración de datos.
- **Inyección de dependencias:** nativa de NestJS por módulos (se elimina InversifyJS).
- **Validación:** `ValidationPipe` global (class-validator/class-transformer ya eran compatibles).
- **Documentación API:** Swagger/OpenAPI en `/api/docs`.
- **Reglas de negocio preservadas:** invalidación de JWT (`iat < lastTokenIssuedAt`), token a 8h, bcrypt salt 10.
- **Seguridad (Kata):** nunca registrar contraseñas, `JWT_SECRET` ni cadenas de conexión.
