#!/usr/bin/env node
/**
 * Hook ligero de PostToolUse: corre ESLint --fix SOLO sobre el archivo recién editado.
 *
 * Claude Code entrega el contexto del hook como JSON por stdin; de ahí extraemos
 * `tool_input.file_path`. Si es un .ts bajo src/ o test/, se hace lint de ese archivo.
 * Es no bloqueante: siempre sale con código 0 para no frenar el flujo de edición.
 *
 * Uso (configurado en .claude/settings.json): node scripts/harness/lint-changed.mjs
 */
import { execSync } from 'node:child_process';

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

// Normaliza separadores para la comprobación de ruta (Windows usa "\").
// Acepta tanto rutas absolutas (.../src/...) como relativas (src/...).
const normalized = filePath.replace(/\\/g, '/');
const isLintable =
  normalized.endsWith('.ts') && /(^|\/)(src|test)\//.test(normalized);

if (!isLintable) process.exit(0);

try {
  execSync(`npx eslint "${filePath}" --fix`, { stdio: 'inherit' });
  console.log(`[harness] lint --fix aplicado a ${filePath}`);
} catch {
  // No bloquea la edición: solo avisa. La verificación dura ocurre en el hook Stop.
  console.log(`[harness] lint reportó observaciones en ${filePath} (no bloqueante).`);
}

process.exit(0);
