/* RetroLimpia - lógica de la interfaz.
   Todo ocurre en una sola ventana: no hay ventanas emergentes salvo la
   explicación de confianza la primera vez que se abre. */
'use strict';

// ============================================================ Estado
const S = {
  settings: {}, info: {}, data: {},
  programs: null, hardware: null, drivers: null, updates: null, junk: null, startup: null, quarantine: null, restorePoints: null,
  scan: { state: 'idle', steps: {}, findings: [], score: null, date: null },
  fix: null,
  view: 'inicio',
  busy: null,            // { label, pct, msg }
  sel: new Set(),        // selección en Programas
  progFilter: 'todos', search: '',
  junkSel: null,
  pendingResidues: null, // restos dudosos esperando revisión
  needsReboot: false,
  appUpdate: null
};

const L = (es, en) => (S.settings.idioma === 'en' ? (en ?? es) : es);
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GB = 1024 ** 3;

function fmtBytes(b) {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return (b >= 100 ? b.toFixed(0) : b.toFixed(1)).replace('.', S.settings.idioma === 'en' ? '.' : ',') + ' ' + u[i];
}
function globRe(p) { return new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); }
function yearsSince(dateStr) { if (!dateStr) return null; const d = new Date(dateStr); if (isNaN(d)) return null; return (Date.now() - d.getTime()) / (365.25 * 864e5); }
function prettyAppx(n) {
  let s = n.includes('.') ? n.split('.').slice(1).join(' ') : n;
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim() || n;
}

// ============================================================ Clasificación
function classifyProgram(p) {
  const lists = p.tipo === 'appx' ? S.data.bloat.appx : S.data.bloat.win32;
  for (const r of lists) {
    if (globRe(r.patron).test(p.nombre)) return { color: r.color, nombre: p.tipo === 'appx' ? r.nombre : p.nombre, nota: L(r.es, r.en) };
  }
  if (p.tipo === 'win32') {
    for (const r of S.data.prot.win32) if (globRe(r.patron).test(p.nombre)) return { color: 'rojo', nombre: p.nombre, nota: L(r.es, r.en) };
    return { color: null, nombre: p.nombre, nota: '' };
  }
  return { color: null, nombre: prettyAppx(p.nombre), nota: '' };
}
function classifyStartup(it) {
  const hay = it.nombre + ' ' + it.comando;
  for (const r of S.data.inicio.reglas) {
    const re = globRe(r.patron);
    if (re.test(it.nombre) || re.test(hay)) return { rec: r.rec, nota: L(r.es, r.en) };
  }
  return { rec: 'desconocido', nota: L('No lo conocemos: decide tú. Si no sabes qué es, déjalo como está.', "We don't know it: your call. If unsure, leave it as it is.") };
}
const REC = {
  desactivar: { c: 'verde', es: 'Se puede desactivar', en: 'Safe to disable' },
  opcional: { c: 'amarillo', es: 'Opcional', en: 'Optional' },
  mantener: { c: 'rojo', es: 'Mejor dejarlo', en: 'Better keep it' },
  desconocido: { c: 'gris', es: 'Desconocido', en: 'Unknown' }
};
const COLOR_TXT = {
  verde: ['Seguro quitarlo', 'Safe to remove'],
  amarillo: ['Opcional', 'Optional'],
  rojo: ['Mejor no tocar', 'Better not touch']
};
const JUNK = {
  temp_usuario: ['Archivos temporales', 'Temporary files', 'Restos que dejan los programas al trabajar.', 'Leftovers programs create while working.'],
  temp_windows: ['Temporales de Windows', 'Windows temp files', 'Archivos temporales del propio Windows.', "Windows' own temporary files."],
  wu_cache: ['Descargas de Windows Update', 'Windows Update downloads', 'Instaladores de actualizaciones que ya se aplicaron.', 'Installers of updates already applied.'],
  entrega: ['Caché de optimización de entrega', 'Delivery Optimization cache', 'Copias de actualizaciones para compartir con otros PCs.', 'Update copies shared with other PCs.'],
  informes: ['Informes de errores', 'Error reports', 'Registros de fallos que Windows guarda.', 'Crash logs Windows keeps.'],
  miniaturas: ['Miniaturas de imágenes', 'Thumbnail cache', 'Se vuelven a crear solas al abrir carpetas.', 'Rebuilt automatically when you open folders.'],
  navegadores: ['Caché de navegadores', 'Browser cache', 'Solo la caché: no borra contraseñas, historial ni sesiones. Las páginas tardarán un poco más la primera vez.', 'Cache only: passwords, history and sessions stay. Pages load a bit slower the first time.'],
  volcados: ['Volcados de memoria', 'Memory dumps', 'Archivos de pantallazos azules antiguos. Solo los usan técnicos.', 'Old blue-screen dumps. Only technicians use them.'],
  papelera: ['Papelera de reciclaje', 'Recycle Bin', 'Vacía la papelera. Revísala antes si tiene algo importante.', 'Empties the Recycle Bin. Check it first if it holds anything important.']
};
const PNP_CODES = {
  1: ['Está mal configurado.', 'Not configured correctly.'], 3: ['Su driver está dañado.', 'Its driver is corrupted.'],
  10: ['No puede arrancar.', 'Cannot start.'], 12: ['Le faltan recursos libres.', 'Not enough free resources.'],
  14: ['Necesita reiniciar el PC.', 'Needs a restart.'], 18: ['Hay que reinstalar su driver.', 'Its driver must be reinstalled.'],
  19: ['Su configuración en el registro está dañada.', 'Its registry configuration is damaged.'],
  24: ['No está presente o no funciona.', 'Not present or not working.'], 28: ['No tiene driver instalado.', 'Has no driver installed.'],
  29: ['Está desactivado en la BIOS.', 'Disabled in BIOS.'], 31: ['No funciona correctamente.', 'Not working properly.'],
  32: ['Su servicio está desactivado.', 'Its service is disabled.'], 37: ['Su driver falló al arrancar.', 'Its driver failed to start.'],
  39: ['Su driver falta o está dañado.', 'Driver missing or corrupted.'], 43: ['Windows lo detuvo porque reportó fallos.', 'Windows stopped it because it reported problems.'],
  52: ['Windows no pudo verificar la firma de su driver.', 'Windows could not verify its driver signature.']
};
const GPU_LINKS = {
  nvidia: ['NVIDIA App', 'https://www.nvidia.com/es-la/software/nvidia-app/'],
  amd: ['AMD Software: Adrenalin', 'https://www.amd.com/es/support/download/drivers.html'],
  intel: ['Intel Driver & Support Assistant', 'https://www.intel.com/content/www/us/en/support/detect.html']
};

// ============================================================ Utilidades UI
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 5200);
}
function setStatus(t) { $('#titlebarStatus').textContent = t || ''; }

async function task(label, fn) {
  if (S.busy) { toast(L('Espera a que termine la tarea actual.', 'Wait for the current task to finish.'), 'err'); return; }
  S.busy = { label, pct: 0, msg: '' };
  setStatus(label); render();
  try { return await fn(); }
  catch (e) { console.error(e); toast(L('Algo falló: ', 'Something failed: ') + (e.message || e), 'err'); }
  finally { S.busy = null; setStatus(''); render(); }
}
function progressHTML() {
  if (!S.busy) return '';
  const pct = S.busy.pct || 0;
  return `<div class="progress-card"><div class="msg"><span><b>${esc(S.busy.label)}</b>${S.busy.msg ? ' · ' + esc(S.busy.msg) : ''}</span><span>${pct ? pct + '%' : ''}</span></div>
  <div class="pbar ${pct ? '' : 'indet'}"><i style="width:${pct}%"></i></div></div>`;
}
function updateProgressOnly() {
  const card = document.querySelector('.progress-card');
  if (!card || !S.busy) return;
  card.outerHTML = progressHTML();
}

// ============================================================ Datos
async function loadPrograms() { S.programs = await rl.run('programas', {}); }
async function loadHardware() { S.hardware = await rl.run('hardware', {}); }
async function loadDrivers() { S.drivers = await rl.run('drivers', { accion: 'revisar' }); }
async function loadUpdates() { S.updates = await rl.run('actualizaciones', { accion: 'buscar' }); }
async function loadJunk() { S.junk = await rl.run('limpieza', { accion: 'analizar' }); S.junkSel = new Set(S.junk.categorias.filter((c) => c.color === 'verde' && c.tamano > 0).map((c) => c.id)); }
async function loadStartup() { S.startup = await rl.run('inicio', { accion: 'listar' }); }
async function loadQuarantine() { S.quarantine = await rl.run('cuarentena', { accion: 'listar' }); S.restorePoints = await rl.run('restauracion', { accion: 'listar' }); }

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

// ============================================================ Consejos y nota de salud
function hardwareAdvice(hw) {
  const out = [];
  if (!hw) return out;
  const add = (nivel, es, en) => out.push({ nivel, t: L(es, en) });
  for (const d of hw.discos || []) {
    if (d.salud && d.salud !== 'Healthy') add('importante', `El disco "${d.nombre}" muestra señales de fallo. Haz una copia de tus archivos importantes cuanto antes y piensa en cambiarlo.`, `Disk "${d.nombre}" shows signs of failure. Back up your important files as soon as possible and consider replacing it.`);
    if (d.desgaste != null && d.desgaste >= 80) add('importante', `El SSD "${d.nombre}" está gastado al ${d.desgaste}%. Planea reemplazarlo pronto.`, `SSD "${d.nombre}" is ${d.desgaste}% worn. Plan to replace it soon.`);
    else if (d.desgaste != null && d.desgaste >= 50) add('recomendado', `El SSD "${d.nombre}" lleva un ${d.desgaste}% de desgaste. Todavía va bien, pero conviene tener copias.`, `SSD "${d.nombre}" is ${d.desgaste}% worn. Still fine, but keep backups.`);
    if (d.temperatura && d.temperatura >= 65) add('recomendado', `El disco "${d.nombre}" está a ${d.temperatura} °C. Revisa que le llegue aire.`, `Disk "${d.nombre}" is at ${d.temperatura} °C. Check its airflow.`);
  }
  for (const v of hw.unidades || []) {
    const pct = v.total ? v.libre / v.total : 1;
    if (pct < 0.1) add('importante', `A la unidad ${v.letra} solo le queda ${fmtBytes(v.libre)} libre (${Math.round(pct * 100)}%). Windows se vuelve lento con menos de un 10%.`, `Drive ${v.letra} has only ${fmtBytes(v.libre)} free (${Math.round(pct * 100)}%). Windows slows down below 10%.`);
    else if (pct < 0.2) add('recomendado', `A la unidad ${v.letra} le queda poco espacio (${fmtBytes(v.libre)}).`, `Drive ${v.letra} is getting full (${fmtBytes(v.libre)} free).`);
  }
  const s = hw.sistema || {};
  if (s.build && s.build < 22000) add('importante', 'Usas Windows 10, que ya no recibe actualizaciones de seguridad gratuitas desde octubre de 2025. Si tu PC lo permite, pasa a Windows 11.', 'You are on Windows 10, which stopped getting free security updates in October 2025. Upgrade to Windows 11 if your PC supports it.');
  if (s.diasEncendido >= 7) add('opcional', `Tu PC lleva ${Math.round(s.diasEncendido)} días sin reiniciarse. Reiniciar de vez en cuando aplica actualizaciones y libera memoria.`, `Your PC hasn't restarted in ${Math.round(s.diasEncendido)} days. Restarting now and then applies updates and frees memory.`);
  const ram = hw.ram || {};
  if (ram.total && ram.total < 7.5 * GB) add('recomendado', `Tienes ${fmtBytes(ram.total)} de RAM. Para usar Windows 11 con fluidez se recomiendan 16 GB.`, `You have ${fmtBytes(ram.total)} of RAM. 16 GB is recommended for a smooth Windows 11.`);
  for (const g of hw.gpus || []) {
    if (g.temp && g.temp >= 85) add('importante', `La gráfica está a ${g.temp} °C. Limpia el polvo de los ventiladores.`, `The GPU is at ${g.temp} °C. Clean the dust from its fans.`);
    const y = yearsSince(g.fechaDriver);
    if (y != null && y > 0.5) add('recomendado', `El driver de tu ${g.nombre} tiene más de ${y >= 1 ? Math.floor(y) + (Math.floor(y) === 1 ? ' año' : ' años') : '6 meses'}. Actualízalo desde la app oficial (sección Drivers).`, `Your ${g.nombre} driver is over ${y >= 1 ? Math.floor(y) + ' year(s)' : '6 months'} old. Update it from the official app (Drivers section).`);
  }
  if (hw.cpu && hw.cpu.temp && hw.cpu.temp >= 90) add('importante', `El procesador está a ${hw.cpu.temp} °C. Revisa la ventilación y la pasta térmica.`, `The CPU is at ${hw.cpu.temp} °C. Check cooling and thermal paste.`);
  const by = yearsSince(hw.bios && hw.bios.fecha);
  if (by != null && by > 2) add('opcional', `La BIOS de tu placa (${hw.placa.modelo}) es de ${hw.bios.fecha.slice(0, 4)}. Si tienes problemas de estabilidad, mira en la web de ${hw.placa.fabricante} si hay una más nueva. No la actualices si todo funciona bien.`, `Your motherboard BIOS (${hw.placa.modelo}) is from ${hw.bios.fecha.slice(0, 4)}. If you have stability issues, check ${hw.placa.fabricante}'s website. Don't update it if everything works.`);
  if (hw.bateria && hw.bateria.salud && hw.bateria.salud < 70) add('recomendado', `La batería conserva el ${hw.bateria.salud}% de su capacidad original.`, `The battery keeps ${hw.bateria.salud}% of its original capacity.`);
  return out;
}

function buildFindings() {
  const f = [];
  const add = (o) => f.push({ elegido: o.nivel !== 'opcional' && !!o.accion, ...o });
  // Hardware
  for (const a of hardwareAdvice(S.hardware)) add({ id: 'hw' + f.length, nivel: a.nivel, titulo: a.t, detalle: '', accion: null, ir: 'hardware' });
  // Drivers con problemas
  const prob = (S.drivers?.problemas || []).filter((p) => p.codigo !== 45);
  if (prob.length) add({ id: 'pnp', nivel: 'importante', titulo: L(`${prob.length} dispositivo(s) no funcionan bien`, `${prob.length} device(s) are not working properly`), detalle: prob.map((p) => p.dispositivo).join(', '), accion: null, ir: 'drivers' });
  // Actualizaciones
  const wu = S.updates?.windows || [];
  const wuImp = wu.filter((u) => !u.opcional && !u.grande);
  const wuDrv = wu.filter((u) => u.tipo === 'driver');
  if (wuImp.length || wuDrv.length) add({ id: 'wu', nivel: wuImp.some((u) => u.tipo === 'seguridad') ? 'importante' : 'recomendado', titulo: L(`Instalar ${wuImp.length + wuDrv.filter((u) => u.opcional).length} actualización(es) oficiales de Windows y drivers`, `Install ${wuImp.length + wuDrv.filter((u) => u.opcional).length} official Windows and driver update(s)`), detalle: L('Desde Windows Update, la fuente oficial de Microsoft.', 'From Windows Update, Microsoft\'s official source.'), accion: 'wu' });
  const apps = S.updates?.apps || [];
  if (apps.length) add({ id: 'apps', nivel: 'recomendado', titulo: L(`Actualizar ${apps.length} programa(s)`, `Update ${apps.length} program(s)`), detalle: apps.slice(0, 5).map((a) => a.nombre).join(', ') + (apps.length > 5 ? '…' : ''), accion: 'apps' });
  // Basura
  if (S.junk) {
    const verde = S.junk.categorias.filter((c) => c.color === 'verde');
    const total = verde.reduce((a, c) => a + c.tamano, 0);
    if (total > 300 * 1024 ** 2) add({ id: 'junk', nivel: total > 5 * GB ? 'recomendado' : 'opcional', titulo: L(`Liberar ${fmtBytes(total)} de archivos basura`, `Free ${fmtBytes(total)} of junk files`), detalle: L('Temporales y cachés. No toca tus documentos.', 'Temp files and caches. Your documents are not touched.'), accion: 'junk', elegido: true });
  }
  // Bloatware
  const bloat = allPrograms().filter((p) => p.cls.color === 'verde');
  if (bloat.length) add({ id: 'bloat', nivel: 'recomendado', titulo: L(`Quitar ${bloat.length} programa(s) basura preinstalados`, `Remove ${bloat.length} preinstalled bloatware app(s)`), detalle: bloat.slice(0, 6).map((p) => p.cls.nombre).join(', ') + (bloat.length > 6 ? '…' : ''), accion: 'bloat' });
  // Arranque
  const st = (S.startup?.elementos || []).filter((i) => i.activo && classifyStartup(i).rec === 'desactivar');
  if (st.length) add({ id: 'startup', nivel: 'recomendado', titulo: L(`Hacer que Windows arranque más rápido (${st.length} programa(s) innecesarios al inicio)`, `Make Windows start faster (${st.length} unneeded startup program(s))`), detalle: st.map((i) => i.nombre).join(', '), accion: 'startup' });
  const order = { importante: 0, recomendado: 1, opcional: 2 };
  f.sort((a, b) => order[a.nivel] - order[b.nivel]);
  return f;
}

function computeScore() {
  let s = 100;
  const hw = S.hardware;
  if (hw) {
    for (const d of hw.discos || []) { if (d.salud && d.salud !== 'Healthy') s -= 25; if (d.desgaste >= 80) s -= 15; }
    for (const v of hw.unidades || []) { const p = v.total ? v.libre / v.total : 1; if (p < 0.1) s -= 12; else if (p < 0.2) s -= 5; }
    if (hw.sistema?.build && hw.sistema.build < 22000) s -= 12;
    if (hw.sistema?.diasEncendido >= 7) s -= 3;
  }
  s -= Math.min(20, ((S.drivers?.problemas || []).filter((p) => p.codigo !== 45).length) * 8);
  const wu = (S.updates?.windows || []).filter((u) => !u.opcional && !u.grande);
  if (wu.some((u) => u.tipo === 'seguridad')) s -= 10; else if (wu.length) s -= 5;
  s -= Math.min(6, (S.updates?.apps || []).length);
  if (S.junk) { const t = S.junk.categorias.filter((c) => c.color === 'verde').reduce((a, c) => a + c.tamano, 0); if (t > 5 * GB) s -= 8; else if (t > 1 * GB) s -= 4; }
  const b = allPrograms().filter((p) => p.cls.color === 'verde').length; s -= Math.min(8, b);
  const st = (S.startup?.elementos || []).filter((i) => i.activo && classifyStartup(i).rec === 'desactivar').length; s -= Math.min(6, st * 1.5);
  return Math.max(5, Math.min(100, Math.round(s)));
}
function scoreLabel(n) {
  if (n >= 85) return L('Muy bien', 'Great');
  if (n >= 65) return L('Mejorable', 'Could be better');
  if (n >= 45) return L('Necesita atención', 'Needs attention');
  return L('Necesita ayuda', 'Needs help');
}

// ============================================================ Acciones principales
const SCAN_STEPS = [
  ['hardware', 'Leyendo tu hardware y la salud de los discos', 'Reading your hardware and disk health', loadHardware],
  ['drivers', 'Revisando drivers y dispositivos', 'Checking drivers and devices', loadDrivers],
  ['programas', 'Buscando programas y bloatware', 'Looking for programs and bloatware', loadPrograms],
  ['limpieza', 'Midiendo archivos basura', 'Measuring junk files', loadJunk],
  ['inicio', 'Revisando lo que arranca con Windows', 'Checking startup programs', loadStartup],
  ['updates', 'Buscando actualizaciones oficiales', 'Looking for official updates', loadUpdates]
];

async function scanAll() {
  S.view = 'inicio';
  S.scan = { state: 'running', steps: {}, findings: [], score: null };
  await task(L('Revisando tu PC', 'Checking your PC'), async () => {
    for (const [id, , , fn] of SCAN_STEPS) {
      S.scan.steps[id] = 'run'; render();
      try { await fn(); S.scan.steps[id] = 'ok'; }
      catch (e) { console.error(e); S.scan.steps[id] = 'err'; }
      render();
    }
    S.scan.findings = buildFindings();
    S.scan.score = computeScore();
    S.scan.state = 'done';
    S.scan.date = new Date();
  });
}

async function uninstallPrograms(list, motivo) {
  // list: programas ya clasificados. Devuelve resumen.
  const res = { ok: 0, fail: [], restosMovidos: 0, bytes: 0, dudosos: [], reinicio: false };
  await restorePoint(motivo);
  let i = 0;
  for (const p of list) {
    i++;
    if (S.busy) { S.busy.label = L(`Desinstalando (${i}/${list.length})`, `Uninstalling (${i}/${list.length})`); S.busy.msg = p.cls.nombre; S.busy.pct = Math.round(((i - 1) / list.length) * 100); updateProgressOnly(); setStatus(S.busy.label + ' · ' + p.cls.nombre); }
    const r = await rl.run('desinstalar', { ...p, cls: undefined, etiqueta: p.cls.nombre, permitirVentana: true });
    if (r.reinicio) res.reinicio = true;
    if (!r.ok) { res.fail.push(p.cls.nombre); continue; }
    res.ok++;
    if (p.tipo === 'win32') {
      const rr = await rl.run('residuos', { nombre: p.nombre, editor: p.editor, carpeta: p.carpeta, clave: p.clave });
      const altos = rr.restos.filter((x) => x.confianza === 'alta');
      const dudosos = rr.restos.filter((x) => x.confianza !== 'alta');
      if (S.settings.restosAutomaticos && altos.length) {
        const q = await rl.run('cuarentena', { accion: 'mover', items: altos, motivo: L('Restos de ', 'Leftovers of ') + p.nombre });
        res.restosMovidos += q.guardados; res.bytes += q.bytes || 0;
      } else dudosos.unshift(...altos);
      if (dudosos.length) res.dudosos.push({ programa: p.nombre, restos: dudosos.map((d) => ({ ...d, elegido: d.confianza === 'alta' })) });
    }
  }
  if (res.reinicio) S.needsReboot = true;
  return res;
}

async function fixAll() {
  const chosen = S.scan.findings.filter((f) => f.elegido && f.accion);
  if (!chosen.length) { toast(L('No hay nada seleccionado para arreglar.', 'Nothing selected to fix.'), 'err'); return; }
  S.fix = { steps: chosen.map((f) => ({ id: f.accion, titulo: f.titulo, state: 'wait', extra: '' })), done: false, summary: [] };
  await task(L('Arreglando tu PC', 'Fixing your PC'), async () => {
    S.busy.msg = L('Creando punto de restauración...', 'Creating restore point...'); render();
    await rl.run('restauracion', { accion: 'crear', motivo: L('Antes de arreglar todo', 'Before fix all') }).catch(() => {});
    const saved = S.settings.puntoRestauracion; S.settings.puntoRestauracion = false; // ya creado
    try {
      for (const st of S.fix.steps) {
        st.state = 'run'; render();
        try {
          if (st.id === 'junk') {
            const cats = S.junk.categorias.filter((c) => c.color === 'verde' && c.tamano > 0).map((c) => c.id);
            const r = await rl.run('limpieza', { accion: 'limpiar', categorias: cats });
            st.extra = L('Liberado ', 'Freed ') + fmtBytes(r.liberado);
          } else if (st.id === 'bloat') {
            const list = allPrograms().filter((p) => p.cls.color === 'verde');
            const r = await uninstallPrograms(list, L('Quitar bloatware', 'Remove bloatware'));
            st.extra = L(`${r.ok} quitados`, `${r.ok} removed`) + (r.fail.length ? L(`, ${r.fail.length} no se pudieron`, `, ${r.fail.length} failed`) : '');
            if (r.dudosos.length) S.pendingResidues = r.dudosos;
          } else if (st.id === 'startup') {
            const list = S.startup.elementos.filter((i) => i.activo && classifyStartup(i).rec === 'desactivar');
            for (const it of list) await rl.run('inicio', { accion: 'cambiar', id: it.id, activar: false });
            st.extra = L(`${list.length} desactivados`, `${list.length} disabled`);
          } else if (st.id === 'wu') {
            const r = await rl.run('actualizaciones', { accion: 'instalarWU', todos: true });
            const ok = r.resultados.filter((x) => x.ok).length;
            st.extra = L(`${ok} de ${r.resultados.length} instaladas`, `${ok} of ${r.resultados.length} installed`);
            if (r.reinicio) S.needsReboot = true;
          } else if (st.id === 'apps') {
            const r = await rl.run('actualizaciones', { accion: 'winget', todos: true });
            st.extra = L(`${r.resultados.filter((x) => x.ok).length} actualizados`, `${r.resultados.filter((x) => x.ok).length} updated`);
          }
          st.state = 'ok';
        } catch (e) { console.error(e); st.state = 'err'; st.extra = String(e.message || e).slice(0, 80); }
        render();
      }
    } finally { S.settings.puntoRestauracion = saved; }
    S.fix.done = true;
    // Re-escaneo rápido para actualizar la nota
    S.busy.label = L('Volviendo a medir', 'Measuring again'); S.busy.msg = ''; render();
    await Promise.allSettled([loadJunk(), loadPrograms(), loadStartup()]);
    S.updates = S.updates ? { ...S.updates, windows: [], apps: [] } : S.updates;
    S.scan.findings = buildFindings(); S.scan.score = computeScore();
  });
  toast(L('¡Listo! Tu PC está más limpio.', 'Done! Your PC is cleaner.'));
}

// ============================================================ Vistas
const ICONS = {
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  programas: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/>',
  limpieza: '<path d="M14 3l7 7M4 20l7-7M9.5 8.5l6 6-2.5 5.5-9-9z"/><path d="M5 4v3M3.5 5.5h3"/>',
  arranque: '<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  hardware: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  drivers: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
  actualizaciones: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const NAV = [
  ['inicio', 'Revisar mi PC', 'Check my PC'],
  ['programas', 'Programas y bloatware', 'Programs & bloatware'],
  ['limpieza', 'Limpieza', 'Cleanup'],
  ['arranque', 'Arranque de Windows', 'Windows startup'],
  'sep',
  ['hardware', 'Hardware y salud', 'Hardware & health'],
  ['drivers', 'Drivers', 'Drivers'],
  ['actualizaciones', 'Actualizaciones', 'Updates'],
  'sep',
  ['deshacer', 'Deshacer y cuarentena', 'Undo & quarantine'],
  ['ajustes', 'Ajustes', 'Settings']
];

function navCount(id) {
  if (id === 'programas' && S.programs) { const n = allPrograms().filter((p) => p.cls.color === 'verde').length; return n ? [n, ''] : null; }
  if (id === 'limpieza' && S.junk) { const t = S.junk.categorias.reduce((a, c) => a + c.tamano, 0); return t > 0 ? [fmtBytes(t), ''] : null; }
  if (id === 'drivers' && S.drivers) { const n = S.drivers.problemas.filter((p) => p.codigo !== 45).length; return n ? [n, 'alerta'] : null; }
  if (id === 'actualizaciones' && S.updates) { const n = S.updates.windows.length + S.updates.apps.length; return n ? [n, ''] : null; }
  if (id === 'hardware' && S.hardware) { const n = hardwareAdvice(S.hardware).filter((a) => a.nivel === 'importante').length; return n ? [n, 'alerta'] : null; }
  return null;
}
function renderNav() {
  $('#nav').innerHTML = NAV.map((n) => {
    if (n === 'sep') return '<div class="nav-sep"></div>';
    const [id, es, en] = n; const c = navCount(id);
    return `<button class="nav-item ${S.view === id ? 'active' : ''}" data-nav="${id}"><svg viewBox="0 0 24 24">${ICONS[id]}</svg><span>${L(es, en)}</span>${c ? `<span class="count ${c[1]}">${esc(c[0])}</span>` : ''}</button>`;
  }).join('') + `<div class="nav-foot"><div class="trust">${L('Sin telemetría · Código abierto', 'No telemetry · Open source')}</div>${L('Todo lo que borra se puede deshacer.', 'Everything it removes can be undone.')}</div>`;
}

function head(title, desc, right = '') {
  return `<div class="view-head"><div><h1>${title}</h1><p>${desc}</p></div><div>${right}</div></div>`;
}
function banners() {
  let h = '';
  if (S.info.demo) h += `<div class="banner info"><div class="grow"><b>${L('Modo demostración', 'Demo mode')}</b> · ${L('Los datos son de ejemplo y no se cambia nada en este equipo.', 'Sample data; nothing on this computer is changed.')}</div></div>`;
  if (!S.info.esAdmin) h += `<div class="banner warn"><div class="grow"><b>${L('Abre RetroLimpia como administrador', 'Run RetroLimpia as administrator')}</b> · ${L('Sin permisos de administrador no puede desinstalar ni actualizar drivers. Ciérralo, haz clic derecho en su icono y elige "Ejecutar como administrador".', 'Without admin rights it cannot uninstall or update drivers. Close it, right-click its icon and choose "Run as administrator".')}</div></div>`;
  if (S.needsReboot) h += `<div class="banner warn"><div class="grow"><b>${L('Reinicia el PC cuando puedas', 'Restart your PC when you can')}</b> · ${L('Algunas actualizaciones o desinstalaciones terminan al reiniciar.', 'Some updates or uninstalls finish after a restart.')}</div></div>`;
  if (S.appUpdate?.disponible) h += `<div class="banner good"><div class="grow"><b>${L('Hay una versión nueva de RetroLimpia', 'A new RetroLimpia version is available')} (${esc(S.appUpdate.version)})</b></div><button class="btn small" data-open="${esc(S.appUpdate.url)}">${L('Descargar', 'Download')}</button></div>`;
  return h;
}

function viewInicio() {
  const sc = S.scan;
  const score = sc.score;
  const C = 2 * Math.PI * 80;
  const ring = `<div class="ring"><svg viewBox="0 0 190 190"><defs><linearGradient id="ringGrad" x1="0" x2="1"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".5" stop-color="#b14dff"/><stop offset="1" stop-color="#2de2e6"/></linearGradient></defs>
    <circle class="track" cx="95" cy="95" r="80" fill="none" stroke-width="14"/>
    <circle class="bar" cx="95" cy="95" r="80" fill="none" stroke-width="14" stroke-dasharray="${C}" stroke-dashoffset="${score == null ? C : C * (1 - score / 100)}"/></svg>
    <div class="val"><div><div class="num">${score == null ? '—' : score}</div><div class="lbl">${score == null ? L('Salud del PC', 'PC health') : scoreLabel(score)}</div></div></div></div>`;

  let body = '';
  if (sc.state === 'idle') {
    body = `<div class="hero"><div class="hero-text">
      <h1>${L('Deja tu PC como nuevo', 'Make your PC feel new again')}</h1>
      <p>${L('Pulsa el botón y RetroLimpia revisa todo: programas basura, archivos inútiles, drivers, actualizaciones y la salud de tus discos. No cambia nada hasta que tú lo confirmes.', 'Press the button and RetroLimpia checks everything: bloatware, junk files, drivers, updates and disk health. Nothing changes until you confirm.')}</p>
      <button class="btn primary big" data-act="scan" ${S.busy ? 'disabled' : ''}>${L('Revisar mi PC', 'Check my PC')}</button>
      <div class="note">${L('Tarda de 1 a 4 minutos.', 'Takes 1 to 4 minutes.')}</div></div>${ring}</div>`;
  } else if (sc.state === 'running') {
    body = `<div class="hero"><div class="hero-text"><h1>${L('Revisando tu PC...', 'Checking your PC...')}</h1><p>${L('Puedes seguir usando el PC mientras tanto.', 'You can keep using your PC meanwhile.')}</p></div>${ring}</div>
      <div class="stepper">${SCAN_STEPS.map(([id, es, en]) => `<div class="step ${sc.steps[id] || ''}"><span class="dot"></span>${L(es, en)}</div>`).join('')}</div>`;
  } else {
    const fx = S.fix;
    if (fx) {
      body = `<div class="hero"><div class="hero-text"><h1>${fx.done ? L('¡Listo!', 'Done!') : L('Arreglando tu PC...', 'Fixing your PC...')}</h1><p>${fx.done ? L('Todo lo que se quitó está en la cuarentena unos días por si quieres deshacerlo.', 'Everything removed stays in quarantine for a few days in case you want to undo it.') : L('No apagues el PC. Esto puede tardar varios minutos si hay actualizaciones.', "Don't turn off your PC. This may take several minutes if there are updates.")}</p>
        ${fx.done ? `<button class="btn" data-act="closeFix">${L('Ver el resumen', 'See summary')}</button> <button class="btn ghost" data-act="report">${L('Guardar informe', 'Save report')}</button>` : ''}</div>${ring}</div>
        <div class="stepper">${fx.steps.map((s) => `<div class="step ${s.state === 'wait' ? '' : s.state}"><span class="dot"></span>${esc(s.titulo)}<span class="extra">${esc(s.extra)}</span></div>`).join('')}</div>`;
    } else {
      const fs = sc.findings;
      const chosen = fs.filter((f) => f.elegido && f.accion).length;
      body = `<div class="hero"><div class="hero-text">
        <h1>${fs.length ? L(`Encontramos ${fs.length} cosa(s) para mejorar`, `We found ${fs.length} thing(s) to improve`) : L('¡Tu PC está en muy buen estado!', 'Your PC is in great shape!')}</h1>
        <p>${fs.length ? L('Ya marcamos lo recomendado. Revísalo si quieres, o pulsa "Arreglar todo".', "We've already ticked what we recommend. Review it if you like, or press \"Fix all\".") : L('No hay nada importante que arreglar ahora mismo.', 'Nothing important to fix right now.')}</p>
        <button class="btn ghost" data-act="scan" ${S.busy ? 'disabled' : ''}>${L('Volver a revisar', 'Check again')}</button> <button class="btn ghost" data-act="report">${L('Guardar informe', 'Save report')}</button></div>${ring}</div>
        ${fs.length ? `<h2>${L('Lo que encontramos', 'What we found')}</h2>` : ''}
        ${fs.map((f) => `<div class="finding ${f.nivel}">
          ${f.accion ? `<input type="checkbox" class="check" data-finding="${f.id}" ${f.elegido ? 'checked' : ''}>` : '<span style="width:20px"></span>'}
          <div class="txt"><div class="t">${esc(f.titulo)}</div>${f.detalle ? `<div class="d">${esc(f.detalle)}</div>` : ''}</div>
          <span class="badge ${f.nivel === 'importante' ? 'rojo' : f.nivel === 'recomendado' ? 'amarillo' : 'gris'}">${f.nivel === 'importante' ? L('Importante', 'Important') : f.nivel === 'recomendado' ? L('Recomendado', 'Recommended') : L('Opcional', 'Optional')}</span>
          <button class="btn small ghost" data-nav="${f.ir || ({ junk: 'limpieza', bloat: 'programas', startup: 'arranque', wu: 'actualizaciones', apps: 'actualizaciones' })[f.accion] || 'inicio'}">${L('Ver', 'View')}</button></div>`).join('')}
        ${chosen ? `<div class="actionbar"><div class="info">${L(`<b>${chosen}</b> mejora(s) seleccionadas. Antes crearemos un punto de restauración.`, `<b>${chosen}</b> improvement(s) selected. A restore point is created first.`)}</div>
          <button class="btn" data-nav="programas">${L('Elegir yo qué arreglar', 'Let me choose')}</button>
          <button class="btn primary" data-act="fixAll" ${S.busy ? 'disabled' : ''}>${L('Arreglar todo', 'Fix all')}</button></div>` : ''}`;
    }
  }
  return `<div class="view">${banners()}${body}</div>`;
}

function residuesReviewHTML() {
  if (!S.pendingResidues?.length) return '';
  return `<div class="card" style="margin-bottom:18px;border-color:var(--amarillo)"><h3>${L('Revisa estos posibles restos', 'Review these possible leftovers')}</h3>
    <p class="meta">${L('No estamos 100% seguros de que sean del programa que quitaste. Marca solo lo que reconozcas. Irá a la cuarentena, no se borra todavía.', "We're not 100% sure they belong to the program you removed. Only tick what you recognise. It goes to quarantine, nothing is deleted yet.")}</p>
    ${S.pendingResidues.map((g, gi) => `<div style="margin-top:12px"><b>${esc(g.programa)}</b><div class="list" style="margin-top:6px">${g.restos.map((r, ri) => `<div class="row"><input type="checkbox" class="check" data-res="${gi}:${ri}" ${r.elegido ? 'checked' : ''}><div class="grow"><div class="name">${esc(r.ruta)}</div><div class="sub">${r.tipo === 'registro' ? L('Entrada del registro', 'Registry entry') : r.tipo === 'carpeta' ? L('Carpeta', 'Folder') : L('Archivo', 'File')} · ${r.confianza === 'alta' ? L('casi seguro', 'very likely') : L('posible', 'possible')}</div></div><div class="size">${r.tamano ? fmtBytes(r.tamano) : ''}</div></div>`).join('')}</div></div>`).join('')}
    <div style="margin-top:14px;display:flex;gap:10px"><button class="btn primary" data-act="moveResidues">${L('Mover lo marcado a la cuarentena', 'Move ticked items to quarantine')}</button><button class="btn ghost" data-act="skipResidues">${L('Dejarlo como está', 'Leave it')}</button></div></div>`;
}

function viewProgramas() {
  if (!S.programs) return loadingView(L('Programas y bloatware', 'Programs & bloatware'), loadPrograms);
  const all = allPrograms();
  const q = S.search.toLowerCase();
  const filt = all.filter((p) => {
    if (q && !(p.cls.nombre + ' ' + p.editor + ' ' + p.nombre).toLowerCase().includes(q)) return false;
    switch (S.progFilter) {
      case 'verde': return p.cls.color === 'verde';
      case 'amarillo': return p.cls.color === 'amarillo';
      case 'store': return p.tipo === 'appx';
      case 'clasicos': return p.tipo === 'win32';
      default: return S.settings.modoExperto || p.tipo === 'win32' || p.cls.color;
    }
  });
  const rank = { verde: 0, amarillo: 1, null: 2, rojo: 3 };
  filt.sort((a, b) => (rank[a.cls.color] - rank[b.cls.color]) || a.cls.nombre.localeCompare(b.cls.nombre));
  const selList = all.filter((p) => S.sel.has(p.id));
  const selSize = selList.reduce((a, p) => a + (p.tamano || 0), 0);
  const chips = [['todos', 'Todos', 'All'], ['verde', 'Seguro quitar', 'Safe to remove'], ['amarillo', 'Opcionales', 'Optional'], ['clasicos', 'Programas', 'Programs'], ['store', 'Apps de la Store', 'Store apps']];
  const nVerde = all.filter((p) => p.cls.color === 'verde').length;
  return `<div class="view">${banners()}${head(L('Programas y bloatware', 'Programs & bloatware'), L('Desinstala sin ventanas y sin dejar restos. Los colores te dicen qué es seguro quitar.', 'Uninstall without pop-ups and without leftovers. Colours tell you what is safe to remove.'), nVerde ? `<button class="btn" data-act="selVerde">${L(`Marcar los ${nVerde} recomendados`, `Tick the ${nVerde} recommended`)}</button>` : '')}
    ${progressHTML()}${residuesReviewHTML()}
    <div class="toolbar"><input class="search" id="search" placeholder="${L('Buscar un programa...', 'Search a program...')}" value="${esc(S.search)}">
      ${chips.map(([id, es, en]) => `<button class="chip ${S.progFilter === id ? 'on' : ''}" data-filter="${id}">${L(es, en)}</button>`).join('')}</div>
    <div class="list">${filt.length ? filt.map((p) => {
      const blocked = p.cls.color === 'rojo' && !S.settings.modoExperto;
      return `<label class="row ${blocked ? 'disabled' : ''}"><input type="checkbox" class="check" data-sel="${esc(p.id)}" ${S.sel.has(p.id) ? 'checked' : ''} ${blocked ? 'disabled' : ''}>
        <div class="grow"><div class="name">${esc(p.cls.nombre)}</div><div class="sub">${esc(p.cls.nota || [p.editor, p.version].filter(Boolean).join(' · '))}</div>
        ${S.settings.modoExperto ? `<div class="tech">${esc(p.tipo === 'appx' ? p.paquete : (p.desinstalarSilencioso || p.desinstalar))}</div>` : ''}</div>
        ${p.cls.color ? `<span class="badge ${p.cls.color}">${L(...COLOR_TXT[p.cls.color])}</span>` : ''}
        ${p.tipo === 'appx' ? `<span class="badge gris">Store</span>` : ''}
        <div class="size">${p.tamano ? fmtBytes(p.tamano) : ''}</div></label>`;
    }).join('') : `<div class="empty">${L('No hay programas que coincidan.', 'No matching programs.')}</div>`}</div>
    ${S.sel.size ? `<div class="actionbar"><div class="info">${L(`<b>${S.sel.size}</b> seleccionado(s)`, `<b>${S.sel.size}</b> selected`)}${selSize ? ' · ' + fmtBytes(selSize) : ''}. ${L('Se buscarán sus restos al terminar.', 'Leftovers will be searched afterwards.')}</div>
      <button class="btn ghost" data-act="selNone">${L('Quitar selección', 'Clear')}</button>
      <button class="btn primary" data-act="uninstallSel" ${S.busy ? 'disabled' : ''}>${L('Desinstalar', 'Uninstall')} (${S.sel.size})</button></div>` : ''}</div>`;
}

function viewLimpieza() {
  if (!S.junk) return loadingView(L('Limpieza', 'Cleanup'), loadJunk);
  const cats = S.junk.categorias;
  const total = cats.filter((c) => S.junkSel.has(c.id)).reduce((a, c) => a + c.tamano, 0);
  return `<div class="view">${banners()}${head(L('Limpieza', 'Cleanup'), L('Borra archivos que no sirven para nada. Nunca toca tus documentos, fotos, contraseñas ni historial.', 'Deletes useless files. Never touches your documents, photos, passwords or history.'), `<button class="btn ghost" data-act="reloadJunk">${L('Volver a medir', 'Measure again')}</button>`)}
    ${progressHTML()}
    <div class="list">${cats.map((c) => { const [es, en, des, den] = JUNK[c.id] || [c.id, c.id, '', '']; return `<label class="row ${c.tamano ? '' : 'disabled'}"><input type="checkbox" class="check" data-junk="${c.id}" ${S.junkSel.has(c.id) ? 'checked' : ''} ${c.tamano ? '' : 'disabled'}>
      <div class="grow"><div class="name">${L(es, en)}</div><div class="note">${L(des, den)}</div></div>
      <span class="badge ${c.color}">${c.color === 'verde' ? L('Seguro', 'Safe') : L('Revisa antes', 'Check first')}</span><div class="size">${fmtBytes(c.tamano)}</div></label>`; }).join('')}</div>
    <div class="actionbar"><div class="info">${L('Seleccionado:', 'Selected:')} <b>${fmtBytes(total)}</b></div>
      <button class="btn primary" data-act="clean" ${!total || S.busy ? 'disabled' : ''}>${L('Liberar ', 'Free ')}${fmtBytes(total)}</button></div></div>`;
}

function viewArranque() {
  if (!S.startup) return loadingView(L('Arranque de Windows', 'Windows startup'), loadStartup);
  const items = S.startup.elementos.map((i) => ({ ...i, c: classifyStartup(i) }));
  const rank = { desactivar: 0, opcional: 1, desconocido: 2, mantener: 3 };
  items.sort((a, b) => rank[a.c.rec] - rank[b.c.rec] || a.nombre.localeCompare(b.nombre));
  const pend = items.filter((i) => i.activo && i.c.rec === 'desactivar').length;
  const active = items.filter((i) => i.activo).length;
  return `<div class="view">${banners()}${head(L('Arranque de Windows', 'Windows startup'), L(`${active} programa(s) se abren solos al encender el PC. Menos programas = Windows arranca más rápido. Desactivar no borra nada.`, `${active} program(s) open by themselves at boot. Fewer programs = faster startup. Disabling deletes nothing.`))}
    ${progressHTML()}
    <div class="list">${items.length ? items.map((i) => `<div class="row"><div class="grow"><div class="name">${esc(i.nombre)}</div><div class="sub">${esc(i.c.nota)}</div>${S.settings.modoExperto ? `<div class="tech">${esc(i.comando)}</div>` : ''}</div>
      <span class="badge ${REC[i.c.rec].c}">${L(REC[i.c.rec].es, REC[i.c.rec].en)}</span>
      <label class="switch" title="${i.activo ? L('Activo', 'Enabled') : L('Desactivado', 'Disabled')}"><input type="checkbox" data-startup="${esc(i.id)}" ${i.activo ? 'checked' : ''} ${S.busy ? 'disabled' : ''}><span></span></label></div>`).join('') : `<div class="empty">${L('No hay programas al inicio.', 'No startup programs.')}</div>`}</div>
    ${pend ? `<div class="actionbar"><div class="info">${L(`<b>${pend}</b> se pueden desactivar sin problema.`, `<b>${pend}</b> can be safely disabled.`)}</div><button class="btn primary" data-act="startupRec">${L('Aplicar recomendación', 'Apply recommendation')}</button></div>` : ''}</div>`;
}

function viewHardware() {
  if (!S.hardware) return loadingView(L('Hardware y salud', 'Hardware & health'), loadHardware);
  const h = S.hardware;
  const adv = hardwareAdvice(h);
  const healthBadge = (d) => d.salud === 'Healthy' ? `<span class="badge verde">${L('Sano', 'Healthy')}</span>` : `<span class="badge rojo">${L('Con problemas', 'Problems')}</span>`;
  return `<div class="view">${banners()}${head(L('Hardware y salud', 'Hardware & health'), L('Lo que tiene tu PC por dentro y cómo está.', "What's inside your PC and how it's doing."), `<button class="btn ghost" data-act="reloadHw">${L('Actualizar', 'Refresh')}</button>`)}
    ${progressHTML()}
    ${adv.length ? `<div class="card" style="margin-bottom:14px"><h3>${L('Consejos para tu PC', 'Tips for your PC')}</h3>${adv.map((a) => `<div class="advice"><span class="badge ${a.nivel === 'importante' ? 'rojo' : a.nivel === 'recomendado' ? 'amarillo' : 'gris'}">${a.nivel === 'importante' ? L('Importante', 'Important') : a.nivel === 'recomendado' ? L('Recomendado', 'Recommended') : L('Consejo', 'Tip')}</span><div>${esc(a.t)}</div></div>`).join('')}</div>`
      : `<div class="banner good"><div class="grow"><b>${L('Todo en orden', 'All good')}</b> · ${L('No vemos problemas en tu hardware.', 'No hardware problems found.')}</div></div>`}
    <div class="grid c3">
      <div class="card"><h3>${L('Sistema', 'System')}</h3><div class="big">${esc(h.sistema.nombre)}</div><div class="meta">${esc(h.sistema.version)} · build ${esc(h.sistema.build)}</div><div class="meta">${L('Encendido hace', 'Up for')} ${esc(h.sistema.diasEncendido)} ${L('días', 'days')}</div></div>
      <div class="card"><h3>${L('Procesador', 'Processor')}</h3><div class="big">${esc(h.cpu.nombre)}</div><div class="meta">${h.cpu.nucleos} ${L('núcleos', 'cores')} / ${h.cpu.hilos} ${L('hilos', 'threads')}${h.cpu.temp ? ' · ' + h.cpu.temp + ' °C' : ''}</div></div>
      <div class="card"><h3>${L('Memoria RAM', 'RAM')}</h3><div class="big">${fmtBytes(h.ram.total)}</div><div class="meta">${h.ram.modulos} ${L('módulo(s)', 'module(s)')}${h.ram.velocidad ? ' · ' + h.ram.velocidad + ' MT/s' : ''}</div>
        <div class="meter"><i style="width:${Math.round(100 * (1 - h.ram.libre / h.ram.total))}%"></i></div><div class="meta">${L('En uso ahora', 'In use now')}: ${fmtBytes(h.ram.total - h.ram.libre)}</div></div>
      ${(h.gpus || []).map((g) => `<div class="card"><h3>${L('Tarjeta gráfica', 'Graphics card')}</h3><div class="big">${esc(g.nombre)}</div><div class="meta">${g.vram ? fmtBytes(g.vram) + ' · ' : ''}${L('Driver', 'Driver')} ${esc(g.versionNvidia || g.driver)} (${esc(g.fechaDriver)})${g.temp ? ' · ' + g.temp + ' °C' : ''}</div></div>`).join('')}
      <div class="card"><h3>${L('Placa base', 'Motherboard')}</h3><div class="big">${esc(h.placa.modelo)}</div><div class="meta">${esc(h.placa.fabricante)}</div><div class="meta">BIOS ${esc(h.bios.version)} (${esc(h.bios.fecha)})</div></div>
      ${h.bateria ? `<div class="card"><h3>${L('Batería', 'Battery')}</h3><div class="big">${h.bateria.carga}%</div>${h.bateria.salud ? `<div class="meta">${L('Salud', 'Health')}: ${h.bateria.salud}%</div>` : ''}</div>` : ''}
    </div>
    <h2>${L('Discos', 'Disks')}</h2>
    <div class="grid c2">${(h.discos || []).map((d) => `<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div class="big">${esc(d.nombre)}</div>${healthBadge(d)}</div>
      <div class="meta">${esc(d.tipo || d.bus)} · ${fmtBytes(d.tamano)}${d.temperatura ? ' · ' + d.temperatura + ' °C' : ''}${d.horas ? ' · ' + Math.round(d.horas / 24) + L(' días encendido', ' days powered on') : ''}</div>
      ${d.desgaste != null ? `<div class="meter"><i class="${d.desgaste >= 80 ? 'rojo' : d.desgaste >= 50 ? 'amarillo' : ''}" style="width:${Math.max(2, d.desgaste)}%"></i></div><div class="meta">${L('Desgaste', 'Wear')}: ${d.desgaste}%</div>` : ''}
      ${d.errores ? `<div class="meta" style="color:var(--rojo)">${d.errores} ${L('errores de lectura/escritura', 'read/write errors')}</div>` : ''}</div>`).join('')}</div>
    <h2>${L('Espacio', 'Space')}</h2>
    <div class="grid c2">${(h.unidades || []).map((v) => { const used = v.total ? 1 - v.libre / v.total : 0; return `<div class="card"><div class="big">${esc(v.letra)} ${esc(v.etiqueta || '')}</div><div class="meter"><i class="${used > 0.9 ? 'rojo' : used > 0.8 ? 'amarillo' : ''}" style="width:${Math.round(used * 100)}%"></i></div><div class="meta">${fmtBytes(v.libre)} ${L('libres de', 'free of')} ${fmtBytes(v.total)}</div></div>`; }).join('')}</div></div>`;
}

function viewDrivers() {
  if (!S.drivers) return loadingView(L('Drivers', 'Drivers'), async () => { await loadDrivers(); if (!S.hardware) await loadHardware(); });
  const d = S.drivers;
  const prob = d.problemas.filter((p) => p.codigo !== 45);
  const imp = d.drivers.filter((x) => x.importante && !x.generico);
  const wuDrv = (S.updates?.windows || []).filter((u) => u.tipo === 'driver');
  const gpus = (S.hardware?.gpus || []).filter((g) => GPU_LINKS[g.fabricante]);
  imp.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  return `<div class="view">${banners()}${head(L('Drivers', 'Drivers'), L('Los drivers son los "traductores" entre Windows y tu hardware. RetroLimpia solo usa fuentes oficiales: Windows Update y las apps de cada fabricante. Nunca webs de "drivers gratis".', 'Drivers are the "translators" between Windows and your hardware. RetroLimpia only uses official sources: Windows Update and each manufacturer\'s app. Never "free driver" websites.'), `<button class="btn" data-act="backupDrivers" ${S.busy ? 'disabled' : ''}>${L('Hacer copia de mis drivers', 'Back up my drivers')}</button>`)}
    ${progressHTML()}
    ${prob.length ? `<div class="card" style="border-color:rgba(255,84,112,.5);margin-bottom:14px"><h3 style="color:var(--rojo)">${L('Dispositivos con problemas', 'Devices with problems')}</h3>
      ${prob.map((p) => `<div class="advice"><span class="badge rojo">${L('Código', 'Code')} ${p.codigo}</span><div><b>${esc(p.dispositivo)}</b><div class="meta">${L(...(PNP_CODES[p.codigo] || ['Tiene un problema.', 'Has a problem.']))} ${L('Prueba primero con las actualizaciones de Windows Update de abajo; si sigue, instala el driver desde la web del fabricante.', 'Try the Windows Update updates below first; if it persists, install the driver from the manufacturer website.')}</div>${S.settings.modoExperto ? `<div class="tech">${esc(p.id)}</div>` : ''}</div></div>`).join('')}</div>`
      : `<div class="banner good"><div class="grow"><b>${L('Todos tus dispositivos funcionan', 'All your devices are working')}</b></div></div>`}
    ${gpus.length ? `<h2>${L('Tu tarjeta gráfica', 'Your graphics card')}</h2><div class="grid c2">${gpus.map((g) => `<div class="card"><div class="big">${esc(g.nombre)}</div><div class="meta">${L('Driver actual', 'Current driver')}: ${esc(g.versionNvidia || g.driver)} (${esc(g.fechaDriver)})</div>
      <p class="meta">${L('Para gráficas, el driver más nuevo y fiable sale de la app oficial del fabricante. Windows Update suele ir varios meses atrás.', 'For graphics cards, the newest reliable driver comes from the official app. Windows Update is often months behind.')}</p>
      <button class="btn primary small" data-open="${GPU_LINKS[g.fabricante][1]}">${L('Abrir', 'Open')} ${GPU_LINKS[g.fabricante][0]}</button></div>`).join('')}</div>` : ''}
    <h2>${L('Drivers oficiales disponibles en Windows Update', 'Official drivers available on Windows Update')}${S.updates ? '' : `<span class="sub"><button class="link" data-act="loadUpdates">${L('Buscar ahora', 'Search now')}</button></span>`}</h2>
    ${S.updates ? (wuDrv.length ? `<div class="list">${wuDrv.map((u) => `<div class="row"><div class="grow"><div class="name">${esc(u.titulo)}</div><div class="sub">${fmtBytes(u.tamano)}${u.opcional ? ' · ' + L('opcional', 'optional') : ''}</div></div><button class="btn small" data-wu="${esc(u.id)}" ${S.busy ? 'disabled' : ''}>${L('Instalar', 'Install')}</button></div>`).join('')}</div>` : `<div class="card meta">${L('Windows Update no tiene drivers nuevos para ti.', 'Windows Update has no new drivers for you.')}</div>`) : ''}
    <h2>${L('Drivers importantes instalados', 'Important installed drivers')}<span class="sub">${L('ordenados del más antiguo al más nuevo', 'oldest first')}</span></h2>
    <div class="list">${imp.map((x) => { const y = yearsSince(x.fecha); return `<div class="row"><div class="grow"><div class="name">${esc(x.dispositivo)}</div><div class="sub">${esc(x.proveedor)} · ${esc(x.version)}</div>${S.settings.modoExperto ? `<div class="tech">${esc(x.inf)} · ${esc(x.clase)}</div>` : ''}</div>
      ${y != null && y > 3 ? `<span class="badge amarillo">${L('Antiguo', 'Old')}</span>` : `<span class="badge verde">OK</span>`}<div class="size">${esc(x.fecha)}</div></div>`; }).join('') || `<div class="empty">—</div>`}</div>
    ${d.respaldos.length ? `<p class="meta" style="margin-top:14px">${L('Copias de drivers guardadas', 'Saved driver backups')}: ${d.respaldos.length} · <button class="link" data-folder="drivers">${L('Abrir carpeta', 'Open folder')}</button></p>` : ''}</div>`;
}

function viewActualizaciones() {
  if (!S.updates) return loadingView(L('Actualizaciones', 'Updates'), loadUpdates, L('Preguntando a Windows Update. Puede tardar unos minutos...', 'Asking Windows Update. May take a few minutes...'));
  const u = S.updates;
  const wu = u.windows;
  const big = wu.filter((x) => x.grande);
  const normal = wu.filter((x) => !x.grande);
  const tipoTxt = { seguridad: L('Seguridad', 'Security'), driver: 'Driver', windows: 'Windows' };
  return `<div class="view">${banners()}${head(L('Actualizaciones', 'Updates'), L('Actualiza cada cosa por separado o todo de una vez. Solo fuentes oficiales: Windows Update y winget (el gestor de apps de Microsoft).', 'Update items one by one or all at once. Official sources only: Windows Update and winget (Microsoft\'s app manager).'), `<button class="btn ghost" data-act="loadUpdates" ${S.busy ? 'disabled' : ''}>${L('Buscar de nuevo', 'Search again')}</button>`)}
    ${progressHTML()}
    ${u.error ? `<div class="banner warn"><div class="grow">${L('Windows Update no respondió', 'Windows Update did not respond')}: ${esc(u.error)}</div></div>` : ''}
    <h2>${L('Windows y drivers', 'Windows & drivers')}<span class="sub">${normal.length} ${L('disponibles', 'available')}</span></h2>
    ${normal.length ? `<div class="list">${normal.map((x) => `<div class="row"><div class="grow"><div class="name">${esc(x.titulo)}</div><div class="sub">${tipoTxt[x.tipo]} · ${fmtBytes(x.tamano)}${x.reinicio ? ' · ' + L('pide reiniciar', 'needs restart') : ''}${x.opcional ? ' · ' + L('opcional', 'optional') : ''}</div></div>
      <span class="badge ${x.tipo === 'seguridad' ? 'rojo' : x.opcional ? 'gris' : 'amarillo'}">${x.tipo === 'seguridad' ? L('Importante', 'Important') : x.opcional ? L('Opcional', 'Optional') : L('Recomendado', 'Recommended')}</span>
      <button class="btn small" data-wu="${esc(x.id)}" ${S.busy ? 'disabled' : ''}>${L('Instalar', 'Install')}</button></div>`).join('')}</div>` : `<div class="banner good"><div class="grow"><b>${L('Windows está al día', 'Windows is up to date')}</b></div></div>`}
    ${big.length ? `<div class="banner info" style="margin-top:12px"><div class="grow"><b>${L('Hay una versión nueva de Windows disponible', 'A new Windows version is available')}</b> · ${esc(big[0].titulo)}. ${L('Por seguridad, RetroLimpia no la instala automáticamente: hazlo desde Configuración > Windows Update cuando tengas tiempo.', 'For safety RetroLimpia does not install it automatically: do it from Settings > Windows Update when you have time.')}</div></div>` : ''}
    <h2>${L('Tus programas', 'Your programs')}<span class="sub">${u.apps.length} ${L('con versión nueva', 'with a new version')}</span></h2>
    ${!u.wingetDisponible ? `<div class="banner warn"><div class="grow">${L('Falta "Instalador de aplicaciones" (winget). Instálalo gratis desde Microsoft Store para poder actualizar tus programas.', 'App Installer (winget) is missing. Install it free from the Microsoft Store to update your programs.')}</div><button class="btn small" data-open="https://apps.microsoft.com/detail/9NBLGGH4NNS1">${L('Abrir Store', 'Open Store')}</button></div>`
      : u.apps.length ? `<div class="list">${u.apps.map((a) => `<div class="row"><div class="grow"><div class="name">${esc(a.nombre)}</div><div class="sub">${esc(a.actual)} → <b style="color:var(--verde)">${esc(a.nueva)}</b></div>${S.settings.modoExperto ? `<div class="tech">${esc(a.id)}</div>` : ''}</div><button class="btn small" data-wg="${esc(a.id)}" ${S.busy ? 'disabled' : ''}>${L('Actualizar', 'Update')}</button></div>`).join('')}</div>`
      : `<div class="banner good"><div class="grow"><b>${L('Tus programas están al día', 'Your programs are up to date')}</b></div></div>`}
    ${(normal.length || u.apps.length) ? `<div class="actionbar"><div class="info">${L('Las actualizaciones opcionales de Windows y los cambios de versión no se incluyen en "todo".', 'Optional Windows updates and version upgrades are not included in "all".')}</div><button class="btn primary" data-act="updateAll" ${S.busy ? 'disabled' : ''}>${L('Actualizar todo', 'Update all')}</button></div>` : ''}</div>`;
}

function viewDeshacer() {
  if (!S.quarantine) return loadingView(L('Deshacer y cuarentena', 'Undo & quarantine'), loadQuarantine);
  const dias = S.settings.diasCuarentena || 7;
  const lotes = S.quarantine.lotes || [];
  return `<div class="view">${banners()}${head(L('Deshacer y cuarentena', 'Undo & quarantine'), L(`Todo lo que RetroLimpia quita se guarda aquí ${dias} días antes de borrarse para siempre. Si algo deja de funcionar, restáuralo con un clic.`, `Everything RetroLimpia removes is kept here for ${dias} days before being deleted for good. If something breaks, restore it with one click.`))}
    ${progressHTML()}
    <h2>${L('Cuarentena', 'Quarantine')}</h2>
    <div class="list">${lotes.length ? lotes.map((l) => { const left = Math.max(0, Math.ceil(dias - (Date.now() - new Date(l.fecha)) / 864e5)); return `<div class="row"><div class="grow"><div class="name">${esc(l.motivo || L('Restos', 'Leftovers'))}</div><div class="sub">${new Date(l.fecha).toLocaleString()} · ${l.cantidad} ${L('elemento(s)', 'item(s)')} · ${fmtBytes(l.bytes)} · ${L(`se borra en ${left} día(s)`, `deleted in ${left} day(s)`)}</div></div><button class="btn small" data-restore="${esc(l.id)}" ${S.busy ? 'disabled' : ''}>${L('Restaurar', 'Restore')}</button></div>`; }).join('') : `<div class="empty">${L('La cuarentena está vacía.', 'Quarantine is empty.')}</div>`}</div>
    <h2>${L('Puntos de restauración de Windows', 'Windows restore points')}</h2>
    <div class="card"><p class="meta" style="margin-top:0">${L('Si algo grave sale mal (por ejemplo, tras actualizar un driver), Windows puede volver al estado de un punto de restauración. Tus documentos no se tocan.', 'If something serious goes wrong (e.g. after a driver update), Windows can go back to a restore point. Your documents are not touched.')}</p>
      ${(S.restorePoints?.puntos || []).slice(-5).reverse().map((p) => `<div class="advice"><span class="badge gris">${esc(p.fecha)}</span><div>${esc(p.descripcion)}</div></div>`).join('') || `<p class="meta">${L('No hay puntos guardados.', 'No restore points saved.')}</p>`}
      <button class="btn" data-act="openRestore" style="margin-top:10px">${L('Abrir Restaurar sistema', 'Open System Restore')}</button></div>
    <p class="meta" style="margin-top:16px"><button class="link" data-folder="cuarentena">${L('Abrir carpeta de cuarentena', 'Open quarantine folder')}</button> · <button class="link" data-folder="drivers">${L('Copias de drivers', 'Driver backups')}</button> · <button class="link" data-folder="logs">${L('Registro de cambios', 'Change log')}</button></p></div>`;
}

function viewAjustes() {
  const s = S.settings;
  const sw = (key, title, desc) => `<div class="setting"><div class="grow"><b>${title}</b><span>${desc}</span></div><label class="switch"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}><span></span></label></div>`;
  const repoUrl = S.info.repo && !S.info.repo.startsWith('TU_USUARIO') ? 'https://github.com/' + S.info.repo : null;
  return `<div class="view">${banners()}${head(L('Ajustes', 'Settings'), L('Casi nadie necesita cambiar nada aquí.', 'Most people never need to change anything here.'))}
    <div class="card">
      <div class="setting"><div class="grow"><b>${L('Idioma', 'Language')}</b></div><select data-setting="idioma"><option value="es" ${s.idioma === 'es' ? 'selected' : ''}>Español</option><option value="en" ${s.idioma === 'en' ? 'selected' : ''}>English</option></select></div>
      ${sw('restosAutomaticos', L('Borrar restos seguros automáticamente', 'Remove safe leftovers automatically'), L('Al desinstalar, mueve a la cuarentena los restos que seguro son del programa, sin preguntar.', 'After uninstalling, quarantine leftovers that surely belong to the program without asking.'))}
      ${sw('puntoRestauracion', L('Crear punto de restauración antes de cambios', 'Create a restore point before changes'), L('Muy recomendado. Tarda unos segundos.', 'Highly recommended. Takes a few seconds.'))}
      <div class="setting"><div class="grow"><b>${L('Días en cuarentena', 'Days in quarantine')}</b><span>${L('Cuánto tiempo se guardan las cosas quitadas antes de borrarlas.', 'How long removed items are kept before deletion.')}</span></div><select data-setting="diasCuarentena">${[3, 7, 14, 30].map((d) => `<option value="${d}" ${s.diasCuarentena == d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      ${sw('modoExperto', L('Modo experto', 'Expert mode'), L('Muestra detalles técnicos y permite quitar elementos marcados en rojo. Solo si sabes lo que haces.', 'Shows technical details and allows removing red items. Only if you know what you are doing.'))}
    </div>
    <h2>${L('Acerca de RetroLimpia', 'About RetroLimpia')}</h2>
    <div class="card"><div class="kv"><span>${L('Versión', 'Version')}</span><span>${esc(S.info.version)}</span><span>${L('Licencia', 'License')}</span><span>MIT (${L('código abierto', 'open source')})</span><span>${L('Privacidad', 'Privacy')}</span><span>${L('No envía ningún dato tuyo a internet.', 'Sends none of your data to the internet.')}</span></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn" data-act="trust">${L('¿Por qué Windows o mi antivirus avisan?', 'Why does Windows or my antivirus warn me?')}</button>
      ${repoUrl ? `<button class="btn ghost" data-open="${repoUrl}">${L('Ver el código', 'View the code')}</button>` : ''}
      <button class="btn ghost" data-act="checkUpdate">${L('Buscar versión nueva', 'Check for a new version')}</button></div></div></div>`;
}

function loadingView(title, loader, msg) {
  S.failed = S.failed || {};
  if (S.failed[title]) {
    return `<div class="view">${banners()}${head(title, '')}<div class="banner bad"><div class="grow"><b>${L('No se pudo leer esta información', 'Could not read this information')}</b> · ${esc(S.failed[title])}</div><button class="btn small" data-retry="${esc(title)}">${L('Reintentar', 'Retry')}</button></div></div>`;
  }
  if (!S.busy) setTimeout(() => task(L('Cargando', 'Loading') + ' · ' + title, async () => {
    try { await loader(); } catch (e) { S.failed[title] = String(e.message || e).slice(0, 300); throw e; }
  }), 0);
  return `<div class="view">${banners()}${head(title, msg || L('Un momento...', 'One moment...'))}${progressHTML()}</div>`;
}

// ============================================================ Confianza
function showTrust() {
  const repoUrl = S.info.repo && !S.info.repo.startsWith('TU_USUARIO') ? 'https://github.com/' + S.info.repo : null;
  $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h2>${L('Tranquilo: RetroLimpia no es un virus', "Relax: RetroLimpia isn't a virus")}</h2>
    <p class="lead">${L('Puede que Windows te haya mostrado una pantalla azul de "Windows protegió su PC" o que tu antivirus haya dudado. Te explicamos por qué pasa, con total sinceridad:', 'Windows may have shown a blue "Windows protected your PC" screen, or your antivirus may have hesitated. Here is honestly why:')}</p>
    <div class="why"><span class="n">1</span><div><b>${L('No tiene firma digital de pago', "It has no paid digital signature")}</b><p>${L('Las grandes empresas pagan cada año un certificado para "firmar" sus programas. RetroLimpia es un proyecto independiente y gratuito, sin ese certificado. Windows avisa de cualquier programa nuevo sin firma, aunque no tenga nada malo: el aviso significa "no conozco a este autor", no "he encontrado un virus".', 'Big companies pay every year for a certificate to "sign" their software. RetroLimpia is an independent free project without one. Windows warns about any new unsigned program even if it is harmless: the warning means "I don\'t know this author", not "I found a virus".')}</p></div></div>
    <div class="why"><span class="n">2</span><div><b>${L('Hace cosas "poderosas" a propósito', 'It does "powerful" things on purpose')}</b><p>${L('Para limpiar de verdad, RetroLimpia necesita permisos de administrador, borrar archivos, tocar el registro y manejar drivers. Los antivirus usan reglas automáticas, y esas acciones también las hacen los programas malos. Por eso a veces dan una "falsa alarma" con limpiadores y desinstaladores.', 'To clean properly, RetroLimpia needs admin rights, deletes files, edits the registry and handles drivers. Antivirus use automatic rules, and malware does those things too. That\'s why cleaners and uninstallers sometimes get a "false alarm".')}</p></div></div>
    <div class="why"><span class="n">3</span><div><b>${L('Puedes comprobarlo tú mismo', 'You can check it yourself')}</b><p>${L('Su código es abierto: cualquiera puede leerlo en GitHub. Puedes subir el instalador a VirusTotal, que lo revisa con más de 60 antivirus a la vez. Y RetroLimpia no envía ningún dato tuyo a internet.', 'Its code is open: anyone can read it on GitHub. You can upload the installer to VirusTotal, which scans it with 60+ antivirus engines. And RetroLimpia sends none of your data to the internet.')}</p></div></div>
    <div class="why"><span class="n">4</span><div><b>${L('Y todo se puede deshacer', 'And everything can be undone')}</b><p>${L('Antes de cambiar nada crea un punto de restauración, y lo que quita pasa unos días en la cuarentena antes de borrarse.', 'Before changing anything it creates a restore point, and anything it removes spends a few days in quarantine before deletion.')}</p></div></div>
    <div class="foot"><button class="btn primary" data-act="trustOk">${L('Entendido, empezar', 'Got it, let\'s start')}</button>
      ${repoUrl ? `<button class="btn ghost" data-open="${repoUrl}">${L('Ver el código', 'View the code')}</button>` : ''}
      <button class="btn ghost" data-open="https://www.virustotal.com/">VirusTotal</button></div></div>`;
  $('#modal').classList.remove('hidden');
}

// ============================================================ Informe
function buildReport() {
  const h = S.hardware;
  const rows = (S.scan.findings || []).map((f) => `<li><b>[${f.nivel}]</b> ${esc(f.titulo)}${f.detalle ? ' — ' + esc(f.detalle) : ''}</li>`).join('');
  return `<!DOCTYPE html><html lang="${S.settings.idioma}"><head><meta charset="utf-8"><title>RetroLimpia - ${L('Informe', 'Report')}</title>
  <style>body{font:15px/1.6 Segoe UI,sans-serif;max-width:860px;margin:40px auto;padding:0 20px;color:#1a1631}h1{color:#8a5cff}td{padding:4px 14px 4px 0;vertical-align:top}.score{font-size:42px;font-weight:700}</style></head><body>
  <h1>RetroLimpia — ${L('Informe del PC', 'PC report')}</h1><p>${new Date().toLocaleString()} · ${esc(S.info.equipo || '')}</p>
  <p class="score">${S.scan.score ?? '—'}/100 <small>${S.scan.score != null ? scoreLabel(S.scan.score) : ''}</small></p>
  <h2>${L('Hallazgos', 'Findings')}</h2><ul>${rows || '<li>—</li>'}</ul>
  ${h ? `<h2>Hardware</h2><table>
   <tr><td>${L('Sistema', 'System')}</td><td>${esc(h.sistema.nombre)} ${esc(h.sistema.version)} (build ${esc(h.sistema.build)})</td></tr>
   <tr><td>CPU</td><td>${esc(h.cpu.nombre)}</td></tr><tr><td>RAM</td><td>${fmtBytes(h.ram.total)}</td></tr>
   <tr><td>GPU</td><td>${(h.gpus || []).map((g) => esc(g.nombre) + ' (driver ' + esc(g.driver) + ')').join('<br>')}</td></tr>
   <tr><td>${L('Placa', 'Board')}</td><td>${esc(h.placa.fabricante)} ${esc(h.placa.modelo)} · BIOS ${esc(h.bios.version)} (${esc(h.bios.fecha)})</td></tr>
   <tr><td>${L('Discos', 'Disks')}</td><td>${(h.discos || []).map((d) => esc(d.nombre) + ' — ' + esc(d.salud) + (d.desgaste != null ? ', ' + L('desgaste', 'wear') + ' ' + d.desgaste + '%' : '')).join('<br>')}</td></tr></table>` : ''}
  <p style="color:#888;margin-top:40px">${L('Generado por RetroLimpia', 'Generated by RetroLimpia')} ${esc(S.info.version)}</p></body></html>`;
}

// ============================================================ Render y eventos
function render() {
  renderNav();
  const views = { inicio: viewInicio, programas: viewProgramas, limpieza: viewLimpieza, arranque: viewArranque, hardware: viewHardware, drivers: viewDrivers, actualizaciones: viewActualizaciones, deshacer: viewDeshacer, ajustes: viewAjustes };
  const focusSearch = document.activeElement && document.activeElement.id === 'search';
  const caret = focusSearch ? document.activeElement.selectionStart : 0;
  $('#main').innerHTML = (views[S.view] || viewInicio)();
  if (focusSearch) { const el = $('#search'); el.focus(); el.setSelectionRange(caret, caret); }
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-retry],[data-nav],[data-act],[data-win],[data-open],[data-filter],[data-folder],[data-restore],[data-wu],[data-wg]');
  if (!t) return;
  if (t.dataset.retry) { delete S.failed[t.dataset.retry]; return render(); }
  if (t.dataset.win) return rl.win(t.dataset.win);
  if (t.dataset.open) return rl.open(t.dataset.open);
  if (t.dataset.folder) return rl.openFolder(t.dataset.folder);
  if (t.dataset.nav) { S.view = t.dataset.nav; render(); $('#main').scrollTop = 0; return; }
  if (t.dataset.filter) { S.progFilter = t.dataset.filter; return render(); }
  if (t.dataset.restore) {
    return task(L('Restaurando', 'Restoring'), async () => {
      const r = await rl.run('cuarentena', { accion: 'restaurar', id: t.dataset.restore });
      toast(r.ok ? L('Restaurado. Todo volvió a su sitio.', 'Restored. Everything is back in place.') : L('Se restauró una parte; algunos archivos estaban en uso.', 'Partly restored; some files were in use.'), r.ok ? 'ok' : 'err');
      await loadQuarantine();
    });
  }
  if (t.dataset.wu) {
    return task(L('Instalando actualización', 'Installing update'), async () => {
      await restorePoint(L('Antes de actualizar', 'Before updating'));
      const r = await rl.run('actualizaciones', { accion: 'instalarWU', ids: [t.dataset.wu] });
      const ok = r.resultados.every((x) => x.ok);
      if (r.reinicio) S.needsReboot = true;
      toast(ok ? L('Actualización instalada.', 'Update installed.') : L('No se pudo instalar.', 'Could not install.'), ok ? 'ok' : 'err');
      S.updates.windows = S.updates.windows.filter((u) => !(ok && u.id === t.dataset.wu));
    });
  }
  if (t.dataset.wg) {
    return task(L('Actualizando programa', 'Updating program'), async () => {
      const r = await rl.run('actualizaciones', { accion: 'winget', ids: [t.dataset.wg] });
      const ok = r.resultados.every((x) => x.ok);
      toast(ok ? L('Programa actualizado.', 'Program updated.') : L('No se pudo actualizar (quizá está abierto).', 'Could not update (it may be open).'), ok ? 'ok' : 'err');
      if (ok) S.updates.apps = S.updates.apps.filter((a) => a.id !== t.dataset.wg);
    });
  }
  switch (t.dataset.act) {
    case 'scan': return scanAll();
    case 'fixAll': return fixAll();
    case 'closeFix': S.fix = null; return render();
    case 'report': { const f = await rl.saveReport(buildReport()); toast(L('Informe guardado en Documentos\\RetroLimpia', 'Report saved to Documents\\RetroLimpia')); return f; }
    case 'selVerde': allPrograms().filter((p) => p.cls.color === 'verde').forEach((p) => S.sel.add(p.id)); return render();
    case 'selNone': S.sel.clear(); return render();
    case 'uninstallSel': {
      const list = allPrograms().filter((p) => S.sel.has(p.id));
      return task(L('Desinstalando', 'Uninstalling'), async () => {
        const r = await uninstallPrograms(list, L('Desinstalar programas', 'Uninstall programs'));
        S.sel.clear();
        if (r.dudosos.length) S.pendingResidues = r.dudosos;
        toast(L(`${r.ok} programa(s) quitados`, `${r.ok} program(s) removed`) + (r.restosMovidos ? L(` y ${r.restosMovidos} resto(s) a la cuarentena (${fmtBytes(r.bytes)})`, ` and ${r.restosMovidos} leftover(s) quarantined (${fmtBytes(r.bytes)})`) : '') + '.');
        if (r.fail.length) toast(L('No se pudieron quitar: ', 'Could not remove: ') + r.fail.join(', '), 'err');
        await loadPrograms(); S.quarantine = null;
      });
    }
    case 'moveResidues': {
      const items = S.pendingResidues.flatMap((g) => g.restos.filter((r) => r.elegido));
      if (!items.length) { S.pendingResidues = null; return render(); }
      return task(L('Moviendo restos', 'Moving leftovers'), async () => {
        const q = await rl.run('cuarentena', { accion: 'mover', items, motivo: L('Restos revisados', 'Reviewed leftovers') });
        toast(L(`${q.guardados} resto(s) en la cuarentena.`, `${q.guardados} leftover(s) quarantined.`));
        S.pendingResidues = null; S.quarantine = null;
      });
    }
    case 'skipResidues': S.pendingResidues = null; return render();
    case 'clean':
      return task(L('Limpiando', 'Cleaning'), async () => {
        const r = await rl.run('limpieza', { accion: 'limpiar', categorias: [...S.junkSel] });
        toast(L('¡Liberaste ', 'You freed ') + fmtBytes(r.liberado) + '!');
        await loadJunk();
      });
    case 'reloadJunk': S.junk = null; return render();
    case 'reloadHw': S.hardware = null; return render();
    case 'loadUpdates': return task(L('Buscando actualizaciones', 'Searching updates'), loadUpdates);
    case 'startupRec':
      return task(L('Aplicando', 'Applying'), async () => {
        for (const it of S.startup.elementos.filter((i) => i.activo && classifyStartup(i).rec === 'desactivar')) await rl.run('inicio', { accion: 'cambiar', id: it.id, activar: false });
        await loadStartup(); toast(L('Listo. El próximo arranque será más rápido.', 'Done. Next startup will be faster.'));
      });
    case 'updateAll':
      return task(L('Actualizando todo', 'Updating everything'), async () => {
        await restorePoint(L('Antes de actualizar todo', 'Before updating everything'));
        if (S.updates.windows.some((u) => !u.grande)) {
          S.busy.label = 'Windows Update';
          const r = await rl.run('actualizaciones', { accion: 'instalarWU', todos: true });
          if (r.reinicio) S.needsReboot = true;
        }
        if (S.updates.apps.length) { S.busy.label = L('Programas', 'Programs'); await rl.run('actualizaciones', { accion: 'winget', todos: true }); }
        toast(L('Todo actualizado.', 'Everything updated.'));
        await loadUpdates();
      });
    case 'backupDrivers':
      return task(L('Copia de drivers', 'Driver backup'), async () => {
        const r = await rl.run('drivers', { accion: 'respaldar' });
        toast(r.ok ? L('Copia guardada (', 'Backup saved (') + fmtBytes(r.tamano) + ').' : L('No se pudo hacer la copia.', 'Backup failed.'), r.ok ? 'ok' : 'err');
        await loadDrivers();
      });
    case 'openRestore': return rl.run('restauracion', { accion: 'abrir' });
    case 'trust': return showTrust();
    case 'trustOk': $('#modal').classList.add('hidden'); S.settings = await rl.setSettings({ confianzaVista: true }); return;
    case 'checkUpdate': S.appUpdate = await rl.checkUpdate(); toast(S.appUpdate.disponible ? L('¡Hay versión nueva!', 'New version available!') : L('Tienes la última versión.', 'You have the latest version.')); return render();
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.sel) { t.checked ? S.sel.add(t.dataset.sel) : S.sel.delete(t.dataset.sel); return render(); }
  if (t.dataset.junk) { t.checked ? S.junkSel.add(t.dataset.junk) : S.junkSel.delete(t.dataset.junk); return render(); }
  if (t.dataset.finding) { const f = S.scan.findings.find((x) => x.id === t.dataset.finding); if (f) f.elegido = t.checked; return render(); }
  if (t.dataset.res) { const [g, r] = t.dataset.res.split(':').map(Number); S.pendingResidues[g].restos[r].elegido = t.checked; return; }
  if (t.dataset.startup) {
    const id = t.dataset.startup, on = t.checked;
    return task(on ? L('Activando', 'Enabling') : L('Desactivando', 'Disabling'), async () => { await rl.run('inicio', { accion: 'cambiar', id, activar: on }); await loadStartup(); });
  }
  if (t.dataset.setting) {
    const k = t.dataset.setting;
    const v = t.type === 'checkbox' ? t.checked : (k === 'diasCuarentena' ? Number(t.value) : t.value);
    S.settings = await rl.setSettings({ [k]: v });
    if (k === 'idioma') document.documentElement.lang = v;
    render();
  }
});
document.addEventListener('input', (e) => { if (e.target.id === 'search') { S.search = e.target.value; render(); } });

rl.onProgress((p) => {
  if (!S.busy) return;
  S.busy.pct = p.pct; S.busy.msg = S.settings.idioma === 'en' ? p.en : p.msg;
  updateProgressOnly();
});

// ============================================================ Arranque
(async function init() {
  [S.settings, S.info] = await Promise.all([rl.getSettings(), rl.info()]);
  const [bloat, prot, inicio] = await Promise.all([rl.data('bloatware'), rl.data('protegidos'), rl.data('inicio')]);
  S.data = { bloat, prot, inicio };
  document.documentElement.lang = S.settings.idioma;
  $('#ver').textContent = 'v' + S.info.version;
  render();
  if (!S.settings.confianzaVista) showTrust();
  rl.checkUpdate().then((u) => { S.appUpdate = u; if (u.disponible) render(); }).catch(() => {});
})();
