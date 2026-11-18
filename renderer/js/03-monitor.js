'use strict';
// ============================================================ Ventana de seguimiento al desinstalar
// Enseña en vivo qué hace RetroLimpia y dónde (rutas reales), y al final si quedó algo en el registro.
function monStart(list) {
  S.mon = { items: list.map((p) => ({ nombre: p.cls.nombre, estado: 'wait', log: [], res: null })), cur: -1, done: false };
  $('#monitor').classList.remove('hidden');
  renderMonitor();
}
function monLog(entry) {
  if (!S.mon || S.mon.cur < 0) return;
  const it = S.mon.items[S.mon.cur];
  it.log.push(entry);
  const box = document.getElementById('monLog');
  if (box) { box.insertAdjacentHTML('beforeend', monLine(entry)); box.scrollTop = box.scrollHeight; }
}
const MON_ICO = { paso: '▶', info: '•', buscar: '🔍', hallado: '📌', ok: '✔', aviso: '⚠', error: '✖' };
function monLine(l) {
  const ruta = l.ruta ? `<div class="mon-path"><code>${esc(l.ruta)}</code>${l.tipo !== 'paso' && /^[a-z]:\\/i.test(l.ruta) ? `<button class="link" data-reveal="${esc(l.ruta)}">${L('Abrir ubicación', 'Show in folder')}</button>` : /^HKEY_/.test(l.ruta) ? `<button class="link" data-copy="${esc(l.ruta)}">${L('Copiar', 'Copy')}</button>` : ''}</div>` : '';
  return `<div class="mon-line t-${esc(l.tipo)}"><span class="ico">${MON_ICO[l.tipo] || '•'}</span><div><div>${esc(S.settings.idioma === 'en' ? l.en : l.msg)}</div>${ruta}</div></div>`;
}
function monSummary(it) {
  const r = it.res;
  if (!r) return '';
  if (!r.ok && r.cancelado) return `<div class="mon-sum info">ℹ ${esc(r.mensaje || L('No se desinstaló. No se tocó nada.', 'Not uninstalled. Nothing was touched.'))}</div>`;
  if (!r.ok) return `<div class="mon-sum bad">✖ ${L('No se pudo desinstalar', 'Could not uninstall')}${r.mensaje ? ': ' + esc(r.mensaje) : ''}${S.info.reportes ? ` <button class="link" data-act="reportOpen" data-ctx="${esc(L('Desinstalar ', 'Uninstall ') + it.nombre)}">🐞 ${L('Reportar este problema', 'Report this problem')}</button>` : ''}</div>`;
  const reg = r.regRestos || [];
  const regAllMoved = reg.length && reg.every((x) => x.movido) && r.registroLimpio;
  const regTxt = !reg.length && r.registroLimpio
    ? `<div class="mon-sum good">✔ <b>${L('Registro limpio:', 'Registry clean:')}</b> ${L('no quedó ninguna entrada del programa.', 'no entries of the program remain.')}</div>`
    : regAllMoved
    ? `<div class="mon-sum good">✔ <b>${L('Registro limpio:', 'Registry clean:')}</b> ${L(`el programa dejó ${reg.length} entrada(s) y se movieron a la cuarentena.`, `the program left ${reg.length} entr(ies), moved to quarantine.`)}<ul>${reg.map((x) => `<li><code>${esc(x.ruta)}</code></li>`).join('')}</ul></div>`
    : `<div class="mon-sum warn">⚠ <b>${L(`Quedaron ${reg.length + (r.registroLimpio ? 0 : 1)} entrada(s) en el registro`, `${reg.length + (r.registroLimpio ? 0 : 1)} registry entries remained`)}</b>
        <ul>${reg.map((x) => `<li><code>${esc(x.ruta)}</code> · ${x.movido ? `<span class="ok">${L('movida a la cuarentena ✔', 'moved to quarantine ✔')}</span>` : `<span class="warn">${L('pendiente de que lo revises', 'waiting for your review')}</span>`}</li>`).join('')}
        ${r.registroLimpio ? '' : `<li><code>${esc(r.clave || '')}</code> · ${L('su entrada de desinstalación', 'its uninstall entry')}</li>`}</ul></div>`;
  const disco = r.archivos || [];
  const discoTxt = disco.length ? `<div class="mon-sum ${disco.every((x) => x.movido) ? 'good' : 'warn'}">${disco.every((x) => x.movido) ? '✔' : '⚠'} <b>${L(`${disco.length} resto(s) en disco`, `${disco.length} leftover(s) on disk`)}</b>
        <ul>${disco.map((x) => `<li><code>${esc(x.ruta)}</code> · ${x.movido ? `<span class="ok">${L('movido a la cuarentena ✔', 'moved to quarantine ✔')}</span>` : `<span class="warn">${L('pendiente de que lo revises', 'waiting for your review')}</span>`}</li>`).join('')}</ul></div>`
    : `<div class="mon-sum good">✔ <b>${L('Disco limpio:', 'Disk clean:')}</b> ${L('no quedaron carpetas ni archivos.', 'no folders or files remain.')}</div>`;
  return regTxt + discoTxt + (r.cuarentena ? `<div class="mon-sum info">🛟 ${L('Lo quitado está en la cuarentena unos días, por si quieres restaurarlo:', 'Removed items are kept in quarantine for a few days in case you want to restore them:')} <code>${esc(r.cuarentena)}</code> <button class="link" data-reveal="${esc(r.cuarentena)}">${L('Abrir', 'Open')}</button></div>` : '');
}
function monPctVal() {
  const m = S.mon; if (!m) return 0;
  const total = m.items.length || 1;
  const doneN = m.items.filter((x) => x.estado === 'ok' || x.estado === 'err' || x.estado === 'cancel').length;
  const sub = m.done ? 0 : Math.min(99, m.subPct || 0) / 100;
  return Math.min(100, Math.round(((doneN + (doneN < total ? sub : 0)) / total) * 100));
}
function monProgress(p) {
  const m = S.mon; if (!m || m.done) return;
  m.subPct = p.pct; m.subMsg = S.settings.idioma === 'en' ? p.en : p.msg; m.lastTick = Date.now();
  const v = monPctVal();
  const a = document.getElementById('monPct'); if (a) a.textContent = v + '%';
  const b = document.getElementById('monBar'); if (b) b.style.width = v + '%';
  const c = document.getElementById('monSub'); if (c) c.firstChild.textContent = m.subMsg + ' ';
}
// Reloj de "sigue trabajando": así se nota que no está colgado
setInterval(() => {
  const m = S.mon; if (!m || m.done || m.cur < 0) return;
  const it = m.items[m.cur]; if (!it || !it.t0) return;
  const el = document.getElementById('monTime');
  if (el) el.textContent = '· ' + Math.round((Date.now() - it.t0) / 1000) + ' s';
}, 1000);
function renderMonitor() {
  const m = S.mon;
  if (!m) return;
  const total = m.items.length;
  const doneN = m.items.filter((x) => x.estado === 'ok' || x.estado === 'err' || x.estado === 'cancel').length;
  const sel = m.view != null ? m.view : Math.max(0, m.cur);
  const it = m.items[sel] || m.items[0];
  const anyRegLeft = m.items.some((x) => x.res && x.res.ok && ((x.res.regRestos || []).some((r) => !r.movido) || !x.res.registroLimpio));
  $('#monitor').innerHTML = `<div class="monitor">
    <div class="mon-head"><div><h2>${m.done ? L('Desinstalación terminada', 'Uninstall finished') : L('Desinstalando...', 'Uninstalling...')}</h2>
      <p class="meta">${m.done ? (anyRegLeft ? L('Algunas entradas del registro quedaron pendientes: revísalas abajo.', 'Some registry entries are waiting for review below.') : L('Todo revisado. Aquí tienes lo que se hizo y dónde.', 'All checked. Here is what was done and where.')) : L(`Programa ${Math.min(doneN + 1, total)} de ${total} · Aquí ves en vivo qué hace RetroLimpia y en qué carpeta.`, `Program ${Math.min(doneN + 1, total)} of ${total} · Watch live what RetroLimpia does and where.`)}</p></div>
      <div class="mon-pct" id="monPct">${monPctVal()}%</div></div>
    <div class="pbar"><i id="monBar" style="width:${monPctVal()}%"></i></div>
    ${m.done ? '' : `<div class="mon-sub" id="monSub">${esc(m.subMsg || L('Preparando...', 'Preparing...'))} <span class="meta" id="monTime"></span></div>`}
    <div class="mon-body">
      <div class="mon-list">${m.items.map((x, i) => `<button class="mon-item ${i === sel ? 'on' : ''} s-${x.estado}" data-monview="${i}"><span class="dot"></span><span class="n">${esc(x.nombre)}</span>${x.res && x.res.ok ? ((x.res.regRestos || []).some((r) => !r.movido) || !x.res.registroLimpio ? '<span class="tag warn">⚠</span>' : '<span class="tag ok">✔</span>') : ''}</button>`).join('')}</div>
      <div class="mon-detail"><h3>${esc(it.nombre)}</h3>
        <div class="mon-log" id="${sel === m.cur && !m.done ? 'monLog' : 'monLogStatic'}">${it.log.map(monLine).join('') || `<p class="meta">${L('Esperando su turno...', 'Waiting for its turn...')}</p>`}</div>
        ${monSummary(it)}</div>
    </div>
    <div class="mon-foot">${m.done
      ? `<button class="btn ghost" data-act="monQuar">${L('Ver la cuarentena', 'Open quarantine')}</button><button class="btn primary" data-act="monClose">${L('Cerrar', 'Close')}</button>`
      : `<span class="meta">${L('No cierres RetroLimpia mientras trabaja.', 'Do not close RetroLimpia while it works.')}</span>${S.cancelRequested
        ? `<span class="meta">${L('Se detendrá tras este programa.', 'Will stop after this program.')}</span><button class="btn danger" data-act="monStopNow">${L('Detener ahora', 'Stop now')}</button>`
        : `<button class="btn ghost danger" data-act="cancel">${L('Detener después de este', 'Stop after this one')}</button>`}`}</div></div>`;
  const box = document.getElementById('monLog') || document.getElementById('monLogStatic');
  if (box) box.scrollTop = box.scrollHeight;
}

async function uninstallPrograms(list, motivo) {
  // list: programas ya clasificados. Devuelve resumen.
  const res = { ok: 0, fail: [], restosMovidos: 0, bytes: 0, dudosos: [], reinicio: false };
  monStart(list);
  await restorePoint(motivo);
  let i = 0;
  for (const p of list) {
    if (S.cancelRequested) { S.mon.items.slice(i).forEach((x) => { x.estado = 'cancel'; }); res.cancelado = true; break; }
    const it = S.mon.items[i];
    S.mon.cur = i; S.mon.view = null; S.mon.subPct = 0; S.mon.subMsg = ''; it.estado = 'run'; it.t0 = Date.now(); renderMonitor();
    i++;
    if (S.busy) { S.busy.label = L(`Desinstalando (${i}/${list.length})`, `Uninstalling (${i}/${list.length})`); S.busy.msg = p.cls.nombre; S.busy.pct = Math.round(((i - 1) / list.length) * 100); updateProgressOnly(); setStatus(S.busy.label + ' · ' + p.cls.nombre); }
    const r = obj(await rl.run('desinstalar', { ...p, cls: undefined, imp: undefined, etiqueta: p.cls.nombre, permitirVentana: true })
      .catch((e) => isCancel(e)
        ? { ok: false, cancelado: true, mensaje: L('Detenido por ti. Si su tienda o su asistente seguía abierto, ciérralo; RetroLimpia no tocó nada más.', 'Stopped by you. If its store or wizard was still open, close it; RetroLimpia touched nothing else.') }
        : { ok: false, mensaje: String(e.message || e) }));
    if (r.reinicio) res.reinicio = true;
    it.res = { ok: !!r.ok, metodo: r.metodo, plataforma: r.plataforma, cancelado: !!r.cancelado, registroLimpio: r.registroLimpio !== false, clave: p.clave, mensaje: r.mensaje, regRestos: [], archivos: [] };
    if (!r.ok && r.cancelado) { it.estado = 'cancel'; (res.saltados = res.saltados || []).push(p.cls.nombre); renderMonitor(); continue; }
    if (!r.ok) { it.estado = 'err'; res.fail.push(p.cls.nombre); renderMonitor(); continue; }
    res.ok++; ganar('desinstalados', 1);
    if (p.tipo === 'win32') {
      const rr = obj(await rl.run('residuos', { nombre: p.nombre, editor: p.editor, carpeta: p.carpeta, clave: p.clave, juego: !!r.plataforma }).catch(() => ({})));
      const restos = arr(rr.restos);
      const altos = restos.filter((x) => x.confianza === 'alta');
      const dudosos = restos.filter((x) => x.confianza !== 'alta');
      let movidos = [];
      if (S.settings.restosAutomaticos && altos.length) {
        monLog({ tipo: 'paso', msg: 'Guardando los restos en la cuarentena...', en: 'Moving leftovers to quarantine...' });
        const q = obj(await rl.run('cuarentena', { accion: 'mover', items: altos, motivo: L('Restos de ', 'Leftovers of ') + p.nombre }));
        const fallidos = arr(q.fallidos).map((f) => f.ruta);
        movidos = altos.filter((x) => !fallidos.includes(x.ruta));
        res.restosMovidos += q.guardados || 0; res.bytes += q.bytes || 0;
        if (q.id) it.res.cuarentena = 'C:\\ProgramData\\RetroLimpia\\Cuarentena\\' + q.id;
      } else dudosos.unshift(...altos);
      const mark = (x) => ({ ...x, movido: movidos.some((m) => m.ruta === x.ruta) });
      it.res.regRestos = restos.filter((x) => x.tipo === 'registro').map(mark);
      // Si la entrada de desinstalación quedó (pasa con Steam) y se movió a la cuarentena, el registro quedó limpio
      if (!it.res.registroLimpio && it.res.regRestos.some((x) => x.movido && x.ruta === p.clave)) it.res.registroLimpio = true;
      it.res.archivos = restos.filter((x) => x.tipo !== 'registro').map(mark);
      if (dudosos.length) res.dudosos.push({ programa: p.nombre, restos: dudosos.map((d) => ({ ...d, elegido: d.confianza === 'alta' })) });
    }
    it.estado = 'ok'; renderMonitor();
  }
  if (res.reinicio) S.needsReboot = true;
  S.mon.done = true; S.mon.view = null; renderMonitor();
  return res;
}

async function updateSelected() {
  const wuIds = [...S.updSel].filter((k) => k.startsWith('wu:')).map((k) => k.slice(3));
  const wgIds = [...S.updSel].filter((k) => k.startsWith('wg:')).map((k) => k.slice(3));
  if (!wuIds.length && !wgIds.length) return;
  await taskC(L('Actualizando lo seleccionado', 'Updating selection'), async () => {
    await restorePoint(L('Antes de actualizar', 'Before updating'));
    let ok = 0, bad = [];
    if (wuIds.length) {
      S.busy.label = 'Windows Update'; render();
      const r = await rl.run('actualizaciones', { accion: 'instalarWU', ids: wuIds });
      for (const x of arr(r.resultados)) { if (x.ok) { ok++; S.updSel.delete('wu:' + x.id); } else bad.push(x.titulo || x.id); }
      if (r.reinicio) S.needsReboot = true;
      S.updates.windows = S.updates.windows.filter((u) => !arr(r.resultados).some((x) => x.ok && x.id === u.id));
    }
    checkCancel();
    if (wgIds.length) {
      // Uno por uno: así Cancelar puede parar entre programa y programa
      let i = 0;
      for (const id of wgIds) {
        if (S.cancelRequested) break;
        const app = S.updates.apps.find((a) => a.id === id);
        S.busy.label = L(`Actualizando programas (${++i}/${wgIds.length})`, `Updating programs (${i}/${wgIds.length})`);
        S.busy.msg = app ? app.nombre : id; S.busy.pct = Math.round(((i - 1) / wgIds.length) * 100); render();
        const r = await rl.run('actualizaciones', { accion: 'winget', ids: [id] });
        const x = arr(r.resultados)[0];
        if (x && x.ok) { ok++; S.updSel.delete('wg:' + id); S.updates.apps = S.updates.apps.filter((a) => a.id !== id); }
        else bad.push(app ? app.nombre : id);
      }
    }
    toast(L(`${ok} actualizado(s) correctamente.`, `${ok} updated successfully.`));
    refreshAfter('actualizaciones', 'drivers', 'hardware', 'programas');
    if (bad.length) toast(L('No se pudieron actualizar (quizá estaban abiertos): ', 'Could not update (maybe they were open): ') + bad.join(', '), 'err');
  });
}

async function fixAll() {
  const chosen = S.scan.findings.filter((f) => f.elegido && f.accion);
  if (!chosen.length) { toast(L('No hay nada seleccionado para arreglar.', 'Nothing selected to fix.'), 'err'); return; }
  S.fix = { steps: chosen.map((f) => ({ id: f.accion, titulo: f.titulo, state: 'wait', extra: '' })), done: false, summary: [] };
  await taskC(L('Arreglando tu PC', 'Fixing your PC'), async () => {
    S.busy.msg = L('Creando punto de restauración...', 'Creating restore point...'); render();
    await rl.run('restauracion', { accion: 'crear', motivo: L('Antes de arreglar todo', 'Before fix all') }).catch(() => {});
    const saved = S.settings.puntoRestauracion; S.settings.puntoRestauracion = false; // ya creado
    try {
      let n = 0;
      for (const st of S.fix.steps) {
        if (S.cancelRequested) { st.state = 'cancel'; st.extra = L('Cancelado', 'Cancelled'); continue; }
        S.busy.pct = Math.round((n++ / S.fix.steps.length) * 100); S.busy.msg = st.titulo;
        st.state = 'run'; render();
        try {
          if (st.id === 'junk') {
            const cats = S.junk.categorias.filter((c) => c.color === 'verde' && c.tamano > 0).map((c) => c.id);
            const r = await rl.run('limpieza', { accion: 'limpiar', categorias: cats });
            ganar('liberado', r.liberado);
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
    S.fix.cancelado = S.fix.steps.some((x) => x.state === 'cancel');
    // Re-escaneo rápido para actualizar la nota
    S.busy.label = L('Volviendo a medir', 'Measuring again'); S.busy.msg = ''; render();
    await Promise.allSettled([loadJunk(), loadPrograms(), loadStartup()]);
    refreshAfter('actualizaciones', 'drivers', 'hardware', 'cuarentena');
    S.updates = S.updates ? { ...S.updates, windows: [], apps: [] } : S.updates;
    S.scan.findings = buildFindings(); S.scan.score = computeScore();
  });
  if (S.fix && !S.fix.cancelado) toast(L('¡Listo! Tu PC está más limpio.', 'Done! Your PC is cleaner.'));
}

// ---------- Actualización automática con cuenta atrás ----------
function updBannerHTML() {
  const up = S.upd || {};
  const v = esc(up.version || '');
  let body, btns;
  if (S.updInstalling) {
    body = `<b>${L('Instalando RetroLimpia ' + v + '...', 'Installing RetroLimpia ' + v + '...')}</b> · ${L('Se cerrará y se volverá a abrir solo en unos segundos.', 'It will close and reopen by itself in a few seconds.')}`;
    btns = '';
  } else if (S.updLater) {
    body = `<b>${L('RetroLimpia ' + v + ' está lista', 'RetroLimpia ' + v + ' is ready')}</b> · ${L('Se instalará sola cuando cierres el programa.', 'It will install by itself when you close the program.')}`;
    btns = `<button class="btn small" data-act="installUpdate">${L('Actualizar ahora', 'Update now')}</button>`;
  } else if (S.busy) {
    body = `<b>${L('RetroLimpia ' + v + ' está lista', 'RetroLimpia ' + v + ' is ready')}</b> · ${L('Se instalará sola en cuanto termine la tarea actual.', 'It will install as soon as the current task finishes.')}`;
    btns = '';
  } else {
    const n = S.updCount == null ? 15 : S.updCount;
    body = `<b>✨ ${L('Actualizando a la versión ' + v + ' en ' + n + ' s', 'Updating to version ' + v + ' in ' + n + ' s')}</b> · ${L('No tienes que hacer nada: se cierra y se vuelve a abrir solo.', 'Nothing to do: it closes and reopens by itself.')}<div class="upd-bar"><i style="width:${Math.round(((15 - n) / 15) * 100)}%"></i></div>`;
    btns = `<button class="btn small ghost" data-act="updLater">${L('Más tarde', 'Later')}</button><button class="btn small primary" data-act="installUpdate">${L('Actualizar ya', 'Update now')}</button>`;
  }
  return `<div class="banner good" id="updBanner"><div class="grow">${body}</div>${btns}</div>`;
}
setInterval(() => {
  const up = S.upd || {};
  if (up.estado !== 'lista' || S.updLater || S.updInstalling) return;
  const modalOpen = !$('#tour').classList.contains('hidden') || !$('#modal').classList.contains('hidden') || !$('#monitor').classList.contains('hidden');
  if (S.updHide && !modalOpen && !S.busy) S.updHide = false;   // al terminar la descarga vuelve a mostrarse la ventana
  if (S.busy || modalOpen) { S.updCount = null; return; }
  S.updCount = S.updCount == null ? 15 : S.updCount - 1;
  if (S.updCount <= 0) { S.updInstalling = true; render(); rl.installUpdate(); return; }
  const el = document.getElementById('updBanner');
  if (el) el.outerHTML = updBannerHTML(); else render();
  renderUpdWin();
}, 1000);

// ---------- Ventana de actualización: muestra cada paso ----------
function renderUpdWin() {
  const box = $('#updwin'); if (!box) return;
  const up = S.upd || {};
  const activo = (up.estado === 'descargando' || up.estado === 'lista') && !S.updHide && !S.updLater;
  if (!activo) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const v = esc(up.version || '');
  const pct = up.estado === 'lista' ? 100 : (up.pct || 0);
  const fase = S.updInstalling ? 3 : up.estado === 'lista' ? 2 : 1;
  const n = S.updCount == null ? 15 : S.updCount;
  const paso = (i, es, en, det) => {
    const st = fase > i ? 'ok' : fase === i ? 'now' : 'todo';
    const ico = st === 'ok' ? '✔' : st === 'now' ? '●' : '○';
    return `<li class="upw-step ${st}"><span class="upw-ico">${ico}</span><div><b>${L(es, en)}</b>${det ? `<div class="upw-det">${det}</div>` : ''}</div></li>`;
  };
  let estado;
  if (fase === 1) estado = L('Descargando en segundo plano', 'Downloading in the background') + ` · ${pct}%`;
  else if (fase === 2 && S.busy) estado = L('Esperando a que termine la tarea actual', 'Waiting for the current task to finish');
  else if (fase === 2) estado = L('Se cerrará y volverá a abrir en ' + n + ' s', 'It will close and reopen in ' + n + ' s');
  else estado = L('Instalando… no apagues el PC', 'Installing… do not turn off the PC');
  const barra = fase === 1 ? pct : fase === 2 ? Math.round(((15 - n) / 15) * 100) : 100;
  let btns = '';
  if (fase === 1) btns = `<button class="btn ghost" data-act="updHide">${L('Seguir usando el programa', 'Keep using the program')}</button>`;
  else if (fase === 2) btns = `<button class="btn ghost" data-act="updLater">${L('Más tarde (al cerrar)', 'Later (on close)')}</button><button class="btn primary" data-act="installUpdate">${L('Actualizar ya', 'Update now')}</button>`;
  box.innerHTML = `<div class="modal upw">
    <h2>✨ ${L('Actualizando RetroLimpia a la ' + v, 'Updating RetroLimpia to ' + v)}</h2>
    <p class="lead">${L('No tienes que hacer nada. Se descarga sola desde GitHub, se instala en silencio y el programa se vuelve a abrir.', 'Nothing to do. It downloads from GitHub, installs silently and the program reopens.')}</p>
    <ol class="upw-steps">
      ${paso(1, 'Descargar la versión nueva', 'Download the new version', L('Desde github.com/' + esc(S.info.repo || 'retropunk94/RetroLimpia') + ' · comprobada con su firma SHA-512', 'From github.com/' + esc(S.info.repo || 'retropunk94/RetroLimpia') + ' · checked with its SHA-512 hash'))}
      ${paso(2, 'Preparar la instalación', 'Prepare the install', L('Tus ajustes y la cuarentena se conservan', 'Your settings and quarantine are kept'))}
      ${paso(3, 'Cerrar, instalar y volver a abrir', 'Close, install and reopen', L('La ventana se cierra unos segundos y vuelve sola', 'The window closes a few seconds and comes back by itself'))}
    </ol>
    <div class="upw-estado">${estado}</div>
    <div class="upd-bar"><i style="width:${barra}%"></i></div>
    <div class="upw-btns">${btns}</div>
  </div>`;
  box.classList.remove('hidden');
}
