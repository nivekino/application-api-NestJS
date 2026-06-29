#!/usr/bin/env node
/**
 * Verificador del harness (cross-platform: PowerShell, bash y CI).
 *
 * Reemplaza al `init.sh` de bash del proyecto de referencia. Ejecuta, en orden:
 *   1. Versión de Node (>= 20 LTS).
 *   2. Existencia de los archivos base del harness.
 *   3. Validación de feature_list.json (máx. una feature `in_progress`; estados válidos).
 *   4. Compilación (`npm run build` -> nest build).
 *   5. Pruebas unitarias (`npm test` -> jest).
 *
 * Sale con código 0 solo si todas las verificaciones críticas pasan.
 * Uso: `node scripts/harness/verify.mjs`  (o `npm run harness:verify`).
 *
 * Nota Kata: todo corre local, no envía datos a servicios externos.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};
const ok = (m) => console.log(`${C.green}[OK]${C.reset} ${m}`);
const fail = (m) => console.log(`${C.red}[FAIL]${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}[WARN]${C.reset} ${m}`);
const step = (m) => console.log(`\n${C.cyan}==> ${m}${C.reset}`);

let hasError = false;
const markError = () => {
  hasError = true;
};

// 1. Versión de Node ---------------------------------------------------------
// Node < 20 NO bloquea build ni pruebas unitarias (usan mocks), pero la app SÍ
// falla en runtime: TypeORM lanza "crypto is not defined" al inicializar. Por eso
// es una advertencia fuerte, no un error que tumbe la verificación.
step('Versión de Node');
const major = Number(process.versions.node.split('.')[0]);
if (major >= 20) {
  ok(`Node ${process.versions.node} (>= 20 LTS).`);
} else {
  warn(
    `Node ${process.versions.node}. Build y tests funcionan, pero la app NO arranca en ` +
      'runtime con Node < 20 (TypeORM: "crypto is not defined"). Actualiza a Node >= 20 LTS ' +
      'antes de levantar el servidor o correr e2e contra PostgreSQL.',
  );
}

// 2. Archivos base del harness ----------------------------------------------
step('Archivos base del harness');
const REQUIRED = [
  'CLAUDE.md',
  'AGENTS.MD',
  'CHECKPOINTS.MD',
  'feature_list.json',
  'docs/01-plan-migracion.md',
  '.claude/agents/leader.md',
  '.claude/agents/implementer.md',
  '.claude/agents/reviewer.md',
];
for (const rel of REQUIRED) {
  if (existsSync(join(ROOT, rel))) {
    ok(`Existe ${rel}`);
  } else {
    fail(`Falta ${rel}`);
    markError();
  }
}

// 3. Validación de feature_list.json ----------------------------------------
step('feature_list.json');
const VALID_STATUS = new Set(['pending', 'in_progress', 'done', 'blocked']);
try {
  const data = JSON.parse(readFileSync(join(ROOT, 'feature_list.json'), 'utf8'));
  const features = Array.isArray(data.features) ? data.features : [];
  const inProgress = features.filter((f) => f.status === 'in_progress');
  const invalid = features.filter((f) => !VALID_STATUS.has(f.status));

  if (invalid.length > 0) {
    fail(
      `Estados inválidos: ${invalid
        .map((f) => `#${f.id}:${f.status}`)
        .join(', ')}. Válidos: pending, in_progress, done, blocked.`,
    );
    markError();
  } else {
    ok(`${features.length} feature(s); todos con estado válido.`);
  }

  if (inProgress.length > 1) {
    fail(
      `Hay ${inProgress.length} features 'in_progress'. Solo se permite una a la vez: ` +
        inProgress.map((f) => `#${f.id} ${f.name}`).join(', '),
    );
    markError();
  } else if (inProgress.length === 1) {
    ok(`Feature en progreso: #${inProgress[0].id} ${inProgress[0].name}`);
  } else {
    warn('Sin feature in_progress. Selecciona la siguiente pending para trabajar.');
  }
} catch (e) {
  fail(`No se pudo leer/parsear feature_list.json: ${e.message}`);
  markError();
}

// 4. Build -------------------------------------------------------------------
step('Compilación (npm run build)');
try {
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  ok('Build correcto.');
} catch {
  fail('El build falló. Resuelve los errores de compilación antes de avanzar.');
  markError();
}

// 5. Tests -------------------------------------------------------------------
step('Pruebas unitarias (npm test)');
try {
  execSync('npm test', { cwd: ROOT, stdio: 'inherit' });
  ok('Pruebas en verde.');
} catch {
  fail('Hay pruebas en rojo. No marques features como done hasta que pasen.');
  markError();
}

// Resumen --------------------------------------------------------------------
console.log('');
if (hasError) {
  fail('Entorno NO está listo. Resuelve los errores antes de avanzar.');
  process.exit(1);
}
ok('Entorno listo. Puedes continuar.');
process.exit(0);
