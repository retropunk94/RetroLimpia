// ============================================================ Apoyo al proyecto (donaciones)
// Reglas: pedir solo en buenos momentos (tras una tarea que salió bien), como mucho una vez cada 3 semanas,
// nunca la primera semana, ni en Modo Juego. "Quizá más tarde" 3 veces => cada 2 meses. "Ya doné" => nunca más.
const APOYO = { DIAS: 21, DIAS_LEJOS: 60, PRIMERA_SEMANA: 7 };
const DIA = 864e5;
const apoyoDatos = () => S.settings.apoyo || {};
async function apoyoGuardar(cambios) { S.settings = await rl.setSettings({ apoyo: { ...apoyoDatos(), ...cambios } }); }

// Se llama al terminar algo que salió bien, con la frase del logro ("Acabas de liberar 6,7 GB.")
async function apoyoOfrecer(logro) {
  const a = apoyoDatos(), ahora = Date.now();
  if (S.info.demo === false && !S.info.paypal) return;
  if (!S.settings.primerUso) { S.settings = await rl.setSettings({ primerUso: ahora }); return; }
  if (a.hecho || ahora < (a.proxima || 0) || ahora - S.settings.primerUso < APOYO.PRIMERA_SEMANA * DIA || jugando()) return;
  S.apoyo = { logro };
  await apoyoGuardar({ proxima: ahora + APOYO.DIAS * DIA });   // contado como mostrado: no vuelve a salir en 3 semanas
  render(); if (S.mon) renderMonitor();
}

// Tarjeta pequeña debajo del resultado (Inicio, Limpieza y fin de desinstalación)
function apoyoHTML() {
  const ap = S.apoyo; if (!ap) return '';
  if (ap.tarde) return `<div class="apoyo-card suave">💜 ${L('¡Sin problema! Si quieres ayudar de otra forma, una ⭐ en GitHub o recomendarlo a un amigo también cuenta mucho.', 'No problem! If you want to help another way, a ⭐ on GitHub or recommending it to a friend also means a lot.')}
    <span class="apoyo-links"><button class="link" data-open="https://github.com/retropunk94/RetroLimpia">⭐ ${L('Dejar una estrella en GitHub', 'Star it on GitHub')}</button> · <button class="link" data-copy="https://retropunk94.github.io/RetroLimpia/" data-copiado="${L('Enlace copiado: pégalo donde quieras.', 'Link copied: paste it anywhere.')}">🔗 ${L('Copiar enlace para compartir', 'Copy link to share')}</button></span></div>`;
  return `<div class="apoyo-card"><div class="grow"><b>${esc(ap.logro)} 💜</b><p>${L('RetroLimpia lo hago yo solo, en mis noches, y mantenerlo tiene un coste. Si te ayudó, una donación de lo que puedas hace que siga vivo.', 'I make RetroLimpia on my own, in my evenings, and keeping it going has a cost. If it helped you, a donation of whatever you can keeps it alive.')}</p></div>
    <div class="apoyo-btns"><button class="btn primary small" data-act="apoyoSi">💜 ${L('Apoyar el proyecto', 'Support the project')}</button><button class="btn ghost small" data-act="apoyoTarde">${L('Quizá más tarde', 'Maybe later')}</button><button class="link" data-act="apoyoHecho">${L('Ya doné ❤', 'I already donated ❤')}</button></div></div>`;
}

// Mensaje personal, una sola vez, en las novedades de la versión que lo lleve ("apoyo": true en novedades.json)
function apoyoMensajeHTML() {
  if (apoyoDatos().hecho) return '';
  return `<div class="apoyo-card mensaje"><div class="grow"><b>${L('Un mensaje de Retropunk94', 'A message from Retropunk94')}</b>
    <p>${L('Hago RetroLimpia solo. Es gratis, sin anuncios y sin vender tus datos, y quiero que siga así. Pero ahora mismo casi nadie lo apoya, y sin apoyo no voy a poder seguir dedicándole el tiempo que necesita. Si quieres que RetroLimpia siga mejorando, este es el momento de echar una mano.', 'I make RetroLimpia on my own. It is free, with no ads and no selling your data, and I want to keep it that way. But right now almost nobody supports it, and without support I will not be able to keep giving it the time it needs. If you want RetroLimpia to keep improving, now is the time to lend a hand.')}</p></div>
    <div class="apoyo-btns"><button class="btn primary small" data-act="apoyoSi">💜 ${L('Apoyar el proyecto', 'Support the project')}</button><button class="link" data-act="apoyoHecho">${L('Ya doné ❤', 'I already donated ❤')}</button></div></div>`;
}

async function apoyoAccion(act) {
  if (act === 'apoyoSi') { S.apoyo = null; render(); if (S.mon) renderMonitor(); return showDonate(); }
  if (act === 'apoyoHecho') {
    await apoyoGuardar({ hecho: true }); S.apoyo = null;
    $('#modal').classList.add('hidden');
    toast(L('¡Gracias de corazón! No te lo volveré a pedir 💜', 'Thank you from the heart! I will not ask again 💜'));
  } else if (act === 'apoyoTarde') {
    const tardes = (apoyoDatos().tardes || 0) + 1;
    await apoyoGuardar({ tardes, proxima: Date.now() + (tardes >= 3 ? APOYO.DIAS_LEJOS : APOYO.DIAS) * DIA });
    S.apoyo = { tarde: true };
    setTimeout(() => { if (S.apoyo && S.apoyo.tarde) { S.apoyo = null; render(); if (S.mon) renderMonitor(); } }, 15000);
  }
  render(); if (S.mon) renderMonitor();
}
