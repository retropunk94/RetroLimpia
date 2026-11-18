'use strict';
// ============================================================ Retro, la mascota + modo bajos recursos
// Retro es el ojo del logo. Reacciona a lo que pasa y da consejos cortos.
// Modos (Ajustes): activa | tranquila (icono quieto, sin globitos) | off.
// En modo bajos recursos siempre va en "tranquila".

function modoLigero() {
  const m = S.settings.modoLigero || 'auto';
  return m === 'on' || (m !== 'off' && !!S.info.equipoLimitado);
}
function modoMascota() {
  const m = S.settings.mascota || 'activa';
  if (m === 'off') return 'off';
  return modoLigero() ? 'tranquila' : m;
}
function aplicarModoLigero() { document.body.classList.toggle('ligero', modoLigero()); }

const RETRO = { flash: null, flashHasta: 0, globo: null, globoHasta: 0, ultimoUso: Date.now(), dicho: {} };

// Dibujo: el icono de RetroLimpia con el ojo según el ánimo
function retroSVG(animo) {
  const ojo = {
    normal: '<circle cx="50" cy="50" r="22" fill="#fff"/><circle class="rt-pupila" cx="50" cy="50" r="10" fill="#0f0d1c"/>',
    piensa: '<circle cx="50" cy="50" r="22" fill="#fff"/><circle class="rt-pupila rt-mira" cx="50" cy="50" r="10" fill="#0f0d1c"/>',
    feliz: '<path d="M30 54 Q50 32 70 54" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>',
    guino: '<path d="M32 52 L68 52" stroke="#fff" stroke-width="9" stroke-linecap="round"/>',
    preocupado: '<circle cx="50" cy="54" r="20" fill="#fff"/><circle cx="50" cy="58" r="9" fill="#0f0d1c"/><path d="M30 30 L68 38" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
    duerme: '<path d="M32 54 Q50 64 68 54" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/><text x="70" y="30" font-size="16" font-weight="700" fill="#fff">z</text><text x="80" y="18" font-size="11" font-weight="700" fill="#fff">z</text>',
    gafas: '<circle cx="50" cy="50" r="22" fill="#fff"/><rect x="22" y="38" width="56" height="20" rx="8" fill="#0f0d1c"/><path d="M26 42 L40 42" stroke="#3fd0f0" stroke-width="3" stroke-linecap="round"/>',
    casco: '<circle cx="50" cy="56" r="20" fill="#fff"/><circle class="rt-pupila" cx="50" cy="56" r="9" fill="#0f0d1c"/><path d="M24 34 Q50 6 76 34 Z" fill="#ffc845"/><rect x="20" y="32" width="60" height="6" rx="3" fill="#e0a800"/>'
  }[animo] || '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rtg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset=".5" stop-color="#b14cff"/><stop offset="1" stop-color="#3fd0f0"/></linearGradient></defs><rect x="6" y="6" width="88" height="88" rx="24" fill="url(#rtg)"/>${ojo}</svg>`;
}

function animoActual() {
  if (Date.now() < RETRO.flashHasta && RETRO.flash) return RETRO.flash;
  if (S.juego && S.juego.activo) return 'gafas';
  if (S.busy) return /actualiz|instal|update/i.test(S.busy.label || '') ? 'casco' : 'piensa';
  if (Date.now() - RETRO.ultimoUso > 3 * 60 * 1000) return 'duerme';
  return 'normal';
}

// Reacción breve (p. ej. guiño al terminar una limpieza)
function retroReacciona(animo, msg, ms = 4000) {
  RETRO.flash = animo; RETRO.flashHasta = Date.now() + ms;
  if (msg) retroDice(msg, ms + 1500);
  renderRetro();
  setTimeout(renderRetro, ms + 50);
}
// Globito. clave: si se da, el consejo solo sale una vez por sesión
function retroDice(msg, ms = 6000, clave) {
  if (modoMascota() !== 'activa') return;
  if (clave) { if (RETRO.dicho[clave]) return; RETRO.dicho[clave] = true; }
  RETRO.globo = msg; RETRO.globoHasta = Date.now() + ms;
  renderRetro();
  setTimeout(renderRetro, ms + 50);
}

function renderRetro() {
  let el = document.getElementById('retro');
  const modo = modoMascota();
  if (modo === 'off') { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'retro'; document.body.appendChild(el); }
  const animo = modo === 'tranquila' ? 'normal' : animoActual();
  const presentar = !S.settings.mascotaPresentada && modo === 'activa' && S.settings.tourVisto && $('#tour').classList.contains('hidden');
  const globo = presentar
    ? `<div class="rt-globo"><b>${L('¡Hola! Soy Retro 👋', "Hi! I'm Retro 👋")}</b><span>${L('Te acompaño mientras cuidas tu PC: te aviso cómo va todo y te doy consejos. Si te molesto, me escondo.', 'I keep you company while you look after your PC: I show how things are going and give tips. If I bother you, I can hide.')}</span><div class="rt-btns"><button class="btn small primary" data-act="retroOk">${L('¡Hola, Retro!', 'Hi, Retro!')}</button><button class="btn small ghost" data-act="retroTranquila">${L('Solo quieto', 'Just stay still')}</button><button class="btn small ghost" data-act="retroOff">${L('Esconder a Retro', 'Hide Retro')}</button></div></div>`
    : (modo === 'activa' && RETRO.globo && Date.now() < RETRO.globoHasta ? `<div class="rt-globo corto" role="status">${esc(RETRO.globo)}</div>` : '');
  // Solo se redibuja si algo cambió (así no gasta nada en cada repintado de la ventana)
  const clave = modo + animo + globo + S.settings.idioma;
  if (el.dataset.k === clave) return;
  el.dataset.k = clave;
  el.className = 'retro ' + (modo === 'tranquila' ? 'quieto' : 'vivo') + ' a-' + animo;
  el.innerHTML = `<button class="rt-cara" data-act="retroMenu" title="${L('Retro · clic para opciones', 'Retro · click for options')}" aria-label="${L('Retro, la mascota. Opciones', 'Retro, the mascot. Options')}">${retroSVG(animo)}</button>` + globo;
}

function retroMenu() {
  $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="width:min(460px,92vw)">
    <h2>${L('Retro, tu acompañante', 'Retro, your companion')}</h2>
    <p class="lead">${L('Elige cómo quieres a Retro. Puedes cambiarlo cuando quieras en Ajustes.', 'Choose how you want Retro. You can change it any time in Settings.')}</p>
    <div class="rt-opciones">
      <button class="btn ${S.settings.mascota === 'activa' || !S.settings.mascota ? 'primary' : ''}" data-act="retroActiva">😊 ${L('Activa: reacciona y da consejos', 'Active: reacts and gives tips')}</button>
      <button class="btn ${S.settings.mascota === 'tranquila' ? 'primary' : ''}" data-act="retroTranquila">😐 ${L('Tranquila: solo un icono quieto', 'Calm: just a still icon')}</button>
      <button class="btn ${S.settings.mascota === 'off' ? 'primary' : ''}" data-act="retroOff">🙈 ${L('Esconder a Retro', 'Hide Retro')}</button>
    </div>
    ${modoLigero() ? `<p class="meta">${L('Tu PC va en modo bajos recursos, así que Retro se queda quieta para no gastar.', 'Your PC is in low-resource mode, so Retro stays still to save resources.')}</p>` : ''}
    <div class="foot"><button class="btn ghost" data-act="modalClose">${L('Cerrar', 'Close')}</button></div></div>`;
  $('#modal').classList.remove('hidden');
}
async function setMascota(m) {
  S.settings = await rl.setSettings({ mascota: m, mascotaPresentada: true });
  $('#modal').classList.add('hidden');
  renderRetro(); render();
  if (m === 'off') toast(L('Retro se escondió. Puedes traerla de vuelta en Ajustes.', 'Retro is hidden. You can bring it back in Settings.'));
}

// Actividad: Retro se despierta al usar el programa (sin trabajo continuo: solo marca la hora)
['mousedown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => {
  const dormia = Date.now() - RETRO.ultimoUso > 3 * 60 * 1000;
  RETRO.ultimoUso = Date.now();
  if (dormia) renderRetro();
}, true));
// Un repaso lento (cada 30 s) para que se duerma si no se usa; nada si la ventana está oculta
setInterval(() => { if (!document.hidden && modoMascota() === 'activa') renderRetro(); }, 30000);
