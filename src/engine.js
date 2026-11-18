// Motor de RetroLimpia: ejecuta los scripts de PowerShell de /scripts
// de forma oculta (sin ventanas negras) y devuelve su resultado en JSON.
//
// Protocolo de salida de cada script:
//   @@PROGRESS {"pct":40,"msg":"..."}   -> progreso en vivo
//   @@RESULT {...}                      -> resultado final

const { spawn, execFile } = require('child_process');
const path = require('path');
const demo = require('./demo');

const SCRIPTS = new Set([
  'programas', 'desinstalar', 'residuos', 'cuarentena', 'restauracion',
  'hardware', 'drivers', 'actualizaciones', 'limpieza', 'inicio', 'procesos', 'privacidad', 'restos', 'modojuego', 'reinicios'
]);

let cfg = { demo: false, scriptsDir: '', ligero: false };
const running = new Set();

function init(options) { cfg = { ...cfg, ...options }; }

function run(script, params = {}, onProgress = () => {}, opts = {}) {
  if (!SCRIPTS.has(script)) return Promise.reject(new Error('Script no permitido: ' + script));
  if (cfg.demo) return demo.run(script, params, onProgress);

  const file = path.join(cfg.scriptsDir, script + '.ps1');
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
        }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { errText += d; });
    child.on('error', (e) => { running.delete(child); reject(e); });
    child.on('close', (code) => {
      running.delete(child);
      if (buffer.startsWith('@@RESULT ')) { try { result = JSON.parse(buffer.slice(9)); } catch { /* nada */ } }
      if (child.cancelado) return reject(new Error('CANCELADO'));
      if (result) resolve(result);
      else reject(new Error(`El motor terminó sin respuesta (código ${code}). ${errText.slice(0, 600)}`));
    });
  });
}

// Detiene todo lo que esté en marcha, incluidos los procesos que lanzó cada script.
function cancelAll() {
  if (cfg.demo) { demo.cancel && demo.cancel(); return true; }
  for (const c of running) {
    c.cancelado = true;
    try {
      if (process.platform === 'win32') execFile('taskkill', ['/PID', String(c.pid), '/T', '/F'], { windowsHide: true }, () => {});
      else c.kill();
    } catch { /* ya cerrado */ }
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

module.exports = { init, run, cancelAll, isAdmin };
