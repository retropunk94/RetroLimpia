'use strict';
// ============================================================ Privacidad de Windows
// Cada ajuste es un interruptor explicado en lenguaje sencillo. Todo se puede deshacer.
const PRIVACIDAD = [
  ['anuncios_inicio', '🛍️', 'Anuncios en el menú Inicio', 'Ads in the Start menu',
    'Windows te recomienda apps y juegos para descargar en el menú Inicio. Al apagarlo, solo verás tus cosas.', 'Windows recommends apps and games to download in Start. Turn it off to see only your stuff.'],
  ['apps_solas', '📥', 'Apps que se instalan solas', 'Apps that install themselves',
    'Windows a veces instala juegos y apps "sugeridas" sin preguntarte (como Candy Crush). Esto lo impide. Lo que ya tienes no se borra.', 'Windows sometimes installs "suggested" games and apps without asking (like Candy Crush). This stops it. Nothing you have is removed.'],
  ['sugerencias_ajustes', '⚙️', 'Sugerencias en Configuración', 'Suggestions in Settings',
    'Quita los mensajes que te empujan a usar servicios de Microsoft dentro de la Configuración de Windows.', 'Removes messages pushing Microsoft services inside Windows Settings.'],
  ['consejos_windows', '💬', 'Avisos de "consejos y trucos"', '"Tips and tricks" pop-ups',
    'Esas notificaciones de "Saca el máximo partido a Windows" y pantallas de bienvenida tras actualizar. Fuera.', 'Those "Get the most out of Windows" notifications and welcome screens after updates. Gone.'],
  ['pantalla_bloqueo', '🔒', 'Anuncios en la pantalla de bloqueo', 'Lock screen ads',
    'Quita los textos y "curiosidades" con publicidad que aparecen sobre la foto al bloquear el PC.', 'Removes the promo texts and "fun facts" shown over the lock screen picture.'],
  ['explorador_anuncios', '📁', 'Anuncios en el Explorador de archivos', 'Ads in File Explorer',
    'Quita los avisos que ofrecen OneDrive o Microsoft 365 al abrir tus carpetas.', 'Removes OneDrive / Microsoft 365 offers when you open your folders.'],
  ['id_publicidad', '🎯', 'Publicidad personalizada', 'Personalized ads',
    'Las apps usan un "número de publicidad" para mostrarte anuncios según lo que haces. Al apagarlo, no te siguen.', 'Apps use an "advertising ID" to show ads based on what you do. Turn it off and they stop following you.'],
  ['experiencias_personalizadas', '📊', 'Sugerencias según tu uso', 'Suggestions based on your use',
    'Microsoft usa datos de cómo usas el PC para mostrarte ofertas y consejos. Esto lo apaga.', 'Microsoft uses data on how you use your PC to show offers and tips. This turns it off.'],
  ['bing_busqueda', '🔍', 'Resultados de internet en la búsqueda', 'Web results in Search',
    'Al buscar en la barra de Windows, solo verás tus archivos y apps, sin resultados de Bing. Busca más rápido.', 'When you search from the Windows bar you only see your files and apps, no Bing results. Faster too.'],
  ['telemetria_opcional', '📡', 'Datos de uso opcionales', 'Optional usage data',
    'Windows envía a Microsoft datos de cómo usas el PC. Esto deja solo lo mínimo obligatorio para que Windows funcione y se actualice.', 'Windows sends Microsoft data on how you use the PC. This keeps only the required minimum for Windows to work and update.'],
  ['copilot', '🤖', 'Copilot (el asistente de Microsoft)', 'Copilot (Microsoft assistant)',
    'Quita el botón de Copilot de la barra de tareas. Si lo usas, déjalo encendido.', 'Removes the Copilot button from the taskbar. If you use it, leave it on.']
];
const PRIV_OPCIONAL = new Set(['copilot']);   // no se marca en "Aplicar lo recomendado"

async function loadPrivacidad() { const r = obj(await rl.run('privacidad', { accion: 'listar' })); S.privacidad = arr(r.ajustes); }

function viewPrivacidad() {
  if (!S.privacidad) return loadingView(L('Privacidad', 'Privacy'), loadPrivacidad);
  const st = Object.fromEntries(S.privacidad.map((a) => [a.id, a]));
  const pendientes = PRIVACIDAD.filter(([id]) => st[id] && !st[id].aplicado && st[id].permitido !== false && !PRIV_OPCIONAL.has(id));
  return `<div class="view">${banners()}${head(L('Privacidad', 'Privacy'),
    L('Windows trae anuncios, sugerencias y envía datos de cómo lo usas. Aquí lo apagas con un interruptor. <b>No borra nada tuyo</b> y todo se puede volver a encender cuando quieras.', 'Windows comes with ads, suggestions and sends data on how you use it. Turn it off here with a switch. <b>Nothing of yours is deleted</b> and you can turn everything back on any time.'),
    pendientes.length ? `<button class="btn primary" data-act="privRec">${L(`Apagar los ${pendientes.length} recomendados`, `Turn off the ${pendientes.length} recommended`)}</button>` : `<span class="tag ok">✔ ${L('Todo lo recomendado está apagado', 'All recommended is off')}</span>`)}
    <div class="card list">${PRIVACIDAD.map(([id, ico, es, en, des, den]) => {
      const a = st[id] || {};
      const bloqueado = a.permitido === false;
      return `<div class="row"><span class="priv-ico" aria-hidden="true">${ico}</span><div class="grow"><b>${L(es, en)}</b>${PRIV_OPCIONAL.has(id) ? ` <span class="badge">${L('Opcional', 'Optional')}</span>` : ''}<div class="meta">${L(des, den)}</div>${bloqueado ? `<div class="why-line">${L('Necesita abrir RetroLimpia como administrador.', 'Needs RetroLimpia to run as administrator.')}</div>` : ''}</div>
        <label class="switch" title="${a.aplicado ? L('Apagado: pulsa para volver a encenderlo', 'Off: click to turn it back on') : L('Encendido: pulsa para apagarlo', 'On: click to turn it off')}"><input type="checkbox" data-priv="${id}" ${a.aplicado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''} aria-label="${L('Apagar ', 'Turn off ') + L(es, en)}"><span></span></label></div>`;
    }).join('')}</div>
    <p class="meta">${L('Interruptor activado = ese anuncio o envío de datos está apagado. Algunos cambios se notan al cerrar sesión o reiniciar.', 'Switch on = that ad or data sharing is turned off. Some changes show after signing out or restarting.')}</p></div>`;
}

async function privCambiar(ids, apagar) {
  return taskC(apagar ? L('Apagando anuncios y datos', 'Turning off ads and data') : L('Restaurando', 'Restoring'), async () => {
    const r = obj(await rl.run('privacidad', { accion: apagar ? 'aplicar' : 'restaurar', ids }));
    const malos = arr(r.resultados).filter((x) => !x.ok).length;
    await loadPrivacidad();
    if (malos) toast(L('Algunos ajustes no se pudieron cambiar (Windows los tiene bloqueados).', 'Some settings could not be changed (Windows has them locked).'), 'err');
    else if (apagar) { toast(L(`Listo: ${ids.length} cosa(s) apagada(s). Se notará del todo al reiniciar.`, `Done: ${ids.length} item(s) turned off. Fully visible after restart.`)); retroReacciona('guino', L('¡Menos anuncios! 😉', 'Fewer ads! 😉')); ganar('anuncios', ids.length); }
    else toast(L('Vuelto a como estaba.', 'Back to how it was.'));
  });
}
