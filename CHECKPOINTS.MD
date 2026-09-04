# CHECKPOINTS.MD — Definición de "Hecho"

> Criterios que **toda** feature debe cumplir antes de marcarse `done` en `feature_list.json`. El
> detalle de cada chequeo vive en [docs/verifications.md](docs/verifications.md); este archivo es la
> lista de puertas que el `reviewer` valida. Una feature que no cumple todos los puntos aplicables
> **no se aprueba**.

## Gate de dos niveles (ambos obligatorios)

### Nivel A — automático (`npm run harness:verify` → `[OK]`)

- [ ] El gate termina en `[OK]` (exit 0). **Nunca se cierra una feature con `[FAIL]`.**
- [ ] Una corrida con `--estructura` **no cuenta**: build, typecheck, lint, pruebas y cobertura no se
      ejecutaron.
- [ ] `nest build` compila sin errores (CHECK 5) y `tsc --noEmit` pasa sobre `src/` **y** `test/`
      (CHECK 5b): los specs y los e2e también se verifican de tipos, aunque el build los excluya.
- [ ] `eslint . --max-warnings=0` sin hallazgos (CHECK 5c): reglas `strictTypeChecked` +
      `stylisticTypeChecked`, `eslint-plugin-jest` y Prettier. Sin `eslint-disable` nuevos salvo con
      motivo escrito al lado; nunca para apagar `no-unsafe-*`, `no-explicit-any` o
      `jest/no-conditional-expect`.
- [ ] `jest` pasa al 100% (CHECK 6) y la cobertura está sobre el piso de `rules.cobertura_minima`
      (CHECK 6b). El piso es un **trinquete**: si el gate informa holgura, se sube en la misma pasada.
- [ ] **Toolset de los agentes (CHECK 1b):** ningún agente declara `Bash` (aquí el shell se llama
      `PowerShell`; `Bash` deja al agente **sin shell** y sin poder correr este gate), cada rol declara
      los tools que su flujo exige, y ninguno declara los que su rol prohíbe.
- [ ] **Node en la línea acordada (CHECK 2):** piso Node 24 LTS (`engines`, `.nvmrc`, `.npmrc` con
      `engine-strict`). Por debajo del piso el gate es `[FAIL]`, no advertencia.
- [ ] **Una sola feature activa** (`red` / `green` / `in_review`).
- [ ] **Bandera `needs_design` (CHECK 3b):** la feature está clasificada, y si es `true` su motivo
      **cita el disparador** de [`planner.md` §Disparadores](.claude/agents/planner.md) (única fuente de
      verdad) y existe su `progress/design_<name>.md`.
- [ ] **`tdd: true` (CHECK 3e):** toda feature nace así. La única excepción es la lista explícita
      `rules.tdd_exentas_legacy`, con motivo.
- [ ] **Conteo de advertencias de deuda** igual al baseline vigente de
      [docs/verifications.md](docs/verifications.md) sección 4. **Léelo del documento, no de memoria.**
      Advertencias nuevas = **RECHAZADO**, salvo justificación explícita y aceptada.

### Nivel B — manual, contra PostgreSQL real (**declarado**)

- [ ] El caso se ejecutó (o quedó asignado a una persona) con `npm run test:e2e` contra una base real.
- [ ] La declaración —qué caso, qué comando, contra qué base, resultado— quedó escrita en
      `progress/impl_<name>.md`.
- [ ] ⚠️ Requiere **Node 24 LTS** (la versión de `.nvmrc`): es el mismo piso que el CHECK 2 exige
      para el Nivel A.

**El Nivel B no se sustituye con mocks.** Si un criterio depende de PostgreSQL, del esquema o del ciclo
completo del JWT, va en Nivel B — no simulado con un mock que devuelve lo que conviene.

## Disciplina TDD (lo que distingue esta puerta de una revisión de código normal)

- [ ] **Evidencia RED presente y creíble (CHECK 3d):** `progress/impl_<name>.md` tiene su sección
      *Evidencia RED* con la salida **literal** de Jest fallando **antes** de escribir el código. Menciona
      **cada archivo** de la batería y contiene un fallo reconocible (`FAIL`, `N failed`,
      `error TSxxxx`). Una salida que no menciona los tests de la feature, o que ya venía en verde, **no
      es evidencia**.
- [ ] **`red_modo` correcto:** `nuevo` si la batería falló en disco; `caracterizacion` si el código ya
      existía y el rojo se demostró por **mutación** (la evidencia describe qué se rompió, qué test cayó
      y el verde tras restaurar; el código de producción quedó idéntico).
- [ ] **El gate entendió la fase RED:** con la feature en `red`, `npm run harness:verify` dio `[OK]`
      tolerando fallos **solo** en los archivos del `tdd_contract` (modo `nuevo`), o todo en verde con la
      mutación documentada (modo `caracterizacion`).
- [ ] **La puerta humana se respetó:** el usuario aprobó la batería de tests en rojo antes de que se
      implementara una sola línea.
- [ ] **Trazabilidad completa (CHECK 3c):** cada criterio de `acceptance` tiene su entrada en
      `tdd_contract`, y el `it()` declarado **existe con ese texto exacto** en el archivo declarado.
- [ ] **Los tests prueban resultado**, no ausencia de excepción. `jest/expect-expect` exige un `expect`
      por test; el `reviewer` exige que sea el `expect` **correcto**.
- [ ] **Mocks tipados** (`jest.Mocked<Pick<Servicio, 'metodo'>>`), sin `any` ni `as jest.Mock`.
- [ ] **Ningún criterio en `pendiente`** en una feature `tdd: true`.
- [ ] El refactor se hizo **con la batería en verde**, no antes.

## Convenciones de arquitectura

- [ ] La feature vive en `src/<feature>/` con su `*.module.ts`, `*.controller.ts`, `*.service.ts` y
      `dto/` (y `entities/`/`enums/` si aplica). Lo transversal en `src/common/`.
- [ ] DI nativa de NestJS (`@Injectable`, `@Module`, `@InjectRepository`). Sin InversifyJS.
- [ ] DTOs con `class-validator` + `class-transformer` + `@ApiProperty`. La validación la hace el
      `ValidationPipe` global — sin validación manual en el controller.
- [ ] Endpoints nuevos respetan el prefijo `/api` y están documentados en Swagger (`/api/docs`). Si son
      protegidos, declaran `@ApiBearerAuth('access-token')` **con ese nombre exacto**, o el botón
      *Authorize* no aplica a ellos.
- [ ] **El controller no arma su propio envoltorio de respuesta:** el `ResponseInterceptor` global ya lo
      hace, y hacerlo dos veces produce doble envoltura. Los errores salen por el `HttpExceptionFilter`.
- [ ] **La entidad no sale por la API:** se mapea a DTO y el `password` no aparece en ninguna respuesta.
- [ ] Entidades TypeORM con `@Unique`/enums/timestamps según corresponda. `select` como objeto por
      columna; ningún `update`/`delete` con criterio que pueda quedar vacío (TypeORM 1.x lanza).
- [ ] **Si se tocó el esquema:** el documento dice **cómo llega el cambio a producción**. `synchronize`
      está apagado en producción y **no hay carpeta de migraciones**. Sin esa respuesta → **RECHAZADO**.

## Reglas de negocio (no romper)

- [ ] **Invalidación de JWT** intacta: `JwtStrategy` rechaza `payload.iat < user.lastTokenIssuedAt`; el
      login actualiza `lastTokenIssuedAt`; payload `{ sub, username, role, iat }`; exp **8h**; la
      coerción del bigint-string de PostgreSQL sigue en su lugar (la entidad lo declara
      `number | string | null`).
- [ ] Contraseñas con bcrypt **salt rounds = 10** vía `PasswordService`.
- [ ] Sin datos sensibles (contraseñas, secretos, conexiones, datos de clientes) en logs, respuestas de
      API ni documentación. **Winston escribe a archivo rotado: lo logueado queda en disco.**

## Apego al diseño (sólo si hubo `progress/design_<name>.md`)

- [ ] La implementación siguió el desglose del [`planner`](.claude/agents/planner.md): mismos contratos,
      misma batería de tests, mismos acoplamientos atendidos.
- [ ] Las **desviaciones** están documentadas con su motivo en `progress/impl_<name>.md`. Ninguna
      desviación silenciosa en contratos (rutas, llaves de DTO, nombres de columna).
- [ ] Los **PENDIENTES** del diseño se resolvieron con confirmación real, o siguen marcados como tales.
- [ ] La implementación arrancó con el **"go" explícito del usuario**.

## Higiene y cierre

- [ ] Sin código de depuración (`console.log`), `.only`, tests deshabilitados ni TODOs sin contexto
      (CHECK 4).
- [ ] `progress/current.md` actualizado **durante** el trabajo, no al final.
- [ ] Al cerrar: resumen movido a `progress/history.md`, `current.md` reseteado a su plantilla, y el
      gate corrido una vez más en `[OK]`.
- [ ] Si el cambio resolvió una advertencia del baseline o dejó holgura de cobertura, **se actualizó en
      la misma pasada** en [docs/verifications.md](docs/verifications.md) sección 4 **y** en
      `feature_list.json`.
- [ ] Cada criterio de `acceptance` tiene cobertura demostrable (test de Nivel A verificado o Nivel B
      declarado).
- [ ] Veredicto del `reviewer` = **APROBADO**.
