# Diseño — #5 `arranque_real_port_y_guard_passport12`

> **Estado: `pending`.** Este documento **no arranca la implementación**. No se modificó
> `feature_list.json` ni una línea de `src/` o `test/`.
>
> Fecha: 2026-09-04 · Rol: `planner` (Opus) · Disparadores citados en `feature_list.json`:
> **D3** (guards y cableado de Passport, `src/auth/**`) y **D8** (`src/config/env.validation.ts`).

---

## 1. Encabezado y alcance

**Título:** Arranque real bajo NestJS 12 — `PORT` desde el entorno y `JwtAuthGuard` resolvible en
`UsersModule` (hallazgos B1/B2 del primer Nivel B ejecutado).

**Origen:** `progress/impl_migracion_nestjs_12_esm.md` §11.16.1 y `docs/verifications.md` §1
("Por qué el Nivel B sigue siendo declarado aunque CI corra parte de él"). Los dos defectos son
**preexistentes o colaterales**, no de negocio: ninguno cambia un contrato público.

### Qué SÍ toca

| Archivo | Cambio | Motivo |
|---|---|---|
| `src/config/env.validation.ts` | Anotación de tipo explícita en `PORT` (+ comentario que explica por qué es load-bearing) | B1 · D8 |
| `src/auth/guards/jwt-auth.guard.ts` | Constructor explícito para que la subclase declare su propio `design:paramtypes` | B2 · D3 |
| `src/config/env.validation.spec.ts` | **nuevo** — `src/config/` no tenía spec | batería, criterio 1 |
| `src/users/users.module.spec.ts` | **nuevo** — compila `UsersModule` real, sin `overrideGuard` | batería, criterio 2 |
| `src/auth/guards/jwt-auth.guard.spec.ts` | **nuevo** — fija la causa raíz (metadatos) como invariante ejecutable | batería, criterio 2 |
| `src/users/users.controller.spec.ts` | **se retira** el `.overrideGuard(JwtAuthGuard)` y su comentario (que documenta una causa mal diagnosticada) | quitar la máscara del Nivel A |
| `test/app.e2e-spec.ts` | dos casos nuevos: invalidación real de JWT (B3) y `ValidationPipe` (B5) | Nivel B, criterios 3 y 4 |
| `.claude/agents/planner.md` | acoplamiento **13** nuevo (ver §6.9) | documentación |
| `docs/verifications.md` §1 / §4 / §5 | resultado del Nivel B, piso de cobertura si se mueve, prueba negativa | documentación |
| `progress/impl_arranque_real_port_y_guard_passport12.md`, `progress/current.md`, `progress/history.md` | bitácora del ciclo | harness |

### Qué NO toca (explícito)

- **`src/auth/auth.module.ts`.** `PassportModule.register({ defaultStrategy: 'jwt' })` se queda donde
  está: la configuración de Passport sigue viviendo **solo** en `src/auth/`, tal como exige el criterio 2
  de `acceptance`. Con la corrección elegida (§4.2) **no hace falta importarlo en `UsersModule`**.
- **`src/auth/strategies/jwt.strategy.ts`, `auth.service.ts`, el payload del token, el `expiresIn: '8h'`
  y la regla `payload.iat < user.lastTokenIssuedAt`.** Ni una línea. Es la regla de negocio crítica del
  repo (acoplamiento 1) y esta feature **la verifica de verdad por primera vez** (B3), no la cambia.
- **`src/users/users.controller.ts`.** El guard sigue siendo de **clase** (`@UseGuards(JwtAuthGuard)`
  sobre el controller). Bajarlo a nivel de método (opción (e) del encargo) cambiaría qué rutas quedan
  protegidas: es un D3 con consecuencia real y **se descarta** (§7.4).
- **`src/main.ts`.** `app.listen(process.env.PORT ?? 3000)` se queda como está (§9, Q3).
- **Esquema de datos.** Ninguna entidad, columna, índice ni enum cambia: `synchronize` no tiene nada
  que sincronizar y **no hay ruta a producción que declarar** (acoplamiento 6).
- **`package.json`.** Cero dependencias nuevas, cero versiones movidas. No hay D9.
- **`.env.example`.** `PORT=3000` ya es correcto; lo que estaba mal era el código que lo leía.

### Precondición de secuencia

No hay feature activa (`progress/current.md`: "sin feature activa"). La #6
(`refactor_buenas_practicas`) declara dependencia de esta: **la #5 va primero**.

---

## 2. Contrato confirmado (y PENDIENTES)

Esta feature **no toca ningún contrato público**: no hay ruta, verbo, DTO ni código de estado nuevo o
modificado (no es D2). Lo que se fija es el **contrato interno** de dos funciones y el
**comportamiento observable de arranque**.

### 2.1. `validateEnv(config)` — `src/config/env.validation.ts`

| Aspecto | Confirmado en el código | Fuente |
|---|---|---|
| Firma | `validateEnv(config: Record<string, unknown>): EnvironmentVariables` | `env.validation.ts` |
| Uso | `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` | `src/app.module.ts` |
| Modo | `plainToInstance(..., { enableImplicitConversion: true })` + `validateSync({ skipMissingProperties: false })` | `env.validation.ts` |
| Forma del error | `Error("Validacion de variables de entorno fallida -> PROP: restricción; …")`, **sin el valor recibido** (protege `JWT_SECRET`/`DB_PASS`) | `env.validation.ts`, comentario propio |
| Defecto | `PORT = 3000` **sin anotación** → `__metadata("design:type", Object)` | **`dist/config/env.validation.js` línea 43** (verificado) |
| Contraste | `DB_PORT!: number` → `__metadata("design:type", Number)` → sí convierte `'5432'` | **`dist/config/env.validation.js` línea 54** (verificado) |
| Contraste 2 | `NODE_ENV: NodeEnvironment = …` → `design:type String` (TS serializa un enum de strings como `String`) | **`dist/config/env.validation.js` línea 36** (verificado) |

**Auditoría de las 8 propiedades (respuesta a la decisión 1 del encargo):** se leyó el JavaScript
emitido, no el fuente. `PORT` es **la única** propiedad con `design:type Object`; las otras siete
tienen anotación explícita (`String`, `Number`). **No hay más instancias del mismo patrón** y no hace
falta tocarlas. La evidencia empírica lo confirma: en el arranque fallido de B1, `DB_PORT` (que también
llega como cadena desde `compose.yaml`) pasó la validación y solo `PORT` falló.

**Contrato después del cambio** (esto es lo que la batería fija):

| Entrada de `PORT` | Resultado esperado |
|---|---|
| ausente | `3000` (`number`) |
| `'3000'` (cadena, como llega SIEMPRE del entorno) | `3000` (`number`) ← **hoy lanza** |
| `3000` (número) | `3000` (`number`) |
| `'abc'` | lanza (`must be an integer number`) |
| `'70000'` / `70000` | lanza (`must not be greater than 65535`) |
| cualquiera inválida | el mensaje nombra propiedad + restricción, **nunca el valor** |

### 2.2. `JwtAuthGuard` — `src/auth/guards/jwt-auth.guard.ts`

| Aspecto | Confirmado | Fuente |
|---|---|---|
| Declaración actual | `@Injectable() class JwtAuthGuard extends AuthGuard('jwt') {}` (cuerpo vacío, sin constructor) | `jwt-auth.guard.ts` |
| Uso | guard **de clase** en `UsersController`; único consumidor en todo el repo | `grep JwtAuthGuard` → `users.controller.ts:12` |
| Estrategia | `'jwt'` **explícita** en el mixin; `defaultStrategy` nunca se consulta para elegirla | `node_modules/@nestjs/passport/dist/auth.guard.js:41` |
| Registro real de la estrategia | efecto **global** de `PassportStrategy` (`passportInstance.use(name, this)`) al instanciar `JwtStrategy`, **no DI** | `dist/passport/passport.strategy.js:34` |
| Opciones efectivas hoy | `{ session: false, property: 'user' }` (`defaultOptions`) + `{ defaultStrategy: 'jwt' }`; `omitAuthModuleOptions` descarta `defaultStrategy` y `property` antes de llamar a `passport.authenticate` | `dist/options.js`, `dist/auth.guard.js:31-42, 77-80` |

**PENDIENTES de confirmar:** ninguno. Todo lo anterior se leyó en disco (`src/`, `dist/`,
`node_modules/@nestjs/passport`, `node_modules/@nestjs/core`). El único punto que **no** se pudo
verificar en el árbol es *cuál* de las dos líneas de aguas arriba cambió entre NestJS 11 y 12, porque
el 11 ya no está instalado; §6.2 explica por qué **eso no altera la corrección elegida** y deja la
comprobación opcional escrita.

---

## 3. Causa raíz de B2 (investigada, no adivinada)

El encargo pide explicar por qué el `@Optional()` del mixin no basta. La respuesta está en **una
asimetría de dos líneas** del injector, y se verificó leyendo el código instalado.

### 3.1. Lo que emite TypeScript para la subclase

`dist/auth/guards/jwt-auth.guard.js` (compilado real, verificado):

```js
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
};
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)()
], JwtAuthGuard);
```

**No hay `__metadata("design:paramtypes", …)`.** TypeScript solo lo emite si la clase decorada tiene un
constructor con cuerpo (`shouldAddParamTypesMetadata`), y `JwtAuthGuard` no lo tiene. Tampoco hay
`optional:paramtypes`: `@Optional()` se aplicó al **mixin**, no a esta clase.

### 3.2. Lo que emite el mixin de Passport 12

`node_modules/@nestjs/passport/dist/auth.guard.js:65-73`:

```js
__decorate([ Optional(), Inject(AuthModuleOptions), __metadata("design:type", AuthModuleOptions) ],
  MixinAuthGuard.prototype, "options", void 0);          // ← inyección por PROPIEDAD
MixinAuthGuard = __decorate([ __param(0, Optional()),
  __metadata("design:paramtypes", [AuthModuleOptions]) ], MixinAuthGuard);  // ← por CONSTRUCTOR
```

Y `Optional()` (`node_modules/@nestjs/common/decorators/core/optional.decorator.js:19-20`) escribe
`OPTIONAL_DEPS_METADATA` (`'optional:paramtypes'`) con `Reflect.defineMetadata(..., target)`, donde
`target` es **`MixinAuthGuard`**, no `JwtAuthGuard`.

### 3.3. La asimetría del injector

`node_modules/@nestjs/core/injector/injector.js`:

```js
reflectConstructorParams(type) {                                  // línea 219
  const paramtypes = [...(Reflect.getMetadata(PARAMTYPES_METADATA, type) || [])];   // ← getMetadata: CAMINA la cadena de prototipos
  ...
}
reflectOptionalParams(type) {                                     // línea 227
  return Reflect.getOwnMetadata(OPTIONAL_DEPS_METADATA, type) || [];                // ← getOwnMetadata: SOLO la clase misma
}
```

Con `type = JwtAuthGuard`:

- `design:paramtypes` → no lo tiene propio, **pero `getMetadata` lo hereda del mixin** → `[AuthModuleOptions]`.
- `optional:paramtypes` → `getOwnMetadata` **no hereda** → `[]`.

Resultado: el injector cree que `JwtAuthGuard` pide `AuthModuleOptions` en el índice 0 **y que es
obligatoria**. Como `UsersModule` no importa `PassportModule.register(...)`, falla con el mensaje
exacto del Nivel B:

```
Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument
AuthModuleOptions at index [0] is available in the UsersModule module.
```

**El `@Optional()` no basta porque la opcionalidad no se hereda; el tipo del parámetro sí.** Es la
única de las cuatro lecturas de metadatos del injector que usa `getOwnMetadata`: la inyección por
**propiedad** (`reflectProperties`, línea 410-412) lee *ambas* con `getMetadata`, así que la propiedad
`options` **sí** se hereda como opcional y nunca dio problema. Ese es el detalle que hace que el
defecto se vea "arbitrario".

### 3.4. Por qué el guard se instancia en `UsersModule` (y no en `AuthModule`)

Un guard declarado con `@UseGuards()` sobre un controller se registra como **injectable del módulo
donde vive ese controller** (el scanner lo toma del metadato `__guards__` del controller) y se
instancia junto con los demás en `InstanceLoader.createInstancesOfInjectables`
(`node_modules/@nestjs/core/injector/instance-loader.js:77-84`), que corre dentro de
`createInstancesOfDependencies` — es decir, en `Test.createTestingModule(...).compile()` y en
`NestFactory.create(...)`. Por eso el módulo señalado es `UsersModule` y no `AuthModule`, aunque el
guard viva en `src/auth/`.

### 3.5. Discriminación de la hipótesis "es nuevo en 12"

`progress/impl_migracion_nestjs_12_esm.md` §11.7 atribuye el fallo a que *"a partir de NestJS 12,
`compile()` instancia también los guards de clase (antes se resolvían de forma perezosa)"*.
**Esa explicación no cuadra con lo que se lee en disco:** `createInstancesOfInjectables` no es nueva,
y si la instanciación fuera lo único que cambió, el defecto habría existido igual bajo 11 (los
enhancers se instancian ahí desde hace varias versiones mayores, y `GuardsContextCreator` solo *busca*
la instancia ya creada, no la crea).

La hipótesis que **sí** explica las dos observaciones a la vez (que `users.controller.spec.ts` pasara
sin `overrideGuard` bajo 11, y que la e2e nunca fallara por esto) es que `reflectOptionalParams`
leyera con `Reflect.getMetadata` (cadena) en el 11 y pasara a `getOwnMetadata` en el 12: con lectura en
cadena, `AuthModuleOptions` era opcional en la subclase, se resolvía a `undefined` y todo compilaba.

**Consecuencia práctica: ninguna.** La corrección de §4.2 arregla el defecto bajo **cualquiera** de las
dos hipótesis, porque elimina la dependencia de constructor en lugar de intentar satisfacerla. La
atribución exacta queda como nota histórica; si alguien la quiere cerrar, cuesta un minuto y no
requiere instalar nada:

```powershell
npm pack @nestjs/core@11.2.0        # descarga el tarball, no lo instala
# extraer y buscar reflectOptionalParams en injector.js: ¿getMetadata o getOwnMetadata?
```

> Se corrige **la causa mal diagnosticada** en la bitácora de la #3 al cerrar esta feature
> (§8.3): dejar escrito un diagnóstico equivocado es peor que no dejar ninguno, porque la próxima
> persona lo cita.

---

## 4. Desglose exacto del cambio

### 4.1. `src/config/env.validation.ts` — corrección de B1

```ts
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  readonly PORT: number = 3000;
```

**La anotación `: number` es load-bearing, no estilo.** Con `emitDecoratorMetadata`, TypeScript emite
`design:type` a partir de la anotación; sin ella emite `Object` y
`plainToInstance(..., { enableImplicitConversion: true })` no tiene a qué convertir, así que la cadena
`'3000'` que **siempre** entrega el entorno llega intacta a `@IsInt`/`@Min`/`@Max` y la validación la
rechaza. Es el mismo patrón que ya funciona en `DB_PORT!: number`.

**⚠️ Por qué `readonly` (y no `PORT: number = 3000` a secas):** la regla
`@typescript-eslint/no-inferrable-types` viene como **error** en `stylisticTypeChecked`
(`node_modules/@typescript-eslint/eslint-plugin/dist/configs/flat/stylistic-type-checked.js:37`), con
`ignoreProperties: false` por omisión, y **tiene autofix que borra la anotación**. El hook
`PostToolUse` de `.claude/settings.json` corre `eslint --fix` sobre cada `.ts` editado y
`npm run lint` también lleva `--fix`: sin `readonly`, la herramienta del propio repo **reintroduce el
defecto en silencio** en el siguiente guardado. La regla salta explícitamente las propiedades
`readonly` (`no-inferrable-types.js:168`: `if (ignoreProperties || node.readonly || node.optional) return;`),
y además `readonly` es semánticamente correcto: la configuración validada no se muta. El comentario
del código debe decir **las dos cosas** (metadato + autofix), o alguien lo "limpiará".

Red de seguridad independiente del linter: **T2** de la batería afirma que
`design:type` de `PORT` es `Number`. Si la anotación desaparece por cualquier vía, el gate lo atrapa.

No se extiende `readonly` a las otras siete propiedades en esta feature (mezclarlo con `!:` en siete
líneas es ruido que no compra nada y arriesga el typecheck sin test que lo cubra): candidato para la
feature #6, anotado en §9 Q4.

### 4.2. `src/auth/guards/jwt-auth.guard.ts` — corrección de B2 (opción elegida: **(c)**)

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

**Equivalencia de comportamiento (verificada, no supuesta):**

- Hoy, en la práctica, `this.options` valía `{ defaultStrategy: 'jwt' }` (lo inyectaba
  `PassportModule.register` vía la propiedad) o `{}` (el inicializador del mixin). Después vale
  `{ defaultStrategy: 'jwt' }` **siempre**.
- `canActivate` compone `{ ...defaultOptions, ...this.options, ...getAuthenticateOptions() }` y luego
  `omitAuthModuleOptions` **descarta `defaultStrategy` y `property`**: lo que llega a
  `passport.authenticate('jwt', …)` es idéntico. `property` no se configura en este repo, así que
  `request.user` sigue siendo `request.user` (de `defaultOptions`).
- La inyección por **propiedad** sigue existiendo y sigue siendo opcional; si el token no está
  disponible, `applyProperties` **no sobreescribe** (`injector.js:424`:
  `.filter(item => !isNil(item.instance))`), así que el valor del constructor sobrevive.
- El guard **no necesita DI para encontrar la estrategia**: `JwtStrategy` la registra en el `passport`
  global al instanciarse (`passport.strategy.js:34`). Eso lo garantiza `AuthModule` dentro de
  `AppModule`, como hoy.

**Beneficio de durabilidad:** cualquier módulo futuro que use `@UseGuards(JwtAuthGuard)` funciona sin
importar nada. Con las alternativas (a), (b) o (d) —todas basadas en *proveer* el token— cada módulo
nuevo debe acordarse de importar algo, y el modo de falla vuelve (§7).

**Contingencia (disparador medible, no opinión):** después de `npm run build`, verificar

```powershell
Select-String -Path dist/auth/guards/jwt-auth.guard.js -Pattern 'design:paramtypes'
# esperado:  __metadata("design:paramtypes", [])
```

Si TypeScript 6 **no** emitiera ese arreglo vacío, se pasa al plan B **sin rediseñar la batería** (T9
está escrito para pasar con las dos formas):

```ts
constructor(@Optional() @Inject(AuthModuleOptions) options?: AuthModuleOptions) {
  super(options ?? { defaultStrategy: 'jwt' });
}
```

que fuerza `design:paramtypes` **y** `optional:paramtypes` propios. ⚠️ En plan B,
`AuthModuleOptions`, `Optional` e `Inject` se importan como **valor**, nunca con `import type`
(acoplamiento 12: un tipo borrado en compilación no puede emitirse como metadato).

### 4.3. `src/users/users.controller.spec.ts` — se retira la máscara

Se elimina `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` y el comentario de 7
líneas que lo justificaba (documenta la causa de §3.5, que no es la real). Se conserva una nota de dos
líneas: *el guard real se instancia aquí porque `@UseGuards` es de clase; no se ejercita (eso es
`users.controller.guard.spec.ts` y el Nivel B), solo debe resolver por DI.*

**Decisión (respuesta a la decisión 3 del encargo): se retira.** El `.overrideGuard` es exactamente lo
que escondió el defecto del Nivel A; conservarlo dejaría el mismo hueco abierto para la próxima
regresión. Con la corrección de §4.2 el guard resuelve con cero dependencias, así que el override no
compra nada.

⚠️ **No se renombra ningún `it()` de ese archivo:** los contratos de las features #1 y #2 apuntan a
`getMe devuelve el DTO del usuario autenticado sin campo password` y
`getMe propaga NotFoundException cuando el usuario no existe`, y el CHECK 3c busca esos textos
literales en disco. Cambiar el nombre rompe el gate de dos features cerradas.

### 4.4. Módulos y providers

**Ninguno.** Cero cambios en `@Module({...})`, cero providers nuevos, cero módulos nuevos, cero
importaciones (por lo tanto, cero riesgo de ciclo `AuthModule ↔ UsersModule`). La configuración de
Passport sigue existiendo en un solo lugar: `src/auth/auth.module.ts`.

### 4.5. Decoradores de Swagger

Ninguno. No hay endpoint nuevo ni cambio de contrato publicado; `@ApiBearerAuth('access-token')` de
`UsersController` se queda igual (acoplamiento 5).

### 4.6. Orden exacto de la fase GREEN

| # | Paso | Verificación inmediata |
|---|---|---|
| G1 | `src/config/env.validation.ts` (§4.1) | `npm test -- env.validation` → T1–T7 verdes |
| G2 | `npm run build` | `dist/config/env.validation.js` dice `__metadata("design:type", Number)` en `PORT` |
| G3 | `src/auth/guards/jwt-auth.guard.ts` (§4.2) | `npm test -- jwt-auth.guard users.module users.controller` verdes |
| G4 | `npm run build` + comprobación de `design:paramtypes` (§4.2) | `[]`; si no, plan B y se anota como desviación |
| G5 | `npm test` completo | toda la batería verde, sin `overrideGuard` en ningún spec |
| G6 | `npm run harness:verify` | `[OK]`; si la holgura de cobertura ≥ 5 puntos, **subir el piso** en la misma pasada (`rules.cobertura_minima` + `docs/verifications.md` §4) |
| G7 | **Nivel B completo** (§8.2) | B1–B7 ejecutados y pegados en `progress/impl_<name>.md` |
| G8 | Documentación (§8.3) | acoplamiento 13, §1/§4/§5 de `verifications.md`, corrección de §11.7 de la #3 |

---

## 5. Batería de tests (el plan de trabajo — esto es lo que el usuario aprueba)

`red_modo: **nuevo**` (ya declarado en `feature_list.json`). Los cuatro archivos de Nivel A fallan
**en disco** antes de tocar producción; los "anclas" son casos que ya pasan hoy y que existen para que
la corrección no se vuelva permisiva (se declaran como tales, no se disfrazan de rojo).

### 5.1. `src/config/env.validation.spec.ts` — **nuevo**, Nivel A, criterio 1

Precedente a espejar: `src/users/users.controller.guard.spec.ts` (aserción sobre metadatos de
decoradores, con `import 'reflect-metadata'` y `as unknown` para no violar `no-unsafe-*`).

Base compartida del spec (sin secretos reales; valores literales de prueba):

```ts
const base = { NODE_ENV: 'test', DB_HOST: 'localhost', DB_PORT: '5432', DB_USER: 'u',
               DB_PASS: 'valor-de-prueba-no-es-un-secreto', DB_NAME: 'd',
               JWT_SECRET: 'valor-de-prueba-no-es-un-secreto' };
```

| # | `it()` exacto | Hoy | Después |
|---|---|---|---|
| **T1** | `validateEnv acepta PORT como cadena numerica del entorno ("3000") y lo entrega como number` | **ROJO** (lanza `PORT must be an integer number`) | verde |
| **T2** | `EnvironmentVariables declara PORT con anotacion de tipo: su design:type es Number, no Object` | **ROJO** (`Object`) | verde |
| **T3** | `validateEnv conserva el valor por omision 3000 cuando PORT no viene en el entorno` | verde (ancla) | verde |
| **T4** | `validateEnv rechaza un PORT no numerico` | verde (ancla) | verde (`Number('abc')` → `NaN` → `@IsInt` falla) |
| **T5** | `validateEnv rechaza un PORT fuera del rango 0-65535` | verde (ancla) | verde (`@Max`) |
| **T6** | `el mensaje de error de validateEnv nombra la propiedad y la restriccion, nunca el valor recibido` | verde (ancla, **D6**) | verde |
| **T7** | `validateEnv convierte DB_PORT recibido como cadena del entorno en number` | verde (ancla: es el precedente que sí funciona) | verde |

Notas de implementación:
- T2: `expect(Reflect.getMetadata('design:type', EnvironmentVariables.prototype, 'PORT') as unknown).toBe(Number)`.
- T6: con `PORT: '70000'`, afirmar `toContain('PORT')` **y** `not.toContain('70000')` **y**
  `not.toContain('valor-de-prueba-no-es-un-secreto')`. Es la aserción que impide que alguien "mejore"
  el mensaje agregando el valor recibido y filtre `JWT_SECRET`/`DB_PASS` a la consola y al log.
- Cada `it()` cierra con un `expect` sobre el resultado (regla de la casa + `jest/expect-expect`).

### 5.2. `src/users/users.module.spec.ts` — **nuevo**, Nivel A, criterio 2

Precedente a espejar: `src/common/logger/logger.module.spec.ts` — *"el único test de la batería que
atrapa el modo de falla real […]: una dependencia sin resolver que solo aparece al levantar la app"*.
Mismo patrón: compilar el **módulo real** y sobreescribir solo lo que tocaría infraestructura.

| # | `it()` exacto | Hoy | Después |
|---|---|---|---|
| **T8** | `UsersModule compila sin overrideGuard y JwtAuthGuard resuelve sus dependencias bajo @nestjs/passport 12` | **ROJO** (`Nest can't resolve dependencies of the JwtAuthGuard (?)`) | verde |

```ts
const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
  .overrideProvider(getRepositoryToken(User))
  .useValue(repositorioDoble)          // jest.Mocked<Pick<Repository<User>, 'find' | 'findOne'>>
  .compile();

expect(moduleRef.get(UsersController)).toBeInstanceOf(UsersController);
expect(moduleRef.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard);
```

Verificado que esto es suficiente y que **no toca PostgreSQL**: `TypeOrmModule.forFeature([User])`
declara el repositorio como `{ provide: getRepositoryToken(User), useFactory, inject: [DataSource] }`
(`node_modules/@nestjs/typeorm/dist/typeorm.providers.js:4-15`); `overrideProvider(...).useValue(...)`
**reemplaza el provider completo**, incluido su `inject`, así que el `DataSource` de `forRoot` deja de
ser necesario. `UsersService` solo pide ese token y `PasswordService` (local, sin dependencias).
`moduleRef.get(JwtAuthGuard)` funciona porque `InstanceLinksHost` indexa también los `injectables`
(`instance-links-host.js:31`).

### 5.3. `src/auth/guards/jwt-auth.guard.spec.ts` — **nuevo**, Nivel A, criterio 2

| # | `it()` exacto | Hoy | Después |
|---|---|---|---|
| **T9** | `JwtAuthGuard no declara ninguna dependencia de constructor obligatoria: el injector de NestJS no le exige AuthModuleOptions` | **ROJO** (`[AuthModuleOptions]`) | verde |

Reproduce **exactamente** las dos lecturas del injector (§3.3), y por eso pasa igual con la opción
elegida y con el plan B:

```ts
const paramtypes = (Reflect.getMetadata('design:paramtypes', JwtAuthGuard) ?? []) as unknown[];   // cadena
const opcionales = (Reflect.getOwnMetadata('optional:paramtypes', JwtAuthGuard) ?? []) as number[]; // own
const obligatorias = paramtypes.filter((_, i) => !opcionales.includes(i));

expect(obligatorias).toEqual([]);
```

Este es el test que convierte la causa raíz en invariante ejecutable: si mañana alguien agrega un
parámetro de constructor sin `@Optional()`, o quita el constructor, falla aquí con el nombre del
problema, no con un `[Nest] can't resolve` a las tres de la mañana en el arranque.

### 5.4. `src/users/users.controller.spec.ts` — **existente**, Nivel A, criterio 2 (ancla)

Se modifica el armado del `TestingModule` (§4.3), **no** los `it()`. Se declara en el contrato para que
el gate tolere su rojo durante la fase RED (la tolerancia aplica **solo** a los archivos Nivel A del
`tdd_contract`; ver `scripts/harness/verify.mjs:723`).

| # | `it()` exacto (ya existe) | Hoy sin el override | Después |
|---|---|---|---|
| **T10** | `getMe devuelve el DTO del usuario autenticado sin campo password` | **ROJO** (mismo error de DI, ahora en `RootTestModule`) | verde |

### 5.5. `test/app.e2e-spec.ts` — **existente, se extiende**, Nivel B, criterios 3 y 4

**No cuenta para la cobertura** (config de Jest unitaria: `rootDir: src`, `testRegex: .*\.spec\.ts$`;
`app.e2e-spec.ts` no casa) y **no corre en el Nivel A**. Debe **compilar** desde la fase RED, porque el
CHECK 5b typechea `test/tsconfig.json` y ese archivo **no** está en la lista de tolerados.

**Respuesta a la decisión 4 del encargo (cómo sembrar el usuario): no hace falta inventar nada.** La
suite **ya siembra y borra su propio usuario** en `beforeAll`/`afterAll`, con el hash del
`PasswordService` real (bcrypt, salt 10) y `username` sufijado con `Date.now()`. Es el camino más
barato y determinista para B3 y B5: sin `psql`, sin hashes a mano, sin depender de datos previos.

| # | `it()` exacto | Cubre |
|---|---|---|
| **E1** | `un token emitido antes del ultimo login queda invalidado: el token viejo responde 401 y el nuevo 200` | **B3** (acoplamiento 1) |
| **E2** | `POST /api/users con un campo no declarado en el DTO responde 400 por el ValidationPipe global` | **B5** (acoplamiento 2) |

⚠️ **Detalle que hace o rompe E1, medido leyendo `AuthService.login`:** el login firma con
`iat: Math.floor(Date.now()/1000)` **y** guarda ese mismo valor en `lastTokenIssuedAt`, y el rechazo es
estricto (`payload.iat < lastIssued`). Dos logins **en el mismo segundo** producen `iat` idénticos —
de hecho, tokens byte a byte idénticos — y el token "viejo" seguiría siendo válido. E1 **debe esperar
> 1 s entre los dos logins** (p. ej. `await new Promise((r) => setTimeout(r, 1100))`) y decirlo en un
comentario, o se leerá como un bug del negocio cuando es un artefacto de la resolución en segundos.

Orden y estado compartido: E1 y E2 van **al final** del `describe` (después de los casos existentes,
que obtienen su propio token) y cada uno hace su propio login, porque el re-login de E1 invalida los
tokens obtenidos antes. E2 termina en 400, así que **no crea usuarios** y no necesita limpieza extra.

#### 5.5.1. Adenda del leader (2026-09-04): doble registro del `ResponseInterceptor` en la e2e

Hallazgo del `planner` de la feature #6 (su diseño §6.1), verificado por el leader en el código:
`test/app.e2e-spec.ts` hace `app.useGlobalInterceptors(new ResponseInterceptor())` cuando
`src/app.module.ts` ya lo registra como `APP_INTERCEPTOR`. Los dos globales aplican y la respuesta
exitosa se envuelve **dos veces**: fallarían *"GET /api/ responde…"* y *"login con credenciales
válidas…"* aun con B1 y B2 corregidos. Nunca se vio porque la e2e no llegaba a las aserciones.

**Se incorpora a la fase RED de esta feature** (cambio de test, dentro del archivo Nivel B del
contrato): retirar esa línea y el `require` de `ResponseInterceptor`; conservar `useGlobalPipes`
(`AppModule` no registra `APP_PIPE`; lo hace `main.ts`, que la e2e no ejecuta). Se declara como
desviación documentada del §5.5 en `progress/impl_arranque_real_port_y_guard_passport12.md`.

### 5.6. Mapa `acceptance` ↔ `tdd_contract` (se copia tal cual a `feature_list.json`)

```json
"tdd_contract": [
  { "criterio": 1, "nivel": "A",
    "test": "validateEnv acepta PORT como cadena numerica del entorno (\"3000\") y lo entrega como number",
    "archivo": "src/config/env.validation.spec.ts",
    "nota": "Representa T1-T7: conversion, valor por omision, rechazo de no numericos y fuera de rango, y mensaje sin el valor recibido (D6)." },
  { "criterio": 1, "nivel": "A",
    "test": "EnvironmentVariables declara PORT con anotacion de tipo: su design:type es Number, no Object",
    "archivo": "src/config/env.validation.spec.ts",
    "nota": "Red de seguridad contra el autofix de no-inferrable-types, que borraria la anotacion y reintroduciria el defecto." },
  { "criterio": 2, "nivel": "A",
    "test": "UsersModule compila sin overrideGuard y JwtAuthGuard resuelve sus dependencias bajo @nestjs/passport 12",
    "archivo": "src/users/users.module.spec.ts" },
  { "criterio": 2, "nivel": "A",
    "test": "JwtAuthGuard no declara ninguna dependencia de constructor obligatoria: el injector de NestJS no le exige AuthModuleOptions",
    "archivo": "src/auth/guards/jwt-auth.guard.spec.ts" },
  { "criterio": 2, "nivel": "A",
    "test": "getMe devuelve el DTO del usuario autenticado sin campo password",
    "archivo": "src/users/users.controller.spec.ts",
    "nota": "Ancla: el it() ya existe (features #1 y #2 lo citan, NO se renombra). Entra al contrato porque en RED se retira el .overrideGuard que ocultaba el defecto y su rojo debe quedar tolerado." },
  { "criterio": 3, "nivel": "B", "test": null, "archivo": null,
    "nota": "docker compose --profile app up -d --build --wait + GET /api/ con el envoltorio estandar. Lo automatiza el job docker-smoke de .github/workflows/gate.yml (hoy en rojo por B1). Un script del Nivel A no puede arrancar el contenedor." },
  { "criterio": 4, "nivel": "B",
    "test": "un token emitido antes del ultimo login queda invalidado: el token viejo responde 401 y el nuevo 200",
    "archivo": "test/app.e2e-spec.ts",
    "nota": "npm run test:e2e:docker en verde (B2) mas B3 (este it()) y B5 (POST /api/users con campo no declarado -> 400) en la misma suite; B4, B6 y B7 manuales, todos declarados en progress/impl_arranque_real_port_y_guard_passport12.md. El CHECK 3c no verifica el texto de los criterios Nivel B." }
]
```

### 5.7. Evidencia RED que debe pegarse (CHECK 3d)

Debe mencionar **los cuatro** archivos Nivel A: `src/config/env.validation.spec.ts`,
`src/users/users.module.spec.ts`, `src/auth/guards/jwt-auth.guard.spec.ts` y
`src/users/users.controller.spec.ts`, con un fallo real de Jest en cada uno (no hay ningún caso de
`caracterizacion`, así que no aplica describir mutaciones). Fallos esperados: 5 (T1, T2, T8, T9, T10 —
T10 son en realidad los dos `it()` del controller).

---

## 6. Acoplamientos y riesgos

De los doce de `.claude/agents/planner.md`, aplican estos. Cada uno con la consecuencia concreta de
ignorarlo.

| # | Acoplamiento | Cómo aplica aquí |
|---|---|---|
| **1** | **Invalidación de JWT** ⚠️ el más caro | No se toca `JwtStrategy`, ni el payload, ni el orden del login, ni `expiresIn: '8h'`. Esta feature **la prueba de verdad por primera vez** (E1/B3). Ignorarlo: cualquier retoque "de paso" al guard o al login invalida todos los tokens vivos, o —peor, porque es silencioso— deja de invalidar los viejos. El detalle de los segundos (§5.5) es parte de este acoplamiento: sin la espera, E1 daría un falso rojo y la tentación sería "arreglar" `AuthService`. |
| **2** | `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`) | E2/B5 lo verifica end-to-end. No se agrega ni quita ningún campo de ningún DTO. |
| **3** | `ResponseInterceptor` global | El criterio 3 exige que `GET /api/` responda con el envoltorio estándar; se verifica, no se modifica. Nadie debe envolver nada en un controller. |
| **4** | `HttpExceptionFilter` global | Es quien produce el 401 de E1 y el 400 de E2 con su forma estándar. No se toca (la #4 acaba de cerrarse sobre él). |
| **5** | Prefijo `/api` y Swagger `'access-token'` | B4 revisa que *Authorize* siga aplicando a los endpoints protegidos. Sin cambios de decoradores. |
| **6** | `synchronize` sin migraciones | **No hay cambio de esquema**, así que no hay ruta a producción que declarar. El Nivel B corre **solo** contra la base desechable de `compose.yaml` (tmpfs, muere con `down -v`): nunca DEV/QA. B7 lo confirma comparando las columnas de `users`. |
| **8** | bcrypt salt rounds = 10 | La semilla de la e2e usa el `PasswordService` real; si alguien la reemplaza por un hash pegado a mano, el login del Nivel B falla por una razón que no es la que se está probando. |
| **9** | Winston con rotación a archivo | B6: al provocar el 401 de E1 y un 500, revisar `logs/*.log`. Un dato de cliente ahí **queda en disco**. Ninguna de las dos correcciones agrega logging. |
| **10** | CORS `origin: '*'` | Sin cambio; se asume tal cual (preexistente, heredado del origen Express). |
| **12** | Metadatos de decoradores vs. `import type` | **Central en esta feature, en las dos correcciones.** En `env.validation.ts` el metadato lo produce la **anotación de tipo**; en `jwt-auth.guard.ts`, el **constructor**. Si se activa el plan B (§4.2), `AuthModuleOptions` debe importarse como **valor**: con `import type` desaparece del JavaScript emitido y la DI vuelve a romperse, esta vez con el metadato en `undefined`. |

### 6.9. Acoplamiento **13** — nuevo, a agregar a `.claude/agents/planner.md`

> **13. Guards de clase y metadatos heredados de un mixin.** Un guard declarado con `@UseGuards(X)`
> **sobre el controller** se instancia por DI en el **módulo donde vive el controller**, no donde vive
> el guard (`InstanceLoader.createInstancesOfInjectables`), y eso ocurre dentro de `compile()` /
> `NestFactory.create()`. Además, una subclase de un mixin (`class JwtAuthGuard extends AuthGuard('jwt')`)
> **hereda** el `design:paramtypes` del padre (el injector lo lee con `Reflect.getMetadata`, que camina
> la cadena de prototipos) pero **no hereda** el `optional:paramtypes` (lo lee con
> `Reflect.getOwnMetadata`): una dependencia **opcional** del mixin se vuelve **obligatoria** en la
> subclase. Modo de falla: la app no arranca, y un `.overrideGuard(...)` en el spec unitario **lo
> esconde del Nivel A** (feature #3 → #5, 2026-09-04). Regla: toda subclase de un mixin que se
> inyecte declara su **propio** constructor.

Y, en el acoplamiento **8** o como nota del **12**, la trampa del linter:

> Toda propiedad de `EnvironmentVariables` (y de cualquier clase que `class-transformer` convierta)
> necesita **anotación de tipo explícita**: sin ella TypeScript emite `design:type Object` y
> `enableImplicitConversion` no convierte la cadena que entrega el entorno. ⚠️ Si la propiedad no es
> `readonly`, `@typescript-eslint/no-inferrable-types` **borra esa anotación con `--fix`** (y el hook
> `PostToolUse` corre `eslint --fix` en cada edición): el propio tooling reintroduce el defecto.

### 6.10. Riesgos operativos del ciclo

1. **CI queda roja durante RED, a propósito.** Los jobs `nivel-b-e2e` y `docker-smoke` de
   `.github/workflows/gate.yml` **ya están rojos hoy** (son B2 y B1). La tolerancia de la fase RED es
   del Nivel A únicamente. Que se pongan verdes al terminar GREEN es una de las mejores señales de que
   la feature quedó bien; el `leader` no debe leer ese rojo como bloqueo durante RED.
2. **Un `.env` local con `PORT=3000` también rompe `npm run test:e2e`** (ConfigModule lee `.env`).
   `npm run test:e2e:docker` no define `PORT`, así que hoy la e2e falla por B2 y no por B1; con un
   `.env` presente fallaría por las dos. Vale la pena correr el Nivel B **con** `.env` presente al
   menos una vez, después de G1.
3. **La cobertura va a saltar.** `src/config/env.validation.ts` hoy cuenta como 0 % (Jest lo incluye
   por `collectCoverageFrom` aunque ningún test lo toque) y pasará a ~100 %. Muy probablemente
   dispare el trinquete (holgura ≥ 5 puntos): hay que subir `rules.cobertura_minima` **y**
   `docs/verifications.md` §4 en la misma pasada, o el siguiente `leader` se detiene con el repo
   correcto.
4. **Hallazgo fuera de alcance, para el backlog:** en una base vacía **no hay forma de crear el primer
   usuario por la API** — `POST /api/users` está detrás de `JwtAuthGuard` y sin usuario no hay token.
   No es defecto de esta feature (la e2e siembra por repositorio), pero es un hueco real de operación:
   candidato a feature propia (seed/bootstrap o un comando de CLI). Anotarlo en `progress/history.md`
   al cerrar, sin resolverlo aquí.

---

## 7. Alternativas descartadas

Se evaluaron las cinco opciones del encargo **con la causa raíz de §3 en la mano**. Las cuatro
descartadas comparten un defecto: intentan **satisfacer** una dependencia que el guard no necesita, en
lugar de dejar de declararla.

### 7.1. (a) `UsersModule` importa `PassportModule.register({ defaultStrategy: 'jwt' })` — descartada
Funciona y es lo que la propia librería sugiere (`NO_STRATEGY_ERROR` en `auth.guard.js:19`), pero
**duplica la configuración de Passport fuera de `src/auth/`**, que es justo lo que el criterio 2 de
`acceptance` prohíbe. Además `PassportModule.register` es un módulo dinámico: dos llamadas crean dos
providers `AuthModuleOptions` distintos, y el día que alguien cambie `property` o `session` en uno
solo, la mitad de la app se comporta distinto sin que nada falle.

### 7.2. (b) Un `src/auth/passport-config.module.ts` (o `PASSPORT_OPTIONS`) importado por ambos — descartada
Es la mejor de las variantes "proveer el token": sin ciclo (`UsersModule → PassportConfigModule`,
`AuthModule → PassportConfigModule + UsersModule`) y con la configuración en un solo lugar dentro de
`src/auth/`. Se descarta porque **el modo de falla vuelve con cada módulo nuevo**: quien agregue un
segundo controller con `@UseGuards(JwtAuthGuard)` y no importe ese módulo rompe el arranque otra vez, y
el síntoma vuelve a apuntar al módulo equivocado. Cuesta un archivo y un import por módulo para
resolver algo que el guard no necesita: la estrategia ya es explícita (`'jwt'`) y `defaultStrategy`
**se descarta** antes de llegar a `passport.authenticate` (§4.2). Queda documentada como **plan C** si
en el futuro se necesitara configurar `property` o `session` de forma central.

### 7.3. (d) `@Global()` sobre el módulo que provee `AuthModuleOptions` — descartada
Resuelve el símbolo en todas partes y esconde la dependencia real: un módulo que "funciona" solo
porque algo global existe deja de funcionar en cualquier `TestingModule` acotado — que es exactamente
el hueco que estamos cerrando. Un token global de autenticación disponible en todos los módulos es lo
contrario de explícito en el punto más sensible del repo.

### 7.4. (e) Quitar el guard de clase y ponerlo por método — descartada
Cambia **qué rutas quedan protegidas** (D3). Hoy `@UseGuards` de clase cubre `GET /users/me`,
`POST /users` y `GET /users`; pasarlo a método significa que la próxima ruta nace **desprotegida por
omisión**, y el `it()` de la feature #2 (`UsersController declara JwtAuthGuard como guard de clase…`)
dejaría de tener sentido. Se descarta por diseño, no por costo.

### 7.5. Para `PORT`: `@Type(() => Number)` de `class-transformer` — descartada
Es igual de válida y no depende de `emitDecoratorMetadata`. Se descarta por **precedente de la casa**:
`DB_PORT!: number` ya resuelve exactamente este problema con anotación + `enableImplicitConversion`, y
tener dos mecanismos de conversión en la misma clase de ocho propiedades obliga a explicar cuál
aplica a cada una. Además, la anotación se puede **verificar** (T2) y el `@Type` no arregla el
problema de fondo (una propiedad sin anotación seguiría emitiendo `Object` para el siguiente que la
agregue). Se anota como plan B si apareciera algún caso donde la anotación no baste.

---

## 8. Verificación (Definición de Hecho)

### 8.1. Nivel A

- `npm run harness:verify` en **`[OK]`** (exit 0). Una corrida con `--estructura` **no cuenta**.
- **Advertencias de deuda == baseline vigente.** ⚠️ Léelo de `docs/verifications.md` **§4** al momento
  de correr, **no de aquí**. Al escribir este diseño (2026-09-04) es **0**; esta feature no debería
  moverlo.
- **Piso de cobertura:** `rules.cobertura_minima` (reflejado en `docs/verifications.md` §4).
  **Léelo de la fuente.** Al escribir este diseño: 76/76/72/64 con 80.08/80.45/76.19/67.97 medidos.
  Con `env.validation.ts` cubierto, la holgura probablemente pase de 5 puntos → **trinquete: subir el
  piso en la misma pasada** (G6).
- CHECK 5 (build), 5b (typecheck de `tsconfig.json` **y** `test/tsconfig.json`), 5c
  (`eslint --max-warnings=0`) y 6 en verde **fuera** de la batería, con la tolerancia de la fase RED
  **solo** dentro de los cuatro archivos Nivel A del contrato.
- CHECK 3c: los 4 criterios con entrada en `tdd_contract` y los textos de T1, T2, T8, T9 y T10
  existentes en disco.
- CHECK 3d: *Evidencia RED* que mencione los cuatro archivos Nivel A (§5.7).
- CHECK 4: sin `.only`, sin `console.log` en producción.

### 8.2. Nivel B — hereda B1–B7 de la feature #3 (`design_migracion_nestjs_12_esm.md` §8.2)

Base **desechable** de `compose.yaml` (PostgreSQL 17 en tmpfs), **nunca DEV/QA** (acoplamiento 6), con
el Node de `.nvmrc`. **Los siete deben quedar ejecutados y declarados** en
`progress/impl_arranque_real_port_y_guard_passport12.md` (criterio 4 de `acceptance`).

| # | Caso | Comando / acción | Criterio |
|---|---|---|---|
| **B1** | La API arranca en el contenedor y `GET /api/` responde 200 con el envoltorio estándar | `docker compose --profile app up -d --build --wait` + `curl -fsS http://localhost:3000/api/` → `{"msg":"Server is up and running"}`, `"isError":false`. **Debe verse `PORT: 3000` en el entorno del contenedor** (es el caso que falla hoy) | 3 |
| **B2** | Suite e2e completa en verde | `npm run test:e2e:docker` | 4 |
| **B3** | Ciclo real de invalidación de JWT | **automatizado** por E1 en `test/app.e2e-spec.ts` (§5.5). Manual opcional: login → A; esperar > 1 s; login → B; `GET /api/users/me` con A → **401**, con B → **200** | 4 |
| **B4** | Swagger publicado y *Authorize* aplica | navegar `/api/docs`; el candado del esquema `access-token` debe aplicar a los endpoints de `users` | 4 |
| **B5** | `ValidationPipe` intacto | **automatizado** por E2 (`POST /api/users` con un campo no declarado → **400**) | 4 |
| **B6** | El logger escribe en disco y **no** filtra datos sensibles | provocar el 401 de B3 y un 500; revisar `logs/application-*.log` y `logs/error-*.log`: `MÉTODO ruta -> status: mensaje` y **ninguna** contraseña, token, `JWT_SECRET`, cadena de conexión ni dato de cliente; **sin líneas duplicadas** | 4 |
| **B7** | Esquema sin cambios | `docker compose exec db psql -U postgres -d application_api -c "\d users"` antes/después del arranque; mismas columnas | 4 |

**Si alguien quiere hacer B3/B5 a mano** (fuera de la e2e, contra el contenedor `app`), hay que sembrar
un usuario: `POST /api/users` está detrás del guard y en una base vacía no hay token con qué llamarlo
(§6.10.4). Receta desechable, con el bcrypt **de la propia imagen** para no depender del build local:

```powershell
docker compose --profile app exec app node -e "require('bcrypt').hash('secret123',10).then(h=>console.log(h))"
docker compose exec db psql -U postgres -d application_api -c "INSERT INTO users (username, name, email, password, role, \"isActive\") VALUES ('nivelb','Nivel B','nivelb@example.com','<hash>','admin',true);"
```

Columnas verificadas en `src/users/entities/user.entity.ts` (tabla `users`, camelCase entre comillas
porque `synchronize` usa la estrategia de nombres por omisión; `id`, `createdAt`, `updatedAt` y
`lastTokenIssuedAt` tienen valor por omisión). `secret123` es un valor de prueba de un contenedor que
nace vacío y muere con `down -v`: no es un secreto y no se reutiliza en ningún entorno con datos.
**La vía recomendada sigue siendo la e2e** (E1/E2): siembra sola, es determinista y queda como
regresión permanente, no como un paso manual que nadie repite.

Al terminar: `docker compose --profile app down -v`.

### 8.3. Documentación a actualizar (parte del cierre, no opcional)

| Documento | Qué cambia |
|---|---|
| `.claude/agents/planner.md` | Acoplamiento **13** nuevo (§6.9) y la nota del autofix de `no-inferrable-types` |
| `docs/verifications.md` **§1** | Cerrar el párrafo *"Por qué el Nivel B sigue siendo declarado…"*: los dos defectos quedan corregidos por la #5, y B3/B5 pasan de "manuales" a **automatizados en la e2e** (actualizar también la frase de "En CI…", que hoy los lista como pendientes) |
| `docs/verifications.md` **§4** | Piso de cobertura e histórico, si el trinquete se dispara |
| `docs/verifications.md` **§5** (nueva §5.4) | Prueba negativa: *"el Nivel A no veía lo que el Nivel B sí"*. Escribir la mutación con la que se comprobó que la red nueva muerde: **revertir `jwt-auth.guard.ts`** (quitar el constructor) → `users.module.spec.ts`, `jwt-auth.guard.spec.ts` y `users.controller.spec.ts` en rojo con el error de DI; **quitar la anotación de `PORT`** → T1/T2 en rojo. La fase RED produce esa evidencia sola |
| `progress/impl_migracion_nestjs_12_esm.md` §11.7 | Corregir la causa mal diagnosticada (§3.5), con una nota fechada que apunte a este diseño. No se reescribe la historia: se anota |
| `progress/history.md` | Entrada de cierre + el hallazgo del bootstrap (§6.10.4) |
| `README.md` | Solo si se documenta el arranque con `PORT`; revisar la sección *Docker (Nivel B y despliegue)* |
| `.env.example` | **Sin cambios** (`PORT=3000` ya era correcto) |
| `CLAUDE.md` | **Sin cambios** esperados: no se mueve stack, ni versiones, ni piso de Node |

---

## 9. Preguntas abiertas / decisiones a confirmar

Solo decisiones de negocio o de plataforma. Cada una con **valor por omisión**: el `leader` procede con
él si no hay respuesta.

| # | Pregunta | Valor por omisión recomendado |
|---|---|---|
| **Q1** | ¿Se acepta corregir B2 **en el guard** (§4.2) en lugar de importar `PassportModule` en `UsersModule`? Implica que `JwtAuthGuard` deja de recibir `AuthModuleOptions` por constructor. | **Sí.** Es la única opción que no reintroduce el modo de falla con cada módulo nuevo y la única que deja la configuración de Passport en un solo lugar (`AuthModule`), como pide el criterio 2. Comportamiento equivalente verificado en §4.2. |
| **Q2** | ¿Se retira el `.overrideGuard` de `users.controller.spec.ts`? | **Sí.** Es la máscara que ocultó el defecto del Nivel A. Ningún `it()` se renombra. |
| **Q3** | ¿`main.ts` debe usar el `PORT` **validado** (`app.get(ConfigService).get('PORT')`) en vez de `process.env.PORT ?? 3000`? | **No en esta feature.** Hoy funciona (Express acepta la cadena) y `main.ts` está fuera de la cobertura: cambiarlo agrega riesgo sin test que lo respalde. Candidato claro para la feature **#6** (`refactor_buenas_practicas`), donde queda anotado: hoy se valida un `PORT` que nadie consume. |
| **Q4** | ¿Se extiende `readonly` a las ocho propiedades de `EnvironmentVariables`? | **No en esta feature** (mínimo diff, y no hay test que cubra las otras siete). A la **#6**. |
| **Q5** | ¿Se ejecuta el Nivel B **en esta feature**? | **Sí, obligatorio.** Es una feature que *nace* del Nivel B: cerrarla con el Nivel B declarado-pero-no-ejecutado sería repetir exactamente el error que la originó. Requiere Docker Desktop encendido. Si no se puede, la feature queda en `blocked`, **no** en `green`. |
| **Q6** | ¿Se agregan B3 y B5 como casos permanentes de `test/app.e2e-spec.ts` (crecen ~1.2 s por la espera de E1)? | **Sí.** Convierte dos casos manuales que nadie repite en regresión automática de CI, y la suite ya siembra su propio usuario. El segundo de espera es el precio de probar la regla de negocio más cara del repo. |

---

## 10. Regla de oro

Este diseño **no arranca la implementación**. No se modificó `feature_list.json` (la #5 sigue en
`pending`, con `tdd_contract` vacío) ni una sola línea de `src/`, `test/` o `docs/`.

**Esperando "go" del usuario para pasar a la fase RED del `implementer`.**

Al recibirlo, el orden es: **(1)** copiar §5.6 a `tdd_contract` (con `red_modo: "nuevo"`, ya
declarado); **(2)** fase RED — tres specs nuevos, retiro del `.overrideGuard` y los dos `it()` de la
e2e, con la evidencia en rojo de §5.7; **(3)** puerta humana sobre la batería; **(4)** fase GREEN en el
orden de §4.6, con el Nivel B de §8.2 **ejecutado**, no declarado en abstracto.
