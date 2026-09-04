#!/usr/bin/env node
/**
 * Gate automatico (Nivel A) del harness de application-api-NestJS.
 *
 * Valida integridad ESTRUCTURAL del harness, TRAZABILIDAD criterio<->test y
 * DISCIPLINA TDD, y despues corre la cadena completa de calidad: build, typecheck,
 * lint, pruebas unitarias y cobertura. NO valida comportamiento contra PostgreSQL
 * real, migraciones, ni el contrato publicado en Swagger: eso es Nivel B (ver
 * docs/verifications.md).
 *
 * El gate ENTIENDE la fase RED: con una feature en estado `red` (modo `nuevo`), los
 * fallos de typecheck, lint y jest se toleran SOLO en los archivos declarados en
 * su `tdd_contract`. Cualquier fallo fuera de ellos sigue siendo error, y una
 * bateria en verde durante la fase RED tambien lo es (o el test no prueba nada, o
 * el comportamiento ya existia). Asi el gate puede correr en [OK] durante todo el
 * ciclo sin bajar la guardia.
 *
 * Uso:
 *   npm run harness:verify              # Nivel A completo
 *   npm run harness:estructura          # solo estructura (rapido, sin node_modules)
 *   node scripts/harness/verify.mjs --estructura
 *
 * Salida: [OK] (exit 0) o [FAIL] (exit 1).
 *
 * Nota Kata: todo corre local, no envia datos a servicios externos.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'PowerShell',
  'Bash',
  'Agent',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'NotebookEdit',
  'Skill',
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

// Andamiaje minimo del harness + toolchain. Si falta uno, el gate no puede
// garantizar lo que promete (p. ej. sin .nvmrc no hay version de Node acordada;
// sin eslint.config.mjs el CHECK 5c no tiene reglas que aplicar).
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
  'progress/history.md',
  '.nvmrc',
  '.npmrc',
  '.gitattributes',
  '.prettierrc',
  'eslint.config.mjs',
  'tsconfig.json',
  'tsconfig.build.json',
  'test/tsconfig.json',
];

const ESTADOS_VALIDOS = new Set(['pending', 'red', 'green', 'in_review', 'done', 'blocked']);
const ESTADOS_ACTIVOS = new Set(['red', 'green', 'in_review']);
// Estados en los que la feature ya tiene bateria escrita y, por tanto, contrato y
// evidencia RED. Incluye `red`: la fase RED termina precisamente con esos dos
// artefactos en disco.
const ESTADOS_CON_CONTRATO = new Set(['red', 'green', 'in_review', 'done']);
// Como se demostro el rojo:
//   nuevo           -> la bateria FALLA en disco ahora mismo (comportamiento nuevo).
//   caracterizacion -> el comportamiento ya existia; la bateria pasa en disco y el
//                      rojo se demostro ROMPIENDO el codigo a proposito (mutacion)
//                      y capturando la salida antes de restaurarlo.
const RED_MODOS = new Set(['nuevo', 'caracterizacion']);

// Fecha en que Node 26 entra a Active LTS (schedule.json de nodejs/Release).
const NODE_26_LTS = '2026-10-28';

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

/** Ruta relativa a la raiz con separadores posix, para comparar sin importar el SO. */
const relPosix = (abs) => relative(ROOT, abs).replace(/\\/g, '/');
const normalizarRel = (rel) => rel.replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * Corre un comando con shell, captura stdout y deja pasar stderr en vivo (ahi
 * imprimen su reporte tsc, eslint y jest). Devuelve { status, stdout }.
 */
const correr = (cmd, extra = {}) => {
  const r = spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
    ...extra,
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? '' };
};

console.log(`${C.cyan}== verify.mjs - gate automatico (Nivel A) ==${C.reset}`);
console.log(`${C.gray}Raiz: ${ROOT}${C.reset}`);
if (SOLO_ESTRUCTURA) {
  console.log(
    `${C.gray}Modo --estructura: se omiten build, typecheck, lint, pruebas y cobertura.${C.reset}`,
  );
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
      addWarn(
        `Agente '${nombre}': sin frontmatter YAML delimitado por ---; no se pudo validar su toolset.`,
      );
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
      declarados = inline
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      const resto = fmText.slice(lineaTools.index + lineaTools[0].length);
      for (const ln of resto.split(/\r?\n/)) {
        const m = ln.match(/^\s*-\s*(.+?)\s*$/);
        if (m) declarados.push(m[1]);
        else if (ln.trim() !== '') break;
      }
    }
    if (declarados.length === 0) {
      addWarn(
        `Agente '${nombre}': linea 'tools:' presente pero vacia; no se pudo determinar su toolset.`,
      );
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
//   El piso es la linea LTS que declara package.json (engines) y .nvmrc, no la
//   maquina de quien corre el gate. Por debajo del piso NADA de lo que reporte
//   el gate es confiable: TypeORM 1.x y ESLint 10 declaran engines que npm ya
//   rechaza con engine-strict, y la app no arranca en runtimes viejos (TypeORM:
//   "crypto is not defined"), asi que el Nivel B seria inejecutable.
//   Quedarse en la linea correcta pero en un parche viejo es advertencia de
//   ENTORNO (no cuenta para el baseline): .nvmrc dice cual es el parche acordado.
// ===========================================================================
const NODE_MIN = 24; // LTS Krypton: piso de engines y de .nvmrc
step('CHECK 2 - Version de Node');
const nodeActual = process.versions.node;
const [majorActual] = nodeActual.split('.').map(Number);
const nvmrc = existsSync(join(ROOT, '.nvmrc')) ? leer('.nvmrc').trim() : null;
const cmpSemver = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
};
if (majorActual < NODE_MIN) {
  addErr(
    `Node ${nodeActual} esta por debajo del piso del repo (Node ${NODE_MIN} LTS, ver .nvmrc y ` +
      '"engines" en package.json). El toolchain declarado no soporta esa version: lo que reporte ' +
      `este gate no es confiable. Instala Node ${nvmrc ?? NODE_MIN} y vuelve a correrlo.`,
  );
} else if (nvmrc && /^\d+\.\d+\.\d+$/.test(nvmrc) && cmpSemver(nodeActual, nvmrc) < 0) {
  addWarn(
    `Node ${nodeActual}: cumple la linea ${NODE_MIN} LTS pero .nvmrc acuerda ${nvmrc}. Actualiza el ` +
      'parche para trabajar con la misma version que el resto del equipo y que CI.',
    false,
  );
} else {
  ok(`Node ${nodeActual} (piso: ${NODE_MIN} LTS; acordado en .nvmrc: ${nvmrc ?? 'sin .nvmrc'}).`);
}
if (majorActual > NODE_MIN) {
  addInfo(
    `Node ${nodeActual} es una linea posterior a la acordada (${nvmrc ?? NODE_MIN}). Node 26 entra a ` +
      `LTS el ${NODE_26_LTS}; el piso del repo se mueve actualizando .nvmrc, engines y este check ` +
      'en la misma pasada, no por correr el gate con otra version.',
  );
}

// ===========================================================================
// CHECK 3 - feature_list.json: estados, una sola activa, conteo, modo RED
// ===========================================================================
step('CHECK 3 - feature_list.json');
let backlog = null;
try {
  backlog = JSON.parse(leer('feature_list.json'));
} catch (e) {
  addErr(`No se pudo leer/parsear feature_list.json: ${e.message}`);
}

// Contexto de la fase RED que usan los checks 5b, 5c y 6.
let activa = null;
let enRed = false;
let redModo = 'nuevo';
const archivosContrato = new Set(); // rutas posix relativas de los tests nivel A de la activa

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
    const resumen = Object.entries(porEstado)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    ok(`${features.length} feature(s) con estado valido (${resumen}).`);
  }

  if (activas.length > 1) {
    addErr(
      `Hay ${activas.length} features en estado activo (${[...ESTADOS_ACTIVOS].join('/')}). Solo se ` +
        `permite una a la vez: ${activas.map((f) => `#${f.id} ${f.name} [${f.status}]`).join(', ')}.`,
    );
  } else if (activas.length === 1) {
    activa = activas[0];
    ok(`Feature activa: #${activa.id} ${activa.name} [${activa.status}].`);
    if (activa.status === 'red') {
      enRed = true;
      redModo = activa.red_modo ?? 'nuevo';
      if (!RED_MODOS.has(redModo)) {
        addErr(
          `Feature #${activa.id} ${activa.name}: 'red_modo' invalido ("${redModo}"). Validos: ` +
            `${[...RED_MODOS].join(', ')}.`,
        );
        redModo = 'nuevo';
      }
      for (const c of activa.tdd_contract ?? []) {
        if (c.nivel === 'A' && c.archivo) archivosContrato.add(normalizarRel(c.archivo));
      }
      addInfo(
        `#${activa.id} ${activa.name} esta en 'red' (modo ${redModo}): la bateria espera la APROBACION ` +
          'del usuario antes de implementar. No lances la fase GREEN sin su "go" explicito.',
      );
      if (redModo === 'nuevo') {
        addInfo(
          'Fase RED (nuevo): typecheck, lint y jest toleran fallos SOLO en los archivos del ' +
            `tdd_contract: ${[...archivosContrato].join(', ') || '(ninguno declarado)'}.`,
        );
      }
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
  //   Aplica desde `red`: la fase RED termina con la bateria y el contrato en disco.
  // =========================================================================
  step('CHECK 3c - Trazabilidad criterio <-> test');
  let criteriosA = 0;
  let criteriosB = 0;
  let criteriosPend = 0;
  for (const f of features) {
    if (!ESTADOS_CON_CONTRATO.has(f.status)) continue;
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
  // CHECK 3d - Evidencia RED (features con tdd: true, desde `red`)
  //   Un test escrito DESPUES de que el codigo ya pasa no demuestra nada: pudo
  //   nacer verde por accidente. La evidencia de que fallo primero es la unica
  //   prueba de que el test prueba algo. Ademas de existir, la seccion tiene que
  //   ser CREIBLE: mencionar los archivos de la bateria y contener un fallo real
  //   de Jest o del compilador. Una seccion vacia o pegada de otra feature no
  //   pasa. En modo `caracterizacion` debe describir la mutacion aplicada.
  // =========================================================================
  step('CHECK 3d - Evidencia RED');
  const MARCADOR_FALLO =
    /(✕|●|\bFAIL\b|Tests:\s+\d+\s+failed|Test Suites:\s+\d+\s+failed|error TS\d+|Cannot find|is not a function|does not exist on type|Expected|Received)/;
  const seccionEvidencia = (md) => {
    const lineas = md.split(/\r?\n/);
    const i = lineas.findIndex((ln) => /^#{1,6}\s.*Evidencia RED/i.test(ln));
    if (i === -1) return /Evidencia RED/i.test(md) ? md : null;
    const nivel = lineas[i].match(/^#+/)[0].length;
    let j = i + 1;
    while (j < lineas.length && !new RegExp(`^#{1,${nivel}}\\s`).test(lineas[j])) j++;
    return lineas.slice(i, j).join('\n');
  };
  let revisadas = 0;
  for (const f of features) {
    if (f.tdd !== true) continue;
    if (!ESTADOS_CON_CONTRATO.has(f.status)) continue;
    revisadas++;
    const impl = `progress/impl_${f.name}.md`;
    if (!existsSync(join(ROOT, impl))) {
      addErr(`Feature #${f.id} ${f.name} [${f.status}]: falta ${impl} con su evidencia RED.`);
      continue;
    }
    const seccion = seccionEvidencia(leer(impl));
    if (!seccion) {
      addErr(
        `Feature #${f.id} ${f.name}: ${impl} no contiene una seccion "Evidencia RED" con la salida de ` +
          'Jest fallando ANTES de implementar. Sin ella no se puede distinguir TDD de un test escrito al final.',
      );
      continue;
    }
    if (!MARCADOR_FALLO.test(seccion)) {
      addErr(
        `Feature #${f.id} ${f.name}: la seccion "Evidencia RED" de ${impl} no contiene ningun fallo ` +
          'reconocible de Jest ni del compilador (FAIL, "N failed", error TSxxxx...). Pega la salida literal.',
      );
    }
    const archivosA = (f.tdd_contract ?? []).filter((c) => c.nivel === 'A' && c.archivo);
    const noMencionados = archivosA
      .map((c) => basename(normalizarRel(c.archivo)))
      .filter((b, idx, arr) => arr.indexOf(b) === idx)
      .filter((b) => !seccion.includes(b));
    if (noMencionados.length > 0) {
      addErr(
        `Feature #${f.id} ${f.name}: la "Evidencia RED" de ${impl} no menciona ${noMencionados.join(', ')}. ` +
          'Cada archivo de la bateria (nivel A del tdd_contract) debe aparecer fallando en la salida pegada.',
      );
    }
    const modo = f.red_modo ?? 'nuevo';
    if (modo === 'caracterizacion' && !/mutaci/i.test(seccion)) {
      addErr(
        `Feature #${f.id} ${f.name}: red_modo 'caracterizacion' exige que la "Evidencia RED" describa la ` +
          'MUTACION aplicada al codigo (que se rompio, que test fallo, que se restauro).',
      );
    }
  }
  ok(
    revisadas === 0
      ? 'Sin features tdd:true con contrato (nada que exigir).'
      : `${revisadas} feature(s) tdd:true revisada(s).`,
  );

  // =========================================================================
  // CHECK 3e - TDD obligatorio
  //   Toda feature nace con tdd: true. La unica excepcion es la lista explicita
  //   rules.tdd_exentas_legacy (features cerradas antes de que existiera el
  //   ciclo TDD), cada una con su motivo. Una bandera `tdd: false` suelta era una
  //   salida de emergencia silenciosa; ahora la exencion se declara y se audita.
  // =========================================================================
  step('CHECK 3e - TDD obligatorio');
  const exentas = new Map();
  for (const e of backlog.rules?.tdd_exentas_legacy ?? []) {
    if (typeof e?.id === 'number' && typeof e?.motivo === 'string' && e.motivo.trim() !== '') {
      exentas.set(e.id, e.motivo);
    } else {
      addErr(
        `rules.tdd_exentas_legacy tiene una entrada invalida (se esperaba { id, motivo }): ${JSON.stringify(e)}`,
      );
    }
  }
  let sinTdd = 0;
  for (const f of features) {
    if (exentas.has(f.id)) {
      if (f.tdd === true) {
        addWarn(
          `Feature #${f.id} ${f.name}: esta en tdd_exentas_legacy pero ya es tdd:true. Quita la exencion.`,
        );
      }
      continue;
    }
    if (f.tdd !== true) {
      sinTdd++;
      addErr(
        `Feature #${f.id} ${f.name} [${f.status}]: 'tdd' no es true. Toda feature nace con tdd:true; si ` +
          'es legacy, registrala en rules.tdd_exentas_legacy con su motivo.',
      );
    }
  }
  if (sinTdd === 0) {
    ok(`Todas las features son tdd:true (exentas legacy declaradas: ${exentas.size}).`);
  }
}

// ===========================================================================
// CHECK 4 - Higiene del codigo y de las pruebas
//   Produccion: sin console.log/debug (el logger es Winston). TODO/FIXME se
//   listan como informativos.
//   Pruebas: `.only(` es ERROR siempre -- reduce la bateria a un test y deja el
//   gate en verde con el resto sin correr. Tests deshabilitados (`xit`,
//   `it.skip(`) son deuda: esconden un rojo.
// ===========================================================================
step('CHECK 4 - Higiene de src/ y test/');
const archivosProd = [];
const archivosPrueba = [];
const recorrer = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) recorrer(p);
    else if (e.name.endsWith('.spec.ts') || e.name.endsWith('.e2e-spec.ts')) archivosPrueba.push(p);
    else if (e.name.endsWith('.ts')) archivosProd.push(p);
  }
};
if (existsSync(join(ROOT, 'src'))) recorrer(join(ROOT, 'src'));
if (existsSync(join(ROOT, 'test'))) recorrer(join(ROOT, 'test'));
let sucios = 0;
const pendientes = [];
for (const p of archivosProd) {
  const rel = relPosix(p);
  leerAbs(p)
    .split(/\r?\n/)
    .forEach((ln, i) => {
      if (/console\.(log|debug)\s*\(/.test(ln)) {
        addWarn(
          `${rel}:${i + 1} - console.log/debug en codigo de produccion (usar el logger de Winston).`,
        );
        sucios++;
      }
      if (/\b(TODO|FIXME)\b/.test(ln)) pendientes.push(`${rel}:${i + 1}`);
    });
}
let enfocados = 0;
let deshabilitados = 0;
for (const p of archivosPrueba) {
  const rel = relPosix(p);
  leerAbs(p)
    .split(/\r?\n/)
    .forEach((ln, i) => {
      if (/\b(it|test|describe)\.only\s*\(/.test(ln)) {
        addErr(
          `${rel}:${i + 1} - '.only(' en una prueba: la bateria completa deja de correr y el verde miente.`,
        );
        enfocados++;
      }
      if (/\b(xit|xtest|xdescribe)\s*\(|\b(it|test|describe)\.skip\s*\(/.test(ln)) {
        addWarn(
          `${rel}:${i + 1} - prueba deshabilitada (skip/x*): esconde un rojo. Habilitala o borrala con motivo.`,
        );
        deshabilitados++;
      }
    });
}
if (pendientes.length > 0) {
  addInfo(
    `TODO/FIXME en src/ (${pendientes.length}): ${pendientes.join(', ')}. Deben citar su contexto.`,
  );
}
if (sucios === 0)
  ok(`${archivosProd.length} archivo(s) .ts de produccion sin codigo de depuracion.`);
if (enfocados === 0 && deshabilitados === 0) {
  ok(`${archivosPrueba.length} archivo(s) de prueba sin .only ni tests deshabilitados.`);
}

// ===========================================================================
// Helpers de la fase RED para los checks 5b, 5c y 6
//   Un fallo "tolerado" es el que ocurre en un archivo del tdd_contract de la
//   feature activa mientras esta en `red` modo `nuevo`. Todo lo demas es error.
// ===========================================================================
const toleradoEnRed = (relArchivo) =>
  enRed && redModo === 'nuevo' && archivosContrato.has(normalizarRel(relArchivo));
const enRedNuevo = () => enRed && redModo === 'nuevo';

// ===========================================================================
// CHECK 5, 5b, 5c y 6 - Build, typecheck, lint, pruebas y cobertura
// ===========================================================================
if (SOLO_ESTRUCTURA) {
  addWarn(
    'Modo --estructura: build, typecheck, lint, pruebas y cobertura NO se ejecutaron. El Nivel A quedo ' +
      'INCOMPLETO; no cierres una feature con esta corrida.',
    false,
  );
} else if (!existsSync(join(ROOT, 'node_modules'))) {
  addErr(
    'No existe node_modules: build, lint y pruebas no pueden correr. Ejecuta `npm ci` antes del gate. ' +
      'No es un fallo de codigo, es entorno sin instalar.',
  );
} else {
  // -------------------------------------------------------------------------
  // CHECK 5 - Build. Compila SOLO produccion (tsconfig.build.json excluye specs):
  // debe pasar incluso en fase RED, porque los tests no forman parte del build.
  // -------------------------------------------------------------------------
  step('CHECK 5 - Compilacion (npm run build)');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    ok('Build correcto.');
  } catch {
    addErr('El build fallo. Resuelve los errores de compilacion antes de avanzar.');
  }

  // -------------------------------------------------------------------------
  // CHECK 5b - Typecheck de TODO el codigo, specs y e2e incluidos. El build los
  // excluye y ts-jest solo revisa los que ejecuta: sin este paso, un e2e con un
  // error de tipos solo se descubre al correr el Nivel B.
  // En fase RED (nuevo) los errores dentro de los archivos del contrato SON el
  // rojo ("si el test no compila porque el metodo no existe, ese fallo es el rojo").
  // -------------------------------------------------------------------------
  step('CHECK 5b - Typecheck (tsc --noEmit: tsconfig.json + test/tsconfig.json)');
  const parsearTsc = (salida) => {
    const porArchivo = new Map();
    for (const ln of salida.split(/\r?\n/)) {
      const m = ln.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
      if (!m) continue;
      const rel = normalizarRel(m[1]);
      if (!porArchivo.has(rel)) porArchivo.set(rel, []);
      porArchivo.get(rel).push(`${rel}:${m[2]} ${m[4]} ${m[5]}`);
    }
    return porArchivo;
  };
  let tscFallos = 0;
  for (const proyecto of ['tsconfig.json', 'test/tsconfig.json']) {
    const r = correr(`npx tsc --noEmit --pretty false -p ${proyecto}`, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.status === 0) continue;
    const porArchivo = parsearTsc(r.stdout);
    if (porArchivo.size === 0) {
      addErr(
        `tsc -p ${proyecto} fallo sin errores parseables (exit ${r.status}). Correlo a mano para ver el detalle.`,
      );
      tscFallos++;
      continue;
    }
    for (const [rel, errs] of porArchivo) {
      if (toleradoEnRed(rel)) {
        addInfo(
          `Fase RED: ${errs.length} error(es) de tipos en ${rel} (tolerado: es parte de la bateria en rojo).`,
        );
      } else {
        tscFallos++;
        addErr(`Typecheck (${proyecto}): ${errs.length} error(es) en ${rel}. Primero: ${errs[0]}`);
      }
    }
  }
  if (tscFallos === 0) ok('Typecheck sin errores fuera de la fase RED.');

  // -------------------------------------------------------------------------
  // CHECK 5c - Lint con --max-warnings=0 y SIN --fix: el gate verifica, no
  // modifica. Las reglas viven en eslint.config.mjs (strictTypeChecked,
  // stylisticTypeChecked, eslint-plugin-jest, prettier).
  // -------------------------------------------------------------------------
  step('CHECK 5c - Lint (eslint . --max-warnings=0)');
  {
    const r = correr('npx eslint . --max-warnings=0 --format json', {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let resultados;
    try {
      const inicio = r.stdout.indexOf('[');
      resultados = JSON.parse(r.stdout.slice(inicio));
    } catch {
      resultados = null;
    }
    if (!Array.isArray(resultados)) {
      addErr(
        `eslint no devolvio un reporte JSON parseable (exit ${r.status}). Correlo a mano: npm run lint:check`,
      );
    } else {
      let lintFallos = 0;
      let lintTolerados = 0;
      const detalle = [];
      for (const res of resultados) {
        const problemas = res.errorCount + res.warningCount;
        if (problemas === 0) continue;
        const rel = relPosix(res.filePath);
        if (toleradoEnRed(rel)) {
          lintTolerados += problemas;
          continue;
        }
        lintFallos += problemas;
        for (const m of res.messages.slice(0, 5)) {
          detalle.push(`  ${rel}:${m.line}:${m.column} ${m.ruleId ?? 'parse'} - ${m.message}`);
        }
      }
      if (lintTolerados > 0) {
        addInfo(
          `Fase RED: ${lintTolerados} hallazgo(s) de lint en archivos de la bateria (tolerados).`,
        );
      }
      if (lintFallos > 0) {
        addErr(
          `Lint: ${lintFallos} hallazgo(s) (errores + advertencias, --max-warnings=0). Corre \`npm run lint\` ` +
            `para autocorregir lo corregible y revisa el resto:\n${detalle.slice(0, 30).join('\n')}` +
            `${detalle.length > 30 ? `\n  ... y ${detalle.length - 30} mas` : ''}`,
        );
      } else {
        ok(`Lint limpio en ${resultados.length} archivo(s) (0 errores, 0 advertencias).`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // CHECK 6 - Pruebas unitarias con cobertura, leidas del reporte JSON de Jest
  // para poder distinguir DONDE fallo cada test. Fuera de la fase RED todo debe
  // pasar. En RED (nuevo): los unicos fallos permitidos estan en los archivos
  // del contrato, y tiene que haber al menos uno (una bateria verde en RED no es
  // TDD). En RED (caracterizacion): todo pasa y el rojo esta en la evidencia.
  // -------------------------------------------------------------------------
  step('CHECK 6 - Pruebas unitarias (jest --coverage)');
  const dirHarness = join(ROOT, 'coverage', 'harness');
  const jsonJest = join(dirHarness, 'jest.json');
  rmSync(dirHarness, { recursive: true, force: true });
  mkdirSync(dirHarness, { recursive: true });
  {
    const r = correr(
      `npx jest --coverage --coverageReporters=json-summary --coverageReporters=text-summary --json --outputFile="${jsonJest}"`,
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let reporte;
    try {
      reporte = JSON.parse(leerAbs(jsonJest));
    } catch {
      reporte = null;
    }
    if (!reporte) {
      addErr(
        `Jest no dejo un reporte JSON legible en ${relPosix(jsonJest)} (exit ${r.status}). Correlo a mano: npm test`,
      );
    } else {
      const fallosFuera = [];
      const fallosDentro = [];
      for (const suite of reporte.testResults ?? []) {
        const rel = relPosix(suite.name);
        const asercionesRojas = (suite.assertionResults ?? []).filter((a) => a.status === 'failed');
        const suiteRota = suite.status === 'failed' && asercionesRojas.length === 0; // no compilo / no corrio
        if (asercionesRojas.length === 0 && !suiteRota) continue;
        const destino = toleradoEnRed(rel) ? fallosDentro : fallosFuera;
        if (suiteRota) destino.push(`${rel} (la suite no corrio: error de compilacion o de carga)`);
        for (const a of asercionesRojas) destino.push(`${rel} -> "${a.fullName}"`);
      }
      const total = reporte.numTotalTests ?? 0;
      const fallidos = reporte.numFailedTests ?? 0;
      const suitesRotas = reporte.numRuntimeErrorTestSuites ?? 0;

      if (fallosFuera.length > 0) {
        addErr(
          `Pruebas en rojo fuera de la fase RED (${fallosFuera.length}):\n  ${fallosFuera.slice(0, 20).join('\n  ')}` +
            `${fallosFuera.length > 20 ? `\n  ... y ${fallosFuera.length - 20} mas` : ''}`,
        );
      }
      if (enRedNuevo()) {
        if (fallosDentro.length === 0 && fallosFuera.length === 0) {
          addErr(
            `Feature #${activa.id} ${activa.name} esta en 'red' (modo nuevo) pero TODA la bateria pasa. O el test ` +
              'no prueba lo que crees, o el comportamiento ya existia: corrige el test, o declara ' +
              '"red_modo": "caracterizacion" con la evidencia por mutacion en progress/impl_<name>.md.',
          );
        } else if (fallosDentro.length > 0) {
          ok(
            `Fase RED: ${fallosDentro.length} fallo(s) esperado(s) dentro de la bateria:\n  ${fallosDentro.join('\n  ')}`,
          );
        }
      } else if (fallosFuera.length === 0) {
        ok(
          `Pruebas en verde: ${total - fallidos}/${total} tests, ${suitesRotas} suite(s) rota(s).`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // CHECK 6b - Cobertura minima (rules.cobertura_minima en feature_list.json,
  // documentada en docs/verifications.md seccion 4). Es un trinquete: solo sube.
  // En fase RED (nuevo) no se evalua: los tests rojos distorsionan la medida.
  // -------------------------------------------------------------------------
  step('CHECK 6b - Cobertura minima');
  const resumenCov = join(ROOT, 'coverage', 'coverage-summary.json');
  const minimos = backlog?.rules?.cobertura_minima;
  const METRICAS = {
    lineas: 'lines',
    sentencias: 'statements',
    funciones: 'functions',
    ramas: 'branches',
  };
  if (!existsSync(resumenCov)) {
    addErr('Jest no genero coverage/coverage-summary.json: no se puede evaluar la cobertura.');
  } else {
    const total = JSON.parse(leerAbs(resumenCov)).total ?? {};
    const medida = Object.fromEntries(
      Object.entries(METRICAS).map(([es, en]) => [es, Number(total[en]?.pct ?? 0)]),
    );
    const texto = Object.entries(medida)
      .map(([k, v]) => `${k} ${v}%`)
      .join(', ');
    if (!minimos || typeof minimos !== 'object') {
      addInfo(
        `Cobertura medida: ${texto}. Sin rules.cobertura_minima en feature_list.json: registrala (seccion 4 de docs/verifications.md).`,
      );
    } else if (enRedNuevo()) {
      addInfo(`Fase RED: cobertura no evaluada (${texto}); se exige al pasar a green.`);
    } else {
      const bajo = [];
      const holgura = [];
      for (const k of Object.keys(METRICAS)) {
        if (typeof minimos[k] !== 'number') continue;
        if (medida[k] < minimos[k]) bajo.push(`${k} ${medida[k]}% < ${minimos[k]}%`);
        else if (medida[k] - minimos[k] >= 5)
          holgura.push(`${k} ${medida[k]}% (piso ${minimos[k]}%)`);
      }
      if (bajo.length > 0) {
        addErr(
          `Cobertura por debajo del minimo: ${bajo.join(', ')}. Escribe primero el test del codigo que agregaste.`,
        );
      } else {
        ok(`Cobertura sobre el minimo: ${texto}.`);
        if (holgura.length > 0) {
          addInfo(
            `Cobertura con holgura >= 5 puntos en ${holgura.join(', ')}: sube el piso (trinquete) en feature_list.json y docs/verifications.md seccion 4.`,
          );
        }
      }
    }
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
  console.log(
    `${C.yellow}[WARN]${C.reset}${a.deuda ? '' : `${C.gray} (entorno)${C.reset}`} ${a.msg}`,
  );
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
  console.log(
    `${C.green}[BASELINE]${C.reset} ${deuda} advertencias de deuda == baseline ${baseline}.`,
  );
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
