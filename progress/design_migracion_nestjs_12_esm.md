# Diseño — #3 `migracion_nestjs_12_esm`

> **Estado: `pending`.** Este documento **no arranca la implementación**.
> **Esperando "go" del usuario para pasar a la fase RED del implementer.**

---

## 1. Encabezado y alcance

| | |
|---|---|
| **Feature** | `#3 migracion_nestjs_12_esm` — Migrar el framework a NestJS 12 (paquetes ESM) |
| **Disparadores** | **D9** (mayor del framework + empaquetado ESM), **D5** (toca `src/common/` transversal: logger y filtro global), **D8** (piso de Node / `engines` / `.nvmrc`) |
| **Autor** | `planner` (Opus), 2026-09-03 |
| **Insumos leídos** | `CLAUDE.md`, `AGENTS.MD`, `CHECKPOINTS.MD`, `docs/verifications.md` §1/§2/§4/§6, `progress/history.md` (entrada 2026-09-03), `feature_list.json`, `progress/current.md`, y el código real de `src/main.ts`, `src/app.module.ts`, `src/common/logger/winston.config.ts`, `src/common/filters/http-exception.filter.ts`, `src/common/filters/http-exception.filter.spec.ts`, `test/app.e2e-spec.ts`, `test/tsconfig.json`, `test/jest-e2e.json`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, `scripts/harness/verify.mjs` (CHECK 3c/3d/5/5b/5c/6) |

### Qué SÍ toca

| Archivo | Naturaleza del cambio |
|---|---|
| `src/common/logger/winston-logger.service.ts` | **NUEVO** — `LoggerService` propio sobre `winston`, reemplaza a `nest-winston` |
| `src/common/logger/logger.tokens.ts` | **NUEVO** — token de inyección `APP_LOGGER` |
| `src/common/logger/logger.module.ts` | **NUEVO** — `@Global()` módulo que provee y exporta el logger |
| `src/common/logger/winston.config.ts` | Cambia **solo el tipo de retorno**: `WinstonModuleOptions` (nest-winston) → `winston.LoggerOptions`. Los transports, niveles y rotación quedan **idénticos** |
| `src/common/filters/http-exception.filter.ts` | Cambia **solo el token**: `@Inject(WINSTON_MODULE_NEST_PROVIDER)` → `@Inject(APP_LOGGER)`. El tipo del parámetro sigue siendo `LoggerService` y el cuerpo de `catch()` no se toca |
| `src/app.module.ts` | `WinstonModule.forRoot(buildWinstonOptions())` → `LoggerModule` |
| `src/main.ts` | `app.get(WINSTON_MODULE_NEST_PROVIDER)` → `app.get(WinstonLoggerService)` |
| `package.json` | `@nestjs/*` 11 → 12; baja `nest-winston`; revisión de `overrides`; posible `engines`; posible cambio del script `build` (plan B) |
| `package-lock.json` | Regenerado por npm |
| `.nvmrc` (posible) | Ver §6.3 — piso de Node |
| **Baterías nuevas** | `src/common/logger/winston-logger.service.spec.ts`, `src/common/logger/logger.module.spec.ts`, `src/framework-nestjs12.spec.ts` |
| **Documentación** | `CLAUDE.md`, `docs/verifications.md` §6 (y §4 si se mueve el piso), `.claude/agents/*.md`, `README.md`, `docs/README.md`, `docs/01-plan-migracion.md` (criterio 4 de `acceptance`) |

### Qué NO toca (explícito)

- **No migra el proyecto a `"type": "module"`.** El repo sigue siendo **CommonJS** y consume los `@nestjs/*` ESM vía `require(esm)` de Node. `tsconfig.json` conserva `module: nodenext` con emisión CommonJS, `experimentalDecorators` y `emitDecoratorMetadata` (acoplamiento 12: sin metadatos de decoradores la DI de NestJS deja de resolver tipos).
- **No toca el esquema** (D4 no aplica): `typeorm` se queda en `1.1.1`, no se agrega, renombra ni borra ninguna entidad, columna, índice ni enum persistido. **No hay nada que llevar a producción en materia de esquema.**
- **No toca contratos públicos de la API** (D2 no aplica): ni rutas, ni verbos, ni DTOs, ni códigos de estado, ni el prefijo `/api`, ni el nombre `'access-token'` de Swagger.
- **No toca la regla de invalidación de JWT** (`JwtStrategy`, `AuthService`, payload, `lastTokenIssuedAt`, exp 8h) ni `PasswordService` (bcrypt, salt 10). Sube la versión de `@nestjs/jwt` y `@nestjs/passport`, así que **se verifica en Nivel B**, pero no se edita una línea de ese código.
- **No cambia el formato de respuesta** `{ statusCode, message, resource, isError }` ni el cuerpo de `ResponseInterceptor`.
- **No sube TypeScript.** Se queda en `~6.0.3` (techo por typescript-eslint `<6.1.0` y ts-jest `<7`, `docs/verifications.md` §6.2).
- **No cambia CORS** (`origin: '*'`, acoplamiento 10) ni `helmet`.

### Precondición de secuencia

La feature **#2** (`pruebas_guard_401_y_formato_respuesta`) está hoy en `red` esperando la puerta humana. Regla no negociable: **una sola feature activa**. Esta feature **no puede pasar a `red` hasta que la #2 esté `done`**, y además **depende** de ella: el `tdd_contract` de aquí ancla su regresión del filtro en `src/common/filters/http-exception.filter.spec.ts`, que la #2 crea.

---

## 2. Contrato confirmado (y PENDIENTES)

Esta feature no publica endpoints; su "contrato" es el de la plataforma. Tabla de lo verificado contra lo pendiente de confirmar **en la máquina, durante la fase GREEN**:

| # | Afirmación | Estado | Dónde se confirmó / cómo se confirma |
|---|---|---|---|
| C1 | NestJS 12.0.1 (2026-08-27) publica **todos** los `@nestjs/*` como `"type": "module"` (ESM puro): `common`, `core`, `platform-express`, `testing`, `cli` 12.0.0, `schematics` 12.0.0, `config` 12.0.0, `jwt` 12.0.1, `passport` 12.0.0, `swagger` 12.0.1, `typeorm` 12.0.1 | **Confirmado** (medición 2026-09-03, registrada en `docs/verifications.md` §6.3 y `progress/history.md`) | — |
| C2 | Una app CommonJS los consume vía `require(esm)` de Node; requisito de runtime: Node 20.19+/22.12+/**24+** | **Confirmado** (medición 2026-09-03) | — |
| C3 | `nest-winston` 1.10.2 declara peer `@nestjs/common ^5..^11` y **no** soporta v12 (gremo/nest-winston#935, abierto el 2026-09-01). Es la **única** dependencia bloqueante | **Confirmado** | `package.json`; grep: solo 4 archivos de producción lo importan |
| C4 | `winston` 3.19 y `winston-daily-rotate-file` 5 **no** dependen de NestJS | **Confirmado** | `package.json` |
| C5 | `typeorm` 1.1.1 es dual CJS/ESM y `@nestjs/typeorm` 12.0.1 acepta core `^10 \|\| ^11 \|\| ^12` | **Confirmado** | medición 2026-09-03 |
| C6 | Jest 30.5.1 soporta `require()` de módulos ES en `jest-runtime` con **Node ≥ 24.9** (Jest 30.4.0, PR #16074); ts-jest 29.4.12 transpila los specs a CommonJS | **Confirmado** | medición 2026-09-03. La máquina corre 24.11.1 → cumple |
| C7 | El CLI 12 exige **Node ≥ 24.15** para `nest new/generate/upgrade` | **Confirmado** | medición 2026-09-03. La máquina tiene **24.11.1**; `.nvmrc` acuerda **24.20.0** |
| **P1** | ⚠️ **`nest build` con CLI 12 corre en Node 24.11.1** (la exigencia de 24.15 está documentada para `new/generate/upgrade`, no para `build`) | **PENDIENTE de confirmar** | Paso G5. Plan B definido en §4.5 |
| **P2** | ⚠️ **`@nestjs/config` 12 sigue aceptando `validate:` como función.** La guía oficial mueve la validación a **Standard Schema** (Zod/Valibot/ArkType); este repo usa `validate: validateEnv` con class-validator (`src/config/env.validation.ts`) | **PENDIENTE de confirmar** | Paso G3b. Plan B (adaptador Standard Schema sin dependencias nuevas) en §4.6. **D8** |
| **P3** | ⚠️ **Qué TypeScript empaqueta `@nestjs/cli@12`** y si el `overrides` vigente (`"@nestjs/cli": { "typescript": "$typescript" }`) sigue siendo válido o pasa a ser dañino | **PENDIENTE de confirmar** | Paso G4 (`npm ls typescript` debe mostrar **una sola** copia, 6.0.x) |
| **P4** | ⚠️ `@nestjs/swagger` 12 conserva `DocumentBuilder.addBearerAuth(..., 'access-token')` y `SwaggerModule.setup('api/docs', …)` con la misma firma | **PENDIENTE de confirmar** | Typecheck (CHECK 5b) + **Nivel B** (botón *Authorize* en `/api/docs`) |
| **P5** | ⚠️ `@nestjs/passport` 12 / `@nestjs/jwt` 12 conservan la firma de `AuthGuard('jwt')`, `PassportStrategy` y `JwtService.sign` con las opciones actuales | **PENDIENTE de confirmar** | Typecheck + batería unitaria (`jwt.strategy.spec.ts`, `auth.service.spec.ts`) + **Nivel B** (ciclo real de invalidación) |

**Contrato del logger propio (nuevo, y esto sí lo define este diseño):**

```ts
// src/common/logger/logger.tokens.ts
export const APP_LOGGER = 'APP_LOGGER';

// src/common/logger/winston-logger.service.ts
/** Superficie mínima de winston que este servicio consume. Se declara aquí y no se
 *  inyecta el `winston.Logger` completo para poder mockearlo con un solo método. */
export interface WinstonLike {
  log(level: string, message: string, meta?: Record<string, unknown>): unknown;
}

@Injectable()
export class WinstonLoggerService implements LoggerService {
  constructor(private readonly winston: WinstonLike) {}

  log(message: unknown, ...optionalParams: unknown[]): void;      // → nivel 'info'
  error(message: unknown, ...optionalParams: unknown[]): void;    // → nivel 'error' (+ stack)
  warn(message: unknown, ...optionalParams: unknown[]): void;     // → nivel 'warn'
  debug(message: unknown, ...optionalParams: unknown[]): void;    // → nivel 'debug'
  verbose(message: unknown, ...optionalParams: unknown[]): void;  // → nivel 'verbose'
  fatal(message: unknown, ...optionalParams: unknown[]): void;    // → nivel 'error', meta { fatal: true }
}
```

**Reglas exactas de la firma (esto es lo que la batería fija):**

1. **Mapeo de niveles Nest → winston:** `log`→`info`, `error`→`error`, `warn`→`warn`, `debug`→`debug`, `verbose`→`verbose`, `fatal`→`error` con `{ fatal: true }` en el metadato (los niveles `npm` de winston no tienen `fatal`; inventar un nivel obligaría a tocar `levels` en `winston.config.ts`, que es transversal).
2. **Contexto:** NestJS invoca `logger.log(message, context)` y `logger.error(message, stack, context)`. Regla: **si el último `optionalParam` es `string`, es el `context`**; en `error`, si además hay un parámetro previo, es el `stack`. Se emiten como metadato `{ context }` / `{ context, stack }`.
3. **Sin contexto → sin metadato.** Se llama `this.winston.log(nivel, mensaje)` sin tercer argumento (o con objeto vacío; la batería fija cuál).
4. **El mensaje se normaliza a `string`** (`typeof message === 'string' ? message : JSON.stringify(message)` **no**: ver acoplamiento 9 en §6). Decisión: `String(message)` para primitivos y, para objetos, `message instanceof Error ? message.message : String(message)`. **Nunca se serializa un objeto arbitrario al log**, porque un objeto arbitrario en este dominio puede traer datos de cliente y **el log queda en disco**.
5. **`setLogLevels` NO se implementa** (es opcional en `LoggerService`). El nivel lo decide `buildWinstonOptions()` a partir de `NODE_ENV`, en un solo lugar; si NestJS pudiera sobrescribirlo habría dos fuentes de verdad para el mismo número. Queda documentado en el propio archivo.
6. **El tipo del parámetro de `HttpExceptionFilter` sigue siendo `LoggerService`** (no `WinstonLoggerService`). Esto **no es cosmético**: el spec de la feature #2 construye el filtro con `new HttpExceptionFilter(logger)` donde `logger: jest.Mocked<Pick<LoggerService, 'log' | 'error' | 'warn'>>`. Si el parámetro pasara a ser la clase concreta, **ese spec dejaría de compilar** (CHECK 5b en rojo fuera de la batería = `[FAIL]`). Cambia **solo el token del `@Inject`**.

---

## 3. Precedente de la casa a ESPEJAR (no inventar)

| Qué se necesita | Precedente existente que se espeja | Dónde |
|---|---|---|
| Módulo global que provee un servicio transversal | `ConfigModule.forRoot({ isGlobal: true })` registrado en `AppModule` | `src/app.module.ts` |
| Provider por **fábrica** (para poder construir el objeto con dependencias externas) | `TypeOrmModule.forRootAsync({ inject, useFactory })` | `src/app.module.ts` |
| Provider por **token** consumido con `@Inject(...)` | El propio `@Inject(WINSTON_MODULE_NEST_PROVIDER)` que hoy usa `HttpExceptionFilter` | `src/common/filters/http-exception.filter.ts` |
| Servicio `@Injectable()` de `src/common/` con su spec y mocks tipados | `PasswordService` (+ `password.service.spec.ts`) | `src/users/password.service.ts` |
| Spec con mock tipado `jest.Mocked<Pick<…>>` y aserción sobre el resultado | `http-exception.filter.spec.ts` (feature #2), `auth.service.spec.ts` | `src/common/filters/`, `src/auth/` |
| Spec que verifica **metadatos/cableado** de NestJS en vez de comportamiento | `src/users/users.controller.guard.spec.ts` (feature #2, `GUARDS_METADATA`) | `src/users/` |
| Comentario de cabecera que explica el **porqué** de la decisión, en español | `winston.config.ts`, `test/app.e2e-spec.ts`, `tsconfig.json` | varios |

**La implementación debe espejar, no reinventar.** `WinstonLoggerService` es un `@Injectable()` común y corriente con constructor por parámetro-propiedad, igual que `PasswordService`; `LoggerModule` es un `@Module()` con `providers`/`exports`, igual que los demás.

---

## 4. Desglose exacto del cambio

### 4.1. `src/common/logger/logger.tokens.ts` (nuevo)

Una constante `APP_LOGGER` (string) y su comentario: por qué existe un token propio en vez de inyectar la clase (permite que `HttpExceptionFilter` siga tipando su dependencia como `LoggerService` y que el mock del spec sea un `Pick`).

### 4.2. `src/common/logger/winston-logger.service.ts` (nuevo)

- `import * as winston from 'winston';` solo para el tipo `LoggerOptions` si hace falta; la interfaz `WinstonLike` se declara aquí.
- `implements LoggerService` de `@nestjs/common`. **`LoggerService` puede importarse como `import type`** (es una interfaz, no se inyecta ni se valida; acoplamiento 12 respetado). `Injectable` **no** puede ser `import type`.
- Un método privado `escribir(nivel, message, optionalParams)` que concentra el mapeo, y los seis métodos públicos delegando en él. Un solo lugar donde se decide qué llega al metadato = un solo lugar que auditar por datos sensibles.
- Cabecera con la nota de seguridad Kata (equivalente a la que ya tiene `winston.config.ts`).

> **Nota de tipado para el implementer:** si `winston.Logger` no resulta asignable a `WinstonLike` durante el typecheck (sobrecargas de `LogMethod`), el respaldo es `export type WinstonLike = Pick<winston.Logger, 'log'>;`. Es un detalle de compilación, no una decisión de diseño: elige el que compile sin `any` ni `eslint-disable`.

### 4.3. `src/common/logger/logger.module.ts` (nuevo)

```ts
@Global()
@Module({
  providers: [
    {
      provide: WinstonLoggerService,
      useFactory: () => new WinstonLoggerService(winston.createLogger(buildWinstonOptions())),
    },
    { provide: APP_LOGGER, useExisting: WinstonLoggerService },
  ],
  exports: [WinstonLoggerService, APP_LOGGER],
})
export class LoggerModule {}
```

Dos razones para las dos formas de registro:

- **`useExisting`** (no `useClass`) para que el token y la clase apunten a **la misma instancia**: una segunda instancia abriría un segundo juego de transports y **duplicaría cada línea en los archivos rotados**.
- **Exportar la clase** permite que `main.ts` haga `app.get(WinstonLoggerService)` **tipado**. Con `app.get(APP_LOGGER)` (token string) el retorno es `any` y `app.useLogger(...)` dispararía `@typescript-eslint/no-unsafe-argument` → **lint en rojo, gate en `[FAIL]`** (CHECK 5c corre con `--max-warnings=0`).

### 4.4. Modificaciones puntuales

| Archivo | De | A |
|---|---|---|
| `winston.config.ts` | `import { WinstonModuleOptions } from 'nest-winston'` · retorno `WinstonModuleOptions` | sin ese import · retorno `winston.LoggerOptions` |
| `http-exception.filter.ts` | `import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'` · `@Inject(WINSTON_MODULE_NEST_PROVIDER)` | `import { APP_LOGGER } from '../logger/logger.tokens'` · `@Inject(APP_LOGGER)` |
| `app.module.ts` | `import { WinstonModule } from 'nest-winston'` · `WinstonModule.forRoot(buildWinstonOptions())` en `imports` | `import { LoggerModule } from './common/logger/logger.module'` · `LoggerModule` en `imports` (mismo lugar, después de `ConfigModule`) |
| `main.ts` | `app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))` | `app.useLogger(app.get(WinstonLoggerService))` |
| `main.ts` (Swagger) | `.setDescription('API migrada desde Express hacia NestJS 11 (Kata Software).')` | `… NestJS 12 …` — **es texto publicado en `/api/docs`**, no lo dejes desfasado |

`buildWinstonOptions()` **no cambia de comportamiento**: mismos niveles, mismos tres transports, misma rotación, mismo `defaultMeta`. Cambiar transports o retención sería otra feature.

### 4.5. Orden exacto de la fase GREEN

El orden importa: **separa el fallo "logger propio" del fallo "ESM"**. Si se instala NestJS 12 con `nest-winston` presente, npm 10 aborta con `ERESOLVE` (peer `^5..^11`), y el criterio 1 de `acceptance` **prohíbe** `--legacy-peer-deps` y `--force`. Cada paso deja un punto verde al que se puede volver.

| Paso | Acción | Verificación antes de seguir |
|---|---|---|
| **G0** | `git status` limpio. Anota `git rev-parse HEAD` en `progress/impl_migracion_nestjs_12_esm.md`. Instala/activa **Node 24.20.0** (`.nvmrc`) — ver §6.3 | `node -v` → `v24.20.0`; `npm run harness:verify` → `[OK]` |
| **G1** | Escribir los 3 archivos nuevos de `src/common/logger/` y aplicar las 5 modificaciones puntuales de §4.4. **Todavía con NestJS 11 y `nest-winston` instalado pero sin uso** | `grep -r "nest-winston" src/ test/` → **0 resultados**. `npm run harness:verify` → `[OK]`. **Punto verde #1**: la batería del logger pasa en verde *antes* de tocar el framework |
| **G2** | `npm uninstall nest-winston` | `npm run harness:verify` → `[OK]`. **Punto verde #2**. Commit sugerido (`refactor(logger): LoggerService propio, sin nest-winston`) |
| **G3** | Un **solo** comando por grupo, para que npm resuelva el árbol una vez:<br>`npm i @nestjs/common@^12.0.1 @nestjs/core@^12.0.1 @nestjs/platform-express@^12.0.1 @nestjs/config@^12.0.0 @nestjs/jwt@^12.0.1 @nestjs/passport@^12.0.0 @nestjs/swagger@^12.0.1 @nestjs/typeorm@^12.0.1`<br>`npm i -D @nestjs/testing@^12.0.1 @nestjs/cli@^12.0.0 @nestjs/schematics@^12.0.0`<br>**Sin `--legacy-peer-deps` ni `--force`** | Ningún `ERESOLVE`. `npm ls @nestjs/common` → una sola copia 12.x |
| **G3b** | Resolver **P2**: revisar la firma de `ConfigModule.forRoot` en los tipos instalados (`node_modules/@nestjs/config/dist/*.d.ts`) y confirmar que `validate:` sigue aceptando una función | Typecheck de `src/app.module.ts`; plan B en §4.6 |
| **G4** | Resolver **P3**: `npm ls typescript` debe mostrar **una sola** copia `6.0.x`. Si `@nestjs/cli@12` exige TypeScript 7, el `overrides` lo estaría forzando a una versión no soportada → **quitar el override** y evaluar; si el CLI 12 ya trae su propio TS 6, el override sigue siendo inocuo y **se conserva** (el motivo original está en `docs/verifications.md` §6.5) | `npm ls typescript`, y `npx tsc -v` |
| **G5** | `npm run build`. Resolver **P1** | Si el CLI **se niega por Node < 24.15** y el usuario ya está en 24.20.0, el punto desaparece. Si aún así falla, **plan B**: cambiar el script a `"build": "tsc -p tsconfig.build.json"`, verificar que `dist/main.js` queda en la raíz de `dist/` (no `dist/src/main.js`) y documentarlo en `docs/verifications.md` §6 |
| **G6** | Comprobar `require(esm)` en Jest, **aislado antes que en masa**:<br>1. `node -e "console.log(typeof require('@nestjs/common').Injectable)"` → `function` (prueba `require(esm)` en el Node de la máquina)<br>2. `npx jest src/app.controller.spec.ts` (spec mínimo que ya importa `@nestjs/testing`)<br>3. `npx jest` completo | Si (1) falla, el problema es el runtime → §7. Si (1) pasa y (2) falla, el problema es `jest-runtime` → §7 |
| **G7** | `npm run test:e2e` **omitido** sin `DB_*` (es Nivel B, §8), typecheck, lint | `npm run harness:verify` → `[OK]` |
| **G8** | Cobertura: si el gate informa holgura ≥ 5 puntos (el logger nuevo suma ~40 líneas cubiertas), **subir `rules.cobertura_minima` y `docs/verifications.md` §4 en la misma pasada** | CHECK 6b sin `INFO` de holgura |
| **G9** | Actualizar los documentos del criterio 4 (§8.3) | Revisión del `reviewer` |
| **G10** | Declarar el **Nivel B** en `progress/impl_migracion_nestjs_12_esm.md` (§8.2) | — |

### 4.6. Plan B de `@nestjs/config` 12 (P2)

Si `validate:` como función desapareciera en favor de Standard Schema, **no se agrega Zod**: `validateEnv` ya existe y funciona; se envuelve en un objeto Standard Schema mínimo dentro de `src/config/env.validation.ts`, sin dependencias nuevas:

```ts
export const envSchema = {
  '~standard': {
    version: 1,
    vendor: 'kata',
    validate: (value: unknown) => ({ value: validateEnv(value as Record<string, unknown>) }),
  },
};
```

Y `ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema })` con el nombre de opción que exija la versión instalada. **Si esto obligara a agregar un paquete npm nuevo (Zod/Valibot), es D9 no planeado: el implementer se detiene y pregunta** (§9, Q3).

---

## 5. Batería de tests (el plan de trabajo — esto es lo que el usuario aprueba)

**`red_modo`: `nuevo`.** Los tres archivos **fallarán en disco**: dos porque importan módulos que todavía no existen (`error TS2307` + suite que no carga) y uno porque `package.json` declara `^11.2.3`. La cobertura no se evalúa en `red`/`nuevo` (CHECK 6b), y el build (CHECK 5) **debe seguir pasando** porque en RED no se toca código de producción.

### 5.1. `src/common/logger/winston-logger.service.spec.ts` — Nivel A, criterio 2

Mock tipado: `type WinstonMock = jest.Mocked<Pick<WinstonLike, 'log'>>;` y `new WinstonLoggerService(winston)`. Sin `any`, sin `as jest.Mock`.

| # | `it()` — nombre exacto |
|---|---|
| T1 | `log delega en winston con nivel info y pasa el contexto de NestJS como metadato` |
| T2 | `error delega en winston con nivel error e incluye el stack que NestJS envia como segundo parametro` |
| T3 | `warn delega en winston con nivel warn` |
| T4 | `debug y verbose delegan en winston con sus niveles equivalentes` |
| T5 | `fatal se registra en winston con nivel error marcado como fatal` |
| T6 | `sin contexto registra solo el mensaje, sin metadatos adicionales` |

- **T6 es además la prueba de seguridad Kata:** afirma con `toHaveBeenCalledWith` **exacto** que no se adjunta nada más al metadato. Winston escribe a archivo rotado; lo que se cuele ahí **queda en disco** (acoplamiento 9).
- **T4 cubre dos métodos en un `it()`** a propósito: son el mismo camino de código con distinto nivel, y `jest/expect-expect` se satisface con los dos `expect` sobre el mock.

### 5.2. `src/common/logger/logger.module.spec.ts` — Nivel A, criterio 2

| # | `it()` — nombre exacto |
|---|---|
| T7 | `LoggerModule expone APP_LOGGER y HttpExceptionFilter se resuelve por DI sin nest-winston` |

Compila un `Test.createTestingModule({ imports: [LoggerModule], providers: [HttpExceptionFilter] })` con `.overrideProvider(WinstonLoggerService).useValue(<doble tipado>)` y afirma que `module.get(HttpExceptionFilter)` devuelve una instancia de `HttpExceptionFilter`.

> **Por qué este test existe:** es el único de la batería que atrapa el modo de falla real de esta migración — **una dependencia sin resolver que solo aparece al levantar la app**. Los tests que construyen el filtro con `new` nunca ven el token. Y `overrideProvider` es obligatorio: sin él, el módulo construiría el `winston.createLogger` real y **la suite escribiría en `./logs/`**.

### 5.3. `src/framework-nestjs12.spec.ts` — Nivel A, criterio 1

| # | `it()` — nombre exacto |
|---|---|
| T8 | `package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS` |

Lee `package.json` con `readFileSync(join(__dirname, '..', 'package.json'), 'utf8')`, recorre `dependencies` y `devDependencies` quedándose con las llaves que empiezan con `@nestjs/`, y afirma `expect(desalineados).toEqual([])` contra `/^\^?12\./`. La segunda mitad del criterio la demuestra **el archivo mismo**: si `require(esm)` no funcionara bajo `jest-runtime`, la suite **no cargaría** y el fallo sería la evidencia. Se cierra con `expect(typeof Injectable).toBe('function')` sobre un `import` estático real de `@nestjs/common`.

> Es un test de plataforma, no de negocio, y está declarado como tal en su cabecera. Justifica su lugar en la batería porque **el criterio 1 tiene que tener un ancla en disco**: sin él, "la app arranca con NestJS 12" sería una afirmación que nadie vuelve a comprobar cuando alguien haga `npm i` de otra cosa.

### 5.4. Regresión heredada — Nivel A, criterio 2 (segunda mitad)

| # | `it()` — nombre exacto | Archivo |
|---|---|---|
| T9 | `HttpExceptionFilter convierte una excepción no HTTP en 500 "Internal server error" y registra solo método, ruta, status y mensaje (nunca el cuerpo de la petición)` | `src/common/filters/http-exception.filter.spec.ts` (lo crea la feature #2) |

Este test **no se escribe ni se modifica** en esta feature: se **declara** en el `tdd_contract` como el ancla de "`HttpExceptionFilter` sigue registrando método, ruta y status". Debe seguir en **verde** durante todo el ciclo.

> ⚠️ **Trampa del gate, léela antes de la fase RED.** El CHECK 3d exige que la *Evidencia RED* **mencione el nombre de cada archivo nivel A del contrato**, y `http-exception.filter.spec.ts` es uno. Como ese archivo **no** va a fallar, el implementer debe incluirlo explícitamente en la evidencia con una línea del tipo: *"`http-exception.filter.spec.ts` — **PASA (verde)**: regresión heredada de la feature #2, no forma parte del rojo."* Sin esa mención el gate marca `[FAIL]`; con una mención falsa de que falló, la evidencia deja de ser creíble.

### 5.5. Mapa `acceptance` ↔ `tdd_contract` (se copia tal cual a `feature_list.json`)

| Criterio | Nivel | Test / cómo se demuestra | Archivo |
|---|---|---|---|
| **1** — la app arranca y toda la batería pasa con `@nestjs/*` 12 sin `--legacy-peer-deps` ni `--force` | **A** | T8 | `src/framework-nestjs12.spec.ts` |
| **1** (complemento) | **B** | **Lo demuestra el propio gate en GREEN** (CHECK 5 build + 5b typecheck + 5c lint + 6 jest, todos sobre el árbol ya instalado en 12) **más el arranque manual** `npm run start:dev` + `GET /api/`. El "sin flags" queda en la bitácora del `npm i` pegada en `progress/impl_…md` | — |
| **2** — el logger Winston sigue operando y el filtro sigue registrando método/ruta/status | **A** | T1–T6, T7 | `winston-logger.service.spec.ts`, `logger.module.spec.ts` |
| **2** (segunda mitad) | **A** | T9 (regresión, verde) | `http-exception.filter.spec.ts` |
| **3** — el Nivel B (`npm run test:e2e` contra PostgreSQL) pasa con el Node de `.nvmrc` | **B** | §8.2 | — |
| **4** — `CLAUDE.md`, `docs/verifications.md` §6 y `.claude/agents/*.md` reflejan las versiones nuevas y el piso de Node | **B** | Revisión documental del `reviewer` contra la lista de §8.3 | — |

**Ningún criterio queda en `pendiente`** (lo exige `CHECKPOINTS.MD` para features `tdd: true`; el CHECK 3c lo trata como error).

---

## 6. Acoplamientos y riesgos

De los doce acoplamientos ocultos de `.claude/agents/planner.md`, aplican **ocho**:

| # | Acoplamiento | Cómo lo toca esta feature | Consecuencia concreta si se ignora |
|---|---|---|---|
| **1** | **Invalidación de JWT** (`JwtStrategy`, `iat < lastTokenIssuedAt`, bigint-string de pg, exp 8h) | No se edita, pero suben `@nestjs/jwt` y `@nestjs/passport` a 12 | Si `JwtService.sign` cambiara el manejo de `iat` o `PassportStrategy` la forma del payload, **los tokens viejos dejarían de invalidarse** — falla silenciosa en la dirección peligrosa. **Nivel B obligatorio:** login → token A → re-login → token B → `GET /api/users/me` con A debe dar **401** |
| **2** | **`ValidationPipe` global** (`whitelist` + `forbidNonWhitelisted`) | No se edita; sube `@nestjs/common` | Un cambio de comportamiento del pipe rechaza con **400** peticiones legítimas de la app móvil, o peor, deja pasar campos no declarados. **Nivel B:** `POST /api/users` con un campo inventado debe seguir dando 400 |
| **3** | **`ResponseInterceptor` global** | No se edita; sube `@nestjs/core` (rxjs 7.8) | Si el interceptor dejara de aplicarse, **todas** las respuestas pierden el envoltorio `{ statusCode, message, resource, isError }` y el front deja de leerlas. El e2e lo cubre (`body.resource`, `body.isError`) |
| **4** | **`HttpExceptionFilter` global** | **Se edita** (token de inyección) | Es **el punto de mayor riesgo del cambio**: si el token queda mal, la app **no arranca** (dependencia sin resolver) — ruidoso, no silencioso. Lo cubre T7 |
| **5** | **Prefijo `/api` y Swagger `'access-token'`** | No se edita; sube `@nestjs/swagger` a 12 (P4) | Si el nombre del esquema Bearer dejara de casar, el botón *Authorize* de `/api/docs` no aplica y **el endpoint parece roto sin estarlo**. Solo se ve en **Nivel B** |
| **6** | **`synchronize: NODE_ENV !== 'production'` sin migraciones** | **No se toca el esquema** (typeorm sigue en 1.1.1, ninguna entidad cambia) → **no hay nada que llevar a producción** | Riesgo indirecto: si `@nestjs/typeorm` 12 cambiara el registro de metadatos de `autoLoadEntities`, `synchronize` podría **alterar el esquema de DEV/QA al arrancar**. Mitigación obligatoria: **el Nivel B se corre contra una base desechable** (contenedor de `docs/verifications.md` §1), **nunca contra DEV/QA con datos** |
| **9** | **Winston con rotación a archivo** | **Se reimplementa el adaptador** | Todo lo que llegue al logger **queda en disco**. Por eso el servicio propio **no serializa objetos arbitrarios** (§2 regla 4) y T6 lo fija con una aserción exacta. Un `JSON.stringify(message)` cómodo convertiría cualquier objeto de crédito o cobranza en una línea persistida |
| **12** | **Metadatos de decoradores vs. `import type`** | `LoggerService` se importa como tipo; `Injectable`, `Module`, `Global`, `Inject` **no** | Convertir a `import type` una clase que se inyecta la borra del JavaScript emitido y **la DI deja de resolverla en runtime, sin error de compilación**. Por lo mismo, **el proyecto sigue en CommonJS**: pasar a `"type": "module"` para "acompañar" a NestJS 12 rompería `emitDecoratorMetadata` en el patrón que este repo usa en cada módulo y entidad |

No aplican: **7** (la entidad no sale por la API — no se tocan DTOs), **8** (bcrypt salt 10 — intacto), **10** (CORS — intacto), **11** (endurecimiento de TypeORM 1.x — la versión no cambia).

### 6.1. Riesgo específico del gate durante la migración

`npm i` de NestJS 12 puede arrastrar cambios de tipos que produzcan **errores de typecheck o de lint fuera de la batería**. En fase GREEN no hay tolerancia (§1 de `docs/verifications.md`): cualquier rojo fuera del contrato es `[FAIL]`. **No se apaga con `eslint-disable`** — y nunca sobre `no-unsafe-*` o `no-explicit-any` (`CHECKPOINTS.MD`). Si el ajuste de tipos crece más allá de firmas puntuales, es señal de abortar (§7).

### 6.2. Riesgo de doble instancia del logger

Registrar el token con `useClass` en vez de `useExisting` crea **dos** `WinstonLoggerService`, cada uno con su `createLogger` y sus `DailyRotateFile`: **cada línea aparecería dos veces** en `logs/application-*.log` y la rotación competiría por el mismo archivo. Es exactamente el tipo de defecto que no rompe ningún test y solo se descubre leyendo el disco.

### 6.3. Piso de Node — recomendación (D8)

| Hoy | Recomendación |
|---|---|
| `engines.node`: `>=24.11.0` · `.nvmrc`: `24.20.0` · máquina del usuario: **24.11.1** · `NODE_MIN` del gate: `24` (mayor) | **Subir `engines.node` a `>=24.15.0`** y **dejar `.nvmrc` en `24.20.0`**. `NODE_MIN` del gate **no cambia** (compara el mayor, y 24 sigue siendo el piso) |

**Qué implica para el usuario, en concreto:** `.npmrc` tiene `engine-strict`. En cuanto `engines` diga `>=24.15.0`, **`npm ci`/`npm install` se negarán a correr con Node 24.11.1**. Por lo tanto:

> **La fase GREEN empieza con el usuario instalando Node 24.20.0** (`nvm install 24.20.0; nvm use 24.20.0` en nvm-windows), **no con `npm install`.** Si se sube `engines` antes de cambiar de Node, el repo queda inoperable hasta que se cambie.

Beneficio de subirlo: quita la advertencia de entorno del CHECK 2 (parche distinto al de `.nvmrc`), habilita `nest new/generate/upgrade` del CLI 12 y elimina la duda **P1** sobre `nest build`. Si el usuario **no puede** cambiar de Node, la alternativa es dejar `engines` en `>=24.11.0` + plan B de build (§4.5 G5) y dejarlo escrito en `docs/verifications.md` §6 — funciona, pero deja el repo en una combinación no probada por el proveedor del CLI.

Recordatorio de calendario ya registrado en `docs/verifications.md` §6.1: **Node 26 entra a Active LTS el 2026-10-28**. Esta feature **no** mueve el piso a 26.

---

## 7. Alternativa descartada

### A. `overrides` de npm para forzar el peer de `nest-winston` *(la alternativa principal, descartada)*

```json
"overrides": { "nest-winston": { "@nestjs/common": "$@nestjs/common" } }
```

**Por qué se descarta:**

1. **Silencia la declaración, no arregla el código.** El peer `^5..^11` es la forma en que el mantenedor dice "no lo probé con 12". Un override convierte una incompatibilidad declarada en una **falla en runtime**, que en un logger transversal aparece como líneas que dejan de escribirse — sin excepción, sin test en rojo, y **en el componente que sirve para enterarse de todo lo demás**.
2. **La incógnita real no es el peer, es el consumo de ESM.** `nest-winston` 1.10.2 hace `require`/interop CommonJS sobre `@nestjs/common`; contra un paquete ESM puro, el resultado depende del detalle de cada import. Podría funcionar hoy y romperse en 12.0.2.
3. **El override es global y opaco.** Enmascara además cualquier otro conflicto de peers de `@nestjs/common` que aparezca después.
4. **Contradice el protocolo del harness** (`AGENTS.MD` §7): ante una herramienta que falla, se documenta y se detiene, no se inventa un workaround. El issue gremo/nest-winston#935 **no tiene fecha**; adoptar el override nos deja esperando a un tercero con la migración a medias.
5. **El costo de la opción elegida es bajo y acotado:** ~60 líneas de adaptador y su spec, sobre `winston` puro, que **elimina una dependencia** del árbol en vez de agregarla. La lógica de transports y rotación —lo que sí es valioso— ya vive en `winston.config.ts` y **no se toca**.

### B. Sustituir Winston por el `ConsoleLogger` de NestJS 12 *(descartada)*

Cero dependencias y cero adaptador, pero se pierde la **rotación diaria a archivo** (`logs/error-*.log`, `logs/application-*.log`, `maxFiles` 30d/14d). Esa bitácora es la evidencia operativa de un sistema de crédito y cobranza. Cambiar la política de retención de logs es una decisión de negocio, no un efecto colateral de subir el framework.

### C. Quedarse en NestJS 11 *(descartada por definición)*

Es la feature. Se deja registrada porque **sigue siendo el estado al que se vuelve** si se cumple un criterio de aborto (§7.1) — y volver ahí es un resultado legítimo, no un fracaso.

### 7.1. Criterio de aborto: cuándo marcar la feature `blocked`

| Señal en GREEN | Veredicto |
|---|---|
| `npx jest` no puede cargar `@nestjs/common` (`ERR_REQUIRE_ESM`, `Cannot use import statement outside a module`) **con Node 24.20.0 y Jest 30.5.1** | **`blocked`.** Es el supuesto C6 caído; no hay workaround aceptable (migrar toda la batería a ESM es otra feature, con su propio diseño) |
| `npm i` de los `@nestjs/*` 12 termina en `ERESOLVE` y **solo** avanza con `--legacy-peer-deps` o `--force` | **`blocked`.** El criterio 1 de `acceptance` lo prohíbe explícitamente. Anota **qué** paquete lo causó: si es uno solo y ya no se usa, puede volverse una feature previa de limpieza |
| El typecheck exige cambios de tipos **fuera** de firmas puntuales (p. ej. reescribir `JwtStrategy` o los DTOs) | **Parar y preguntar.** Sale del alcance declarado en §1 y probablemente dispara D3 (auth) o D2 (contratos) → diseño nuevo |
| `@nestjs/config` 12 obliga a agregar Zod/Valibot | **Parar y preguntar** (§9, Q3). Es un D9 no planeado |
| `nest build` se niega por Node < 24.15 | **No es aborto:** plan B `tsc -p tsconfig.build.json`, documentado (§4.5 G5) |
| `@nestjs/swagger` 12 cambia la firma de `addBearerAuth` | **No es aborto:** ajuste puntual en `main.ts`, verificado en Nivel B |

**Cómo se vuelve al verde (siempre en este orden):**

1. `git checkout -- package.json package-lock.json`
2. `npm ci` — **no `npm install`**: `ci` restaura el árbol **exacto** del lockfile y borra el árbol a medias que dejó la instalación fallida.
3. Si además se quiere revertir el logger propio: `git reset --hard <SHA del punto verde #2>` (o del `HEAD` anotado en **G0**).
4. `npm run harness:verify` → `[OK]`, y **la feature se deja en `blocked` con la causa escrita** en `progress/impl_migracion_nestjs_12_esm.md` y en `progress/current.md`.

> **El punto verde #1/#2 es el que hace barata esta decisión:** el logger propio y la salida de `nest-winston` son valiosos **por sí solos**, aunque NestJS 12 se posponga. Un aborto en G3+ conserva ese trabajo y deja el repo mejor que como estaba.

---

## 8. Verificación (Definición de Hecho)

### 8.1. Nivel A

- `npm run harness:verify` en **`[OK]`** (exit 0). Una corrida con `--estructura` **no cuenta**.
- **Advertencias de deuda == baseline vigente.** ⚠️ **Léelo de `docs/verifications.md` §4 al momento de correr, no de aquí:** al escribirse este diseño (2026-09-03) el baseline es **2**, y `docs/verifications.md` §4 anticipa que **la feature #2 lo baja a 0** al cerrarse. Como la #2 va antes que esta, lo esperado al ejecutar esta feature es **0** — pero se confirma leyendo el documento.
- **Piso de cobertura:** `rules.cobertura_minima` de `feature_list.json`, reflejado en `docs/verifications.md` §4. Valores al 2026-09-03: líneas 60 / sentencias 60 / funciones 55 / ramas 55; la feature #2 los sube. **Léelos de la fuente.** El logger nuevo (~40 líneas, cubiertas al 100 % por T1–T6) debería dar holgura → **trinquete: si es ≥ 5 puntos, se sube el piso en la misma pasada** (§4.5 G8).
- CHECK 5 (build), 5b (typecheck `src` + `test`), 5c (lint `--max-warnings=0`), 6 (jest 100 %) en verde **fuera** de la batería, y con la tolerancia de la fase RED **solo** dentro de ella.
- CHECK 3c: los 4 criterios con entrada en `tdd_contract`; los textos exactos de T1–T9 existen en sus archivos.
- CHECK 3d: *Evidencia RED* que menciona `winston-logger.service.spec.ts`, `logger.module.spec.ts`, `framework-nestjs12.spec.ts` **y** `http-exception.filter.spec.ts` (esta última con su estatus de verde declarado, §5.4).

### 8.2. Nivel B — declarado en `progress/impl_migracion_nestjs_12_esm.md`

Base **desechable** (contenedor de `docs/verifications.md` §1), **nunca DEV/QA con datos** (acoplamiento 6). Con Node de `.nvmrc`.

| # | Caso | Comando / acción | Criterio de `acceptance` |
|---|---|---|---|
| B1 | La app arranca con NestJS 12 y responde | `npm run start:dev`; `GET /api/` → `{ statusCode, message: 'OK', resource: { msg: 'Server is up and running' }, isError: false }` | 1 |
| B2 | Suite e2e completa en verde | `npm run test:e2e` con `.env` (`DB_*`, `JWT_SECRET`) | 3 |
| B3 | **Ciclo real de invalidación de JWT** | login → token A; re-login → token B; `GET /api/users/me` con A → **401**; con B → **200** | 1, 3 (acoplamiento 1) |
| B4 | Swagger publicado | `/api/docs` carga, *Authorize* con el esquema `access-token` aplica a los endpoints protegidos | 1 (acoplamiento 5) |
| B5 | `ValidationPipe` intacto | `POST /api/users` con un campo no declarado en el DTO → **400** | 1 (acoplamiento 2) |
| B6 | **El logger propio escribe en disco y NO filtra datos sensibles** | Provocar un 401 y un 500; revisar `logs/application-*.log` y `logs/error-*.log`: debe haber `MÉTODO ruta -> status: mensaje` y **ninguna** contraseña, token, `JWT_SECRET`, cadena de conexión ni dato de cliente. Verificar además que **no haya líneas duplicadas** (§6.2) | 2 |
| B7 | Esquema sin cambios | Comparar las columnas de `users` antes/después del arranque con `synchronize` activo (base desechable) | 1 (acoplamiento 6) |

### 8.3. Documentos a actualizar — criterio 4 de `acceptance`

Confirmados por búsqueda de `nest-winston` / `NestJS 11` / `NestJS 12` en el repo:

| Documento | Qué cambia |
|---|---|
| `CLAUDE.md` | "Stack vigente": NestJS 11.2 → 12.x; sección *Verificación*: el punto **"NestJS 11.2, no 12"** desaparece y se reemplaza por la nota de que el repo es CommonJS consumiendo `@nestjs/*` ESM; piso de Node si cambia |
| `docs/verifications.md` §6 | Punto **3** (NestJS 11.2 y no 12) reescrito con el resultado real; punto **1** (piso de Node) si sube `engines`; punto **5** (`overrides` del CLI) según lo hallado en **P3**; y el resultado de **P1**/**P2** |
| `docs/verifications.md` §4 | Baseline y piso de cobertura, si se movieron |
| `docs/verifications.md` §5 | Anotar la **prueba negativa pendiente** que esta feature sí puede cerrar: *"un spec del contrato que no compile (rojo por `tsc`)"* — la fase RED de esta feature lo produce de forma natural (T1–T7 no compilan). **Aprovéchalo y déjalo escrito** |
| `.claude/agents/planner.md` | Acoplamiento **9**: quitar *"`nest-winston` es la única dependencia sin soporte declarado para NestJS 12 (feature #3)"* y describir el logger propio. Acoplamiento **12**: agregar que el repo permanece CommonJS a propósito bajo NestJS 12 ESM |
| `.claude/agents/implementer.md`, `leader.md`, `reviewer.md` | Cualquier mención de versiones o de `nest-winston` |
| `README.md`, `docs/README.md` | Stack y versiones |
| `docs/01-plan-migracion.md` | Tabla de mapeo, donde cite NestJS 11 o `nest-winston` |
| `progress/history.md` | Entrada de cierre |
| `feature_list.json` | `description` del proyecto ("API NestJS 11 + TypeORM 1.x…") |
| `src/main.ts` | La `setDescription` de Swagger (§4.4) — es documentación **publicada** |

> `docs/checkpoints/CP-00` y `CP-05` mencionan `nest-winston`: son **referencia histórica** de la migración Express→NestJS y **no se editan** (`CLAUDE.md` §Contexto histórico).

---

## 9. Preguntas abiertas / decisiones a confirmar

Solo se listan decisiones de **negocio o de plataforma del usuario**. Cada una trae **valor por omisión**: el `leader` procederá con él si no hay respuesta.

| # | Pregunta | Valor por omisión recomendado |
|---|---|---|
| **Q1** | **¿Se sube el piso de Node?** Requiere que el usuario instale **Node 24.20.0** (hoy tiene 24.11.1) **antes** de la fase GREEN, porque `.npmrc` tiene `engine-strict`. | **Sí:** instalar 24.20.0 y subir `engines.node` a `>=24.15.0`, dejando `.nvmrc` en `24.20.0`. Es el único camino plenamente soportado por el CLI 12 y elimina la incógnita P1. Si el usuario no puede cambiar de Node: dejar `engines` como está y usar el plan B de build. |
| **Q2** | **¿Se acepta salir de `nest-winston` y mantener un adaptador propio (~60 líneas) en `src/common/logger/`?** Implica que Kata mantiene ese código; a cambio se elimina una dependencia del árbol y la migración deja de depender de un issue de terceros sin fecha. | **Sí** (opción A de §4). La configuración de transports y rotación —lo valioso— ya es propia y no cambia. |
| **Q3** | **Si `@nestjs/config` 12 obliga a Standard Schema (P2), ¿se autoriza agregar un paquete de validación (Zod) o se prefiere el adaptador sin dependencias?** | **Adaptador sin dependencias** (§4.6): reusa `validateEnv` con class-validator, que ya es la fuente de verdad de las variables de entorno. Agregar Zod sería un D9 no planeado. |
| **Q4** | **¿El `fatal()` de NestJS 12 se registra como `error` de winston con `{ fatal: true }`, o se agrega un nivel `fatal` propio a `winston.config.ts`?** Un nivel nuevo cambia el archivo transversal y la forma de los logs históricos. | **`error` + `{ fatal: true }`**: no altera la configuración de transports ni el parseo de los logs existentes. |
| **Q5** | **¿Se corre el Nivel B en esta feature o se difiere a una persona?** `docs/verifications.md` §6.8 registra que el Nivel B **sigue pendiente desde el 2026-09-03** (sin PostgreSQL local y con el daemon de Docker apagado). Esta feature toca framework, auth y logger a la vez: es la peor candidata para diferirlo. | **Correrlo:** levantar el contenedor `postgres:17` de `docs/verifications.md` §1 y ejecutar B1–B7. Si el entorno no lo permite, **declararlo como pendiente asignado a una persona** en `progress/impl_…md` — el `reviewer` no aprueba sin la declaración, y el `leader` debe saber que cierra la feature con el riesgo abierto. |

---

## 10. Regla de oro

Este diseño **no arranca la implementación**. No se modificó `feature_list.json` (la feature #3 sigue en `pending`) ni una sola línea de `src/` o `test/`.

**Esperando "go" del usuario para pasar a la fase RED del implementer.**

Al recibirlo, el orden es: **(1)** cerrar la feature #2 (`done`), **(2)** copiar §5.5 a `tdd_contract` con `red_modo: "nuevo"`, **(3)** fase RED con los tres specs nuevos, **(4)** puerta humana sobre la batería, **(5)** fase GREEN en el orden de §4.5.
