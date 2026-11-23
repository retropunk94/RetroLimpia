'use strict';
// ============================================================ Procesos (avanzado)
async function loadProcs() {
  if (S.procLoading) return;
  S.procLoading = true;
  try {
    const r = obj(await rl.run('procesos', { accion: 'listar' }));
    S.procs = { procesos: arr(r.procesos).map((x) => ({ ...x, pids: arr(x.pids) })), ramTotal: r.ramTotal || 0, ramLibre: r.ramLibre || 0, cpuTotal: r.cpuTotal || 0, at: Date.now() };
  } catch (e) { if (!isCancel(e)) S.procError = String(e.message || e).slice(0, 200); }
  finally { S.procLoading = false; if (S.view === 'procesos') render(); }
}
setInterval(() => { if (document.hidden) return; if (S.view === 'procesos' && S.settings.procesosAviso && !S.procPaused && !S.procConfirm) loadProcs(); }, 3000);

function showProcWarning() {
  $('#modal').innerHTML = `<div class="modal warn-modal" role="dialog" aria-modal="true">
    <h2>⚠ ${L('Zona para usuarios avanzados', 'Advanced users only')}</h2>
    <p class="lead">${L('Aquí ves todo lo que está funcionando ahora en tu PC y puedes cerrarlo a la fuerza. <b>Úsalo solo si sabes lo que estás haciendo.</b>', 'Here you see everything running on your PC right now and can force it to close. <b>Only use it if you know what you are doing.</b>')}</p>
    <div class="why"><span class="n">1</span><div><b>${L('Puedes perder trabajo', 'You can lose work')}</b><p>${L('Cerrar un programa a la fuerza no guarda nada: si tenías un documento o una partida sin guardar, se pierde.', 'Force-closing a program saves nothing: unsaved documents or games are lost.')}</p></div></div>
    <div class="why"><span class="n">2</span><div><b>${L('Algunas cosas dejan de funcionar', 'Some things stop working')}</b><p>${L('El sonido, la red, el antivirus o la barra de tareas dependen de procesos que no reconocerías por el nombre.', 'Sound, network, antivirus or the taskbar depend on processes you would not recognise by name.')}</p></div></div>
    <div class="why"><span class="n">3</span><div><b>${L('Lo vital está protegido', 'Vital parts are protected')}</b><p>${L('Los procesos imprescindibles de Windows aparecen bloqueados y no se pueden cerrar desde aquí. Si no reconoces algo, déjalo como está.', 'Essential Windows processes are locked and cannot be closed here. If you do not recognise something, leave it alone.')}</p></div></div>
    <div class="foot"><button class="btn primary" data-act="procOk">${L('Entiendo, continuar', 'I understand, continue')}</button><button class="btn ghost" data-act="procBack">${L('Mejor no', 'Better not')}</button></div></div>`;
  $('#modal').classList.remove('hidden');
}

const PROC_LVL = {
  ram: (b) => (b >= 1.5 * GB ? ['rojo', 'Mucha', 'A lot'] : b >= 400 * 1024 ** 2 ? ['amarillo', 'Bastante', 'Quite a bit'] : ['verde', 'Poca', 'Little']),
  cpu: (c) => (c >= 25 ? ['rojo', 'Mucho', 'A lot'] : c >= 5 ? ['amarillo', 'Algo', 'Some'] : ['verde', 'Poco', 'Little'])
};
function procRow(x, maxRam) {
  const name = x.descripcion && x.descripcion.length < 60 ? x.descripcion : x.nombre;
  const [rc, res, ren] = PROC_LVL.ram(x.ram), [cc, ces, cen] = PROC_LVL.cpu(x.cpu);
  const heavy = !x.windows && (x.ram >= 1.5 * GB || x.cpu >= 25);
  const confirming = S.procConfirm === x.nombre;
  const hue = [...x.nombre].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  let action;
  if (x.critico) action = `<span class="badge gris" title="${L('Windows lo necesita para funcionar', 'Windows needs it to work')}">🔒 ${L('Protegido', 'Protected')}</span>`;
  else if (x.windows && !S.settings.modoExperto) action = `<span class="badge gris" title="${L('Es parte de Windows. Actívalo en modo experto si de verdad necesitas cerrarlo.', 'Part of Windows. Enable expert mode if you really need to close it.')}">${L('Mejor no tocar', 'Better leave it')}</span>`;
  else if (confirming) action = `<button class="btn small danger" data-pkill="${esc(x.nombre)}">${L('Sí, cerrar', 'Yes, close')}</button><button class="btn small ghost" data-act="procNo">${L('No', 'No')}</button>`;
  else action = `<button class="btn small ghost" data-pask="${esc(x.nombre)}">${L('Cerrar', 'Close')}</button>`;
  return `<div class="row prow2 ${confirming ? 'confirming' : ''}">
    <span class="pavatar" style="--h:${hue}">${esc((name[0] || '?').toUpperCase())}</span>
    <div class="grow"><div class="name">${esc(name)}${x.cantidad > 1 ? ` <span class="meta" title="${L('Este programa funciona repartido en varias partes', 'This program runs split into several parts')}">· ${x.cantidad} ${L('partes', 'parts')}</span>` : ''}</div>
      <div class="sub">${x.titulo ? '🪟 ' + esc(x.titulo) : esc(x.empresa || x.nombre + '.exe')}</div>
      ${confirming ? `<div class="why-line">${L('¿Seguro? Se cerrará a la fuerza y se perderá lo que no hayas guardado.', 'Sure? It will be force-closed and anything unsaved will be lost.')}</div>` : heavy ? `<div class="why-line">💡 ${L('Está usando mucho. Si no lo necesitas ahora, cerrarlo liberará recursos.', 'It is using a lot. If you do not need it now, closing it frees resources.')}</div>` : ''}
      ${S.settings.modoExperto && x.ruta ? `<div class="tech">${esc(x.ruta)}</div>` : ''}</div>
    <div class="pmet"><small>${L('Memoria', 'Memory')}</small><b>${fmtBytes(x.ram)}</b><span class="lvl ${rc}">${L(res, ren)}</span></div>
    <div class="pmet"><small>${L('Procesador', 'CPU')}</small><b>${x.cpu.toFixed(1)}%</b><span class="lvl ${cc}">${L(ces, cen)}</span></div>
    <div class="pact">${action}</div></div>`;
}

function viewProcesos() {
  const intro = head(L('Procesos (avanzado)', 'Processes (advanced)'), L('Qué programas están gastando la memoria y el procesador de tu PC ahora mismo.', 'Which programs are using your PC\'s memory and processor right now.'),
    `<button class="btn ghost" data-act="procPause">${S.procPaused ? L('Reanudar', 'Resume') : L('Pausar', 'Pause')}</button>`);
  if (!S.settings.procesosAviso) {
    if ($('#modal').classList.contains('hidden')) setTimeout(showProcWarning, 0);
    return `<div class="view">${banners()}${intro}</div>`;
  }
  if (!S.procs) { loadProcs(); return `<div class="view">${banners()}${intro}<div class="progress-card"><div class="msg"><span><b>${L('Mirando qué está funcionando...', 'Looking at what is running...')}</b></span></div><div class="pbar indet"><i></i></div></div></div>`; }
  const pr = S.procs;
  S.procSort = S.procSort || 'ram';
  const q = (S.procSearch || '').toLowerCase().trim();
  const match = (x) => !q || [x.nombre, x.descripcion, x.titulo, x.empresa].join(' ').toLowerCase().includes(q);
  const small = (x) => x.ram < 30 * 1024 ** 2 && x.cpu < 0.5;
  const sorter = (a, b) => (S.procSort === 'cpu' ? b.cpu - a.cpu || b.ram - a.ram : b.ram - a.ram);
  const all = pr.procesos.filter(match).sort(sorter);
  const showSmall = S.procShowSmall || !!q;
  const groups = [
    ['usando', '🪟', L('Programas que estás usando', 'Programs you are using'), L('Tienen una ventana abierta.', 'They have an open window.'), all.filter((x) => x.ventana && !x.windows)],
    ['fondo', '⚙️', L('Funcionando en segundo plano', 'Running in the background'), L('Sin ventana: actualizadores, ayudantes de otros programas, launchers...', 'No window: updaters, helpers of other programs, launchers...'), all.filter((x) => !x.ventana && !x.windows)],
    ['windows', '🛡️', L('Partes de Windows', 'Parts of Windows'), L('Windows las necesita. Mejor no tocarlas.', 'Windows needs them. Better leave them alone.'), all.filter((x) => x.windows)]
  ];
  const ramUsada = pr.ramTotal - pr.ramLibre;
  const ramPct = pr.ramTotal ? Math.round(100 * ramUsada / pr.ramTotal) : 0;
  const mood = (pct) => (pct >= 90 ? ['rojo', 'Al límite', 'Maxed out'] : pct >= 70 ? ['amarillo', 'Ocupado', 'Busy'] : ['verde', 'Tranquilo', 'Relaxed']);
  const [mc, mes, men] = mood(ramPct), [pc, pes, pen] = mood(pr.cpuTotal);
  let hidden = 0;
  const sections = groups.map(([id, ico, title, desc, list]) => {
    const collapsed = id === 'windows' && !S.procShowWin && !q;
    const vis = showSmall ? list : list.filter((x) => !small(x));
    hidden += list.length - vis.length;
    if (!list.length) return '';
    return `<h2>${ico} ${title}<span class="sub">${list.length} · ${desc}</span>${id === 'windows' ? `<button class="link sel-all" data-act="procWin">${collapsed ? L('Mostrar', 'Show') : L('Ocultar', 'Hide')}</button>` : ''}</h2>
      ${collapsed ? '' : vis.length ? `<div class="list">${vis.map((x) => procRow(x)).join('')}</div>` : `<div class="card meta">${L('Solo hay procesos pequeños aquí.', 'Only small processes here.')}</div>`}`;
  }).join('');
  return `<div class="view">${banners()}${intro}
    <div class="banner info"><div class="grow">💡 ${L('<b>¿Tu PC va lento?</b> Aquí ves quién tiene la culpa. Cada programa abierto usa parte de la memoria y del procesador. Cerrar algo desde aquí es cerrarlo a la fuerza: <b>no guarda nada</b>.', '<b>PC feeling slow?</b> Here you see who is to blame. Every open program uses some memory and processor. Closing something here force-closes it: <b>nothing is saved</b>.')}</div></div>
    <div class="grid c2" style="margin-bottom:14px">
      <div class="card"><h3>${L('Memoria (RAM)', 'Memory (RAM)')}</h3><div class="big">${fmtBytes(ramUsada)} <span class="meta">${L('de', 'of')} ${fmtBytes(pr.ramTotal)}</span> <span class="lvl ${mc}">${L(mes, men)}</span></div><div class="meter"><i class="${mc === 'verde' ? '' : mc}" style="width:${ramPct}%"></i></div></div>
      <div class="card"><h3>${L('Procesador', 'Processor')}</h3><div class="big">${pr.cpuTotal}% <span class="lvl ${pc}">${L(pes, pen)}</span></div><div class="meter"><i class="${pc === 'verde' ? '' : pc}" style="width:${Math.max(1, pr.cpuTotal)}%"></i></div></div>
    </div>
    <div class="toolbar"><input class="search" id="procSearch" placeholder="${L('Buscar un programa (ej. chrome, discord, obs)...', 'Search a program (e.g. chrome, discord, obs)...')}" value="${esc(S.procSearch || '')}">
      <button class="chip ${S.procSort === 'ram' ? 'on' : ''}" data-psort="ram">${L('Más memoria', 'Most memory')}</button><button class="chip ${S.procSort === 'cpu' ? 'on' : ''}" data-psort="cpu">${L('Más procesador', 'Most CPU')}</button></div>
    ${q && !all.length ? `<div class="empty">${L('No hay nada funcionando con ese nombre.', 'Nothing running with that name.')}</div>` : sections}
    ${hidden ? `<p class="meta" style="margin-top:14px;text-align:center"><button class="link" data-act="procSmall">${L(`Mostrar también ${hidden} procesos pequeños`, `Also show ${hidden} small processes`)}</button></p>` : S.procShowSmall && !q ? `<p class="meta" style="margin-top:14px;text-align:center"><button class="link" data-act="procSmall">${L('Ocultar los procesos pequeños', 'Hide small processes')}</button></p>` : ''}
    ${S.procPaused ? `<p class="meta" style="text-align:center">${L('En pausa: los datos no se actualizan.', 'Paused: data is not refreshing.')}</p>` : ''}</div>`;
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

function updStatusText() {
  const up = S.upd || {};
  if (up.estado === 'lista') return L(`La versión ${up.version} está descargada y lista para instalar.`, `Version ${up.version} is downloaded and ready to install.`);
  if (up.estado === 'descargando') return L(`Descargando la versión ${up.version || ''}... ${up.pct || 0}%`, `Downloading version ${up.version || ''}... ${up.pct || 0}%`);
  if (up.estado === 'error') return L('No se pudo comprobar (¿sin internet?). Se volverá a intentar solo.', 'Could not check (offline?). It will retry by itself.');
  if (S.appUpdate && S.appUpdate.modo === 'manual') return S.appUpdate.disponible ? L(`Hay una versión nueva: ${S.appUpdate.version}.`, `New version available: ${S.appUpdate.version}.`) : L('Tienes la última versión.', 'You have the latest version.');
  if (up.estado === 'al-dia') return L('Tienes la última versión. RetroLimpia lo comprueba solo cada vez que se abre.', 'You have the latest version. RetroLimpia checks by itself every time it opens.');
  return L('RetroLimpia busca actualizaciones solo cada vez que se abre y las instala con un clic.', 'RetroLimpia checks for updates every time it opens and installs them with one click.');
}

function viewAjustes() {
  const s = S.settings;
  const sw = (key, title, desc) => `<div class="setting"><div class="grow"><b>${title}</b><span>${desc}</span></div><label class="switch"><input type="checkbox" data-setting="${key}" ${(key === 'notificaciones' ? s[key] !== false : s[key]) ? 'checked' : ''}><span></span></label></div>`;
  const repo = repoUrl();
  return `<div class="view">${banners()}${head(L('Ajustes', 'Settings'), L('Casi nadie necesita cambiar nada aquí.', 'Most people never need to change anything here.'))}
    <div class="card">
      <div class="setting"><div class="grow"><b>${L('Idioma', 'Language')}</b></div><select data-setting="idioma"><option value="es" ${s.idioma === 'es' ? 'selected' : ''}>Español</option><option value="en" ${s.idioma === 'en' ? 'selected' : ''}>English</option></select></div>
      <div class="setting"><div class="grow"><b>${L('Iniciar con Windows y avisarme', 'Start with Windows and remind me')}</b><span>${L('Revisa en silencio cada cierto tiempo y te manda una notificación si hay basura o actualizaciones. Recomendado.', 'Quietly checks every so often and notifies you about junk or updates. Recommended.')}</span></div><label class="switch"><input type="checkbox" data-autostart ${s.inicioWindows ? 'checked' : ''}><span></span></label></div>
      ${s.inicioWindows ? `<div class="setting"><div class="grow"><b>${L('Frecuencia de revisión', 'Check frequency')}</b><span>${s.ultimaRevision ? L('Última revisión: ', 'Last check: ') + new Date(s.ultimaRevision).toLocaleString() : L('Todavía no ha revisado.', 'No check yet.')}</span></div>${freqSelect('data-setting="frecuenciaDias"')} <button class="btn small ghost" data-act="checkNow">${L('Revisar ahora', 'Check now')}</button></div>` : ''}
      ${s.inicioWindows ? sw('notificaciones', L('Notificaciones', 'Notifications'), L('Si las desactivas, RetroLimpia sigue revisando en silencio: verás el resumen pasando el ratón por su icono junto al reloj, o aquí al abrirlo.', 'If you turn them off, RetroLimpia keeps checking quietly: hover its icon next to the clock or open it here to see the summary.')) + (s.ultimoResumen ? `<div class="setting"><div class="grow"><b>${L('Última revisión automática', 'Last automatic check')}</b><span>${esc(s.ultimoResumen)}</span></div></div>` : '') : ''}
      ${sw('restosAutomaticos', L('Borrar restos seguros automáticamente', 'Remove safe leftovers automatically'), L('Al desinstalar, mueve a la cuarentena los restos que seguro son del programa, sin preguntar.', 'After uninstalling, quarantine leftovers that surely belong to the program without asking.'))}
      ${sw('puntoRestauracion', L('Crear punto de restauración antes de cambios', 'Create a restore point before changes'), L('Muy recomendado. Tarda unos segundos.', 'Highly recommended. Takes a few seconds.'))}
      <div class="setting"><div class="grow"><b>${L('Días en cuarentena', 'Days in quarantine')}</b><span>${L('Cuánto tiempo se guardan las cosas quitadas antes de borrarlas.', 'How long removed items are kept before deletion.')}</span></div><select data-setting="diasCuarentena">${[3, 7, 14, 30].map((d) => `<option value="${d}" ${s.diasCuarentena == d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div class="setting"><div class="grow"><b>${L('Modo bajos recursos', 'Low-resource mode')}</b><span>${L('Quita animaciones y efectos, y hace que RetroLimpia trabaje con menos prioridad para que tu PC no se ponga lento. En automático se activa solo en PCs con 4 GB de RAM o menos o con disco duro mecánico. Además, hace los análisis de uno en uno para no saturar el disco.', 'Removes animations and effects, and makes RetroLimpia work at lower priority so your PC stays responsive. Automatic turns it on for PCs with 4 GB of RAM or less or with a mechanical hard drive. It also runs checks one at a time so the disk is not overloaded.')}${S.info.discoLento ? ' ' + L('(Tu disco de Windows es mecánico: está activado.)', '(Your Windows drive is mechanical: it is on.)') : S.info.equipoLimitado ? ' ' + L('(Tu PC tiene pocos recursos: está activado.)', '(Your PC has limited resources: it is on.)') : ''}</span></div><select data-setting="modoLigero"><option value="auto" ${(s.modoLigero || 'auto') === 'auto' ? 'selected' : ''}>${L('Automático', 'Automatic')}</option><option value="on" ${s.modoLigero === 'on' ? 'selected' : ''}>${L('Siempre activado', 'Always on')}</option><option value="off" ${s.modoLigero === 'off' ? 'selected' : ''}>${L('Desactivado', 'Off')}</option></select></div>
      <div class="setting"><div class="grow"><b>${L('Retro, la mascota', 'Retro, the mascot')}</b><span>${L('El ojo de RetroLimpia que reacciona a lo que pasa y te da consejos. Si te molesta, déjalo quieto o escóndelo.', 'The RetroLimpia eye that reacts to what happens and gives tips. If it bothers you, keep it still or hide it.')}</span></div><select data-setting="mascota"><option value="activa" ${(s.mascota || 'activa') === 'activa' ? 'selected' : ''}>${L('Activa', 'Active')}</option><option value="tranquila" ${s.mascota === 'tranquila' ? 'selected' : ''}>${L('Tranquila (quieta)', 'Calm (still)')}</option><option value="off" ${s.mascota === 'off' ? 'selected' : ''}>${L('Escondida', 'Hidden')}</option></select></div>
      ${sw('modoExperto', L('Modo experto', 'Expert mode'), L('Muestra detalles técnicos y permite quitar elementos marcados en rojo. Solo si sabes lo que haces.', 'Shows technical details and allows removing red items. Only if you know what you are doing.'))}
    </div>
    <h2>${L('Llevar mi configuración a otro PC', 'Take my settings to another PC')}</h2>
    <div class="card"><p class="meta" style="margin-top:0">${L('Guarda en un archivo tus ajustes, tus juegos del Modo Juego y lo que apagaste en Privacidad. En el otro PC, instala RetroLimpia y pulsa "Cargar configuración". No guarda nada personal.', 'Save your settings, your Game Mode games and what you turned off in Privacy to a file. On the other PC, install RetroLimpia and press "Load settings". Nothing personal is saved.')}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-act="cfgExport" ${S.busy ? 'disabled' : ''}>💾 ${L('Guardar configuración', 'Save settings')}</button><button class="btn" data-act="cfgImport" ${S.busy ? 'disabled' : ''}>📂 ${L('Cargar configuración', 'Load settings')}</button></div></div>
    <h2>${L('Acerca de RetroLimpia', 'About RetroLimpia')}</h2>
    <div class="card"><div class="kv"><span>${L('Versión', 'Version')}</span><span>${esc(S.info.version)}</span><span>${L('Licencia', 'License')}</span><span>GPL-3.0 (${L('código abierto', 'open source')})</span><span>${L('Privacidad', 'Privacy')}</span><span>${L('Sin telemetría. Solo envía un reporte si tú lo pides, después de ver qué se manda.', 'No telemetry. It only sends a report if you ask, after showing you what is sent.')}</span></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn" data-act="tour">🧭 ${L('Ver el tour de bienvenida', 'Watch the welcome tour')}</button><button class="btn" data-act="miniTour">✨ ${L('Tour de lo nuevo en la 4.0', '4.0 what is new tour')}</button><button class="btn" data-act="news">📰 ${L('Ver novedades', "What's new")}</button><button class="btn" data-act="trust">${L('¿Por qué Windows o mi antivirus avisan?', 'Why does Windows or my antivirus warn me?')}</button>${S.info.reportes ? `<button class="btn" data-act="reportOpen">🐞 ${L('Reportar un problema', 'Report a problem')}</button>` : ''}${S.info.discord ? `<button class="btn ghost" data-open="${S.info.discord}">💬 ${L('Comunidad en Discord', 'Discord community')}</button>` : ''}
      ${repo ? `<button class="btn ghost" data-open="${repo}">${L('Ver el código', 'View the code')}</button>` : ''}
      <button class="btn ghost" data-act="checkUpdate" ${S.checkingUpd ? 'disabled' : ''}>${S.checkingUpd ? L('Buscando...', 'Checking...') : L('Buscar actualizaciones', 'Check for updates')}</button></div>
      <p class="meta" style="margin-top:12px">${updStatusText()}</p></div></div>`;
}

// Cada pestaña carga lo suyo en segundo plano, sin bloquear a las demás.
// Puedes cambiar de pestaña cuando quieras: la carga sigue y al volver ya está lista.
const VIEW_SCRIPTS = { programas: ['programas', 'inicio'], limpieza: ['limpieza'], arranque: ['inicio'], hardware: ['hardware'], drivers: ['drivers', 'hardware'], actualizaciones: ['actualizaciones'], deshacer: ['cuarentena', 'restauracion'] };
const cleanErr = (e) => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '').slice(0, 300);
function bgScriptActive(script) { return Object.values(S.loads || {}).some((l) => (l.scripts || []).includes(script)); }
function loadCardHTML(title) {
  const l = (S.loads || {})[title] || { start: Date.now() };
  const sp = (l.scripts || []).map((k) => (S.sp || {})[k]).filter(Boolean);
  const cur = sp.find((x) => x.pct < 100) || sp[sp.length - 1];
  const pct = cur ? Math.min(99, Math.round(cur.pct || 0)) : 0;
  return `<div class="progress-card" id="loadCard" data-title="${esc(title)}"><div class="msg"><span><b>${L('Cargando', 'Loading')} · ${esc(title)}</b>${cur && cur.msg ? ' · ' + esc(cur.msg) : ''}</span><span class="eta">${pct ? pct + '% · ' + fmtEta(l.start, pct) : ''}</span></div>
  <div class="prow"><div class="pbar ${pct ? '' : 'indet'}"><i style="width:${pct}%"></i></div></div>
  <p class="meta" style="margin:10px 0 0">${L('Puedes ir a otra sección mientras tanto: esto sigue cargando y al volver estará listo.', 'You can visit another section meanwhile: this keeps loading and will be ready when you come back.')}</p></div>`;
}
function loadingView(title, loader, msg) {
  S.failed = S.failed || {}; S.loads = S.loads || {};
  if (S.failed[title]) {
    return `<div class="view">${banners()}${head(title, '')}<div class="banner bad"><div class="grow"><b>${L('No se pudo leer esta información', 'Could not read this information')}</b> · ${esc(S.failed[title])}</div><button class="btn small" data-retry="${esc(title)}">${L('Reintentar', 'Retry')}</button></div></div>`;
  }
  if (!S.loads[title]) {
    S.loads[title] = { start: Date.now(), scripts: VIEW_SCRIPTS[S.view] || [] };
    setTimeout(async () => {
      try { await loader(); }
      catch (e) {
        // Si se canceló (por ejemplo, desde otra tarea), no es un error: se vuelve a cargar al entrar
        if (!/CANCELADO/.test(String(e && e.message || e))) S.failed[title] = cleanErr(e);
      }
      finally { delete S.loads[title]; render(); }
    }, 0);
  }
  return `<div class="view">${banners()}${head(title, msg || L('Un momento...', 'One moment...'))}${loadCardHTML(title)}</div>`;
}
function updateLoadCard() {
  const c = document.getElementById('loadCard');
  if (c) c.outerHTML = loadCardHTML(c.dataset.title);
}

// ============================================================ Exportar / importar configuración
async function cfgExport() {
  let privacidad = [];
  try { const r = obj(await rl.run('privacidad', { accion: 'listar' })); privacidad = arr(r.ajustes).filter((a) => a.aplicado).map((a) => a.id); } catch { /* sin privacidad: se guarda el resto */ }
  const r = await rl.configExport({ privacidad });
  if (r && r.ruta) toast(L('Configuración guardada en: ', 'Settings saved to: ') + r.ruta);
}
async function cfgImport() {
  const r = await rl.configImport();
  if (!r) return;
  if (r.error) return toast(r.error, 'err');
  S.settings = r.ajustes;
  const priv = arr(r.privacidad).filter((id) => PRIVACIDAD.some((x) => x[0] === id) || ['ver_extensiones', 'explorador_este_equipo'].includes(id));
  if (priv.length && confirm(L(`La configuración trae ${priv.length} ajuste(s) de privacidad (anuncios y datos apagados). ¿Aplicarlos también en este PC?`, `The settings include ${priv.length} privacy change(s). Apply them on this PC too?`))) {
    await taskC(L('Aplicando privacidad', 'Applying privacy'), async () => { await rl.run('privacidad', { accion: 'aplicar', ids: priv }); S.privacidad = null; });
  }
  aplicarModoLigero(); render();
  toast(L('Configuración cargada.', 'Settings loaded.') + (r.juegosQuitados > 0 ? L(` ${r.juegosQuitados} juego(s) no están en este PC y no se añadieron.`, ` ${r.juegosQuitados} game(s) are not on this PC and were skipped.`) : ''));
}
