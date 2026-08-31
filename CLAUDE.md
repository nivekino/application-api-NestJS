# CLAUDE.md — application-api-NestJS

Guía de operación para Claude Code en este repositorio. Idioma de trabajo: **español de negocios
(México)**. Datos de clientes (banca de microcréditos en LATAM) son **sensibles**: nunca expongas
contraseñas, secretos ni cadenas de conexión en logs, respuestas de API ni documentación. Todo el
trabajo es local; no envíes datos a servicios externos.

## Patrón de trabajo: Leader → Planner → Implementer (TDD) → Reviewer

Este repo usa harness engineering: **estado persistente en disco + verificación ejecutable**, operado
por roles con autoridad separada. Tu rol depende del tamaño del cambio:

- **Feature sustancial (toca `src/` o `test/`):** actúa como **leader/orquestador**. Delega vía el
  Agent tool siguiendo el ciclo de abajo. Atajos: `/feature` (ciclo completo), `/design` (sólo diseño).
- **Cambio pequeño** (config, documentación, `docs/`, `progress/`, ajustes de una línea): edítalo
  **directo, sin delegar**.

### El ciclo

```
pending ─→ [planner si needs_design] ─→ (implementer fase RED) ─→ red
                                                                   │
                                              ⏸ PUERTA HUMANA: se aprueba la batería
                                                                   │
   done ←── [reviewer] ←── in_review ←── green ←── (implementer fase GREEN)
```

1. **`planner`** (Opus) — sólo si `needs_design: true`. Diseña el contrato, identifica el precedente de
   la casa a espejar, lista los acoplamientos y **propone la batería de tests**. No implementa.
2. **`implementer` fase RED** (Sonnet) — escribe **sólo los tests**, los corre, y pega la salida en
   rojo en `progress/impl_<name>.md`. No toca código de producción.
3. **⏸ Puerta humana** — el usuario aprueba la batería. Es el único punto donde el ciclo se detiene solo.
4. **`implementer` fase GREEN** — código mínimo que pone la batería en verde, refactor con los tests en
   verde, y **declaración del Nivel B**.
5. **`reviewer`** — veredicto contra `CHECKPOINTS.MD`. Sólo con **APROBADO** se marca `done`.

## Las tres reglas que sostienen el harness

1. **El estado vive en archivos, no en el contexto del modelo.** `feature_list.json` (backlog),
   `progress/current.md` (sesión activa), `progress/history.md` (cerrado). Una sesión nueva reconstruye
   dónde iba leyendo disco.
2. **"Hecho" se demuestra, no se declara.** Gate de **dos niveles**: Nivel A automático
   (`npm run harness:verify`, ejecutable y determinista) + Nivel B manual (lo que el script no puede
   probar: comportamiento contra PostgreSQL real). **El Nivel B no se sustituye, se declara.**
3. **La prueba se escribe antes del código y se demuestra en rojo.** Un test escrito después de que el
   código ya pasa no demuestra nada: pudo nacer verde por accidente, o probar el comportamiento que el
   código tiene en vez del que debería tener. El CHECK 3d exige la *Evidencia RED* por escrito.

## Protocolo de arranque

1. Lee `AGENTS.MD` (mapa de navegación / qué leer y cuándo).
2. Corre `npm run harness:verify`. Si falla, **detente y reporta** antes de avanzar.
3. Compara las advertencias de deuda contra el baseline vigente de `docs/verifications.md` sección 4.
   ⚠️ **No lo cites de memoria.** Más advertencias que el baseline = algo nuevo se introdujo.
4. Revisa `progress/current.md` y `feature_list.json`. Si hay una feature activa, **retómala**.

## Reglas anti-desincronización (las tres que más caro cuestan)

1. **Anti-"teléfono descompuesto".** Los subagentes **escriben sus hallazgos en archivos**
   (`progress/design_<name>.md`, `impl_<name>.md`, `review_<name>.md`, `explore_<tema>.md`) y devuelven
   al leader **solo una línea con la referencia**, nunca el contenido completo por chat. Para
   exploración usa el agente `Explore`, 2-3 en paralelo con consultas enfocadas.
2. **Cada criterio vive en un solo archivo.** La tabla de disparadores de diseño está **sólo** en
   `.claude/agents/planner.md`; el baseline de advertencias **sólo** en `docs/verifications.md` §4. Los
   demás documentos **apuntan sin repetir**. Una lista repetida en cinco documentos se desalinea, y
   cuando se desalinea el paso deja de accionarse aun estando documentado en los cinco lados.
3. **No cites números de memoria.** Baseline de advertencias, salt rounds, conteo de features, número
   de llaves de un contrato: léelos de su fuente. Un baseline obsoleto detiene al leader y hace que el
   reviewer rechace **con el repo en estado correcto**.

## Convenciones NestJS (resumen ejecutable)

- **DI nativa** por módulos: `@Injectable()`, `@Module()`, `@InjectRepository()`. Sin InversifyJS.
- **Estructura por features:** `src/<feature>/` con `*.module.ts`, `*.controller.ts`, `*.service.ts`,
  `dto/`, y cuando aplique `entities/` y `enums/`. Lo transversal en `src/common/`.
- **Validación global** con `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) en
  `main.ts`. Ojo: un campo que no esté en el DTO **no llega vacío, la petición se rechaza con 400**.
- **DTOs** con `class-validator` + `class-transformer` + `@ApiProperty` (Swagger).
- **TypeORM/PostgreSQL**; **respuesta estándar** `{ statusCode, message, resource, isError }` vía
  interceptor + `HttpExceptionFilter` globales. **No armes el envoltorio en el controller:** se
  envuelve dos veces.
- **Prefijo `/api`**, Swagger en `/api/docs`. Un endpoint protegido declara
  `@ApiBearerAuth('access-token')` **con ese nombre exacto**, o el botón *Authorize* no aplica a él.
- **La entidad nunca sale por la API:** se mapea a DTO.

> Los **acoplamientos ocultos** del proyecto (los diez modos de falla silenciosa: `synchronize` sin
> migraciones, doble envoltura, `required` del ValidationPipe, logs que quedan en disco…) están en
> [`.claude/agents/planner.md`](.claude/agents/planner.md). Léelos antes de implementar, aunque la
> feature no haya pasado por diseño.

## Reglas de negocio críticas (no romper)

- **Invalidación de JWT:** `JwtStrategy` rechaza tokens con `payload.iat < user.lastTokenIssuedAt`.
  Login actualiza `lastTokenIssuedAt` al `iat` del token. Payload `{ sub, username, role, iat }`, exp
  **8h**. `lastTokenIssuedAt` llega de PostgreSQL como bigint-string y se coerce antes de comparar.
- **Contraseñas:** bcrypt **salt rounds = 10** vía `PasswordService`.

## Verificación

- `npm run harness:verify` — Nivel A completo: estructura + toolsets + trazabilidad + build + jest.
- `npm run harness:estructura` — sólo estructura, rápido y sin `node_modules`. **No cierra una
  feature:** el Nivel A queda incompleto.
- `npm run test:e2e` — **Nivel B**, contra PostgreSQL real.
- **Requiere Node 22 LTS como mínimo; 24 LTS recomendado** (lo verifica el CHECK 2). Por debajo del
  mínimo la app no arranca (`crypto is not defined` de TypeORM) y el **Nivel B es inejecutable**.
- **TypeScript 6.x** con `target`/`lib` en `ES2024` (base oficial de Node 24). El techo lo pone
  typescript-eslint, no el compilador; TS 7 está bloqueado por `ts-jest` y `typescript-eslint`. El
  detalle y las condiciones para subir están en `docs/verifications.md` §6.
- Detalle de cada check, baseline vigente y bitácora de pruebas negativas: **`docs/verifications.md`**.
- Hooks (`.claude/settings.json`): lint del archivo editado en `PostToolUse`; si se edita un archivo de
  `.claude/agents/`, corre el gate estructural y **bloquea** si queda en rojo; `harness:verify` al
  cerrar sesión (`SessionEnd`).

## Reglas no negociables

- Una sola feature activa (`red` / `green` / `in_review`) a la vez.
- No marcar `done` sin gate de dos niveles cumplido y aprobación del reviewer.
- No saltar la puerta humana de la batería de tests.
- Documenta el progreso en el momento, no al final. Deja el repo limpio (sin código de depuración ni
  TODOs sin contexto).

## Contexto histórico

La migración Express→NestJS ya está completa (`docs/checkpoints/` CP-00…CP-06, todos "Hecho"). Esos
documentos quedan como **referencia histórica** y no describen el flujo vigente: para toda feature
nueva el ciclo es `planner` + `implementer` + `reviewer`.

El harness se actualizó el **2026-08-31** adoptando las lecciones del portafolio Formiik de Kata (gate
de dos niveles, CHECK 1b de toolsets, fase de diseño por bandera, baseline en un solo documento,
prueba negativa obligatoria) y la trazabilidad requisito↔test del patrón SDD, reemplazando el SDD por
**TDD**: aquí el artefacto que se aprueba antes de codificar es **la batería de tests en rojo**, no un
documento paralelo que después se desincroniza del código.
