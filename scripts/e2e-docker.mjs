#!/usr/bin/env node
/**
 * Nivel B local en un paso: levanta el PostgreSQL DESECHABLE de compose.yaml, corre la suite
 * e2e (test/app.e2e-spec.ts) contra el y lo apaga borrando sus datos.
 *
 *   npm run test:e2e:docker           # up db -> e2e -> down -v
 *   npm run test:e2e:docker -- --keep # deja la base arriba para B1/B3-B7 manuales
 *
 * Por que un script de Node y no una linea en package.json: las variables de entorno
 * inline se escriben distinto en PowerShell, cmd y bash, y este repo se opera en los
 * tres (local Windows, git-bash, CI Ubuntu). Aqui se fijan en process.env una sola vez y
 * se heredan tanto a `docker compose` (que las usa para la sustitucion de compose.yaml,
 * por encima de un .env) como a Jest (ConfigModule da prioridad a process.env sobre .env).
 * Asi la base que se levanta y la que la suite ataca reciben SIEMPRE las mismas credenciales.
 *
 * Seguridad de datos: los valores por omision son de un contenedor local que nace vacio y
 * muere al terminar. No son secretos y no se registran en ningun log.
 */
import { spawnSync } from 'node:child_process';

const KEEP = process.argv.includes('--keep');

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DB_HOST: process.env.DB_HOST ?? '127.0.0.1',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_USER: process.env.DB_USER ?? 'postgres',
  DB_PASS: process.env.DB_PASS ?? 'solo-local',
  DB_NAME: process.env.DB_NAME ?? 'application_api',
  JWT_SECRET: process.env.JWT_SECRET ?? 'solo-local-cambiame',
};

// Sin `shell: true`: docker.exe y node.exe se resuelven por PATH en los tres shells, y con
// shell la ruta de process.execPath ("C:\Program Files\...") se partiria en el espacio.
function correr(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (r.error) {
    console.error(`[FAIL] No se pudo ejecutar ${cmd}: ${r.error.message}`);
    return 1;
  }
  return r.status ?? 1;
}

console.log('==> docker compose up -d --wait db');
const up = correr('docker', ['compose', 'up', '-d', '--wait', 'db']);
if (up !== 0) {
  console.error('[FAIL] No se pudo levantar PostgreSQL. Esta Docker Desktop encendido?');
  process.exit(up);
}

// Misma invocacion que el script `test:e2e` de package.json (la bandera es la que permite a
// jest-runtime hacer require() de los @nestjs/* ESM; ver docs/verifications.md seccion 6).
console.log('==> jest e2e contra PostgreSQL en ' + env.DB_HOST + ':' + env.DB_PORT);
const jest = correr(process.execPath, [
  '--experimental-vm-modules',
  'node_modules/jest/bin/jest.js',
  '--config',
  './test/jest-e2e.json',
]);

if (KEEP) {
  console.log('==> --keep: la base sigue arriba. Apagala con `docker compose down -v`.');
} else {
  console.log('==> docker compose down -v');
  correr('docker', ['compose', 'down', '-v']);
}

process.exit(jest);
