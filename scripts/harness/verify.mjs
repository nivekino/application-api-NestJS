#!/usr/bin/env node
/**
 * Gate automatico (Nivel A) del harness de application-api-NestJS.
 *
 * Valida integridad ESTRUCTURAL del harness y TRAZABILIDAD criterio<->test, mas
 * build y pruebas unitarias. NO valida comportamiento contra PostgreSQL real,
 * migraciones, ni el contrato publicado en Swagger: eso es Nivel B (ver
 * docs/verifications.md).
 *
 * Uso:
 *   npm run harness:verify              # Nivel A completo (estructura + build + tests)
 *   npm run harness:estructura          # solo estructura (rapido, sin node_modules)
 *   node scripts/harness/verify.mjs --estructura
 *
 * Salida: [OK] (exit 0) o [FAIL] (exit 1).
 *
 * Nota Kata: todo corre local, no envia datos a servicios externos.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOLO_ESTRUCTURA = process.argv.includes('--estructura');

// ---------------------------------------------------------------------------
// Tool de shell de ESTE harness -- UNICA FUENTE DE VERDAD del CHECK 1b.
//
// Este repo se opera en Windows/PowerShell. El tool de shell se llama
// "PowerShell": declarar "Bash" en el frontmatter de un subagente NO le da un
// shell alterno, lo deja SIN shell, y falla en silencio. Consecuencia medida en
// el portafolio Formiik de Kata (2026-08-02): el leader no podia correr el gate
// -- paso 1 de su propio ciclo -- y el reviewer tampoco, que es su razon de
// existir. Si el equipo migra a Linux/macOS, se cambia AQUI y en ningun otro
// lado.
// ---------------------------------------------------------------------------
const SHELL_TOOL = 'PowerShell';
const SHELL_TOOL_PROHIBIDO = 'Bash';

const TOOLS_CONOCIDOS = [
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'PowerShell', 'Bash', 'Agent',
  'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'Skill',
];

// Agente -> tools que su flujo EXIGE. Si el flujo de un rol cambia, actualiza
// este mapa en la misma pasada.
const TOOLS_REQUERIDOS = {
  leader: [SHELL_TOOL, 'Agent'],
  planner: ['Read', 'Write'],
  implementer: ['Read', 'Edit', 'Write', SHELL_TOOL],
  reviewer: ['Read', 'Write', SHELL_TOOL],
};

// Agente -> tools que su flujo PROHIBE, y por que. No es higiene: es el limite
// de autoridad del rol, y sin el gate se erosiona sin que nadie lo note.
const TOOLS_PROHIBIDOS = {
  planner: { Edit: 'el planner disena, no implementa: con Edit puede tocar src/' },
  reviewer: { Edit: 'el reviewer no corrige lo que revisa; solo CREA su propio review_ con Write' },
  leader: { Edit: 'el leader orquesta y no edita src/ ni test/' },
};

const ARCHIVOS_BASE = [
  'CLAUDE.md',
  'AGENTS.MD',
  'CHECKPOINTS.MD',
  'feature_list.json',
  'docs/01-plan-migracion.md',
  'docs/verifications.md',
  '.claude/agents/leader.md',
  '.claude/agents/planner.md',
  '.claude/agents/implementer.md',
  '.claude/agents/reviewer.md',
  '.claude/commands/feature.md',
  '.claude/commands/design.md',
  '.claude/settings.json',
  'scripts/harness/check-changed.mjs',
  'progress/current.md',
];

const ESTADOS_VALIDOS = new Set(['pending', 'red', 'green', 'in_review', 'done', 'blocked']);
const ESTADOS_ACTIVOS = new Set(['red', 'green', 'in_review']);
// Estados en los que la feature ya debe tener codigo y, por tanto, contrato.
const ESTADOS_CON_CODIGO = new Set(['green', 'in_review', 'done']);

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const errores = [];
const advertencias = []; // { msg, deuda }
const infos = [];

const addErr = (m) => errores.push(m);
/**
 * @param deuda  true  = deuda del proyecto, CUENTA para el baseline.
 *               false = estado del entorno o de la sesion, NO cuenta.
 * Mezclarlas haria que el baseline cambiara solo por no tener feature activa,
 * y un baseline que se mueve por si solo es un baseline que nadie lee.
 */
const addWarn = (m, deuda = true) => advertencias.push({ msg: m, deuda });
const addInfo = (m) => infos.push(m);

const ok = (m) => console.log(`${C.green}[OK]${C.reset} ${m}`);
const step = (m) => console.log(`\n${C.cyan}==> ${m}${C.reset}`);

/**
 * Lector unico del gate. Quita el BOM antes de devolver el texto.
 *
 * No es cosmetico: en Windows cualquier editor (o un `Set-Content -Encoding UTF8`
 * de PowerShell 5.1) guarda con BOM, y con BOM al inicio el regex del frontmatter
 * NO casa y `JSON.parse` truena. Medido el 2026-08-31 haciendo la prueba negativa
 * del CHECK 1b: el gate degradaba a "sin frontmatter; no se pudo validar su
 * toolset" -- una ADVERTENCIA -- en vez de detectar que al agente le habian
 * quitado el shell. O sea, el BOM apagaba en silencio justo la verificacion que
 * existe para que nada se apague en silencio. Todo el gate lee por aqui.
 */
const leerAbs = (abs) => {
  const txt = readFileSync(abs, 'utf8');
  return txt.charCodeAt(0) === 0xfeff ? txt.slice(1) : txt;
};
const leer = (rel) => leerAbs(join(ROOT, rel));

console.log(`${C.cyan}== verify.mjs - gate automatico (Nivel A) ==${C.reset}`);
console.log(`${C.gray}Raiz: ${ROOT}${C.reset}`);
if (SOLO_ESTRUCTURA) {
  console.log(`${C.gray}Modo --estructura: se omiten build y pruebas.${C.reset}`);
}

// ===========================================================================
// CHECK 1 - Archivos base del harness
// ===========================================================================
step('CHECK 1 - Archivos base del harness');
let faltantes = 0;
for (const rel of ARCHIVOS_BASE) {
  if (!existsSync(join(ROOT, rel))) {
    addErr(`Falta archivo base del harness: ${rel}`);
    faltantes++;
  }
}
if (faltantes === 0) ok(`Los ${ARCHIVOS_BASE.length} archivos base existen.`);

// ===========================================================================
// CHECK 1b - Toolset declarado por los subagentes
//   La verificacion mas importante del harness: protege la CAPACIDAD DE
//   VERIFICAR. Un rol sin shell no puede correr este gate; un rol sin Write no
//   puede persistir su propio veredicto; un rol con Edit de mas puede tocar
//   codigo que no le corresponde.
// ===========================================================================
step('CHECK 1b - Toolset de los subagentes');
const dirAgentes = join(ROOT, '.claude', 'agents');
if (!existsSync(dirAgentes)) {
  addErr('No existe .claude/agents: no se pudo validar el toolset de los subagentes.');
} else {
  const archivos = readdirSync(dirAgentes).filter((f) => f.endsWith('.md'));
  for (const archivo of archivos) {
    const nombre = archivo.replace(/\.md$/, '');
    const txt = leerAbs(join(dirAgentes, archivo));

    const fm = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) {
      addWarn(`Agente '${nombre}': sin frontmatter YAML delimitado por ---; no se pudo validar su toolset.`);
      continue;
    }
    const fmText = fm[1];
    const lineaTools = fmText.match(/^tools:[ \t]*(.*)$/m);
    if (!lineaTools) {
      addInfo(`Agente '${nombre}': sin linea 'tools:' (hereda el toolset del padre).`);
      continue;
    }

    // 'tools:' admite dos formas YAML: inline separada por comas, o lista en
    // bloque con guiones. Se resuelven las dos.
    let declarados = [];
    const inline = lineaTools[1].trim();
    if (inline !== '') {
      declarados = inline.split(',').map((t) => t.trim()).filter(Boolean);
    } else {
      const resto = fmText.slice(lineaTools.index + lineaTools[0].length);
      for (const ln of resto.split(/\r?\n/)) {
        const m = ln.match(/^\s*-\s*(.+?)\s*$/);
        if (m) declarados.push(m[1]);
        else if (ln.trim() !== '') break;
      }
    }
    if (declarados.length === 0) {
      addWarn(`Agente '${nombre}': linea 'tools:' presente pero vacia; no se pudo determinar su toolset.`);
      continue;
    }

    if (declarados.includes(SHELL_TOOL_PROHIBIDO)) {
      addErr(
        `Agente '${nombre}' declara '${SHELL_TOOL_PROHIBIDO}': en este harness el tool de shell se ` +
          `llama '${SHELL_TOOL}'. Declarar '${SHELL_TOOL_PROHIBIDO}' NO da un shell alterno, deja al ` +
          `agente SIN shell y sin poder correr este gate. Cambialo a '${SHELL_TOOL}'.`,
      );
    }
    for (const t of declarados) {
      if (!TOOLS_CONOCIDOS.includes(t)) {
        addWarn(
          `Agente '${nombre}': tool declarado '${t}' no reconocido; si no existe, el agente corre sin ` +
            'el (silenciosamente).',
        );
      }
    }
    if (TOOLS_REQUERIDOS[nombre]) {
      const falta = TOOLS_REQUERIDOS[nombre].filter((t) => !declarados.includes(t));
      if (falta.length > 0) {
        addErr(
          `Agente '${nombre}': su flujo exige ${falta.join(', ')} pero no lo declara en 'tools:'. Sin eso ` +
            'no puede cumplir su propia definicion (p. ej. escribir su archivo de progress/ o correr el gate).',
        );
      }
    }
    if (TOOLS_PROHIBIDOS[nombre]) {
      for (const [t, motivo] of Object.entries(TOOLS_PROHIBIDOS[nombre])) {
        if (declarados.includes(t)) {
          addErr(`Agente '${nombre}': declara '${t}' y su rol lo prohibe (${motivo}).`);
        }
      }
    }
  }
  ok(`Toolsets revisados: ${archivos.length} agente(s).`);
}

// ===========================================================================
// CHECK 2 - Version de Node
//   Una version vieja NO bloquea build ni pruebas unitarias (usan mocks), pero la
//   app SI falla en runtime: TypeORM lanza "crypto is not defined" al inicializar
//   sobre runtimes donde webcrypto no es global. Es advertencia de ENTORNO, no
//   deuda: no cuenta para el baseline.
//
//   El piso son las lineas LTS vigentes, no la version de la maquina de quien
//   corre el gate: si el piso se baja para acomodar un equipo, el harness deja de
//   avisar cuando el Nivel B es inejecutable.
// ===========================================================================
const NODE_MIN = 22; // LTS minimo soportado
const NODE_RECOMENDADO = 24; // linea LTS recomendada
step('CHECK 2 - Version de Node');
const major = Number(process.versions.node.split('.')[0]);
if (major >= NODE_RECOMENDADO) {
  ok(`Node ${process.versions.node} (>= ${NODE_RECOMENDADO} LTS recomendado).`);
} else if (major >= NODE_MIN) {
  addWarn(
    `Node ${process.versions.node}: cumple el minimo (${NODE_MIN} LTS) pero la linea recomendada es ` +
      `${NODE_RECOMENDADO} LTS o superior.`,
    false,
  );
} else {
  addWarn(
    `Node ${process.versions.node} esta por debajo del minimo soportado (${NODE_MIN} LTS). Build y ` +
      'pruebas unitarias funcionan, pero la app NO arranca en runtime (TypeORM: "crypto is not ' +
      'defined"), asi que el Nivel B (e2e contra PostgreSQL) es IMPOSIBLE de ejecutar: actualiza a ' +
      `Node ${NODE_RECOMENDADO} LTS antes de declararlo.`,
    false,
  );
}

// ===========================================================================
// CHECK 3 - feature_list.json: estados, una sola activa, conteo
// ===========================================================================
step('CHECK 3 - feature_list.json');
let backlog = null;
try {
  backlog = JSON.parse(leer('feature_list.json'));
} catch (e) {
  addErr(`No se pudo leer/parsear feature_list.json: ${e.message}`);
}

if (backlog) {
  const features = Array.isArray(backlog.features) ? backlog.features : [];
  const invalidas = features.filter((f) => !ESTADOS_VALIDOS.has(f.status));
  const activas = features.filter((f) => ESTADOS_ACTIVOS.has(f.status));

  if (invalidas.length > 0) {
    addErr(
      `Estados invalidos: ${invalidas.map((f) => `#${f.id}:${f.status}`).join(', ')}. ` +
        `Validos: ${[...ESTADOS_VALIDOS].join(', ')}.`,
    );
  } else {
    // El conteo se REPORTA siempre: sin esta linea el operador no sabe si el
    // archivo se leyo de verdad.
    const porEstado = {};
    for (const f of features) porEstado[f.status] = (porEstado[f.status] ?? 0) + 1;
    const resumen = Object.entries(porEstado).map(([k, v]) => `${k}=${v}`).join(', ');
    ok(`${features.length} feature(s) con estado valido (${resumen}).`);
  }

  if (activas.length > 1) {
    addErr(
      `Hay ${activas.length} features en estado activo (${[...ESTADOS_ACTIVOS].join('/')}). Solo se ` +
        `permite una a la vez: ${activas.map((f) => `#${f.id} ${f.name} [${f.status}]`).join(', ')}.`,
    );
  } else if (activas.length === 1) {
    const a = activas[0];
    ok(`Feature activa: #${a.id} ${a.name} [${a.status}].`);
    if (a.status === 'red') {
      addInfo(
        `#${a.id} ${a.name} esta en 'red': la bateria de tests espera la APROBACION del usuario antes ` +
          'de implementar. No lances la fase GREEN sin su "go" explicito.',
      );
    }
  } else {
    addWarn('Sin feature activa. Selecciona la siguiente pending para trabajar.', false);
  }

  // =========================================================================
  // CHECK 3b - Bandera needs_design
  //   La decision de disenar NO es un juicio en tiempo de ejecucion: es una
  //   bandera que se escribe al registrar la feature. La tabla de disparadores
  //   vive SOLO en .claude/agents/planner.md.
  // =========================================================================
  step('CHECK 3b - Bandera needs_design');
  let sinClasificar = 0;
  for (const f of features) {
    if (typeof f.needs_design !== 'boolean') {
      addWarn(
        `Feature #${f.id} ${f.name}: sin bandera 'needs_design'. Clasificala con la tabla de ` +
          'disparadores de .claude/agents/planner.md (unica fuente de verdad) antes de arrancarla.',
      );
      sinClasificar++;
      continue;
    }
    if (f.needs_design === true) {
      if (!f.needs_design_motivo || !/D\d+/.test(f.needs_design_motivo)) {
        addErr(
          `Feature #${f.id} ${f.name}: 'needs_design: true' sin 'needs_design_motivo' que cite el ` +
            'disparador (p. ej. "D3 - ..."). Sin la cita no se puede auditar la decision.',
        );
      }
      if (f.status !== 'pending' && f.status !== 'blocked') {
        const diseno = `progress/design_${f.name}.md`;
        if (!existsSync(join(ROOT, diseno))) {
          if (f.design_waived_motivo) {
            addWarn(
              `Feature #${f.id} ${f.name}: salio de 'pending' sin ${diseno}, con dispensa declarada ` +
                `("${f.design_waived_motivo}").`,
            );
          } else {
            addErr(
              `Feature #${f.id} ${f.name}: 'needs_design: true' y estado '${f.status}', pero no existe ` +
                `${diseno} ni un 'design_waived_motivo' autorizado.`,
            );
          }
        }
      }
    }
  }
  if (sinClasificar === 0) ok('Todas las features estan clasificadas con needs_design.');

  // =========================================================================
  // CHECK 3c - Trazabilidad ejecutable criterio <-> test
  //   No basta declarar que existe un test: se busca el texto EXACTO del it()
  //   en el archivo declarado. Un contrato que nadie comprueba se desincroniza.
  // =========================================================================
  step('CHECK 3c - Trazabilidad criterio <-> test');
  let criteriosA = 0;
  let criteriosB = 0;
  let criteriosPend = 0;
  for (const f of features) {
    if (!ESTADOS_CON_CODIGO.has(f.status)) continue;
    const criterios = Array.isArray(f.acceptance) ? f.acceptance : [];
    const contrato = Array.isArray(f.tdd_contract) ? f.tdd_contract : null;
    const esTdd = f.tdd === true;

    if (!contrato) {
      const msg =
        `Feature #${f.id} ${f.name} [${f.status}]: sin 'tdd_contract'. Cada criterio de acceptance debe ` +
        'declarar el it() que lo prueba (o su nivel B / pendiente).';
      esTdd ? addErr(msg) : addWarn(msg);
      continue;
    }

    for (let i = 0; i < criterios.length; i++) {
      const entrada = contrato.find((c) => c.criterio === i + 1);
      if (!entrada) {
        const msg =
          `Feature #${f.id} ${f.name}: el criterio ${i + 1} no tiene entrada en 'tdd_contract'. ` +
          `Criterio: "${criterios[i].slice(0, 70)}..."`;
        esTdd ? addErr(msg) : addWarn(msg);
        continue;
      }
      if (entrada.nivel === 'A') {
        criteriosA++;
        if (!entrada.test || !entrada.archivo) {
          addErr(
            `Feature #${f.id} ${f.name}, criterio ${i + 1}: nivel A sin 'test' o 'archivo' declarado.`,
          );
          continue;
        }
        const ruta = join(ROOT, entrada.archivo);
        if (!existsSync(ruta)) {
          addErr(
            `Feature #${f.id} ${f.name}, criterio ${i + 1}: el archivo declarado no existe ` +
              `(${entrada.archivo}).`,
          );
          continue;
        }
        if (!leerAbs(ruta).includes(entrada.test)) {
          addErr(
            `Feature #${f.id} ${f.name}, criterio ${i + 1}: el test declarado NO existe en ` +
              `${entrada.archivo} -> "${entrada.test}". El contrato quedo desincronizado del codigo: ` +
              'renombraron el it() o el test se borro.',
          );
        }
      } else if (entrada.nivel === 'B') {
        criteriosB++;
      } else {
        criteriosPend++;
        const msg =
          `Feature #${f.id} ${f.name}, criterio ${i + 1}: sin cobertura ('${entrada.nivel}')` +
          `${entrada.nota ? ` - ${entrada.nota}` : ''}`;
        esTdd ? addErr(msg) : addWarn(msg);
      }
    }
  }
  ok(
    `Criterios con contrato: ${criteriosA} en Nivel A (verificados en disco), ${criteriosB} en Nivel B, ` +
      `${criteriosPend} sin cobertura.`,
  );

  // =========================================================================
  // CHECK 3d - Evidencia RED (solo features con tdd: true)
  //   Un test escrito DESPUES de que el codigo ya pasa no demuestra nada: pudo
  //   nacer verde por accidente. La evidencia de que fallo primero es la unica
  //   prueba de que el test prueba algo.
  // =========================================================================
  step('CHECK 3d - Evidencia RED');
  let revisadas = 0;
  for (const f of features) {
    if (f.tdd !== true) continue;
    if (!ESTADOS_CON_CODIGO.has(f.status)) continue;
    revisadas++;
    const impl = `progress/impl_${f.name}.md`;
    if (!existsSync(join(ROOT, impl))) {
      addErr(`Feature #${f.id} ${f.name} [${f.status}]: falta ${impl} con su evidencia RED.`);
      continue;
    }
    if (!/Evidencia RED/i.test(leer(impl))) {
      addErr(
        `Feature #${f.id} ${f.name}: ${impl} no contiene una seccion "Evidencia RED" con la salida de ` +
          'Jest fallando ANTES de implementar. Sin ella no se puede distinguir TDD de un test escrito al final.',
      );
    }
  }
  ok(revisadas === 0 ? 'Sin features tdd:true en estado con codigo (nada que exigir).' : `${revisadas} feature(s) tdd:true revisada(s).`);
}

// ===========================================================================
// CHECK 4 - Higiene del codigo
//   Medido el 2026-08-31 sobre src/: 0 console.log y 0 TODO. El check entra
//   limpio, asi que cualquier hallazgo futuro es nuevo y accionable.
// ===========================================================================
step('CHECK 4 - Higiene de src/');
const archivosTs = [];
const recorrer = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) recorrer(p);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) archivosTs.push(p);
  }
};
if (existsSync(join(ROOT, 'src'))) recorrer(join(ROOT, 'src'));
let sucios = 0;
const pendientes = [];
for (const p of archivosTs) {
  const rel = p.slice(ROOT.length + 1).replace(/\\/g, '/');
  const lineas = leerAbs(p).split(/\r?\n/);
  lineas.forEach((ln, i) => {
    if (/console\.(log|debug)\s*\(/.test(ln)) {
      addWarn(`${rel}:${i + 1} - console.log/debug en codigo de produccion (usar el logger de Winston).`);
      sucios++;
    }
    if (/\b(TODO|FIXME)\b/.test(ln)) pendientes.push(`${rel}:${i + 1}`);
  });
}
if (pendientes.length > 0) {
  addInfo(`TODO/FIXME en src/ (${pendientes.length}): ${pendientes.join(', ')}. Deben citar su contexto.`);
}
if (sucios === 0) ok(`${archivosTs.length} archivo(s) .ts de produccion sin codigo de depuracion.`);

// ===========================================================================
// CHECK 5 y 6 - Build y pruebas
// ===========================================================================
if (SOLO_ESTRUCTURA) {
  addWarn(
    'Modo --estructura: build y pruebas NO se ejecutaron. El Nivel A quedo INCOMPLETO; no cierres una ' +
      'feature con esta corrida.',
    false,
  );
} else if (!existsSync(join(ROOT, 'node_modules'))) {
  addErr(
    'No existe node_modules: build y pruebas no pueden correr. Ejecuta `npm install` (o `npm ci`) antes ' +
      'del gate. No es un fallo de codigo, es entorno sin instalar.',
  );
} else {
  step('CHECK 5 - Compilacion (npm run build)');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    ok('Build correcto.');
  } catch {
    addErr('El build fallo. Resuelve los errores de compilacion antes de avanzar.');
  }

  step('CHECK 6 - Pruebas unitarias (npm test)');
  try {
    execSync('npm test', { cwd: ROOT, stdio: 'inherit' });
    ok('Pruebas en verde.');
  } catch {
    addErr('Hay pruebas en rojo. No marques features como done hasta que pasen.');
  }
}

// ===========================================================================
// CHECK 7 - Recordatorio de Nivel B (informativo, no bloqueante)
//   Evita que [OK] se lea como "probado".
// ===========================================================================
addInfo(
  'Nivel B (NO lo prueba este script): comportamiento contra PostgreSQL real, invalidacion de JWT ' +
    'end-to-end tras re-login, migraciones/sincronizacion de esquema, y el contrato publicado en ' +
    '/api/docs. Se DECLARA en progress/impl_<name>.md; no se sustituye. Ver docs/verifications.md.',
);

// ===========================================================================
// Resumen + baseline de advertencias
// ===========================================================================
console.log('');
for (const i of infos) console.log(`${C.cyan}[INFO]${C.reset} ${i}`);
for (const a of advertencias) {
  console.log(`${C.yellow}[WARN]${C.reset}${a.deuda ? '' : `${C.gray} (entorno)${C.reset}`} ${a.msg}`);
}
for (const e of errores) console.log(`${C.red}[ERR ]${C.reset} ${e}`);

const deuda = advertencias.filter((a) => a.deuda).length;
const baseline = backlog?.rules?.baseline_advertencias;
console.log('');
if (typeof baseline !== 'number') {
  console.log(
    `${C.cyan}[INFO]${C.reset} Advertencias de deuda: ${deuda}. Sin baseline registrado: anotalo en ` +
      'docs/verifications.md seccion 4 y en feature_list.json (rules.baseline_advertencias).',
  );
} else if (deuda > baseline) {
  console.log(
    `${C.yellow}[BASELINE]${C.reset} ${deuda} advertencias de deuda vs. baseline ${baseline}: ` +
      'ALGO NUEVO SE INTRODUJO. Investigalo antes de avanzar (docs/verifications.md seccion 4).',
  );
} else if (deuda < baseline) {
  console.log(
    `${C.yellow}[BASELINE]${C.reset} ${deuda} advertencias de deuda vs. baseline ${baseline}: se resolvio ` +
      'deuda. ACTUALIZA el baseline en docs/verifications.md seccion 4 y en feature_list.json en esta misma pasada.',
  );
} else {
  console.log(`${C.green}[BASELINE]${C.reset} ${deuda} advertencias de deuda == baseline ${baseline}.`);
}

console.log('');
if (errores.length > 0) {
  console.log(
    `${C.red}[FAIL]${C.reset} ${errores.length} error(es), ${advertencias.length} advertencia(s). ` +
      'El entorno NO esta listo.',
  );
  process.exit(1);
}
console.log(
  `${C.green}[OK]${C.reset} Entorno integro (Nivel A${SOLO_ESTRUCTURA ? ' parcial' : ''}). ` +
    `${advertencias.length} advertencia(s). Recuerda el Nivel B.`,
);
process.exit(0);
