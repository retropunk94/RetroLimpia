'use strict';
// ============================================================ Asistente "Acabo de formatear"
// Una lista de pasos en orden, explicada para alguien que no sabe nada de ordenadores.
// Programas: solo los imprescindibles y conocidos, instalados en silencio con winget (oficial de Microsoft).
const CATALOGO = [
  ['Navegador', 'Browser', [
    ['Brave.Brave', 'Brave', '🦁', 'Para entrar a internet, como Google Chrome, pero bloquea los anuncios y va más rápido. Si ya usas otro navegador, no hace falta.', 'To browse the internet, like Google Chrome, but it blocks ads and is faster. If you already use another browser, skip it.']]],
  ['Hablar con gente', 'Talk to people', [
    ['Discord.Discord', 'Discord', '💬', 'Chat de texto y de voz con amigos y comunidades. Muy usado para jugar en grupo.', 'Text and voice chat with friends and communities. Popular for gaming together.'],
    ['9NKSQGP7F2NH', 'WhatsApp', '📱', 'Tu WhatsApp del móvil, en la pantalla grande del PC.', 'Your phone WhatsApp, on the big PC screen.', 'msstore'],
    ['Zoom.Zoom', 'Zoom', '🎥', 'Videollamadas para clases o trabajo. Instálalo solo si te lo piden.', 'Video calls for school or work. Install it only if you need it.']]],
  ['Jugar', 'Games', [
    ['Valve.Steam', 'Steam', '🎮', 'La tienda de juegos más grande de PC. Aquí están tus juegos comprados.', 'The biggest PC game store. Your purchased games are here.'],
    ['EpicGames.EpicGamesLauncher', 'Epic Games', '🎁', 'Tienda de juegos (Fortnite) que regala juegos gratis cada semana.', 'Game store (Fortnite) with free games every week.'],
    ['ElectronicArts.EADesktop', 'EA app', '⚽', 'Para juegos de EA: FC (FIFA), Battlefield, Los Sims...', 'For EA games: FC (FIFA), Battlefield, The Sims...'],
    ['Ubisoft.Connect', 'Ubisoft Connect', '🗡️', 'Para juegos de Ubisoft: Assassin\'s Creed, Far Cry...', 'For Ubisoft games: Assassin\'s Creed, Far Cry...'],
    ['GOG.Galaxy', 'GOG Galaxy', '🌌', 'Tienda de juegos sin protecciones, con muchos clásicos.', 'DRM-free game store with lots of classics.'],
    ['Blizzard.BattleNet', 'Battle.net', '❄️', 'Para juegos de Blizzard: World of Warcraft, Diablo, Overwatch, Call of Duty.', 'For Blizzard games: World of Warcraft, Diablo, Overwatch, Call of Duty.']]],
  ['Música y vídeo', 'Music & video', [
    ['VideoLAN.VLC', 'VLC', '🎬', 'Abre CUALQUIER vídeo o música, aunque Windows diga que no puede. Imprescindible.', 'Plays ANY video or music, even when Windows says it cannot. A must.'],
    ['9NCBCSZSJRSB', 'Spotify', '🎵', 'Música y pódcasts. Tiene versión gratis con anuncios.', 'Music and podcasts. Has a free version with ads.', 'msstore'],
    ['OBSProject.OBSStudio', 'OBS Studio', '🔴', 'Para grabar la pantalla o hacer directos en Twitch, YouTube o TikTok.', 'To record your screen or stream on Twitch, YouTube or TikTok.']]],
  ['Útiles para todos los días', 'Everyday tools', [
    ['7zip.7zip', '7-Zip', '🗜️', 'Abre archivos comprimidos (.zip, .rar, .7z) que te descargas. Imprescindible.', 'Opens compressed files (.zip, .rar, .7z) you download. A must.'],
    ['SumatraPDF.SumatraPDF', 'SumatraPDF', '📄', 'Abre PDFs al instante, mucho más ligero que Adobe Reader.', 'Opens PDFs instantly, much lighter than Adobe Reader.'],
    ['ShareX.ShareX', 'ShareX', '📸', 'Capturas de pantalla y grabaciones cortas con una tecla.', 'Screenshots and short recordings with one key.'],
    ['voidtools.Everything', 'Everything', '🔎', 'Encuentra cualquier archivo del PC al instante, mientras escribes.', 'Finds any file on your PC instantly, as you type.'],
    ['Microsoft.PowerToys', 'PowerToys', '🧰', 'Herramientas extra de Microsoft: cambiar tamaño de fotos, selector de colores, atajos...', 'Extra Microsoft tools: resize photos, color picker, shortcuts...'],
    ['TheDocumentFoundation.LibreOffice', 'LibreOffice', '📝', 'Como Word, Excel y PowerPoint, pero gratis. Abre los archivos de Office.', 'Like Word, Excel and PowerPoint, but free. Opens Office files.']]]
];
const IMPRESCINDIBLES = new Set(['VideoLAN.VLC', '7zip.7zip']);
const FORM_GPU = [['NVIDIA', 'https://www.nvidia.com/es-es/software/nvidia-app/'], ['AMD', 'https://www.amd.com/es/support/download/drivers.html'], ['Intel', 'https://www.intel.es/content/www/es/es/support/detect.html']];
const PASOS = [
  ['drivers', '🔌', 'Drivers', 'Drivers', 'Son los "traductores" entre Windows y tus piezas (sonido, wifi, tarjeta gráfica). Tras formatear suelen faltar o ser viejos.', 'They are the "translators" between Windows and your parts (sound, wifi, graphics). After a format they are often missing or old.'],
  ['windows', '🔄', 'Actualizaciones de Windows', 'Windows updates', 'Parches de seguridad y mejoras. Un PC recién formateado suele tener muchas pendientes.', 'Security patches and improvements. A freshly formatted PC usually has many pending.'],
  ['programas', '📦', 'Tus programas', 'Your programs', 'Marca los que quieras y se instalan solos, sin anuncios ni "siguiente, siguiente".', 'Tick what you want and they install by themselves, no ads or "next, next".'],
  ['bloatware', '🗑️', 'Quitar lo que trae Windows y no usas', 'Remove Windows extras you do not use', 'Juegos y apps de prueba que vienen preinstalados. Tú decides cuáles quitar.', 'Trial games and apps that come preinstalled. You decide which to remove.'],
  ['privacidad', '🛡️', 'Apagar anuncios y envío de datos', 'Turn off ads and data sharing', 'Con un clic. Todo se puede volver a encender en la pestaña Privacidad.', 'One click. Everything can be turned back on in the Privacy tab.'],
  ['comodo', '✨', 'Ajustes cómodos', 'Comfort settings', 'Pequeños cambios que hacen Windows más fácil de usar.', 'Small changes that make Windows easier to use.'],
  ['punto', '💾', 'Guardar este momento', 'Save this moment', 'Crea un punto de restauración: si algún día algo se rompe, puedes volver a este PC recién configurado.', 'Creates a restore point: if something ever breaks, you can go back to this freshly set-up PC.']
];

function formSel() { if (!S.formSel) S.formSel = new Set(IMPRESCINDIBLES); return S.formSel; }
function formHecho() { return obj(S.settings.formateoPasos); }

function viewFormateo() {
  const hecho = formHecho(), sel = formSel();
  const nHechos = PASOS.filter(([id]) => hecho[id]).length;
  const paso = (id, ico, es, en, des, den, cuerpo) => `<div class="card paso-f ${hecho[id] ? 'hecho' : ''}"><div class="pf-head"><span class="pf-num">${hecho[id] ? '✔' : ico}</span><div class="grow"><h3>${L(es, en)}</h3><p class="meta">${L(des, den)}</p></div></div>${cuerpo}</div>`;
  const cuerpos = {
    drivers: `<div class="pf-acc"><button class="btn" data-form-ir="drivers">${L('Revisar drivers', 'Check drivers')}</button><span class="meta">${L('Tarjeta gráfica: mejor su programa oficial →', 'Graphics card: best with its official app →')}</span>${FORM_GPU.map(([n, u]) => `<button class="btn small ghost" data-open="${u}">${n}</button>`).join('')}</div>`,
    windows: `<div class="pf-acc"><button class="btn" data-form-ir="actualizaciones">${L('Buscar actualizaciones', 'Search updates')}</button></div>`,
    programas: `<div class="catalogo">${CATALOGO.map(([ces, cen, items]) => `<div class="cat"><div class="cat-t">${L(ces, cen)}</div>${items.map(([id, nombre, ico, des, den]) => `<label class="prog ${sel.has(id) ? 'on' : ''}"><input type="checkbox" class="check" data-form-prog="${id}" ${sel.has(id) ? 'checked' : ''}><span class="pi">${ico}</span><div class="grow"><b>${nombre}</b>${IMPRESCINDIBLES.has(id) ? ` <span class="badge verde">${L('Imprescindible', 'Must have')}</span>` : ''}<div class="note">${L(des, den)}</div></div></label>`).join('')}</div>`).join('')}</div>
      <div class="pf-acc"><button class="btn primary" data-act="formInstalar" ${!sel.size || S.busy ? 'disabled' : ''}>${L(`Instalar ${sel.size} programa(s)`, `Install ${sel.size} program(s)`)}</button><span class="meta">${L('Se descargan de sus webs oficiales. Lo que ya tengas instalado se salta.', 'Downloaded from their official sources. Anything already installed is skipped.')}</span></div>`,
    bloatware: `<div class="pf-acc"><button class="btn" data-form-ir="programas">${L('Ver qué trae Windows', 'See Windows extras')}</button></div>`,
    privacidad: `<div class="pf-acc"><button class="btn" data-act="formPriv" ${S.busy ? 'disabled' : ''}>${L('Apagar lo recomendado', 'Turn off the recommended')}</button></div>`,
    comodo: `<label class="row"><input type="checkbox" class="check" data-form-com="ver_extensiones" ${S.formCom === undefined || S.formCom.has('ver_extensiones') ? 'checked' : ''}><div class="grow"><b>${L('Ver la extensión de los archivos', 'Show file extensions')}</b><div class="note">${L('Verás "foto.jpg" en vez de "foto". Así distingues un virus que se hace pasar por foto ("foto.jpg.exe").', 'You will see "photo.jpg" instead of "photo". It helps spot a virus pretending to be a photo ("photo.jpg.exe").')}</div></div></label>
      <label class="row"><input type="checkbox" class="check" data-form-com="explorador_este_equipo" ${S.formCom === undefined || S.formCom.has('explorador_este_equipo') ? 'checked' : ''}><div class="grow"><b>${L('Abrir el Explorador en "Este equipo"', 'Open File Explorer in "This PC"')}</b><div class="note">${L('Al abrir las carpetas verás tus discos directamente.', 'When you open folders you see your drives directly.')}</div></div></label>
      <div class="pf-acc"><button class="btn" data-act="formComodo" ${S.busy ? 'disabled' : ''}>${L('Aplicar', 'Apply')}</button></div>`,
    punto: `<div class="pf-acc"><button class="btn" data-act="formPunto" ${S.busy ? 'disabled' : ''}>${L('Crear punto de restauración', 'Create restore point')}</button></div>`
  };
  return `<div class="view">${banners()}${head(L('Acabo de formatear', 'Fresh install'), L('¿Windows recién instalado? Sigue estos pasos en orden y en un rato tendrás el PC listo, rápido y sin basura. Puedes hacerlos cuando quieras: se recuerda lo que ya hiciste.', 'Freshly installed Windows? Follow these steps in order and your PC will be ready, fast and junk-free. Do them whenever you like: your progress is remembered.'),
    `<div class="pf-prog"><b>${nHechos}/${PASOS.length}</b> ${L('pasos hechos', 'steps done')}${nHechos ? ` <button class="link" data-act="formReset">${L('Empezar de nuevo', 'Start over')}</button>` : ''}</div>`)}
    ${progressHTML()}
    ${PASOS.map(([id, ico, es, en, des, den], i) => paso(id, `<span>${i + 1}</span>`, es, en, des, den, cuerpos[id])).join('')}
    ${nHechos === PASOS.length ? `<div class="banner good"><div class="grow">🎉 <b>${L('¡Tu PC está listo!', 'Your PC is ready!')}</b> ${L('Recién configurado, rápido y sin basura.', 'Freshly set up, fast and junk-free.')}</div></div>` : ''}</div>`;
}

async function formMarcar(id) {
  S.settings = await rl.setSettings({ formateoPasos: { ...formHecho(), [id]: true } });
  if (PASOS.every(([p]) => S.settings.formateoPasos[p])) retroReacciona('feliz', L('¡PC listo! 🎉', 'PC ready! 🎉'), 6000);
}

function formInstalar() {
  const items = CATALOGO.flatMap((c) => c[2]).filter(([id]) => formSel().has(id)).map(([id, nombre, , , , fuente]) => ({ id, nombre, fuente: fuente || 'winget' }));
  return taskC(L('Instalando tus programas', 'Installing your programs'), async () => {
    const r = obj(await rl.run('actualizaciones', { accion: 'instalar', items }));
    if (r.sinWinget) { toast(L('Falta "Instalador de aplicación" de Microsoft. Te abro la tienda para instalarlo (es gratis) y vuelve a intentarlo.', 'Microsoft "App Installer" is missing. Opening the Store so you can install it (free), then try again.'), 'err'); rl.open('ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'); return; }
    const res = arr(r.resultados), malos = res.filter((x) => !x.ok);
    ganar('programas', res.filter((x) => x.ok && !x.yaEstaba).length);
    if (malos.length) toast(L(`Se instalaron ${res.length - malos.length} de ${res.length}. Los que fallaron puedes instalarlos desde su web.`, `${res.length - malos.length} of ${res.length} installed. Install the failed ones from their website.`), 'err');
    else toast(L(`¡Listo! ${res.length} programa(s) instalados.`, `Done! ${res.length} program(s) installed.`));
    await formMarcar('programas');
    refreshAfter('programas', 'actualizaciones');
  });
}

function formPriv() {
  const ids = PRIVACIDAD.map((x) => x[0]).filter((id) => !PRIV_OPCIONAL.has(id));
  return taskC(L('Apagando anuncios y datos', 'Turning off ads and data'), async () => {
    const r = obj(await rl.run('privacidad', { accion: 'aplicar', ids }));
    S.privacidad = null;
    const ok = arr(r.resultados).filter((x) => x.ok).length;
    if (ok < ids.length) toast(L(`Apagados ${ok} de ${ids.length}. El resto necesita abrir RetroLimpia como administrador.`, `${ok} of ${ids.length} turned off. The rest need RetroLimpia running as administrator.`), 'err');
    else toast(L('Anuncios y envío de datos apagados. Se notará del todo al reiniciar.', 'Ads and data sharing off. Fully visible after restart.'));
    ganar('anuncios', ok);
    await formMarcar('privacidad');
  });
}

function formComodo() {
  const ids = S.formCom ? [...S.formCom] : ['ver_extensiones', 'explorador_este_equipo'];
  return taskC(L('Aplicando ajustes', 'Applying settings'), async () => {
    if (ids.length) await rl.run('privacidad', { accion: 'aplicar', ids });
    toast(L('Hecho. Se nota al abrir una carpeta nueva.', 'Done. Visible when you open a new folder.'));
    await formMarcar('comodo');
  });
}

function formPunto() {
  return taskC(L('Creando punto de restauración', 'Creating restore point'), async () => {
    const r = obj(await rl.run('restauracion', { accion: 'crear', motivo: L('PC recién configurado', 'Fresh PC set up') }));
    if (r.ok === false) { toast(L('Windows no dejó crear el punto: ', 'Windows did not allow the restore point: ') + (r.mensaje || ''), 'err'); return; }
    toast(L('Guardado. Si algo se rompe, podrás volver a este momento desde "Deshacer".', 'Saved. If something breaks, you can return to this moment from "Undo".'));
    await formMarcar('punto');
    refreshAfter('cuarentena');
  });
}
