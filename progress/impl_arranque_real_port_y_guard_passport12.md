# Implementación — #5 `arranque_real_port_y_guard_passport12`

## 1. Feature y fase

- **Feature:** `#5 arranque_real_port_y_guard_passport12` — Arranque real bajo NestJS 12: `PORT` desde
  el entorno y `JwtAuthGuard` resolvible en `UsersModule` (hallazgos B1/B2 del Nivel B de la feature #3).
- **Fase:** **RED** (esta pasada). Puerta humana: **pendiente de aprobación del usuario**.
- **`red_modo`:** `nuevo` (el comportamiento no existe: los cuatro archivos Nivel A del contrato fallan
  en disco).
- **Diseño seguido:** `progress/design_arranque_real_port_y_guard_passport12.md` (autor: `planner`,
  2026-09-04). Se sigue el desglose §4 (corrección de B1/B2), la batería §5 con los `it()` exactos
  T1–T9 y E1/E2, y el mapa `acceptance` ↔ `tdd_contract` de §5.6.
- **Precondición de secuencia (diseño §1):** no había otra feature activa antes de arrancar (`progress/
  current.md` decía "sin feature activa"). La feature #6 declara dependencia de esta.

## 2. Batería de tests

| Criterio (`acceptance`) | `it()` — nombre exacto | Archivo | Nivel |
|---|---|---|---|
| 1 | `validateEnv acepta PORT como cadena numerica del entorno ("3000") y lo entrega como number` (T1) | `src/config/env.validation.spec.ts` | A |
| 1 | `EnvironmentVariables declara PORT con anotacion de tipo: su design:type es Number, no Object` (T2) | `src/config/env.validation.spec.ts` | A |
| 1 (ancla) | `validateEnv conserva el valor por omision 3000 cuando PORT no viene en el entorno` (T3) | `src/config/env.validation.spec.ts` | A |
| 1 (ancla) | `validateEnv rechaza un PORT no numerico` (T4) | `src/config/env.validation.spec.ts` | A |
| 1 (ancla) | `validateEnv rechaza un PORT fuera del rango 0-65535` (T5) | `src/config/env.validation.spec.ts` | A |
| 1 (ancla, D6) | `el mensaje de error de validateEnv nombra la propiedad y la restriccion, nunca el valor recibido` (T6) | `src/config/env.validation.spec.ts` | A |
| 1 (ancla) | `validateEnv convierte DB_PORT recibido como cadena del entorno en number` (T7) | `src/config/env.validation.spec.ts` | A |
| 2 | `UsersModule compila sin overrideGuard y JwtAuthGuard resuelve sus dependencias bajo @nestjs/passport 12` (T8) | `src/users/users.module.spec.ts` | A |
| 2 | `JwtAuthGuard no declara ninguna dependencia de constructor obligatoria: el injector de NestJS no le exige AuthModuleOptions` (T9) | `src/auth/guards/jwt-auth.guard.spec.ts` | A |
| 2 (ancla) | `getMe devuelve el DTO del usuario autenticado sin campo password` (T10, ya existía, citado por las features #1 y #2, **no se renombra**) | `src/users/users.controller.spec.ts` | A |
| 3 | `docker compose --profile app up -d --build --wait` + `GET /api/` con el envoltorio estándar (B1) | — | B |
| 4 | `un token emitido antes del ultimo login queda invalidado: el token viejo responde 401 y el nuevo 200` (E1, B3) | `test/app.e2e-spec.ts` | B |
| 4 | `POST /api/users con un campo no declarado en el DTO responde 400 por el ValidationPipe global` (E2, B5) | `test/app.e2e-spec.ts` | B |
| 4 | `npm run test:e2e:docker` (B2) + B4/B6/B7 manuales | — | B |

Nota: `tdd_contract` en `feature_list.json` copia §5.6 del diseño tal cual (7 entradas: 5 Nivel A —
usando T1 y T2 como anclas textuales del criterio 1, ya que el CHECK 3c admite varias entradas por
criterio y T3–T7 quedan cubiertas por el mismo archivo — y 2 Nivel B).

## 3. Evidencia RED

Corrida completa de `npm test`, **antes de escribir ningún código de producción**. Los cuatro archivos
Nivel A del contrato fallan; el resto de la suite (39 `it()` en 11 suites) sigue en verde.

```
> application-api-nestjs@0.1.0 test
> node --experimental-vm-modules node_modules/jest/bin/jest.js

FAIL src/config/env.validation.spec.ts
  ● validateEnv › validateEnv acepta PORT como cadena numerica del entorno ("3000") y lo entrega como number

    Validacion de variables de entorno fallida -> PORT: PORT must not be greater than 65535, PORT must not be less than 0, PORT must be an integer number

      at validateEnv (config/C:/Users/nivek/Desktop/application-api-NestJS/src/config/env.validation.ts:76:11)
      at Object.<anonymous> (config/C:/Users/nivek/Desktop/application-api-NestJS/src/config/env.validation.spec.ts:23:31)

  ● validateEnv › EnvironmentVariables declara PORT con anotacion de tipo: su design:type es Number, no Object

    expect(received).toBe(expected) // Object.is equality

    Expected: [Function Number]
    Received: [Function Object]

      at Object.<anonymous> (config/C:/Users/nivek/Desktop/application-api-NestJS/src/config/env.validation.spec.ts:35:18)

FAIL src/auth/guards/jwt-auth.guard.spec.ts
  ● JwtAuthGuard › JwtAuthGuard no declara ninguna dependencia de constructor obligatoria: el injector de NestJS no le exige AuthModuleOptions

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 3

    - Array []
    + Array [
    +   [Function AuthModuleOptions],
    + ]

      at Object.<anonymous> (auth/guards/C:/Users/nivek/Desktop/application-api-NestJS/src/auth/guards/jwt-auth.guard.spec.ts:22:26)

FAIL src/users/users.controller.spec.ts
  ● UsersController - GET /users/me › getMe devuelve el DTO del usuario autenticado sin campo password

    Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument
    AuthModuleOptions at index [0] is available in the RootTestModule module.

      at TestingInjector.lookupComponentInParentModules (../node_modules/@nestjs/core/injector/injector.js:313:19)
      ...
      at Object.<anonymous> (users/C:/Users/nivek/Desktop/application-api-NestJS/src/users/users.controller.spec.ts:53:35)

  ● UsersController - GET /users/me › getMe propaga NotFoundException cuando el usuario no existe

    Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument
    AuthModuleOptions at index [0] is available in the RootTestModule module.

      at Object.<anonymous> (users/C:/Users/nivek/Desktop/application-api-NestJS/src/users/users.controller.spec.ts:53:35)

FAIL src/users/users.module.spec.ts
  ● UsersModule › UsersModule compila sin overrideGuard y JwtAuthGuard resuelve sus dependencias bajo @nestjs/passport 12

    Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument
    AuthModuleOptions at index [0] is available in the UsersModule module.

      at Object.<anonymous> (users/C:/Users/nivek/Desktop/application-api-NestJS/src/users/users.module.spec.ts:26:23)

Test Suites: 4 failed, 11 passed, 15 total
Tests:       6 failed, 37 passed, 43 total
Snapshots:   0 total
Time:        7.131 s
Ran all test suites.
```

Lectura de la evidencia (los cuatro archivos Nivel A del contrato, cada uno con su fallo real):

- **`src/config/env.validation.spec.ts`** (T1, T2): T1 falla porque `validateEnv` **lanza** con
  `PORT: '3000'` (la cadena que siempre entrega el entorno) — exactamente B1. T2 falla porque
  `Reflect.getMetadata('design:type', ..., 'PORT')` es hoy `Object`, no `Number`. T3–T7 (anclas) pasan
  hoy sin tocar nada, confirmando que no se rompió el comportamiento existente.
- **`src/auth/guards/jwt-auth.guard.spec.ts`** (T9): falla porque `design:paramtypes` de `JwtAuthGuard`
  hoy **hereda** `[AuthModuleOptions]` del mixin (`AuthGuard('jwt')`) y `optional:paramtypes` no lo
  hereda, así que `obligatorias` es `[AuthModuleOptions]`, no `[]` — la causa raíz exacta de B2.
- **`src/users/users.module.spec.ts`** (T8): falla con el mismo `Nest can't resolve dependencies of the
  JwtAuthGuard (?)` que produjo B2 en el Nivel B real de la feature #3, ahora reproducido en el Nivel A.
- **`src/users/users.controller.spec.ts`** (T10, ambos `it()` existentes): al retirar el
  `.overrideGuard(JwtAuthGuard)` que ocultaba el defecto, los dos `it()` del describe fallan con el
  mismo error de DI (el guard se instancia al compilar el `TestingModule`, antes de llegar a cada test).

Ningún test de la batería nueva pasó por accidente: los seis (T1, T2, T8, T9 y los dos `it()` de T10)
fallan por la razón exacta que el criterio afirma que hoy no se cumple.

## 4. Archivos modificados (fase RED)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/config/env.validation.spec.ts` | Nuevo | T1–T7: `PORT` como cadena numérica, valor por omisión, rechazo fuera de rango/no numérico, mensaje sin el valor recibido (D6), y el ancla de `DB_PORT` (el precedente que ya funciona). |
| `src/users/users.module.spec.ts` | Nuevo | T8: compila `UsersModule` real con `Test.createTestingModule`, `overrideProvider(getRepositoryToken(User))` con un doble tipado (`jest.Mocked<Pick<Repository<User>, 'find' \| 'findOne'>>`), sin `overrideGuard`. |
| `src/auth/guards/jwt-auth.guard.spec.ts` | Nuevo | T9: reproduce las dos lecturas del injector (`getMetadata`/`getOwnMetadata`) y fija que ningún parámetro del constructor de `JwtAuthGuard` quede obligatorio. |
| `src/users/users.controller.spec.ts` | Modificado | Se retira `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` y el comentario de 7 líneas que documentaba la causa mal diagnosticada; se deja una nota de dos líneas (§4.3 del diseño). **Ningún `it()` se renombró.** |
| `test/app.e2e-spec.ts` | Modificado | Se agregan E1 (`un token emitido antes del ultimo login queda invalidado...`, B3) y E2 (`POST /api/users con un campo no declarado en el DTO responde 400...`, B5) al final del `describe`, tras los casos existentes. |
| `feature_list.json` | Modificado | Feature #5: `status` → `"red"`, `tdd_contract` completo (7 entradas: 5 Nivel A + 2 Nivel B), copiado de §5.6 del diseño. |
| `progress/current.md` | Modificado | Plan de la fase RED, batería, evidencia capturada, verificación del gate. |

No se tocó ningún archivo de producción: ni `src/config/env.validation.ts`, ni
`src/auth/guards/jwt-auth.guard.ts`, ni ningún `*.module.ts`, tal como exige la fase RED del diseño.

## 5. Decisiones de implementación (fase RED)

1. **T1–T7 viven en un solo archivo nuevo** (`env.validation.spec.ts`) porque `src/config/` no tenía
   spec propio; T1 y T2 son las dos entradas Nivel A del `tdd_contract` para el criterio 1 (representan
   T1–T7), tal como indica §5.6 del diseño.
2. **T9 reproduce literalmente las dos lecturas de metadatos del injector** (`Reflect.getMetadata` para
   `design:paramtypes`, `Reflect.getOwnMetadata` para `optional:paramtypes`), en vez de compilar un
   módulo completo, para que el test siga pasando igual bajo la opción elegida (§4.2 del diseño) y bajo
   el plan B, sin rediseñar la batería si hiciera falta el plan B.
3. **`src/users/users.module.spec.ts` sobreescribe solo el repositorio de `User`**, no el guard: es
   exactamente el test que atrapa B2 (precedente: `src/common/logger/logger.module.spec.ts`, "el único
   test de la batería que atrapa el modo de falla real […]: una dependencia sin resolver que solo
   aparece al levantar la app").
4. **`users.controller.spec.ts` se modificó, no se reescribió**: se quitó únicamente el
   `.overrideGuard` y su comentario; los dos `it()` (citados por los contratos de las features #1 y #2)
   quedaron con el texto exacto que ya tenían.
5. **E1 espera > 1 s entre los dos logins** (`setTimeout` de 1100 ms), documentado en el propio test:
   `AuthService.login` firma con `iat` en segundos y lo guarda como `lastTokenIssuedAt`; dos logins en
   el mismo segundo producen tokens idénticos y el "viejo" seguiría siendo válido, lo que daría un falso
   verde/rojo por un artefacto de resolución en segundos, no por la regla de negocio.
6. **Hallazgo del líder, corregido en esta misma pasada (antes de que hubiera código de producción que
   proteger):** `test/app.e2e-spec.ts` registraba `app.useGlobalInterceptors(new ResponseInterceptor())`
   en `beforeAll`, pero `src/app.module.ts` ya lo registra como `APP_INTERCEPTOR` global. Los dos
   interceptores activos habrían envuelto la respuesta dos veces (`body.resource` habría sido
   `{ statusCode, message, resource, isError }`), lo que hacía fallar "GET /api/ responde que el
   servidor está arriba" y "login con credenciales válidas...". Nadie lo había visto porque la suite
   nunca pasó de compilar `AppModule` (B2). Se quitó esa línea y el `require` de `ResponseInterceptor`
   que solo existía para eso (se conservó el `import type { ApiResponse }`, que sigue haciendo falta
   para tipar las respuestas). Se conservó `useGlobalPipes(new ValidationPipe(...))`: `AppModule` no
   declara `APP_PIPE` (lo hace `main.ts`, que esta suite no ejecuta), así que si se quitara, E2 fallaría
   por una razón distinta a la que prueba (el campo no declarado pasaría sin 400). Esto **es una
   desviación de §5.5 del diseño**, que no anticipaba este ajuste porque no auditó el `beforeAll`
   existente contra `app.module.ts`; el archivo sigue compilando (verificado con `npm run typecheck`) y
   ningún `it()` existente cambió de nombre ni de aserción.
7. **No se creó ningún archivo de producción vacío** para que los specs "casi" compilaran: los seis
   fallos de la sección 3 son exactamente el rojo que exige la fase RED en modo `nuevo`.

## 6. Refactor aplicado con la batería en verde

No aplica: la fase RED no escribe código de producción, así que no hay refactor.

## 7. Desviaciones del diseño

| Punto del diseño | Desviación | Motivo |
|---|---|---|
| §5.5 (`test/app.e2e-spec.ts`, "agrega E1 y E2 al final del `describe`") | Además de agregar E1/E2, se quitó `app.useGlobalInterceptors(new ResponseInterceptor())` del `beforeAll` | Doble envoltura real detectada por el líder al revisar el archivo contra `src/app.module.ts` (`APP_INTERCEPTOR` ya registra el mismo interceptor); sin la corrección, los `it()` **existentes** de la suite (no solo E1/E2) habrían fallado por una razón ajena a lo que prueban. Cambio de test, no de producción; documentado en la decisión 6 de la sección 5. |

Ningún otro punto del diseño se desvió: los tres archivos nuevos, el retiro del `.overrideGuard`, los
`it()` exactos y el `tdd_contract` siguen literalmente §4–§5.6.

## 8. Verificación Nivel A (fase RED)

`npm run harness:verify` (feature en `red`, modo `nuevo`) terminó en **`[OK]`** (exit 0), tolerando
fallos de typecheck/lint/jest únicamente en los cuatro archivos Nivel A declarados en el `tdd_contract`.
Resumen de la corrida (checks 3–6b, con el detalle de Jest condensado — ver sección 3 para el detalle
completo):

```
==> CHECK 3 - feature_list.json
[OK] 6 feature(s) con estado valido (done=4, red=1, pending=1).
[OK] Feature activa: #5 arranque_real_port_y_guard_passport12 [red].

==> CHECK 3b - Bandera needs_design
[OK] Todas las features estan clasificadas con needs_design.

==> CHECK 3c - Trazabilidad criterio <-> test
[OK] Criterios con contrato: 16 en Nivel A (verificados en disco), 5 en Nivel B, 0 sin cobertura.

==> CHECK 3d - Evidencia RED
[OK] 4 feature(s) tdd:true revisada(s).

==> CHECK 3e - TDD obligatorio
[OK] Todas las features son tdd:true (exentas legacy declaradas: 1).

==> CHECK 4 - Higiene de src/ y test/
[OK] 26 archivo(s) .ts de produccion sin codigo de depuracion.
[OK] 16 archivo(s) de prueba sin .only ni tests deshabilitados.

==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 46 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 4 failed, 11 passed, 15 total
Tests:       6 failed, 37 passed, 43 total
[OK] Fase RED: 6 fallo(s) esperado(s) dentro de la bateria:
  src/auth/guards/jwt-auth.guard.spec.ts -> "JwtAuthGuard JwtAuthGuard no declara ninguna dependencia de constructor obligatoria: el injector de NestJS no le exige AuthModuleOptions"
  src/config/env.validation.spec.ts -> "validateEnv validateEnv acepta PORT como cadena numerica del entorno ("3000") y lo entrega como number"
  src/config/env.validation.spec.ts -> "validateEnv EnvironmentVariables declara PORT con anotacion de tipo: su design:type es Number, no Object"
  src/users/users.controller.spec.ts -> "UsersController - GET /users/me getMe devuelve el DTO del usuario autenticado sin campo password"
  src/users/users.controller.spec.ts -> "UsersController - GET /users/me getMe propaga NotFoundException cuando el usuario no existe"
  src/users/users.module.spec.ts -> "UsersModule UsersModule compila sin overrideGuard y JwtAuthGuard resuelve sus dependencias bajo @nestjs/passport 12"

==> CHECK 6b - Cobertura minima
[INFO] Fase RED (nuevo): typecheck, lint y jest toleran fallos SOLO en los archivos del tdd_contract: src/config/env.validation.spec.ts, src/users/users.module.spec.ts, src/auth/guards/jwt-auth.guard.spec.ts, src/users/users.controller.spec.ts.
[INFO] Fase RED: cobertura no evaluada (lineas 88.98%, sentencias 89.09%, funciones 78.57%, ramas 71.24%); se exige al pasar a green.

[BASELINE] 0 advertencias de deuda == baseline 0.

[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

Advertencias de deuda vs. baseline vigente (`docs/verifications.md` §4, `rules.baseline_advertencias`):
**0 == 0**, sin cambios. Cobertura: no se evalúa en fase RED modo `nuevo` (CHECK 6b); el gate reporta de
forma informativa 88.98/89.09/78.57/71.24 %, ya por encima del piso vigente (76/76/72/64) porque la
batería nueva ejercita `env.validation.ts` sin que exista todavía la corrección de producción que la
pondría en verde — la cobertura real de GREEN se medirá contra el piso en esa fase.

Una sola corrida fue suficiente; no hizo falta iterar.

## 9. Prueba Nivel B

**Pendiente de la fase GREEN**, tal como define el ciclo (el Nivel B se declara y ejecuta en GREEN,
contra el árbol ya corregido). Casos que quedan pendientes de ejecutar, listados en el diseño §8.2
(B1–B7, heredados de la feature #3):

| # | Caso | Comando / acción | Estado |
|---|---|---|---|
| B1 | La app arranca en el contenedor con `PORT` del entorno y `GET /api/` responde 200 | `docker compose --profile app up -d --build --wait` + `curl -fsS http://localhost:3000/api/` | Pendiente de GREEN |
| B2 | Suite e2e completa en verde | `npm run test:e2e:docker` | Pendiente de GREEN |
| B3 | Ciclo real de invalidación de JWT | Automatizado por E1 (`test/app.e2e-spec.ts`, ya escrito en esta fase RED; corre dentro de B2) | Pendiente de ejecución en GREEN |
| B4 | Swagger publicado y *Authorize* aplica | Navegar `/api/docs` con la app arriba | Pendiente de GREEN |
| B5 | `ValidationPipe` intacto | Automatizado por E2 (`test/app.e2e-spec.ts`, ya escrito en esta fase RED; corre dentro de B2) | Pendiente de ejecución en GREEN |
| B6 | El logger escribe en disco sin datos sensibles | Provocar el 401 de B3 y un 500; revisar `logs/*.log` | Pendiente de GREEN |
| B7 | Esquema sin cambios | `docker compose exec db psql ... "\d users"` antes/después | Pendiente de GREEN |

## 10. Acoplamientos revisados

De los acoplamientos ocultos de `.claude/agents/planner.md` que aplican a esta feature (diseño §6): en
esta fase RED no se tocó ningún código de producción, así que ninguno se "respetó" activamente todavía
(la fase GREEN los atenderá explícitamente). Dos ya influyeron en el diseño de la batería:

- **1 (invalidación de JWT):** E1 se escribió con la espera > 1 s entre logins precisamente para no
  falsear esta regla de negocio con un artefacto de resolución en segundos (decisión 5, sección 5).
- **2 (`ValidationPipe` global):** al corregir la doble envoltura del `beforeAll` de la e2e (decisión 6),
  se verificó explícitamente que `ValidationPipe` sí hacía falta declararlo ahí (porque `AppModule` no
  registra `APP_PIPE`), para no romper E2 por una razón distinta a la que prueba.

---

## 11. Fase GREEN (2026-09-04)

### 11.1. Puerta humana

El usuario aprobó la batería en rojo el 2026-09-04 con "ok sigamos". Se procedió en el orden exacto de
§4.6 del diseño (G1–G8).

### 11.2. G1 — `src/config/env.validation.ts`

Se aplicó literalmente §4.1 del diseño: anotación de tipo explícita y `readonly` en `PORT`.

```ts
// La anotacion ": number" es load-bearing, no estilo: con emitDecoratorMetadata,
// TypeScript emite design:type a partir de la anotacion; sin ella emite Object y
// plainToInstance(..., { enableImplicitConversion: true }) no tiene a que convertir,
// asi que la cadena '3000' que SIEMPRE entrega el entorno llega intacta a
// @IsInt/@Min/@Max y la validacion la rechaza (mismo patron que DB_PORT!: number).
// "readonly" es obligatorio (y no solo declarativo): @typescript-eslint/no-inferrable-types
// trae autofix que BORRA la anotacion de tipo cuando puede inferirse del valor por
// omision, y el hook PostToolUse corre `eslint --fix` en cada guardado; la regla salta
// las propiedades readonly, asi que sin esta palabra el propio tooling del repo
// reintroduce el defecto en silencio en el siguiente guardado.
@IsOptional()
@IsInt()
@Min(0)
@Max(65535)
readonly PORT: number = 3000;
```

No se tocó ninguna otra propiedad de `EnvironmentVariables` (§9 Q4 del diseño: queda para la #6).

### 11.3. G2 — build y verificación del metadato de `PORT`

```
$ npm run build
> application-api-nestjs@0.1.0 build
> nest build
(sin salida: build correcto)
```

`dist/config/env.validation.js` (extracto, línea 43-44):

```js
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(65535),
    __metadata("design:type", Number)
], EnvironmentVariables.prototype, "PORT", void 0);
```

`design:type` pasó de `Object` a `Number`. Contingencia de §4.1 no disparada: la anotación bastó.

### 11.4. G3 — `src/auth/guards/jwt-auth.guard.ts`

Se aplicó literalmente §4.2 del diseño (opción elegida, plan A):

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    // El constructor NO es decorativo: es lo que hace que TypeScript emita
    // `design:paramtypes: []` PROPIO de esta clase. Sin él, el injector de NestJS lee el
    // metadato heredado del mixin `AuthGuard()` con `Reflect.getMetadata` (camina la cadena de
    // prototipos) y ve una dependencia `AuthModuleOptions`, mientras que el `@Optional()` de ese
    // mismo mixin lo lee con `getOwnMetadata` y NO lo hereda: la dependencia opcional del padre se
    // vuelve OBLIGATORIA aquí y el módulo del controller que use este guard no arranca.
    // La estrategia es explícita ('jwt'), así que `defaultStrategy` solo documenta la intención:
    // `omitAuthModuleOptions()` lo descarta antes de llamar a passport.authenticate().
    super({ defaultStrategy: 'jwt' });
  }
}
```

No se tocó `@Module`, providers ni imports de ningún módulo (§4.4 del diseño: cero cambios).

### 11.5. G4 — build y verificación de `design:paramtypes`

```
$ npm run build
> application-api-nestjs@0.1.0 build
> nest build
(sin salida: build correcto)
```

`dist/auth/guards/jwt-auth.guard.js` (completo):

```js
"use strict";
...
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    constructor() {
        super({ defaultStrategy: 'jwt' });
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], JwtAuthGuard);
```

`__metadata("design:paramtypes", [])` presente, como esperaba el diseño. **El plan A (§4.2) funcionó a
la primera; no hizo falta el plan B** (`@Optional() @Inject(AuthModuleOptions)`), así que
`AuthModuleOptions` no se importó como valor en este archivo — no aplica la advertencia del
acoplamiento 12 para este caso concreto.

### 11.6. G5 — batería completa y ausencia de `overrideGuard`

```
$ npm test
> application-api-nestjs@0.1.0 test
> node --experimental-vm-modules node_modules/jest/bin/jest.js

Test Suites: 15 passed, 15 total
Tests:       43 passed, 43 total
Snapshots:   0 total
Time:        8.061 s
```

43/43 en verde (37 previos + los 6 que estaban en rojo en RED: T1, T2, T8, T9 y los dos `it()` de T10).
Verificado con `grep` que no queda ningún `.overrideGuard(` real en `src/` (la única coincidencia de la
palabra en `src/users/users.module.spec.ts` es el nombre del `it()` y un comentario que **describen**
la ausencia del override, no una llamada).

### 11.7. G6 — `npm run harness:verify` y trinquete de cobertura

Primera corrida, con la feature todavía marcada `red` en `feature_list.json`: el gate correctamente
falló con `[ERR] Feature #5 ... esta en 'red' (modo nuevo) pero TODA la bateria pasa`, exactamente el
comportamiento documentado en `docs/verifications.md` §1 (una batería completamente verde en `red`
significa "o el test no prueba nada, o el comportamiento ya existía" — aquí es lo segundo: el código de
producción ya se corrigió). Se cambió `feature_list.json`: `status` de la feature #5 → `"green"`.

Segunda corrida, en `green`:

```
==> CHECK 5 - Compilacion (npm run build)
[OK] Build correcto.

==> CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)
[OK] Typecheck sin errores fuera de la fase RED.

==> CHECK 5c - Lint (eslint . --max-warnings=0)
[OK] Lint limpio en 46 archivo(s) (0 errores, 0 advertencias).

==> CHECK 6 - Pruebas unitarias (jest --coverage)
Test Suites: 15 passed, 15 total
Tests:       43 passed, 43 total
[OK] Pruebas en verde: 43/43 tests, 0 suite(s) rota(s).

==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 89.87%, sentencias 89.88%, funciones 83.72%, ramas 71.24%.

[INFO] Cobertura con holgura >= 5 puntos en lineas 89.87% (piso 76%), sentencias 89.88% (piso 76%),
funciones 83.72% (piso 72%), ramas 71.24% (piso 64%): sube el piso (trinquete) en feature_list.json y
docs/verifications.md seccion 4.

[BASELINE] 0 advertencias de deuda == baseline 0.

[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

**Trinquete disparado** (holgura ≥ 5 puntos en los cuatro indicadores): se subió `rules.cobertura_minima`
en `feature_list.json` de `76/76/72/64` a **`85/85/79/67`**, y `docs/verifications.md` §4 (línea base
vigente + histórico) en la misma pasada. Tercera corrida del gate, ya con el piso nuevo:

```
==> CHECK 6b - Cobertura minima
[OK] Cobertura sobre el minimo: lineas 89.87%, sentencias 89.88%, funciones 83.72%, ramas 71.24%.

[BASELINE] 0 advertencias de deuda == baseline 0.

[OK] Entorno integro (Nivel A). 0 advertencia(s). Recuerda el Nivel B.
```

`[OK]`, sin ningún `[INFO]` de holgura pendiente. Advertencias de deuda: **0 == baseline 0**. Cobertura
final: líneas 89.87 % · sentencias 89.88 % · funciones 83.72 % · ramas 71.24 %, todas por encima del
piso nuevo.

### 11.8. G7 — Nivel B, EJECUTADO (Docker Desktop encendido)

Base **desechable** de `compose.yaml` (PostgreSQL 17 en tmpfs), **nunca DEV/QA** (acoplamiento 6), con
la imagen construida desde el `Dockerfile` del repo (Node 24.20.0, igual que `.nvmrc`). Sin `.env` local
(confirmado con `Test-Path .env` → `False`), así que no aplicaba el riesgo operativo §6.10.2 del diseño.

**B2/B3/B5 — `npm run test:e2e:docker`:**

```
$ npm run test:e2e:docker
==> docker compose up -d --wait db
 Container application-api-nestjs-db-1 Healthy
==> jest e2e contra PostgreSQL en 127.0.0.1:5432
error: POST /api/users -> 401: Unauthorized {...}
error: POST /api/auth/login -> 401: Contraseña incorrecta {...}
error: GET /api/users/me -> 401: Unauthorized {...}
error: POST /api/users -> 400: Validación fallida {...}
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        4.912 s
==> docker compose down -v
```

6/6 en verde: los 4 casos previos de la feature #3 más **E1** (invalidación real de JWT tras re-login,
B3) y **E2** (`ValidationPipe` con campo no declarado → 400, B5). Los `error:` en la salida son el
logger registrando los 401/400 esperados por la propia suite (comportamiento correcto del filtro, no un
fallo).

**B1 — arranque real con `PORT` del entorno:**

```
$ docker compose --profile app up -d --build --wait
...
 Container application-api-nestjs-app-1 Healthy
```

```powershell
PS> Invoke-RestMethod -Uri 'http://localhost:3000/api/' -Method Get | ConvertTo-Json -Depth 5
{
    "statusCode":  200,
    "message":  "OK",
    "resource":  { "msg":  "Server is up and running" },
    "isError":  false
}
```

El contenedor arrancó con `PORT: 3000` inyectado desde `compose.yaml` (variable de entorno = cadena) y
respondió con el envoltorio estándar exacto que exige el criterio 3. Antes de esta feature, esto era
precisamente B1 en rojo.

**B4 — Swagger publicado y *Authorize* aplica:**

```powershell
PS> (Invoke-WebRequest -Uri 'http://localhost:3000/api/docs' -UseBasicParsing).StatusCode
200
PS> $json = Invoke-RestMethod -Uri 'http://localhost:3000/api/docs-json'
PS> $json.components.securitySchemes | ConvertTo-Json -Compress
{"access-token":{"scheme":"bearer","bearerFormat":"JWT","type":"http"}}
PS> # rutas de users:
/api/users/me [get] security: {"access-token":[]}
/api/users [post] security: {"access-token":[]}
/api/users [get] security: {"access-token":[]}
```

Las tres rutas de `UsersController` declaran el esquema `access-token` en el JSON publicado.

**B6 — logger sin datos sensibles, con 401 y 500 reales:**

401 provocado (cuerpo con `password` de prueba, sin token):

```powershell
PS> try { Invoke-RestMethod -Uri 'http://localhost:3000/api/users' -Method Post -ContentType 'application/json' `
      -Body '{"username":"nivelb-log-test",...,"password":"valor-de-prueba","role":"admin"}' } `
    catch { "Status: $($_.Exception.Response.StatusCode.value__)" }
Status: 401
```

500 real (no trivial de provocar — el diseño §8.2 lo declaraba opcional, pero sí se logró): se sembró
un usuario de prueba desechable directamente en la base (receta exacta de §8.2 del diseño: hash bcrypt
con `docker compose exec app node -e "require('bcrypt').hash(...)"`, `INSERT` vía `psql` con stdin
para evitar el escapado de comillas de PowerShell), se hizo login para obtener un token válido, y se
repitió el `POST /api/users` **autenticado** con el mismo `email` ya usado — TypeORM lanza
`QueryFailedError` por la restricción `UQ_users_email`, que **no** es una `HttpException`, así que cae
en la rama que corrigió la feature #4:

```powershell
PS> Invoke-RestMethod ... -Headers @{ Authorization = "Bearer $token" } -Body '{...,"email":"nivelb-user@example.com",...}'
Status: 500
{"statusCode":500,"message":"Internal server error","isError":true}
```

Logs (`docker compose --profile app exec app sh -c "cat logs/*.log"`):

```
{"hostname":"...","level":"error","message":"POST /api/users -> 401: Unauthorized",...}
{"hostname":"...","level":"error","message":"POST /api/users -> 500: duplicate key value violates unique constraint \"UQ_users_email\"",...}
{"hostname":"...","level":"error","message":"POST /api/users -> 401: Unauthorized",...}
{"hostname":"...","level":"error","message":"POST /api/users -> 500: duplicate key value violates unique constraint \"UQ_users_email\"",...}
```

Cada línea aparece **exactamente una vez por archivo** (`application-2026-09-04-18.log` y
`error-2026-09-04.log`; verificado leyendo cada archivo por separado): la duplicación aparente al
concatenar con `cat logs/*.log` es el diseño esperado de Winston con dos transports (uno captura todos
los niveles, el otro solo `error`), **no** una regresión. Búsqueda explícita en el contenido completo
de `logs/*.log`: `valor-de-prueba` → no aparece; `JWT_SECRET` → no aparece; `solo-local` → no aparece;
la contraseña de prueba del usuario sembrado (`nivelb-secret-01`) → no aparece; el hash bcrypt sembrado
→ no aparece. El mensaje real del `Error` (`duplicate key value violates unique constraint...`) llega
al log para diagnóstico, tal como fija la feature #4, y el cliente solo recibió `"Internal server
error"`.

**B7 — esquema sin cambios:**

```
$ docker compose exec db psql -U postgres -d application_api -c "\d users"
                                       Table "public.users"
      Column       |            Type             | Collation | Nullable |         Default
-------------------+-----------------------------+-----------+----------+-------------------------
 id                | uuid                        |           | not null | uuid_generate_v4()
 username          | character varying(50)       |           | not null |
 name              | character varying(100)      |           | not null |
 email             | character varying           |           | not null |
 password          | character varying           |           | not null |
 role              | users_role_enum             |           | not null | 'user'::users_role_enum
 isActive          | boolean                     |           | not null | true
 lastTokenIssuedAt | bigint                      |           |          |
 createdAt         | timestamp without time zone |           | not null | now()
 updatedAt         | timestamp without time zone |           | not null | now()
Indexes:
    "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY, btree (id)
    "UQ_users_email" UNIQUE CONSTRAINT, btree (email)
    "UQ_users_username" UNIQUE CONSTRAINT, btree (username)
```

Columnas idénticas a `src/users/entities/user.entity.ts`: `id`, `username`, `name`, `email`, `password`,
`role`, `isActive`, `lastTokenIssuedAt` (nullable, `bigint`), `createdAt`, `updatedAt`. Sin cambios de
esquema, como anticipaba el diseño (§1 "Qué NO toca").

Cierre: `docker compose --profile app down -v` (contenedores, red y volúmenes tmpfs eliminados).

**Resultado consolidado — los siete casos, ejecutados:**

| # | Caso | Resultado |
|---|---|---|
| B1 | Arranque con `PORT` del entorno + `GET /api/` | ✅ 200, envoltorio estándar |
| B2 | Suite e2e completa | ✅ 6/6 (`npm run test:e2e:docker`) |
| B3 | Invalidación real de JWT tras re-login | ✅ automatizado (E1), dentro de B2 |
| B4 | Swagger + `access-token` en rutas de `users` | ✅ `/api/docs` 200, esquema aplicado a las 3 rutas |
| B5 | `ValidationPipe` intacto | ✅ automatizado (E2), dentro de B2 |
| B6 | Logger sin datos sensibles, 401 y 500 reales | ✅ ambos provocados; sin fugas; sin líneas duplicadas por archivo |
| B7 | Esquema sin cambios | ✅ columnas idénticas a la entidad `User` |

### 11.9. G8 — Documentación

| Documento | Cambio |
|---|---|
| `docs/verifications.md` §1 | Cerrado el párrafo "Por qué el Nivel B sigue siendo declarado…": los dos defectos quedaron corregidos por la #5; el párrafo de "En CI" ahora dice que B3 y B5 corren automatizados dentro de `nivel-b-e2e`. |
| `docs/verifications.md` §4 | Piso subido a 85/85/79/67 (desde 76/76/72/64); histórico con la fila 2026-09-04 de la feature #5. |
| `docs/verifications.md` §5.4 (nueva) | Prueba negativa: "el Nivel B encuentra lo que el Nivel A no ve", con la mutación exacta (revertir el guard, quitar la anotación de `PORT`) y su lectura correcta. |
| `docs/verifications.md` §6 punto 3 | Nota fechada (2026-09-04) que corrige el diagnóstico erróneo de la feature #3 sobre por qué se necesitó `.overrideGuard`, sin borrar el texto original. |
| `.claude/agents/planner.md` | Acoplamiento **13** nuevo (metadatos heredados de un mixin en guards de clase) + nota de la trampa de `no-inferrable-types`; contador de "12 puntos" → "13 puntos" en la sección de estructura del diseño. |
| `CLAUDE.md` | "doce" → "trece" modos de falla silenciosa (desincronizado por mi propia edición de `planner.md`; se corrigió en la misma pasada). |
| `progress/impl_migracion_nestjs_12_esm.md` §11.7 | Nota fechada (2026-09-04) que corrige el diagnóstico "a partir de NestJS 12, `compile()` instancia también los guards" con la causa real (asimetría `getMetadata`/`getOwnMetadata`), sin borrar el texto original ni reescribir la historia. |
| `.env.example` | Sin cambios (confirmado: `PORT=3000` ya era correcto, el defecto estaba en el código que lo leía). |
| `README.md` | Revisado (sección "Docker (Nivel B y despliegue)"): ya documentaba los comandos correctos sin mencionar el defecto corregido; sin cambios necesarios. |
| `feature_list.json` | `status` de la feature #5 → `"green"`; `rules.cobertura_minima` y `cobertura_nota` actualizados. |

### 11.10. Cierre

`feature_list.json`: feature #5 en `"green"`. `npm run harness:verify` final: **`[OK]`**, sin
tolerancias de fase RED, 0 advertencias de deuda, cobertura sobre el piso nuevo. Nivel B **ejecutado**
(no solo declarado), los siete casos con evidencia pegada arriba. No se marcó `done` (corresponde al
`reviewer`) y no se hizo ningún commit.
