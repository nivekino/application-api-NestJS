# application-api-NestJS

API de **Kata Software** para flujos de crédito y cobranza de banca de microcréditos en LATAM, migrada
desde Express hacia **NestJS 11 + TypeORM 1.x + PostgreSQL**. Los datos de clientes son sensibles: nada
de contraseñas, secretos ni cadenas de conexión en logs, respuestas ni documentación.

El repositorio se opera con un **harness de ingeniería** (estado en disco + verificación ejecutable +
roles con autoridad separada) en ciclo **TDD estricto**. Antes de tocar código lee
[CLAUDE.md](CLAUDE.md) (rol y convenciones) y [AGENTS.MD](AGENTS.MD) (qué leer y cuándo).

## Requisitos

| Herramienta | Versión | Dónde se fija |
|---|---|---|
| Node.js | **24 LTS** (`.nvmrc`: 24.20.0). Piso `>=24.11.0` | `engines` en `package.json`, `.nvmrc`, `.npmrc` (`engine-strict`) |
| npm | `>=10` | `engines` |
| TypeScript | `~6.0.3` (techo del toolchain, ver `docs/verifications.md` §6) | `package.json` |
| PostgreSQL | cualquier versión soportada por `pg` 8.x | `.env` (ver `.env.example`) |

Node 26 entra a LTS el 2026-10-28; el piso del repo se mueve actualizando `.nvmrc`, `engines` y el
CHECK 2 del gate en la misma pasada.

## Puesta en marcha

```bash
npm ci                      # instala exactamente el lockfile (falla si Node no cumple engines)
cp .env.example .env        # completa DB_* y JWT_SECRET; NUNCA subas el .env
npm run start:dev           # API en http://localhost:3000/api, Swagger en /api/docs
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run harness:verify` | **Gate Nivel A completo:** estructura del harness + Node + `feature_list.json` + trazabilidad TDD + build + typecheck + lint + jest con cobertura. Es lo que corre CI. |
| `npm run harness:estructura` | Solo la parte estructural (rápido, sin `node_modules`). No cierra una feature. |
| `npm run build` | `nest build` (solo producción; excluye specs). |
| `npm run typecheck` | `tsc --noEmit` sobre `src/` y `test/`. |
| `npm run lint` / `npm run lint:check` | ESLint 10 (`strictTypeChecked` + `stylisticTypeChecked` + jest + prettier) con y sin `--fix`. |
| `npm run format` / `npm run format:check` | Prettier (`printWidth` 100, LF). |
| `npm test` / `npm run test:cov` | Pruebas unitarias con Jest 30 (ts-jest). |
| `npm run test:e2e` | **Nivel B:** e2e contra PostgreSQL real; se omite (skip) sin variables `DB_*`/`JWT_SECRET`. |

## Verificación: gate de dos niveles

- **Nivel A (automático):** `npm run harness:verify` termina en `[OK]`. El gate **entiende la fase
  RED** del ciclo TDD: con una feature en `red` tolera fallos solo dentro de la batería declarada.
- **Nivel B (declarado):** comportamiento contra PostgreSQL real, invalidación de JWT end-to-end,
  esquema y Swagger. No se sustituye con mocks: se declara en `progress/impl_<name>.md`.

Detalle de cada check, baseline de advertencias, piso de cobertura y pruebas negativas:
[docs/verifications.md](docs/verifications.md). Definición de "Hecho": [CHECKPOINTS.MD](CHECKPOINTS.MD).

## Estructura

```
src/                 API NestJS (auth/, users/, common/, config/)
test/                e2e (Nivel B) con su tsconfig
scripts/harness/     verify.mjs (gate) y check-changed.mjs (hook PostToolUse)
.claude/             agentes (leader, planner, implementer, reviewer), slash commands, hooks
docs/                migración Express→NestJS (histórico) y verifications.md (vigente)
progress/            estado de la sesión, bitácora y documentos de diseño/implementación/revisión
feature_list.json    backlog, reglas del harness, baseline y piso de cobertura
```

## Licencia

UNLICENSED — uso interno de Kata Software.
