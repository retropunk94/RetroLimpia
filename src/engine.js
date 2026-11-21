// Motor de RetroLimpia: ejecuta los scripts de PowerShell de /scripts
// de forma oculta (sin ventanas negras) y devuelve su resultado en JSON.
//
// Protocolo de salida de cada script:
//   @@PROGRESS {"pct":40,"msg":"..."}   -> progreso en vivo
//   @@RESULT {...}                      -> resultado final

const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const demo = require('./demo');

const SCRIPTS = new Set([
  'programas', 'desinstalar', 'residuos', 'cuarentena', 'restauracion',
  'hardware', 'drivers', 'actualizaciones', 'limpieza', 'inicio', 'procesos', 'privacidad', 'restos', 'modojuego', 'reinicios'
]);

let cfg = { demo: false, scriptsDir: '', ligero: false };
const running = new Set();
// Fila: nunca más de 3 análisis de PowerShell a la vez (1 en modo bajos recursos). Lanzarlos todos juntos
// dejaba el disco al 100 % durante minutos en PCs con disco lento. El Modo Juego no hace fila.
let activos = 0;
const fila = [];
const limite = () => (cfg.ligero ? 1 : 3);
function siguiente() {
  while (fila.length && activos < limite()) { const t = fila.shift(); activos++; t.empezar(); }
}

function init(options) { cfg = { ...cfg, ...options }; }

// Algunos antivirus (p. ej. AVG/Avast) mandan a cuarentena los scripts de RetroLimpia por error.
// Lista los que faltan para avisar claro en vez de dar un error raro.
function faltantes() {
  if (cfg.demo || !cfg.scriptsDir) return [];
  const todos = ['common', ...SCRIPTS];
  return todos.filter((n) => { try { return !fs.existsSync(path.join(cfg.scriptsDir, n + '.ps1')); } catch { return false; } });
}
function errorAntivirus(nombre) {
  const e = new Error('Tu antivirus bloqueó o borró un archivo de RetroLimpia (' + nombre + '.ps1), así que esta parte no puede funcionar. ' +
    'Añade la carpeta de RetroLimpia a las excepciones de tu antivirus (o restaura el archivo desde su cuarentena) y vuelve a instalar RetroLimpia desde la web. El resto del programa sigue funcionando.');
  e.antivirus = true;
  return e;
}

function run(script, params = {}, onProgress = () => {}, opts = {}) {
  if (!SCRIPTS.has(script)) return Promise.reject(new Error('Script no permitido: ' + script));
  if (cfg.demo) return demo.run(script, params, onProgress);
  if (opts.sinCancelar || script === 'modojuego') return lanzar(script, params, onProgress, opts);
  return new Promise((resolve, reject) => {
    const t = {
      empezar: () => lanzar(script, params, onProgress, opts).then(resolve, reject).finally(() => { activos--; siguiente(); }),
      cancelar: () => reject(new Error('CANCELADO'))
    };
    fila.push(t);
    siguiente();
  });
}

function lanzar(script, params, onProgress, opts) {

  const file = path.join(cfg.scriptsDir, script + '.ps1');
  for (const n of [script, 'common']) {
    try { if (!fs.existsSync(path.join(cfg.scriptsDir, n + '.ps1'))) return Promise.reject(errorAntivirus(n)); } catch { /* seguimos */ }
  }
  const b64 = Buffer.from(JSON.stringify(params), 'utf8').toString('base64');
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', file, '-P', b64];

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, { windowsHide: true });
    if (!opts.sinCancelar) running.add(child);   // el Modo Juego automático no se corta con el botón Cancelar
    // Modo bajos recursos: el trabajo va con menos prioridad para que el PC siga respondiendo
    if (cfg.ligero && child.pid) { try { require('os').setPriority(child.pid, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* sin permiso: sigue normal */ } }
    let buffer = '';
    let result = null;
    let errText = '';
    // Se responde en cuanto el script entrega su resultado (o al cancelar), sin esperar a que se cierre:
    // algunos instaladores que lanza el script heredan su salida y la mantienen abierta muchos minutos.
    let listo = false;
    const fin = (fn, v) => { if (listo) return; listo = true; fn(v); };
    child.rechazar = (e) => fin(reject, e);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line.startsWith('@@PROGRESS ')) {
          try { onProgress(JSON.parse(line.slice(11))); } catch { /* línea incompleta */ }
        } else if (line.startsWith('@@LOG ')) {
          try { onProgress({ log: JSON.parse(line.slice(6)) }); } catch { /* línea incompleta */ }
        } else if (line.startsWith('@@RESULT ')) {
          try { result = JSON.parse(line.slice(9)); } catch (e) { errText += 'Respuesta ilegible del motor. '; }
          if (result && !child.cancelado && !child.espera) {
            // Normalmente se cierra al instante. Si algo lanzado por el script sigue enganchado, no esperamos minutos:
            // margen corto (más largo al desinstalar, para que el desinstalador termine antes de buscar restos).
            const margen = script === 'desinstalar' ? 45000 : 10000;
            child.espera = setTimeout(() => { child.terminado = true; running.delete(child); fin(resolve, result); }, margen);
          }
        }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { errText += d; });
    child.on('error', (e) => { running.delete(child); fin(reject, e); });
    child.on('close', (code) => {
      if (child.espera) clearTimeout(child.espera);
      running.delete(child);
      if (listo) return;
      if (buffer.startsWith('@@RESULT ')) { try { result = JSON.parse(buffer.slice(9)); } catch { /* nada */ } }
      if (child.cancelado) return fin(reject, new Error('CANCELADO'));
      if (!result && /-File|no existe|does not exist|CommandNotFound/i.test(errText)) {
        const falta = faltantes()[0];
        if (falta) return fin(reject, errorAntivirus(falta));
      }
      if (result) fin(resolve, result);
      else fin(reject, new Error(`El motor terminó sin respuesta (código ${code}). ${errText.slice(0, 600)}`));
    });
  });
}

// Detiene todo lo que esté en marcha, incluidos los procesos que lanzó cada script.
function cancelAll() {
  if (cfg.demo) { demo.cancel && demo.cancel(); return true; }
  // Lo que aún esperaba turno en la fila también se cancela
  for (const t of fila.splice(0)) { try { t.cancelar(); } catch { /* nada */ } }
  for (const c of running) {
    c.cancelado = true;
    try {
      if (process.platform === 'win32') execFile('taskkill', ['/PID', String(c.pid), '/T', '/F'], { windowsHide: true }, () => {});
      else c.kill();
    } catch { /* ya cerrado */ }
    // El botón Cancelar responde al momento aunque algún instalador tarde en soltar la salida
    if (c.espera) clearTimeout(c.espera);
    try { c.rechazar && c.rechazar(new Error('CANCELADO')); } catch { /* nada */ }
  }
  running.clear();
  return true;
}

function isAdmin() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);
    execFile('net', ['session'], { windowsHide: true }, (err) => resolve(!err));
  });
}

module.exports = { init, run, cancelAll, isAdmin, faltantes };
