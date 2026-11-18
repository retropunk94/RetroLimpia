'use strict';
// ============================================================ Modo Juego
// Muy didáctico: el usuario elige qué se cierra, ve exactamente qué hace cada intensidad
// y con un botón todo vuelve a como estaba. OBS, Discord, launchers y periféricos nunca se tocan.
const INTENSIDAD = {
  suave: ['🌱', 'Suave', 'Gentle', ['Cierra solo lo que tú marques', 'Pone el PC a máxima potencia'], ['Closes only what you tick', 'Sets your PC to max power']],
  equilibrado: ['⚖️', 'Equilibrado', 'Balanced', ['Todo lo de Suave', 'Silencia las notificaciones', 'Activa el Modo Juego de Windows', 'Pausa las descargas de Windows Update'], ['Everything in Gentle', 'Mutes notifications', 'Turns on Windows Game Mode', 'Pauses Windows Update downloads']],
  atope: ['🔥', 'A tope', 'All out', ['Todo lo de Equilibrado', 'Pausa el indexado de archivos y la precarga de Windows', 'Da prioridad alta a tu juego'], ['Everything in Balanced', 'Pauses file indexing and Windows preloading', 'Gives your game high priority']]
};
const LOGROS = [[1, '🎮', 'Primera partida', 'First game'], [5, '🕹️', 'Jugador habitual', 'Regular player'], [25, '🏆', 'Veterano', 'Veteran'], [100, '👑', 'Leyenda', 'Legend']];

async function loadJuego() {
  const r = obj(await rl.run('modojuego', { accion: 'listar' }));
  S.juego = { apps: arr(r.apps), activo: !!r.activo, estado: r.estado || null };
  S.info.juegoActivo = S.juego.activo;
  if (!S.juegoSel) {
    const guardados = arr(S.settings.juegoCerrar);
    S.juegoSel = new Set(guardados.length ? guardados : S.juego.apps.filter((a) => a.sugerido).map((a) => a.nombre));
  }
}

function minutosDesde(iso) { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }

function viewJuego() {
  if (!S.juego) return loadingView(L('Modo Juego', 'Game Mode'), loadJuego);
  const j = S.juego, st = S.settings;
  const int = st.juegoIntensidad || 'equilibrado';
  const partidas = Number(st.juegoPartidas) || 0;
  const desc = L('Antes de jugar, RetroLimpia cierra <b>solo lo que tú elijas</b>, pone el PC a máxima potencia y pausa lo que molesta. Al terminar, un botón lo deja <b>todo como estaba</b>. OBS, Discord, Steam y tus periféricos nunca se tocan.',
    'Before you play, RetroLimpia closes <b>only what you choose</b>, sets max power and pauses distractions. When done, one button puts <b>everything back</b>. OBS, Discord, Steam and your peripherals are never touched.');
  if (j.activo) {
    const e = j.estado || {};
    return `<div class="view">${banners()}${head(L('Modo Juego', 'Game Mode'), desc)}
      <div class="card juego-on"><div class="juego-big">🕶️</div><div class="grow"><h3>${L('Modo Juego activo', 'Game Mode on')}</h3>
        <p>${L(`Desde hace ${minutosDesde(e.desde)} · intensidad <b>${L(...INTENSIDAD[e.intensidad || 'equilibrado'].slice(1, 3))}</b>`, `For ${minutosDesde(e.desde)} · <b>${L(...INTENSIDAD[e.intensidad || 'equilibrado'].slice(1, 3))}</b> intensity`)}${arr(e.cerrados).length ? L(` · cerré ${arr(e.cerrados).length} programa(s)`, ` · closed ${arr(e.cerrados).length} program(s)`) : ''}</p>
        <label class="inline"><input type="checkbox" class="check" data-juego-reabrir ${st.juegoReabrir !== false ? 'checked' : ''}> ${L('Volver a abrir lo que cerré', 'Reopen what I closed')}</label></div>
        <button class="btn primary big" data-act="juegoOff" ${S.busy ? 'disabled' : ''}>${L('Terminé de jugar: restaurar', 'Done playing: restore')}</button></div>
      <p class="meta">${L('¿Se cerró RetroLimpia o se apagó el PC a mitad? No pasa nada: al volver, este botón sigue aquí y lo deja todo como estaba.', 'Did RetroLimpia close or the PC shut down midway? No problem: this button stays here and puts everything back.')}</p></div>`;
  }
  const libres = j.apps.filter((a) => !a.protegido), prot = j.apps.filter((a) => a.protegido);
  const ram = libres.filter((a) => S.juegoSel.has(a.nombre)).reduce((s, a) => s + (Number(a.ram) || 0), 0);
  const juegos = arr(st.misJuegos);
  return `<div class="view">${banners()}${head(L('Modo Juego', 'Game Mode'), desc, `<button class="btn ghost" data-act="juegoReload" ${S.busy ? 'disabled' : ''}>${L('Ver otra vez qué hay abierto', 'Check open apps again')}</button>`)}
    ${progressHTML()}
    <h3 class="paso">1 · ${L('¿Con cuánta fuerza?', 'How strong?')}</h3>
    <div class="intens">${Object.entries(INTENSIDAD).map(([id, [ico, es, en, les, len]]) => `<label class="int-card ${int === id ? 'on' : ''}"><input type="radio" name="intens" data-intens="${id}" ${int === id ? 'checked' : ''}>
      <div class="int-t">${ico} ${L(es, en)}${id === 'equilibrado' ? ` <span class="badge">${L('Recomendado', 'Recommended')}</span>` : ''}</div><ul>${L(les, len).map((x) => `<li>${x}</li>`).join('')}</ul></label>`).join('')}</div>

    <h3 class="paso">2 · ${L('¿Qué cerramos mientras juegas?', 'What do we close while you play?')}</h3>
    <p class="meta">${L('Marca solo lo que no necesites. Lo marcado de inicio es lo que casi nunca hace falta para jugar. Tu elección se recuerda.', 'Tick only what you do not need. Pre-ticked items are rarely needed for gaming. Your choice is remembered.')}</p>
    <div class="list">${libres.length ? libres.map((a) => `<label class="row"><input type="checkbox" class="check" data-juego-app="${esc(a.nombre)}" ${S.juegoSel.has(a.nombre) ? 'checked' : ''}>
      <div class="grow"><div class="name">${esc(a.titulo || a.nombre)}${a.sugerido ? ` <span class="badge verde">${L('Sugerido', 'Suggested')}</span>` : ''}</div><div class="note">${esc(a.nota || '')}</div></div>
      <div class="size">${fmtBytes(a.ram)}</div></label>`).join('') : `<div class="empty">${L('No hay nada que cerrar: tu PC ya está ligero.', 'Nothing to close: your PC is already light.')}</div>`}</div>
    ${prot.length ? `<details class="prot"><summary>🛡️ ${L(`${prot.length} protegido(s): nunca se cierran`, `${prot.length} protected: never closed`)}</summary><p class="meta">${prot.map((a) => esc(a.titulo || a.nombre)).join(' · ')}</p></details>` : ''}

    <h3 class="paso">3 · ${L('Mis juegos (opcional)', 'My games (optional)')}</h3>
    <p class="meta">${L('Añade tus juegos o emuladores (cualquier .exe, sea de la tienda que sea). Si activas el modo automático, el Modo Juego se enciende solo al abrirlos y se apaga al cerrarlos.', 'Add your games or emulators (any .exe, from any store). With auto mode, Game Mode turns on when you open them and off when you close them.')}</p>
    <div class="list">${juegos.map((g, i) => `<div class="row"><span class="priv-ico">🎮</span><div class="grow"><div class="name">${esc(g.nombre)}</div><div class="tech">${esc(g.ruta)}</div></div><button class="btn small ghost" data-juego-quitar="${i}">${L('Quitar', 'Remove')}</button></div>`).join('')}
      <div class="row"><button class="btn small" data-act="juegoAdd">＋ ${L('Añadir juego o emulador', 'Add game or emulator')}</button><div class="grow"></div>
      <label class="inline">${L('Automático', 'Automatic')} <span class="switch"><input type="checkbox" data-juego-auto ${st.juegoAuto ? 'checked' : ''} ${juegos.length ? '' : 'disabled'}><span></span></span></label></div></div>

    <div class="logros">${LOGROS.map(([n, ico, es, en]) => `<span class="logro ${partidas >= n ? 'on' : ''}" title="${L(`${n} partida(s) con Modo Juego`, `${n} game(s) with Game Mode`)}">${ico} ${L(es, en)}</span>`).join('')}<span class="meta">${L(`Partidas con Modo Juego: <b>${partidas}</b>`, `Games with Game Mode: <b>${partidas}</b>`)}</span></div>

    <div class="actionbar"><div class="info">${S.juegoSel.size ? L(`Se cerrarán <b>${[...S.juegoSel].filter((n) => libres.some((a) => a.nombre === n)).length}</b> programa(s) · liberas ~<b>${fmtBytes(ram)}</b> de memoria`, `<b>${S.juegoSel.size}</b> program(s) will close · frees ~<b>${fmtBytes(ram)}</b> of memory`) : L('No se cerrará ningún programa.', 'No program will be closed.')}</div>
      <button class="btn primary big" data-act="juegoOn" ${S.busy ? 'disabled' : ''}>🎮 ${L('Activar Modo Juego', 'Turn on Game Mode')}</button></div></div>`;
}

function juegoOn(juego) {
  const cerrar = S.juego ? [...S.juegoSel].filter((n) => S.juego.apps.some((a) => a.nombre === n && !a.protegido)) : arr(S.settings.juegoCerrar);
  const intensidad = S.settings.juegoIntensidad || 'equilibrado';
  return taskC(L('Preparando el PC para jugar', 'Getting your PC ready to play'), async () => {
    S.settings = await rl.setSettings({ juegoCerrar: cerrar });
    const juegos = arr(S.settings.misJuegos).map((g) => g.ruta.split('\\').pop());
    const r = obj(await rl.run('modojuego', { accion: 'activar', intensidad, cerrar, juego: juego || '', juegos }));
    if (r.ok === false) return toast(r.mensaje || L('No se pudo activar el Modo Juego.', 'Could not turn on Game Mode.'), 'err');
    S.juego = { ...(S.juego || { apps: [] }), activo: true, estado: r.estado || { desde: new Date().toISOString(), intensidad } };
    S.info.juegoActivo = true;
    const nc = arr(r.noCerrados);
    if (nc.length) toast(L(`Modo Juego activo. No cerré ${nc.join(', ')}: puede que te pregunte si guardar algo. Ciérralo tú cuando quieras.`, `Game Mode on. I did not close ${nc.join(', ')}: it may be asking to save something. Close it yourself.`), 'err');
    else toast(L('🎮 Modo Juego activo. ¡A jugar! Cuando termines, pulsa "Restaurar".', '🎮 Game Mode on. Have fun! When done, press "Restore".'));
    retroReacciona('gafas', L('¡A jugar! 😎', 'Game on! 😎'), 5000);
  });
}

function juegoOff() {
  return taskC(L('Devolviendo el PC a como estaba', 'Putting your PC back'), async () => {
    const r = obj(await rl.run('modojuego', { accion: 'restaurar', reabrir: S.settings.juegoReabrir !== false }));
    const partidas = (Number(S.settings.juegoPartidas) || 0) + (r.nada ? 0 : 1);
    S.settings = await rl.setSettings({ juegoPartidas: partidas });
    const logro = LOGROS.find(([n]) => n === partidas);
    toast(logro ? L(`🏆 ¡Logro desbloqueado: ${logro[2]}!`, `🏆 Achievement unlocked: ${logro[3]}!`) : L(`Todo vuelve a estar como antes${r.minutos ? ` (jugaste ${r.minutos} min)` : ''}.`, `Everything is back to normal${r.minutos ? ` (you played ${r.minutos} min)` : ''}.`));
    retroReacciona('feliz', logro ? L('¡Nuevo logro! 🏆', 'New achievement! 🏆') : L('¡Buena partida!', 'Good game!'));
    S.juego = null; S.info.juegoActivo = false;
    await loadJuego();
  });
}

async function juegoAdd() {
  const g = await rl.pickExe();
  if (!g) return;
  const lista = arr(S.settings.misJuegos);
  if (lista.some((x) => x.ruta.toLowerCase() === g.ruta.toLowerCase())) return toast(L('Ese juego ya está en tu lista.', 'That game is already on your list.'));
  S.settings = await rl.setSettings({ misJuegos: [...lista, g] });
  toast(L(`Añadido: ${g.nombre}`, `Added: ${g.nombre}`)); render();
}
// El proceso principal avisa cuando se abre o se cierra uno de "Mis juegos" (modo automático)
if (rl.onJuego) rl.onJuego((ev) => {
  S.info.juegoActivo = !!ev.activo;
  if (ev.activo) { S.juego = { ...(S.juego || { apps: [] }), activo: true, estado: ev.estado }; retroReacciona('gafas', L(`Detecté ${ev.juego}. ¡Modo Juego activo! 😎`, `Detected ${ev.juego}. Game Mode on! 😎`), 5000); }
  else { S.juego = null; if (ev.partidas) S.settings.juegoPartidas = ev.partidas; toast(L('Cerraste el juego: todo vuelve a estar como antes.', 'Game closed: everything is back to normal.')); }
  render();
});
