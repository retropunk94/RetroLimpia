'use strict';
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
  procesos: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
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
  ['procesos', 'Procesos (avanzado)', 'Processes (advanced)'],
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
  }).join('') + `<div class="nav-foot">${/^https:\/\//.test(S.info.paypal || '') ? `<div class="donate"><div class="d-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>${L('Tu donación lo mantiene vivo', 'Your donation keeps it alive')}</div>
    <p>${L('No hay empresa detrás: hay una persona que le dedica sus noches. Si te ayudó, donar, por poco que sea, lo mantiene vivo para todos.', 'No company behind it: one person giving it their nights. If it helped you, donating, however little, keeps it alive for everyone.')}</p>
    <button class="donate-btn big-donate" data-act="donateAsk">${L('Donar con PayPal', 'Donate with PayPal')}</button><div class="d-note">${L('Cada donación cuenta 💜', 'Every donation counts 💜')}</div></div>` : ''}<div class="side-row">${S.info.reportes ? `<button class="side-mini" data-act="reportOpen" title="${L('Envíanos lo que pasó, con captura y registro técnico', 'Send us what happened, with screenshot and technical log')}">🐞 <span>${L('Reportar un problema', 'Report a problem')}</span></button>` : ''}${/^https:\/\//.test(S.info.discord || '') ? `<button class="side-mini discord" data-open="${S.info.discord}" title="${L('Únete a la comunidad en Discord', 'Join the community on Discord')}">${DISCORD_ICON}<span>${L('Únete al Discord', 'Join our Discord')}</span></button>` : ''}</div>${repoUrl() ? `<button class="gh-btn" data-open="${repoUrl()}" title="${L('Revisar el código abierto en GitHub', 'Review the open source code on GitHub')}">${GH_ICON}<span>${L('Ver el código en GitHub', 'View code on GitHub')}</span></button>` : ''}<div class="trust">${L('Sin telemetría · Código abierto', 'No telemetry · Open source')}</div>${L('Todo lo que borra se puede deshacer.', 'Everything it removes can be undone.')}</div>`;
}

function head(title, desc, right = '') {
  return `<div class="view-head"><div><h1>${title}</h1><p>${desc}</p></div><div>${right}</div></div>`;
}
function banners() {
  let h = '';
  if (S.info.demo) h += `<div class="banner info"><div class="grow"><b>${L('Modo demostración', 'Demo mode')}</b> · ${L('Los datos son de ejemplo y no se cambia nada en este equipo.', 'Sample data; nothing on this computer is changed.')}</div></div>`;
  if (!S.info.esAdmin) h += `<div class="banner warn"><div class="grow"><b>${L('Abre RetroLimpia como administrador', 'Run RetroLimpia as administrator')}</b> · ${L('Sin permisos de administrador no puede desinstalar ni actualizar drivers. Ciérralo, haz clic derecho en su icono y elige "Ejecutar como administrador".', 'Without admin rights it cannot uninstall or update drivers. Close it, right-click its icon and choose "Run as administrator".')}</div></div>`;
  if (S.needsReboot) h += `<div class="banner warn"><div class="grow"><b>${L('Reinicia el PC cuando puedas', 'Restart your PC when you can')}</b> · ${L('Algunas actualizaciones o desinstalaciones terminan al reiniciar.', 'Some updates or uninstalls finish after a restart.')}</div></div>`;
  if (S.refreshing && S.refreshing.has(VIEW_REFRESH[S.view])) h += `<div class="banner info"><div class="grow">🔄 <b>${L('Actualizando esta pestaña', 'Refreshing this tab')}</b> · ${L('Leyendo de nuevo lo que cambió tras la última acción...', 'Re-reading what changed after the last action...')}</div></div>`;
  if (S.info.cierreRaro && !S.crashSeen && S.info.reportes) h += `<div class="banner warn"><div class="grow"><b>${L('La última vez RetroLimpia se cerró de forma inesperada', 'Last time RetroLimpia closed unexpectedly')}</b> · ${L('¿Nos cuentas qué estabas haciendo? Nos ayuda a arreglarlo en la próxima versión.', 'Tell us what you were doing? It helps us fix it in the next version.')}</div><button class="btn small" data-act="reportOpen">🐞 ${L('Reportar', 'Report')}</button><button class="btn small ghost" data-act="crashSeen">${L('Ahora no', 'Not now')}</button></div>`;
  const up = S.upd || {};
  if (up.estado === 'lista') h += updBannerHTML();
  else if (up.estado === 'descargando') h += `<div class="banner info"><div class="grow"><b>${L('Descargando RetroLimpia ' + esc(up.version || ''), 'Downloading RetroLimpia ' + esc(up.version || ''))}</b> · ${up.pct || 0}% · ${L('puedes seguir usándolo mientras tanto', 'you can keep using it meanwhile')}</div></div>`;
  else if (S.appUpdate?.disponible && S.appUpdate.modo === 'manual') h += `<div class="banner good"><div class="grow"><b>${L('Hay una versión nueva de RetroLimpia', 'A new RetroLimpia version is available')} (${esc(S.appUpdate.version)})</b> · ${L('Descárgala e instálala encima.', 'Download it and install it over this one.')}</div><button class="btn small" data-open="${esc(S.appUpdate.url)}">${L('Descargar', 'Download')}</button></div>`;
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
      ${progressHTML()}
      <div class="stepper">${SCAN_STEPS.map(([id, , , es, en]) => `<div class="step ${sc.steps[id] || ''}"><span class="dot"></span>${L(es, en)}<span class="extra">${sc.steps[id] === 'err' ? L('No se pudo leer', 'Could not read') : sc.steps[id] === 'ok' ? L('Listo', 'Done') : ''}</span></div>`).join('')}</div>`;
  } else {
    const fx = S.fix;
    if (fx) {
      body = `<div class="hero"><div class="hero-text"><h1>${fx.done ? (fx.cancelado ? L('Detenido', 'Stopped') : L('¡Listo!', 'Done!')) : L('Arreglando tu PC...', 'Fixing your PC...')}</h1><p>${fx.done ? (fx.cancelado ? L('Se detuvo al terminar el paso que estaba en marcha. Lo que se llegó a hacer está en la cuarentena por si quieres deshacerlo.', 'Stopped after the step in progress. Anything already done is in quarantine in case you want to undo it.') : L('Todo lo que se quitó está en la cuarentena unos días por si quieres deshacerlo.', 'Everything removed stays in quarantine for a few days in case you want to undo it.')) : L('No apagues el PC. Esto puede tardar varios minutos si hay actualizaciones.', "Don't turn off your PC. This may take several minutes if there are updates.")}</p>
        ${fx.done ? `<button class="btn" data-act="closeFix">${L('Ver el resumen', 'See summary')}</button> <button class="btn ghost" data-act="report">${L('Guardar informe', 'Save report')}</button>` : ''}</div>${ring}</div>
        ${fx.done ? '' : progressHTML()}
        <div class="stepper">${fx.steps.map((s) => `<div class="step ${s.state === 'wait' ? '' : s.state}"><span class="dot"></span>${esc(s.titulo)}<span class="extra">${esc(s.extra)}</span></div>`).join('')}</div>`;
    } else {
      const fs = sc.findings;
      const chosen = fs.filter((f) => f.elegido && f.accion).length;
      body = `<div class="hero"><div class="hero-text">
        <h1>${fs.length ? L(`Encontramos ${fs.length} cosa(s) para mejorar`, `We found ${fs.length} thing(s) to improve`) : L('¡Tu PC está en muy buen estado!', 'Your PC is in great shape!')}</h1>
        <p>${fs.length ? L('Ya marcamos lo recomendado. Revísalo si quieres, o pulsa "Arreglar todo".', "We've already ticked what we recommend. Review it if you like, or press \"Fix all\".") : L('No hay nada importante que arreglar ahora mismo.', 'Nothing important to fix right now.')}</p>
        <button class="btn ghost" data-act="scan" ${S.busy ? 'disabled' : ''}>${L('Volver a revisar', 'Check again')}</button> <button class="btn ghost" data-act="report">${L('Guardar informe', 'Save report')}</button></div>${ring}</div>
        ${Object.keys(sc.errors || {}).length ? `<div class="banner warn" style="margin-top:16px"><div class="grow"><b>${L('Algunas partes no se pudieron revisar', 'Some parts could not be checked')}</b> · ${SCAN_STEPS.filter(([id]) => sc.errors[id]).map(([, , , es, en]) => L(es, en)).join(', ')}. ${L('El resto del análisis es válido.', 'The rest of the check is valid.')}</div></div>` : ''}
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

// Impacto en el sistema: lo que un programa hace aunque no lo estés usando
function programImpact(p) {
  const why = [];
  let pts = 0;
  const loc = String(p.carpeta || '').replace(/"/g, '').toLowerCase().replace(/\\$/, '');
  const arranca = (S.startup?.elementos || []).some((i) => i.activo && ((loc.length > 6 && String(i.comando).toLowerCase().includes(loc)) || (p.tipo === 'win32' && i.nombre.length > 3 && p.nombre.toLowerCase().startsWith(i.nombre.toLowerCase()))));
  if (arranca) { pts += 2; why.push(L('arranca con Windows', 'starts with Windows')); }
  if (p.serviciosAuto > 0) { pts += 2; why.push(L(`${p.serviciosAuto} servicio(s) siempre activos`, `${p.serviciosAuto} always-on service(s)`)); }
  else if (p.servicios > 0) { pts += 1; why.push(L(`${p.servicios} servicio(s)`, `${p.servicios} service(s)`)); }
  if (p.ram > 300 * 1024 ** 2) { pts += 2; why.push(L(`usa ${fmtBytes(p.ram)} de RAM ahora`, `using ${fmtBytes(p.ram)} RAM now`)); }
  else if (p.ram > 60 * 1024 ** 2) { pts += 1; why.push(L(`usa ${fmtBytes(p.ram)} de RAM ahora`, `using ${fmtBytes(p.ram)} RAM now`)); }
  const nivel = pts >= 4 ? 'alto' : pts >= 2 ? 'medio' : 'bajo';
  return { nivel, pts, why };
}
const IMPACT = { alto: ['rojo', 'Impacto alto', 'High impact'], medio: ['amarillo', 'Impacto medio', 'Medium impact'], bajo: ['verde', 'Impacto bajo', 'Low impact'] };

function viewProgramas() {
  if (!S.programs) return loadingView(L('Programas y bloatware', 'Programs & bloatware'), async () => { await loadPrograms(); if (!S.startup) await loadStartup().catch(() => {}); });
  const all = allPrograms().map((p) => ({ ...p, imp: programImpact(p) }));
  const q = S.search.toLowerCase();
  const filt = all.filter((p) => {
    if (q && !(p.cls.nombre + ' ' + p.editor + ' ' + p.nombre).toLowerCase().includes(q)) return false;
    switch (S.progFilter) {
      case 'verde': return p.cls.color === 'verde';
      case 'amarillo': return p.cls.color === 'amarillo';
      case 'store': return p.tipo === 'appx';
      case 'clasicos': return p.tipo === 'win32';
      case 'impacto': return p.imp.nivel !== 'bajo';
      default: return S.settings.modoExperto || p.tipo === 'win32' || p.cls.color;
    }
  });
  const rank = { verde: 0, amarillo: 1, null: 2, rojo: 3 };
  const sorts = {
    rec: (a, b) => (rank[a.cls.color] - rank[b.cls.color]) || a.cls.nombre.localeCompare(b.cls.nombre),
    peso: (a, b) => (b.tamano || 0) - (a.tamano || 0),
    impacto: (a, b) => (b.imp.pts - a.imp.pts) || (b.ram || 0) - (a.ram || 0),
    nombre: (a, b) => a.cls.nombre.localeCompare(b.cls.nombre)
  };
  S.progSort = S.progSort || 'rec';
  filt.sort(sorts[S.progSort]);
  const maxSize = Math.max(1, ...filt.map((p) => p.tamano || 0));
  const totalSize = all.reduce((a, p) => a + (p.tamano || 0), 0);
  const nAlto = all.filter((p) => p.imp.nivel === 'alto').length;
  const selList = all.filter((p) => S.sel.has(p.id));
  const selSize = selList.reduce((a, p) => a + (p.tamano || 0), 0);
  const chips = [['todos', 'Todos', 'All'], ['verde', 'Seguro quitar', 'Safe to remove'], ['amarillo', 'Opcionales', 'Optional'], ['impacto', 'Con impacto', 'With impact'], ['clasicos', 'Programas', 'Programs'], ['store', 'Store', 'Store']];
  const sortOpts = [['rec', 'Recomendado', 'Recommended'], ['peso', 'Más pesados', 'Largest'], ['impacto', 'Mayor impacto', 'Highest impact'], ['nombre', 'Nombre (A-Z)', 'Name (A-Z)']];
  const nVerde = all.filter((p) => p.cls.color === 'verde').length;
  return `<div class="view">${banners()}${head(L('Programas y bloatware', 'Programs & bloatware'), L(`${all.length} programas ocupan <b>${fmtBytes(totalSize)}</b>${nAlto ? ` · <b>${nAlto}</b> con impacto alto en el sistema` : ''}. Desinstala sin ventanas y sin dejar restos.`, `${all.length} programs take up <b>${fmtBytes(totalSize)}</b>${nAlto ? ` · <b>${nAlto}</b> with high system impact` : ''}. Uninstall without pop-ups or leftovers.`), `<button class="btn ghost" data-act="refreshProgs" title="${L('Vuelve a leer los programas instalados', 'Re-read installed programs')}">⟳ ${L('Actualizar lista', 'Refresh list')}</button>` + (nVerde ? ` <button class="btn" data-act="selVerde">${L(`Marcar los ${nVerde} recomendados`, `Tick the ${nVerde} recommended`)}</button>` : ''))}
    ${progressHTML()}${residuesReviewHTML()}
    <div class="toolbar"><input class="search" id="search" placeholder="${L('Buscar un programa...', 'Search a program...')}" value="${esc(S.search)}">
      <label class="sortsel">${L('Ordenar:', 'Sort:')} <select data-sort>${sortOpts.map(([id, es, en]) => `<option value="${id}" ${S.progSort === id ? 'selected' : ''}>${L(es, en)}</option>`).join('')}</select></label></div>
    <div class="toolbar">${chips.map(([id, es, en]) => `<button class="chip ${S.progFilter === id ? 'on' : ''}" data-filter="${id}">${L(es, en)}</button>`).join('')}</div>
    <div class="list">${filt.length ? filt.map((p) => {
      const blocked = p.cls.color === 'rojo' && !S.settings.modoExperto;
      const [ic, ies, ien] = IMPACT[p.imp.nivel];
      return `<label class="row ${blocked ? 'disabled' : ''}"><input type="checkbox" class="check" data-sel="${esc(p.id)}" ${S.sel.has(p.id) ? 'checked' : ''} ${blocked ? 'disabled' : ''}>
        <div class="grow"><div class="name">${esc(p.cls.nombre)}${p.tipo === 'appx' ? ' <span class="badge gris">Store</span>' : ''}</div><div class="sub">${esc(p.cls.nota || [p.editor, p.version].filter(Boolean).join(' · '))}</div>
        ${p.imp.why.length ? `<div class="why-line">${esc(p.imp.why.join(' · '))}</div>` : ''}
        ${S.settings.modoExperto ? `<div class="tech">${esc(p.tipo === 'appx' ? p.paquete : (p.desinstalarSilencioso || p.desinstalar))}</div>` : ''}</div>
        ${p.cls.color ? `<span class="badge ${p.cls.color}">${L(...COLOR_TXT[p.cls.color])}</span>` : ''}
        <span class="badge ${ic}" title="${esc(p.imp.why.join(', ') || L('No hace nada mientras no lo usas', 'Does nothing while not in use'))}">${L(ies, ien)}</span>
        <div class="weight"><b>${p.tamano ? fmtBytes(p.tamano) : '—'}</b><i style="width:${p.tamano ? Math.max(3, Math.round(100 * p.tamano / maxSize)) : 0}%"></i></div></label>`;
    }).join('') : `<div class="empty">${L('No hay programas que coincidan.', 'No matching programs.')}</div>`}</div>
    ${S.sel.size ? `<div class="actionbar"><div class="info">${L(`<b>${S.sel.size}</b> seleccionado(s)`, `<b>${S.sel.size}</b> selected`)}${selSize ? ' · ' + L('liberarás ', 'frees ') + '<b>' + fmtBytes(selSize) + '</b>' : ''}. ${L('Se buscarán sus restos al terminar.', 'Leftovers will be searched afterwards.')}</div>
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
  S.updSel = S.updSel || new Set();
  const wu = u.windows;
  const big = wu.filter((x) => x.grande);
  const normal = wu.filter((x) => !x.grande);
  const tipoTxt = { seguridad: L('Seguridad', 'Security'), driver: 'Driver', windows: 'Windows' };
  const keysWu = normal.map((x) => 'wu:' + x.id), keysWg = u.apps.map((a) => 'wg:' + a.id);
  const allOn = (keys) => keys.length && keys.every((k) => S.updSel.has(k));
  const selAll = (grp, keys) => keys.length ? `<button class="link sel-all" data-updall="${grp}">${allOn(keys) ? L('Quitar todos', 'Untick all') : L('Marcar todos', 'Tick all')}</button>` : '';
  const nSel = [...S.updSel].filter((k) => keysWu.includes(k) || keysWg.includes(k)).length;
  const chk = (key) => `<input type="checkbox" class="check" data-upd="${esc(key)}" ${S.updSel.has(key) ? 'checked' : ''} ${S.busy ? 'disabled' : ''}>`;
  return `<div class="view">${banners()}${head(L('Actualizaciones', 'Updates'), L('Marca lo que quieras actualizar y hazlo de una vez, o actualízalo todo. Solo fuentes oficiales: Windows Update y winget (el gestor de apps de Microsoft).', 'Tick what you want to update and do it in one go, or update everything. Official sources only: Windows Update and winget (Microsoft\'s app manager).'), `<button class="btn ghost" data-act="loadUpdates" ${S.busy ? 'disabled' : ''}>${L('Buscar de nuevo', 'Search again')}</button>`)}
    ${progressHTML()}
    ${u.error ? `<div class="banner warn"><div class="grow">${L('Windows Update no respondió', 'Windows Update did not respond')}: ${esc(u.error)}</div></div>` : ''}
    <h2>${L('Windows y drivers', 'Windows & drivers')}<span class="sub">${normal.length} ${L('disponibles', 'available')}</span>${selAll('wu', keysWu)}</h2>
    ${normal.length ? `<div class="list">${normal.map((x) => `<label class="row">${chk('wu:' + x.id)}<div class="grow"><div class="name">${esc(x.titulo)}</div><div class="sub">${tipoTxt[x.tipo]} · ${fmtBytes(x.tamano)}${x.reinicio ? ' · ' + L('pide reiniciar', 'needs restart') : ''}${x.opcional ? ' · ' + L('opcional', 'optional') : ''}</div></div>
      <span class="badge ${x.tipo === 'seguridad' ? 'rojo' : x.opcional ? 'gris' : 'amarillo'}">${x.tipo === 'seguridad' ? L('Importante', 'Important') : x.opcional ? L('Opcional', 'Optional') : L('Recomendado', 'Recommended')}</span>
      <button class="btn small" data-wu="${esc(x.id)}" ${S.busy ? 'disabled' : ''}>${L('Instalar', 'Install')}</button></label>`).join('')}</div>` : `<div class="banner good"><div class="grow"><b>${L('Windows está al día', 'Windows is up to date')}</b></div></div>`}
    ${big.length ? `<div class="banner info" style="margin-top:12px"><div class="grow"><b>${L('Hay una versión nueva de Windows disponible', 'A new Windows version is available')}</b> · ${esc(big[0].titulo)}. ${L('Por seguridad, RetroLimpia no la instala automáticamente: hazlo desde Configuración > Windows Update cuando tengas tiempo.', 'For safety RetroLimpia does not install it automatically: do it from Settings > Windows Update when you have time.')}</div></div>` : ''}
    <h2>${L('Tus programas', 'Your programs')}<span class="sub">${u.apps.length} ${L('con versión nueva', 'with a new version')}</span>${selAll('wg', keysWg)}</h2>
    ${!u.wingetDisponible ? `<div class="banner warn"><div class="grow">${L('Falta "Instalador de aplicaciones" (winget). Instálalo gratis desde Microsoft Store para poder actualizar tus programas.', 'App Installer (winget) is missing. Install it free from the Microsoft Store to update your programs.')}</div><button class="btn small" data-open="https://apps.microsoft.com/detail/9NBLGGH4NNS1">${L('Abrir Store', 'Open Store')}</button></div>`
      : u.apps.length ? `<div class="list">${u.apps.map((a) => `<label class="row">${chk('wg:' + a.id)}<div class="grow"><div class="name">${esc(a.nombre)}</div><div class="sub">${esc(a.actual)} → <b style="color:var(--verde)">${esc(a.nueva)}</b></div>${S.settings.modoExperto ? `<div class="tech">${esc(a.id)}</div>` : ''}</div><button class="btn small" data-wg="${esc(a.id)}" ${S.busy ? 'disabled' : ''}>${L('Actualizar', 'Update')}</button></label>`).join('')}</div>`
      : `<div class="banner good"><div class="grow"><b>${L('Tus programas están al día', 'Your programs are up to date')}</b></div></div>`}
    ${(normal.length || u.apps.length) ? `<div class="actionbar">
      ${nSel ? `<div class="info">${L(`<b>${nSel}</b> seleccionado(s). Se instalan uno detrás de otro, sin ventanas.`, `<b>${nSel}</b> selected. Installed one after another, no pop-ups.`)}</div>
        <button class="btn ghost" data-act="updNone">${L('Quitar selección', 'Clear')}</button>
        <button class="btn primary" data-act="updateSel" ${S.busy ? 'disabled' : ''}>${L('Actualizar seleccionados', 'Update selected')} (${nSel})</button>`
      : `<div class="info">${L('Marca las casillas para elegir qué actualizar. "Todo" no incluye opcionales de Windows ni cambios de versión.', 'Tick boxes to choose what to update. "All" excludes optional Windows updates and version upgrades.')}</div>
        <button class="btn primary" data-act="updateAll" ${S.busy ? 'disabled' : ''}>${L('Actualizar todo', 'Update all')}</button>`}</div>` : ''}</div>`;
}
