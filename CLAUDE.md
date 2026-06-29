# CLAUDE.md — application-api-NestJS

Guía de operación para Claude Code en este repositorio. Idioma de trabajo: **español de negocios
(México)**. Datos de clientes (banca de microcréditos en LATAM) son **sensibles**: nunca expongas
contraseñas, secretos ni cadenas de conexión en logs, respuestas de API ni documentación. Todo el
trabajo es local; no envíes datos a servicios externos.

## Patrón de trabajo: Leader → Implementer → Reviewer

Este repo usa harness engineering (estilo recomendado por Anthropic): estado persistente en disco y
verificación ejecutable. Tu rol depende del tamaño del cambio:

- **Feature sustancial (multi-archivo):** actúa como **leader/orquestador**. Delega vía el Agent tool:
  1. `implementer` → codifica la feature `pending` de menor `id` y sus pruebas.
  2. `reviewer` → valida contra `CHECKPOINTS.MD` y corre `npm run harness:verify`.
  3. Solo si el reviewer **APRUEBA**, marca la feature como `done` en `feature_list.json` y mueve el
     resumen a `progress/history.md`.
  Atajo: el slash command `/feature` ejecuta este ciclo completo.
- **Cambio pequeño** (config, documentación, `progress/`, ajustes de una línea): puedes editarlo
  directamente, sin delegar.

## Protocolo de arranque

1. Lee `AGENTS.MD` (mapa de navegación / qué leer y cuándo).
2. Revisa `progress/current.md` (estado de la sesión anterior) y `feature_list.json` (backlog).
3. Corre `npm run harness:verify`. Si falla, **detente y reporta** antes de avanzar.

## Regla anti-"teléfono descompuesto"

Los subagentes **escriben sus hallazgos en archivos** (`progress/impl_<name>.md`,
`progress/review_<name>.md`, `progress/explore_<tema>.md`) y devuelven al leader **solo una línea con
la referencia al archivo**, nunca el contenido completo por chat. Para exploración usa el agente
`Explore` integrado, 2-3 en paralelo con consultas enfocadas cuando convenga.

## Convenciones NestJS (resumen ejecutable)

- **DI nativa** por módulos: `@Injectable()`, `@Module()`, `@InjectRepository()`. Sin InversifyJS.
- **Estructura por features:** `src/<feature>/` con `*.module.ts`, `*.controller.ts`, `*.service.ts`,
  `dto/`, y cuando aplique `entities/` y `enums/`. Lo transversal en `src/common/`.
- **Validación global** con `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) en `main.ts`.
- **DTOs** con `class-validator` + `class-transformer` + `@ApiProperty` (Swagger).
- **TypeORM/PostgreSQL**; **respuesta estándar** `{ statusCode, message, resource, isError }` vía
  interceptor + `HttpExceptionFilter` globales; **prefijo `/api`**, Swagger en `/api/docs`.

## Reglas de negocio críticas (no romper)

- **Invalidación de JWT:** `JwtStrategy` rechaza tokens con `payload.iat < user.lastTokenIssuedAt`.
  Login actualiza `lastTokenIssuedAt` al `iat` del token. Payload `{ sub, username, role, iat }`, exp **8h**.
- **Contraseñas:** bcrypt **salt rounds = 10**.

## Verificación

- `npm run harness:verify` — Node>=20 + validación de `feature_list.json` + `nest build` + `jest`.
- **Requiere Node >= 20 LTS.** En Node 18 el build de TypeORM falla con `crypto is not defined`.
- Hooks (`.claude/settings.json`): lint del archivo editado en `PostToolUse`; `harness:verify` al cerrar sesión (`SessionEnd`).

## Reglas no negociables

- Una sola feature `in_progress` a la vez.
- No marcar `done` sin pruebas en verde y aprobación del reviewer.
- Documenta el progreso en el momento, no al final. Deja el repo limpio (sin código de depuración ni
  TODOs sin contexto).

## Contexto histórico

La migración Express→NestJS ya está completa (`docs/checkpoints/` CP-00…CP-06, todos "Hecho"). El
subagente `nestjs-migrator` se conserva como referencia de esa fase; para nuevas features usa
`implementer` + `reviewer`.
