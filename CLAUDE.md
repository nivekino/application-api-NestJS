# CLAUDE.md — application-api-NestJS

Guía de operación para Claude Code en este repositorio. Idioma de trabajo: **español de negocios
(México)**. Datos de clientes (banca de microcréditos en LATAM) son **sensibles**: nunca expongas
contraseñas, secretos ni cadenas de conexión en logs, respuestas de API ni documentación. Todo el
trabajo es local; no envíes datos a servicios externos.

**Stack vigente (2026-09-04):** Node **24 LTS** (`.nvmrc`), TypeScript **6.0.x**, NestJS **12.0.1**,
TypeORM **1.x**, PostgreSQL, Jest 30 + ts-jest, ESLint 10 + typescript-eslint 8 (`strictTypeChecked`),
Prettier 3 (`printWidth` 100, LF). Las versiones exactas viven en `package.json`; las razones del techo
de TS 7 en `docs/verifications.md` §6. NestJS 12 publica todos los `@nestjs/*` como ESM puro; el
repositorio sigue siendo **CommonJS** y los consume con el `require(esm)` nativo de Node (Jest arranca
con `--experimental-vm-modules`, ver `docs/verifications.md` §6).

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
   la casa a espejar, lista los acoplamientos y **propone la batería de tests** con su `red_modo`. No
   implementa.
2. **`implementer` fase RED** (Sonnet) — escribe **sólo los tests**, fija el `red_modo` (`nuevo`: la
   batería falla en disco; `caracterizacion`: el código ya existe y el rojo se demuestra por
   **mutación**), pega la evidencia en rojo en `progress/impl_<name>.md`, escribe el `tdd_contract` y
   deja el gate en `[OK]`. No toca código de producción.
3. **⏸ Puerta humana** — el usuario aprueba la batería. Es el único punto donde el ciclo se detiene solo.
4. **`implementer` fase GREEN** — código mínimo que pone la batería en verde, refactor con los tests en
   verde, gate en `[OK]` y **declaración del Nivel B**.
5. **`reviewer`** — veredicto contra `CHECKPOINTS.MD`. Sólo con **APROBADO** se marca `done`.

## Las tres reglas que sostienen el harness

1. **El estado vive en archivos, no en el contexto del modelo.** `feature_list.json` (backlog, reglas,
   baseline, piso de cobertura), `progress/current.md` (sesión activa), `progress/history.md`
   (cerrado). Una sesión nueva reconstruye dónde iba leyendo disco.
2. **"Hecho" se demuestra, no se declara.** Gate de **dos niveles**: Nivel A automático
   (`npm run harness:verify`: estructura + typecheck + lint + build + jest + cobertura, ejecutable y
   determinista) + Nivel B manual (lo que el script no puede probar: comportamiento contra PostgreSQL
   real). **El Nivel B no se sustituye, se declara.**
3. **La prueba se escribe antes del código y se demuestra en rojo.** Un test escrito después de que el
   código ya pasa no demuestra nada: pudo nacer verde por accidente, o probar el comportamiento que el
   código tiene en vez del que debería tener. El CHECK 3d exige la *Evidencia RED* por escrito y
   **creíble** (menciona cada archivo de la batería y contiene un fallo real). Toda feature nace con
   `tdd: true` (CHECK 3e); las exenciones legacy se declaran en `rules.tdd_exentas_legacy`.

**El gate entiende la fase RED.** Con una feature en `red` (modo `nuevo`) tolera fallos de typecheck,
lint y jest **sólo** en los archivos del `tdd_contract`, y exige que al menos uno falle. Fuera de eso,
cualquier rojo es error. Así el gate puede dar `[OK]` durante todo el ciclo sin bajar la guardia.

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
   `.claude/agents/planner.md`; el baseline de advertencias y el piso de cobertura **sólo** en
   `docs/verifications.md` §4 (reflejados en `feature_list.json → rules`). Los demás documentos
   **apuntan sin repetir**. Una lista repetida en cinco documentos se desalinea, y cuando se desalinea
   el paso deja de accionarse aun estando documentado en los cinco lados.
3. **No cites números de memoria.** Baseline de advertencias, piso de cobertura, salt rounds, conteo de
   features, número de llaves de un contrato: léelos de su fuente. Un baseline obsoleto detiene al
   leader y hace que el reviewer rechace **con el repo en estado correcto**.

## Convenciones NestJS (resumen ejecutable)

- **DI nativa** por módulos: `@Injectable()`, `@Module()`, `@InjectRepository()`. Sin InversifyJS.
- **Estructura por features:** `src/<feature>/` con `*.module.ts`, `*.controller.ts`, `*.service.ts`,
  `dto/`, y cuando aplique `entities/` y `enums/`. Lo transversal en `src/common/`.
- **Validación global** con `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) en
  `main.ts`. Ojo: un campo que no esté en el DTO **no llega vacío, la petición se rechaza con 400**.
- **DTOs** con `class-validator` + `class-transformer` + `@ApiProperty` (Swagger).
- **TypeORM 1.x/PostgreSQL**; `select` como objeto por columna; `update`/`delete` con criterio vacío
  **lanzan**. **Respuesta estándar** `{ statusCode, message, resource, isError }` vía interceptor +
  `HttpExceptionFilter` globales. **No armes el envoltorio en el controller:** se envuelve dos veces.
- **Prefijo `/api`**, Swagger en `/api/docs`. Un endpoint protegido declara
  `@ApiBearerAuth('access-token')` **con ese nombre exacto**, o el botón *Authorize* no aplica a él.
- **La entidad nunca sale por la API:** se mapea a DTO.
- **Pruebas:** mocks tipados (`jest.Mocked<Pick<Servicio, 'metodo'>>`), sin `any`, sin `.only`, un
  `expect` sobre el resultado en cada `it()`, sin `expect` condicionales. Lo vigila el linter.
- **Imports de tipos:** no conviertas a `import type` clases que NestJS inyecta o valida en runtime
  (`emitDecoratorMetadata`). Ver la nota de `tsconfig.json`.
- **Idioma de los identificadores:** orientados al framework y al contrato público en **inglés**
  (rutas, llaves de DTO, nombres de columna, clases, métodos públicos); comentarios, mensajes de
  negocio, textos de `it()` y helpers privados en **español de negocios (México)**. No es una mezcla
  accidental: es la convención del repo (p. ej. `escribir`, `normalizarMensaje`, `construirHost` son
  helpers privados a propósito en español).
- **Parámetro del usuario autenticado:** `@CurrentUser()` (`src/auth/decorators/current-user.decorator.ts`,
  `createParamDecorator`) en vez de `@Request() req: { user: User }`: el controller no conoce la forma
  del `Request` de Express. Requiere `JwtAuthGuard` (o cualquier guard que puebla `req.user`) antes en
  la cadena.

> Los **acoplamientos ocultos** del proyecto (los trece modos de falla silenciosa: `synchronize` sin
> migraciones, doble envoltura, `required` del ValidationPipe, logs que quedan en disco, criterios
> vacíos en TypeORM 1.x, metadatos heredados de un mixin en guards de clase…) están en
> [`.claude/agents/planner.md`](.claude/agents/planner.md). Léelos
> antes de implementar, aunque la feature no haya pasado por diseño.

## Reglas de negocio críticas (no romper)

- **Invalidación de JWT:** `JwtStrategy` rechaza tokens con `payload.iat < user.lastTokenIssuedAt`.
  Login actualiza `lastTokenIssuedAt` al `iat` del token. Payload `{ sub, username, role, iat }`, exp
  **8h**. `lastTokenIssuedAt` es `bigint`: llega de PostgreSQL como string, la entidad lo declara
  `number | string | null` y se coerce antes de comparar.
- **Contraseñas:** bcrypt **salt rounds = 10** vía `PasswordService`.

## Verificación

- `npm run harness:verify` — Nivel A completo: estructura + toolsets + trazabilidad + evidencia RED +
  build + typecheck + lint + jest + cobertura.
- `npm run harness:estructura` — sólo estructura, rápido y sin `node_modules`. **No cierra una
  feature:** el Nivel A queda incompleto.
- `npm run test:e2e` — **Nivel B**, contra PostgreSQL real (se omite sin variables `DB_*`).
  `npm run test:e2e:docker` la corre en un paso contra el PostgreSQL desechable de `compose.yaml`;
  `docker compose --profile app up -d --build --wait` levanta además la API (`Dockerfile`) para los
  casos manuales. CI corre gate + e2e + smoke de la imagen (`.github/workflows/gate.yml`).
- **Node 24 LTS es el piso** (`engines >=24.15.0` + `.npmrc` con `engine-strict`; lo verifica el CHECK 2
  como error, no como advertencia). Node 26 entra a LTS el 2026-10-28: el piso se mueve actualizando
  `.nvmrc`, `engines` y el CHECK 2 en la misma pasada.
- **TypeScript 6.0.x** (`~6.0.3`) con `target`/`lib` en `ES2024`. El techo lo ponen typescript-eslint
  (`<6.1.0`) y ts-jest (`<7`), no el compilador. Condiciones para subir: `docs/verifications.md` §6.
- **NestJS 12.0.1, todos los `@nestjs/*` como ESM puro.** El repositorio permanece **CommonJS**
  (`module: nodenext` con emisión CommonJS, `experimentalDecorators` + `emitDecoratorMetadata` intactos)
  y consume esos paquetes vía `require(esm)` de Node. `nest-winston` no soporta NestJS 12: el logger es
  un `WinstonLoggerService` propio en `src/common/logger/` (feature #3). Jest necesita
  `--experimental-vm-modules` para poder hacer `require(esm)` de `@nestjs/*` bajo `jest-runtime`; los
  scripts `test*` invocan `node --experimental-vm-modules node_modules/jest/bin/jest.js` en vez de
  `jest` a secas.
- Detalle de cada check, baseline vigente, piso de cobertura y bitácora de pruebas negativas:
  **`docs/verifications.md`**.
- Hooks (`.claude/settings.json`): `eslint --fix` del archivo editado en `PostToolUse` (`.ts` de
  `src/`/`test/` y `.mjs` de `scripts/`); si se edita un archivo de `.claude/agents/` o
  `feature_list.json`, corre el gate estructural y **bloquea** si queda en rojo; `harness:verify` al
  cerrar sesión (`SessionEnd`). CI (`.github/workflows/gate.yml`) corre el gate en Node de `.nvmrc`.

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

El harness se actualizó el **2026-08-31** adoptando las lecciones de un portafolio previo de proyectos (gate
de dos niveles, CHECK 1b de toolsets, fase de diseño por bandera, baseline en un solo documento,
prueba negativa obligatoria) y la trazabilidad requisito↔test del patrón SDD, reemplazando el SDD por
**TDD**: aquí el artefacto que se aprueba antes de codificar es **la batería de tests en rojo**, no un
documento paralelo que después se desincroniza del código.

El **2026-09-03** se subió el toolchain completo (Node 24 como piso, TypeORM 1.x, ESLint 10 estricto,
Jest 30) y el gate se hizo **consciente de la fase RED**: typecheck, lint y cobertura entraron al Nivel
A, la evidencia RED se valida por credibilidad, `red_modo: caracterizacion` formaliza las pruebas sobre
código existente, y `tdd: true` es obligatorio (CHECK 3e). Detalle en `progress/history.md`.
