'use strict';
// ============================================================ Render y eventos
function render() {
  renderNav();
  const views = { inicio: viewInicio, programas: viewProgramas, limpieza: viewLimpieza, arranque: viewArranque, privacidad: viewPrivacidad, hardware: viewHardware, drivers: viewDrivers, actualizaciones: viewActualizaciones, procesos: viewProcesos, deshacer: viewDeshacer, ajustes: viewAjustes };
  const focusId = document.activeElement && ['search', 'procSearch'].includes(document.activeElement.id) ? document.activeElement.id : null;
  const caret = focusId ? document.activeElement.selectionStart : 0;
  let html;
  try { html = (views[S.view] || viewInicio)(); }
  catch (e) {
    console.error(e);
    html = `<div class="view"><div class="banner bad"><div class="grow"><b>${L('Esta pantalla tuvo un problema', 'This screen had a problem')}</b> · ${esc(e.message)}</div><button class="btn small" data-nav="inicio">${L('Volver al inicio', 'Back to start')}</button></div></div>`;
  }
  $('#main').innerHTML = html;
  aplicarModoLigero(); renderRetro();
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); el.setSelectionRange(caret, caret); } }
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-reveal],[data-copy],[data-monview],[data-psort],[data-pask],[data-pkill],[data-updall],[data-retry],[data-nav],[data-act],[data-win],[data-open],[data-filter],[data-folder],[data-restore],[data-wu],[data-wg]');
  if (!t) return;
  if (t.dataset.reveal) { const ok = await rl.reveal(t.dataset.reveal); if (!ok) toast(L('Esa ubicación ya no existe (se movió a la cuarentena o se borró).', 'That location no longer exists (moved to quarantine or deleted).'), 'err'); return; }
  if (t.dataset.copy) { try { await navigator.clipboard.writeText(t.dataset.copy); toast(L('Ruta copiada.', 'Path copied.')); } catch { toast(t.dataset.copy); } return; }
  if (t.dataset.monview) { S.mon.view = Number(t.dataset.monview); return renderMonitor(); }
  if (t.dataset.psort) { S.procSort = t.dataset.psort; return render(); }
  if (t.dataset.pask) { S.procConfirm = t.dataset.pask; return render(); }
  if (t.dataset.pkill) {
    const g = S.procs.procesos.find((x) => x.nombre === t.dataset.pkill);
    S.procConfirm = null;
    if (!g) return render();
    const r = obj(await rl.run('procesos', { accion: 'terminar', nombre: g.nombre, pids: g.pids }));
    toast(r.ok ? L(`${g.nombre} cerrado.`, `${g.nombre} closed.`) : L(`No se pudo cerrar ${g.nombre} (puede necesitar más permisos o ser protegido).`, `Could not close ${g.nombre}.`), r.ok ? 'ok' : 'err');
    return loadProcs();
  }
  if (t.dataset.updall) { const keys = t.dataset.updall === 'wu' ? S.updates.windows.filter((x) => !x.grande).map((x) => 'wu:' + x.id) : S.updates.apps.map((a) => 'wg:' + a.id); const on = !keys.every((k) => S.updSel.has(k)); keys.forEach((k) => (on ? S.updSel.add(k) : S.updSel.delete(k))); return render(); }
  if (t.dataset.retry) { delete S.failed[t.dataset.retry]; return render(); }
  if (t.dataset.win) return rl.win(t.dataset.win);
  if (t.dataset.open) return rl.open(t.dataset.open);
  if (t.dataset.folder) return rl.openFolder(t.dataset.folder);
  if (t.dataset.nav) { S.view = t.dataset.nav; render(); $('#main').scrollTop = 0; if (S.view === 'programas') refreshProgramsQuiet('entrar'); return; }
  if (t.dataset.filter) { S.progFilter = t.dataset.filter; return render(); }
  if (t.dataset.restore) {
    return taskC(L('Restaurando', 'Restoring'), async () => {
      const r = await rl.run('cuarentena', { accion: 'restaurar', id: t.dataset.restore });
      toast(r.ok ? L('Restaurado. Todo volvió a su sitio.', 'Restored. Everything is back in place.') : L('Se restauró una parte; algunos archivos estaban en uso.', 'Partly restored; some files were in use.'), r.ok ? 'ok' : 'err');
      await loadQuarantine();
      refreshAfter('programas', 'inicio', 'limpieza');
    });
  }
  if (t.dataset.wu) {
    return taskC(L('Instalando actualización', 'Installing update'), async () => {
      await restorePoint(L('Antes de actualizar', 'Before updating'));
      const r = await rl.run('actualizaciones', { accion: 'instalarWU', ids: [t.dataset.wu] });
      const ok = r.resultados.every((x) => x.ok);
      if (r.reinicio) S.needsReboot = true;
      toast(ok ? L('Actualización instalada.', 'Update installed.') : L('No se pudo instalar.', 'Could not install.'), ok ? 'ok' : 'err');
      S.updates.windows = S.updates.windows.filter((u) => !(ok && u.id === t.dataset.wu));
      refreshAfter('actualizaciones', 'drivers', 'hardware');
    });
  }
  if (t.dataset.wg) {
    return taskC(L('Actualizando programa', 'Updating program'), async () => {
      const r = await rl.run('actualizaciones', { accion: 'winget', ids: [t.dataset.wg] });
      const ok = r.resultados.every((x) => x.ok);
      toast(ok ? L('Programa actualizado.', 'Program updated.') : L('No se pudo actualizar (quizá está abierto).', 'Could not update (it may be open).'), ok ? 'ok' : 'err');
      if (ok) S.updates.apps = S.updates.apps.filter((a) => a.id !== t.dataset.wg);
      refreshAfter('actualizaciones', 'programas');
    });
  }
  switch (t.dataset.act) {
    case 'cancel': return cancelTask();
    case 'procOk': S.settings = await rl.setSettings({ procesosAviso: true }); $('#modal').classList.add('hidden'); return render();
    case 'procBack': $('#modal').classList.add('hidden'); S.view = 'inicio'; return render();
    case 'procPause': S.procPaused = !S.procPaused; return render();
    case 'tour': return startTour();
    case 'monClose': $('#monitor').classList.add('hidden'); S.mon = null; return render();
    case 'monQuar': $('#monitor').classList.add('hidden'); S.mon = null; S.quarantine = null; S.view = 'deshacer'; return render();
    case 'donateAsk': return showDonate();
    case 'donateGo': $('#modal').classList.add('hidden'); return rl.open(S.info.paypal);
    case 'modalClose': $('#modal').classList.add('hidden'); S.rep = null; return;
    case 'retroMenu': return retroMenu();
    case 'privRec': { const st = Object.fromEntries(S.privacidad.map((a) => [a.id, a])); return privCambiar(PRIVACIDAD.map((x) => x[0]).filter((id) => st[id] && !st[id].aplicado && st[id].permitido !== false && !PRIV_OPCIONAL.has(id)), true); }
    case 'retroOk': S.settings = await rl.setSettings({ mascotaPresentada: true }); return renderRetro();
    case 'retroActiva': return setMascota('activa');
    case 'retroTranquila': return setMascota('tranquila');
    case 'retroOff': return setMascota('off');
    case 'news': return showNews(null, true);
    case 'crashSeen': S.crashSeen = true; return render();
    case 'reportOpen': return openReport(t.dataset.ctx || '');
    case 'repPick': {
      const r = await rl.reportPickImage(); if (!r) return;
      if (r.error) return toast(r.error, 'err');
      S.rep.img = r.dataUrl; S.rep.imgNombre = r.nombre; S.rep.useImg = true; return renderReport();
    }
    case 'repUseAuto': S.rep.img = S.rep.auto; S.rep.imgNombre = L('Captura de RetroLimpia', 'RetroLimpia screenshot'); S.rep.useImg = true; return renderReport();
    case 'repNoImg': S.rep.useImg = false; return renderReport();
    case 'repToggleLog': S.rep.verLog = !S.rep.verLog; return renderReport();
    case 'repSend': return sendReport();
    case 'procWin': S.procShowWin = !S.procShowWin; return render();
    case 'procSmall': S.procShowSmall = !S.procShowSmall; return render();
    case 'procNo': S.procConfirm = null; return render();
    case 'updNone': S.updSel.clear(); return render();
    case 'updateSel': return updateSelected();
    case 'scan': return scanAll();
    case 'fixAll': return fixAll();
    case 'closeFix': S.fix = null; return render();
    case 'report': { const f = await rl.saveReport(buildReport()); toast(L('Informe guardado en Documentos\\RetroLimpia', 'Report saved to Documents\\RetroLimpia')); return f; }
    case 'selVerde': allPrograms().filter((p) => p.cls.color === 'verde').forEach((p) => S.sel.add(p.id)); return render();
    case 'selNone': S.sel.clear(); return render();
    case 'monStopNow': monLog({ tipo: 'aviso', msg: 'Deteniendo ahora...', en: 'Stopping now...' }); return rl.cancel();
    case 'refreshProgs': return task(L('Actualizando la lista de programas', 'Refreshing program list'), async () => {
      await loadPrograms();
      const ids = new Set(allPrograms().map((p) => p.id));
      [...S.sel].forEach((id) => { if (!ids.has(id)) S.sel.delete(id); });
      toast(L(`Lista actualizada: ${ids.size} programas.`, `List refreshed: ${ids.size} programs.`));
    });
    case 'uninstallSel': {
      const list = allPrograms().filter((p) => S.sel.has(p.id));
      return taskC(L('Desinstalando', 'Uninstalling'), async () => {
        const r = await uninstallPrograms(list, L('Desinstalar programas', 'Uninstall programs'));
        S.sel.clear();
        if (r.dudosos.length) S.pendingResidues = r.dudosos;
        toast(L(`${r.ok} programa(s) quitados`, `${r.ok} program(s) removed`) + (r.restosMovidos ? L(` y ${r.restosMovidos} resto(s) a la cuarentena (${fmtBytes(r.bytes)})`, ` and ${r.restosMovidos} leftover(s) quarantined (${fmtBytes(r.bytes)})`) : '') + '.');
        if (r.fail.length) toast(L('No se pudieron quitar: ', 'Could not remove: ') + r.fail.join(', '), 'err');
        if (r.saltados && r.saltados.length) toast(L('No se desinstalaron (cancelado en su tienda): ', 'Not uninstalled (cancelled in its store): ') + r.saltados.join(', '));
        await loadPrograms(); S.quarantine = null;
        refreshAfter('inicio', 'actualizaciones', 'limpieza');
      });
    }
    case 'moveResidues': {
      const items = S.pendingResidues.flatMap((g) => g.restos.filter((r) => r.elegido));
      if (!items.length) { S.pendingResidues = null; return render(); }
      return taskC(L('Moviendo restos', 'Moving leftovers'), async () => {
        const q = await rl.run('cuarentena', { accion: 'mover', items, motivo: L('Restos revisados', 'Reviewed leftovers') });
        toast(L(`${q.guardados} resto(s) en la cuarentena.`, `${q.guardados} leftover(s) quarantined.`));
        S.pendingResidues = null; S.quarantine = null;
        refreshAfter('programas');
      });
    }
    case 'skipResidues': S.pendingResidues = null; return render();
    case 'clean':
      return taskC(L('Limpiando', 'Cleaning'), async () => {
        const r = await rl.run('limpieza', { accion: 'limpiar', categorias: [...S.junkSel] });
        toast(L('¡Liberaste ', 'You freed ') + fmtBytes(r.liberado) + '!');
        retroReacciona('guino', L('¡Más limpio! 😉', 'Squeaky clean! 😉'));
        await loadJunk();
      });
    case 'reloadJunk': S.junk = null; return render();
    case 'reloadHw': S.hardware = null; return render();
    case 'loadUpdates': return task(L('Buscando actualizaciones', 'Searching updates'), loadUpdates);
    case 'startupRec':
      return taskC(L('Aplicando', 'Applying'), async () => {
        for (const it of S.startup.elementos.filter((i) => i.activo && classifyStartup(i).rec === 'desactivar')) await rl.run('inicio', { accion: 'cambiar', id: it.id, activar: false });
        await loadStartup(); toast(L('Listo. El próximo arranque será más rápido.', 'Done. Next startup will be faster.'));
      });
    case 'updateAll':
      return taskC(L('Actualizando todo', 'Updating everything'), async () => {
        await restorePoint(L('Antes de actualizar todo', 'Before updating everything'));
        if (S.updates.windows.some((u) => !u.grande)) {
          S.busy.label = 'Windows Update';
          const r = await rl.run('actualizaciones', { accion: 'instalarWU', todos: true });
          if (r.reinicio) S.needsReboot = true;
        }
        if (S.updates.apps.length) { S.busy.label = L('Programas', 'Programs'); await rl.run('actualizaciones', { accion: 'winget', todos: true }); }
        toast(L('Todo actualizado.', 'Everything updated.'));
        await loadUpdates();
        refreshAfter('drivers', 'hardware', 'programas');
      });
    case 'backupDrivers':
      return taskC(L('Copia de drivers', 'Driver backup'), async () => {
        const r = await rl.run('drivers', { accion: 'respaldar' });
        toast(r.ok ? L('Copia guardada (', 'Backup saved (') + fmtBytes(r.tamano) + ').' : L('No se pudo hacer la copia.', 'Backup failed.'), r.ok ? 'ok' : 'err');
        await loadDrivers();
        refreshAfter('cuarentena');
      });
    case 'openRestore': return rl.run('restauracion', { accion: 'abrir' });
    case 'trust': return showTrust();
    case 'trustOk': $('#modal').classList.add('hidden'); S.settings = await rl.setSettings({ confianzaVista: true }); if (!S.settings.tourVisto) startTour(); else if (!S.settings.recordatoriosPreguntado) showReminders(); return;
    case 'remindYes': {
      const dias = Number(($('#remFreq') || {}).value) || 3;
      const r = await rl.autostart(true, dias); S.settings = r.settings; $('#modal').classList.add('hidden');
      toast(r.ok ? L('¡Hecho! Te avisaré cuando tu PC necesite un repaso.', "Done! I'll let you know when your PC needs a tune-up.") : L('No se pudo activar el inicio con Windows.', 'Could not enable start with Windows.'), r.ok ? 'ok' : 'err');
      return render();
    }
    case 'remindNo': S.settings = await rl.setSettings({ recordatoriosPreguntado: true }); $('#modal').classList.add('hidden'); return;
    case 'checkNow': {
      toast(L('Revisando... tarda unos segundos.', 'Checking... takes a few seconds.'));
      const res = await rl.checkNow();
      S.settings = await rl.getSettings();
      if (res) toast(L('Resultado: ', 'Result: ') + res);
      return render();
    }
    case 'checkUpdate': {
      S.checkingUpd = true; render();
      const r = await rl.checkUpdate().catch(() => ({ disponible: false, error: 'x' }));
      S.checkingUpd = false; S.appUpdate = r;
      if (r.error) toast(L('No se pudo comprobar. ¿Hay conexión a internet?', 'Could not check. Are you online?'), 'err');
      else if (!r.disponible) toast(L('Tienes la última versión. ✔', 'You have the latest version. ✔'));
      else toast(r.modo === 'auto' ? L(`Versión ${r.version} encontrada: se está descargando sola.`, `Version ${r.version} found: downloading by itself.`) : L(`Hay una versión nueva: ${r.version}.`, `New version: ${r.version}.`));
      return render();
    }
    case 'installUpdate': S.updInstalling = true; S.updLater = false; S.updHide = false; render(); renderUpdWin(); return rl.installUpdate();
    case 'updLater': S.updLater = true; S.updCount = null; renderUpdWin(); return render();
    case 'updHide': S.updHide = true; renderUpdWin(); return render();
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.sort !== undefined) { S.progSort = t.value; return render(); }
  if (t.dataset.upd) { t.checked ? S.updSel.add(t.dataset.upd) : S.updSel.delete(t.dataset.upd); return render(); }
  if (t.dataset.sel) { t.checked ? S.sel.add(t.dataset.sel) : S.sel.delete(t.dataset.sel); return render(); }
  if (t.dataset.junk) { t.checked ? S.junkSel.add(t.dataset.junk) : S.junkSel.delete(t.dataset.junk); return render(); }
  if (t.dataset.finding) { const f = S.scan.findings.find((x) => x.id === t.dataset.finding); if (f) f.elegido = t.checked; return render(); }
  if (t.dataset.res) { const [g, r] = t.dataset.res.split(':').map(Number); S.pendingResidues[g].restos[r].elegido = t.checked; return; }
  if (t.dataset.startup) {
    const id = t.dataset.startup, on = t.checked;
    return taskC(on ? L('Activando', 'Enabling') : L('Desactivando', 'Disabling'), async () => { await rl.run('inicio', { accion: 'cambiar', id, activar: on }); await loadStartup(); refreshAfter('programas'); });
  }
  if (t.dataset.autostart !== undefined) {
    const r = await rl.autostart(t.checked, S.settings.frecuenciaDias); S.settings = r.settings;
    toast(t.checked ? (r.ok ? L('RetroLimpia arrancará con Windows y te avisará.', 'RetroLimpia will start with Windows and remind you.') : L('No se pudo activar.', 'Could not enable.')) : L('Ya no arrancará con Windows.', 'It will no longer start with Windows.'), r.ok ? 'ok' : 'err');
    return render();
  }
  if (t.dataset.priv) { if (S.busy) { t.checked = !t.checked; return toast(L('Espera a que termine la tarea actual.', 'Wait for the current task to finish.'), 'err'); } return privCambiar([t.dataset.priv], t.checked); }
  if (t.dataset.setting) {
    const k = t.dataset.setting;
    const v = t.type === 'checkbox' ? t.checked : (['diasCuarentena', 'frecuenciaDias'].includes(k) ? Number(t.value) : t.value);
    S.settings = await rl.setSettings({ [k]: v });
    if (k === 'idioma') document.documentElement.lang = v;
    render();
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { S.search = e.target.value; render(); }
  if (e.target.id === 'procSearch') { S.procSearch = e.target.value; render(); }
});

rl.onProgress((p) => {
  if (p.log) { monLog(p.log); return; }
  if (S.mon && !S.mon.done && p.script === 'desinstalar') monProgress(p);
  // Progreso de las cargas en segundo plano de cada pestaña
  S.sp = S.sp || {}; S.sp[p.script] = { pct: p.pct, msg: S.settings.idioma === 'en' ? p.en : p.msg };
  if (bgScriptActive(p.script) && !(S.scan && S.scan.state === 'running')) { updateLoadCard(); if (!S.busy || !S.busy.script || S.busy.script !== p.script) return; }
  if (!S.busy) return;
  const msg = S.settings.idioma === 'en' ? p.en : p.msg;
  if (S.scan.state === 'running') {
    S.scan.pct[p.script] = p.pct;
    S.busy.pct = scanPct();
    if (p.pct < 100) S.busy.msg = msg;
  } else if (!S.cancelRequested) {
    S.busy.pct = p.pct; S.busy.msg = msg;
  }
  updateProgressOnly();
});
// El tiempo restante se recalcula cada segundo aunque el motor no informe.
setInterval(() => { if (document.hidden) return; if (S.busy) updateProgressOnly(); if (S.loads && Object.keys(S.loads).length) updateLoadCard(); }, 1000);
