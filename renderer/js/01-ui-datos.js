'use strict';
// ============================================================ Utilidades UI
function toast(msg, type = 'ok') {
  if (type === 'err' && typeof retroReacciona === 'function') retroReacciona('preocupado', null, 3500);
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 5200);
}
function setStatus(t) { $('#titlebarStatus').textContent = t || ''; }

// Tareas: solo una a la vez. Las de solo lectura se cancelan al instante;
// las que cambian el sistema se detienen al terminar el paso en curso (nunca a medias).
async function task(label, fn, opts = {}) {
  if (S.busy) { toast(L('Espera a que termine la tarea actual o cancélala.', 'Wait for the current task to finish or cancel it.'), 'err'); return; }
  S.cancelRequested = false;
  S.busy = { label, pct: 0, msg: '', start: Date.now(), cambios: !!opts.cambios };
  rl.setBusy && rl.setBusy(true);
  setStatus(label); render();
  try { return await fn(); }
  catch (e) {
    if (isCancel(e)) toast(L('Tarea cancelada.', 'Task cancelled.'));
    else { console.error(e); toast(L('Algo falló: ', 'Something failed: ') + cleanErr(e), 'err'); }
  }
  finally { S.busy = null; S.cancelRequested = false; rl.setBusy && rl.setBusy(false); setStatus(''); render(); }
}
const taskC = (label, fn) => task(label, fn, { cambios: true });
const isCancel = (e) => S.cancelRequested || /CANCELADO/.test(String(e && e.message || e));
function checkCancel() { if (S.cancelRequested) throw new Error('CANCELADO'); }
async function cancelTask() {
  if (!S.busy || S.cancelRequested) return;
  S.cancelRequested = true;
  if (!S.busy.cambios) await rl.cancel();   // solo lectura: se corta ya
  else S.busy.msg = L('Cancelando al terminar el paso actual (para no dejar nada a medias)...', 'Cancelling after the current step (so nothing is left half-done)...');
  render();
  if (S.mon && !S.mon.done) renderMonitor();
}
function fmtEta(start, pct) {
  const el = (Date.now() - start) / 1000;
  if (pct < 4 || el < 4) return L('Calculando tiempo...', 'Estimating time...');
  const left = Math.max(1, Math.round(el * (100 - pct) / pct));
  if (left < 60) return L(`Quedan ~${left} s`, `~${left} s left`);
  return L(`Quedan ~${Math.round(left / 60)} min`, `~${Math.round(left / 60)} min left`);
}
function progressHTML() {
  if (!S.busy) return '';
  const pct = Math.min(99, Math.round(S.busy.pct || 0));
  return `<div class="progress-card"><div class="msg"><span><b>${esc(S.busy.label)}</b>${S.busy.msg ? ' · ' + esc(S.busy.msg) : ''}</span><span class="eta">${pct ? pct + '% · ' + fmtEta(S.busy.start, pct) : ''}</span></div>
  <div class="prow"><div class="pbar ${pct ? '' : 'indet'}"><i style="width:${pct}%"></i></div>
  <button class="btn small danger" data-act="cancel" ${S.cancelRequested ? 'disabled' : ''}>${S.cancelRequested ? L('Cancelando...', 'Cancelling...') : L('Cancelar', 'Cancel')}</button></div></div>`;
}
function updateProgressOnly() {
  const card = document.querySelector('.progress-card');
  if (card && S.busy) card.outerHTML = progressHTML();
}

// ============================================================ Datos
// PowerShell a veces devuelve un objeto suelto en vez de una lista: lo normalizamos siempre.
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const obj = (x) => (x && typeof x === 'object' ? x : {});
async function loadPrograms() { const r = obj(await rl.run('programas', {})); S.programs = { programas: arr(r.programas), apps: arr(r.apps) }; S.programsAt = Date.now(); }
// Si se instala o desinstala algo FUERA de RetroLimpia (Steam, Ajustes de Windows...), la lista se
// pone al día sola: al volver a la ventana o al entrar en Programas. Es silencioso: no borra la pantalla.
let refrescandoProgs = false;
async function refreshProgramsQuiet(motivo) {
  if (!S.programs || refrescandoProgs || S.busy || (S.mon && !S.mon.done)) return;
  if (Date.now() - (S.programsAt || 0) < 15000) return;
  refrescandoProgs = true;
  try {
    const antes = new Set(allPrograms().map((p) => p.id));
    const r = obj(await rl.run('programas', {}));
    S.programs = { programas: arr(r.programas), apps: arr(r.apps) }; S.programsAt = Date.now();
    const ahora = new Set(allPrograms().map((p) => p.id));
    [...S.sel].forEach((id) => { if (!ahora.has(id)) S.sel.delete(id); });
    const quitados = [...antes].filter((id) => !ahora.has(id)).length, nuevos = [...ahora].filter((id) => !antes.has(id)).length;
    if (quitados || nuevos) {
      if (S.view === 'programas') render();
      toast(L('Lista de programas al día', 'Program list updated') + (quitados ? L(` · ${quitados} ya no está(n)`, ` · ${quitados} removed`) : '') + (nuevos ? L(` · ${nuevos} nuevo(s)`, ` · ${nuevos} new`) : ''));
    }
  } catch { /* si falla, se intenta la próxima vez */ }
  finally { refrescandoProgs = false; }
}
window.addEventListener('focus', () => refreshProgramsQuiet('foco'));
// Después de cada acción que cambia el PC, se vuelven a leer las pestañas afectadas
// (en segundo plano: no bloquea nada y la pantalla no se queda en blanco).
const REFRESH = {
  programas: ['programs', () => loadPrograms()], inicio: ['startup', () => loadStartup()],
  actualizaciones: ['updates', () => loadUpdates()], drivers: ['drivers', () => loadDrivers()],
  hardware: ['hardware', () => loadHardware()], limpieza: ['junk', () => loadJunk()], cuarentena: ['quarantine', () => loadQuarantine()]
};
const VIEW_REFRESH = { programas: 'programas', arranque: 'inicio', actualizaciones: 'actualizaciones', drivers: 'drivers', hardware: 'hardware', limpieza: 'limpieza', deshacer: 'cuarentena' };
S.refreshing = new Set();
function refreshAfter(...keys) {
  setTimeout(async () => {
    for (const k of keys) {
      const def = REFRESH[k];
      if (!def || S.refreshing.has(k)) continue;
      if (!S[def[0]]) continue;            // aún no se había abierto: se cargará al entrar
      S.refreshing.add(k); if (VIEW_REFRESH[S.view] === k) render();
      try { await def[1](); } catch { /* se reintenta al volver a entrar */ }
      finally { S.refreshing.delete(k); render(); }
    }
  }, 0);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProgramsQuiet('visible'); });
async function loadHardware() {
  const r = obj(await rl.run('hardware', {}));
  S.hardware = { ...r, equipo: obj(r.equipo), sistema: obj(r.sistema), cpu: obj(r.cpu), ram: obj(r.ram), placa: obj(r.placa), bios: obj(r.bios), gpus: arr(r.gpus), discos: arr(r.discos), unidades: arr(r.unidades), bateria: r.bateria || null };
}
async function loadDrivers() { const r = obj(await rl.run('drivers', { accion: 'revisar' })); S.drivers = { drivers: arr(r.drivers), problemas: arr(r.problemas), respaldos: arr(r.respaldos) }; }
async function loadUpdates() { const r = obj(await rl.run('actualizaciones', { accion: 'buscar' })); S.updates = { windows: arr(r.windows), apps: arr(r.apps), wingetDisponible: !!r.wingetDisponible, error: r.error || '' }; }
async function loadJunk() {
  const r = obj(await rl.run('limpieza', { accion: 'analizar' }));
  S.junk = { categorias: arr(r.categorias) };
  S.junkSel = new Set(S.junk.categorias.filter((c) => c.color === 'verde' && c.tamano > 0).map((c) => c.id));
}
async function loadStartup() { const r = obj(await rl.run('inicio', { accion: 'listar' })); S.startup = { elementos: arr(r.elementos) }; }
async function loadQuarantine() {
  const q = obj(await rl.run('cuarentena', { accion: 'listar' }));
  S.quarantine = { lotes: arr(q.lotes).map((l) => ({ ...l, items: arr(l.items) })) };
  const rp = obj(await rl.run('restauracion', { accion: 'listar' }));
  S.restorePoints = { puntos: arr(rp.puntos) };
}

function allPrograms() {
  if (!S.programs) return [];
  return [...S.programs.programas, ...S.programs.apps].map((p) => ({ ...p, cls: classifyProgram(p) }));
}

async function restorePoint(motivo) {
  if (!S.settings.puntoRestauracion) return true;
  S.busy && (S.busy.msg = L('Creando punto de restauración...', 'Creating restore point...'));
  const r = await rl.run('restauracion', { accion: 'crear', motivo });
  if (!r.ok) toast(L('No se pudo crear el punto de restauración (puede que esté desactivado en Windows). Seguimos: todo va a la cuarentena igualmente.', 'Could not create a restore point (it may be disabled). Continuing: everything still goes to quarantine.'), 'err');
  return true;
}
