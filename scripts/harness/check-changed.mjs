#!/usr/bin/env node
/**
 * Hook de PostToolUse: verificacion ligera del archivo recien editado.
 *
 * Dos comportamientos segun lo que se toco:
 *
 *   1. `.ts` bajo src/ o test/  -> ESLint --fix sobre ese archivo. NO bloqueante:
 *      sale con codigo 0 aunque haya observaciones, para no frenar la edicion.
 *
 *   2. `.claude/agents/*.md`    -> corre el gate ESTRUCTURAL (verify.mjs
 *      --estructura). SI bloqueante (exit 2): el mensaje regresa al modelo.
 *      Motivo: el frontmatter de un agente decide si el ciclo puede verificarse
 *      a si mismo. Un rol al que se le quita el shell, o al que se le agrega Edit,
 *      rompe el harness sin romper ningun test — falla en silencio. Este es el
 *      unico lugar del hook donde se bloquea a proposito.
 *
 * Claude Code entrega el contexto del hook como JSON por stdin; de ahi se extrae
 * `tool_input.file_path`.
 *
 * Uso (configurado en .claude/settings.json): node scripts/harness/check-changed.mjs
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

// --- Caso 2: definicion de un subagente -------------------------------------
if (/\.claude\/agents\/.+\.md$/.test(normalized)) {
  try {
    execSync('node scripts/harness/verify.mjs --estructura', { cwd: ROOT, stdio: 'pipe' });
    console.log('[harness] gate estructural en verde tras editar el agente.');
    process.exit(0);
  } catch (e) {
    const salida = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`;
    process.stderr.write(
      'El gate estructural quedo en [FAIL] despues de editar la definicion de un subagente. ' +
        'Esto suele significar que un rol quedo sin el shell que su flujo necesita, sin Write para ' +
        'persistir su propio archivo de progress/, o con un tool que su rol prohibe. Corrigelo antes ' +
        `de seguir:\n\n${salida}\n`,
    );
    // exit 2: el mensaje regresa al modelo en vez de perderse en el transcript.
    process.exit(2);
  }
}

// --- Caso 1: codigo TypeScript ----------------------------------------------
if (normalized.endsWith('.ts') && /(^|\/)(src|test)\//.test(normalized)) {
  try {
    execSync(`npx eslint "${filePath}" --fix`, { stdio: 'inherit' });
    console.log(`[harness] lint --fix aplicado a ${filePath}`);
  } catch {
    // No bloquea la edicion: solo avisa. La verificacion dura ocurre en el gate.
    console.log(`[harness] lint reporto observaciones en ${filePath} (no bloqueante).`);
  }
}

process.exit(0);
