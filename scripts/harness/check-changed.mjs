#!/usr/bin/env node
/**
 * Hook de PostToolUse: verificacion ligera del archivo recien editado.
 *
 * Tres comportamientos segun lo que se toco:
 *
 *   1. `.ts` bajo src/ o test/, o `.mjs` bajo scripts/ -> ESLint --fix sobre ese
 *      archivo. NO bloqueante: sale con codigo 0 aunque haya observaciones, para
 *      no frenar la edicion. La verificacion dura (--max-warnings=0) es el
 *      CHECK 5c del gate.
 *
 *   2. `.claude/agents/*.md`    -> corre el gate ESTRUCTURAL (verify.mjs
 *      --estructura). SI bloqueante (exit 2): el mensaje regresa al modelo.
 *      Motivo: el frontmatter de un agente decide si el ciclo puede verificarse
 *      a si mismo. Un rol al que se le quita el shell, o al que se le agrega Edit,
 *      rompe el harness sin romper ningun test -- falla en silencio.
 *
 *   3. `feature_list.json`      -> tambien el gate estructural, SI bloqueante.
 *      Es el estado del harness: un JSON roto, dos features activas o una
 *      feature sin tdd:true deben detener al agente en el momento, no al cierre.
 *
 * Claude Code entrega el contexto del hook como JSON por stdin; de ahi se extrae
 * `tool_input.file_path`.
 *
 * Uso (configurado en .claude/settings.json): node scripts/harness/check-changed.mjs
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readStdinAsync() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Quita un posible BOM inicial (Windows/PowerShell) antes de parsear.
let raw = await readStdinAsync();
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
raw = raw.trim();
if (!raw) process.exit(0);

let filePath;
try {
  const payload = JSON.parse(raw);
  filePath = payload?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath) process.exit(0);

// Normaliza separadores (Windows usa "\"). Acepta rutas absolutas y relativas.
const normalized = filePath.replace(/\\/g, '/');

const gateEstructural = (contexto) => {
  try {
    execSync('node scripts/harness/verify.mjs --estructura', { cwd: ROOT, stdio: 'pipe' });
    console.log(`[harness] gate estructural en verde tras editar ${contexto}.`);
    process.exit(0);
  } catch (e) {
    const salida = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`;
    process.stderr.write(
      `El gate estructural quedo en [FAIL] despues de editar ${contexto}. Corrigelo antes de seguir:\n\n${salida}\n`,
    );
    // exit 2: el mensaje regresa al modelo en vez de perderse en el transcript.
    process.exit(2);
  }
};

// --- Caso 2: definicion de un subagente -------------------------------------
if (/\.claude\/agents\/.+\.md$/.test(normalized)) {
  gateEstructural(
    'la definicion de un subagente (suele significar un rol sin el shell que su flujo necesita, sin ' +
      'Write para persistir su progress/, o con un tool que su rol prohibe)',
  );
}

// --- Caso 3: estado del harness ---------------------------------------------
if (/(^|\/)feature_list\.json$/.test(normalized)) {
  gateEstructural(
    'feature_list.json (estados, una sola feature activa, tdd:true, red_modo, contrato)',
  );
}

// --- Caso 1: codigo TypeScript o scripts del harness ------------------------
const esTs = normalized.endsWith('.ts') && /(^|\/)(src|test)\//.test(normalized);
const esMjs = normalized.endsWith('.mjs') && /(^|\/)scripts\//.test(normalized);
if (esTs || esMjs) {
  try {
    execSync(`npx eslint "${filePath}" --fix`, { cwd: ROOT, stdio: 'inherit' });
    console.log(`[harness] lint --fix aplicado a ${filePath}`);
  } catch {
    // No bloquea la edicion: solo avisa. La verificacion dura ocurre en el gate.
    console.log(`[harness] lint reporto observaciones en ${filePath} (no bloqueante).`);
  }
}

process.exit(0);
