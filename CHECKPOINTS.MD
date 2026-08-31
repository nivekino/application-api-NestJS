# CHECKPOINTS.MD — Definición de "Hecho"

> Criterios que **toda** feature debe cumplir antes de marcarse `done` en `feature_list.json`. El
> detalle de cada chequeo vive en [docs/verifications.md](docs/verifications.md); este archivo es la
> lista de puertas que el `reviewer` valida. Una feature que no cumple todos los puntos aplicables
> **no se aprueba**.

## Gate de dos niveles (ambos obligatorios)

### Nivel A — automático (`npm run harness:verify` → `[OK]`)

- [ ] El gate termina en `[OK]` (exit 0). **Nunca se cierra una feature con `[FAIL]`.**
- [ ] Una corrida con `--estructura` **no cuenta**: build y pruebas no se ejecutaron.
- [ ] `nest build` compila sin errores y `jest` pasa al 100%.
- [ ] `eslint` sin errores en los archivos tocados.
- [ ] **Toolset de los agentes (CHECK 1b):** ningún agente declara `Bash` (aquí el shell se llama
      `PowerShell`; `Bash` deja al agente **sin shell** y sin poder correr este gate), cada rol declara
      los tools que su flujo exige, y ninguno declara los que su rol prohíbe.
- [ ] **Una sola feature activa** (`red` / `green` / `in_review`).
- [ ] **Bandera `needs_design` (CHECK 3b):** la feature está clasificada, y si es `true` su motivo
      **cita el disparador** de [`planner.md` §Disparadores](.claude/agents/planner.md) (única fuente de
      verdad) y existe su `progress/design_<name>.md`.
- [ ] **Conteo de advertencias de deuda** igual al baseline vigente de
      [docs/verifications.md](docs/verifications.md) sección 4. **Léelo del documento, no de memoria.**
      Advertencias nuevas = **RECHAZADO**, salvo justificación explícita y aceptada.

### Nivel B — manual, contra PostgreSQL real (**declarado**)

- [ ] El caso se ejecutó (o quedó asignado a una persona) con `npm run test:e2e` contra una base real.
- [ ] La declaración —qué caso, qué comando, contra qué base, resultado— quedó escrita en
      `progress/impl_<name>.md`.
- [ ] ⚠️ Requiere **Node 22 LTS como mínimo** (24 LTS recomendado): por debajo la app no arranca
      (`crypto is not defined`) y el Nivel B es inejecutable.

**El Nivel B no se sustituye con mocks.** Si un criterio depende de PostgreSQL, del esquema o del ciclo
completo del JWT, va en Nivel B — no simulado con un mock que devuelve lo que conviene.

## Disciplina TDD (lo que distingue esta puerta de una revisión de código normal)

- [ ] **Evidencia RED presente y creíble:** `progress/impl_<name>.md` tiene su sección *Evidencia RED*
      con la salida **literal** de Jest fallando **antes** de escribir el código. Una salida que no
      menciona los tests de la feature, o que ya venía en verde, **no es evidencia**.
- [ ] **La puerta humana se respetó:** el usuario aprobó la batería de tests en rojo antes de que se
      implementara una sola línea.
- [ ] **Trazabilidad completa:** cada criterio de `acceptance` tiene su entrada en `tdd_contract`, y el
      `it()` declarado **existe con ese texto exacto** en el archivo declarado.
- [ ] **Los tests prueban resultado**, no ausencia de excepción. Un `it()` con el nombre correcto sobre
      un `expect` vacío pasa el CHECK 3c y no prueba nada: eso lo atrapa el `reviewer`, no el script.
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
- [ ] Entidades TypeORM con `@Unique`/enums/timestamps según corresponda.
- [ ] **Si se tocó el esquema:** el documento dice **cómo llega el cambio a producción**. `synchronize`
      está apagado en producción y **no hay carpeta de migraciones**. Sin esa respuesta → **RECHAZADO**.

## Reglas de negocio (no romper)

- [ ] **Invalidación de JWT** intacta: `JwtStrategy` rechaza `payload.iat < user.lastTokenIssuedAt`; el
      login actualiza `lastTokenIssuedAt`; payload `{ sub, username, role, iat }`; exp **8h**; la
      coerción del bigint-string de PostgreSQL sigue en su lugar.
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

- [ ] Sin código de depuración (`console.log`) ni TODOs sin contexto.
- [ ] `progress/current.md` actualizado **durante** el trabajo, no al final.
- [ ] Al cerrar: resumen movido a `progress/history.md`, `current.md` reseteado a su plantilla, y el
      gate corrido una vez más en `[OK]`.
- [ ] Si el cambio resolvió una advertencia del baseline, **se actualizó en la misma pasada** en
      [docs/verifications.md](docs/verifications.md) sección 4 **y** en `feature_list.json`.
- [ ] Cada criterio de `acceptance` tiene cobertura demostrable (test de Nivel A verificado o Nivel B
      declarado).
- [ ] Veredicto del `reviewer` = **APROBADO**.
