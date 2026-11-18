'use strict';
// ============================================================ Confianza
function showTrust() {
  const repo = repoUrl();
  $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h2>${L('Tranquilo: RetroLimpia no es un virus', "Relax: RetroLimpia isn't a virus")}</h2>
    <p class="lead">${L('Puede que Windows te haya mostrado una pantalla azul de "Windows protegió su PC" o que tu antivirus haya dudado. Te explicamos por qué pasa, con total sinceridad:', 'Windows may have shown a blue "Windows protected your PC" screen, or your antivirus may have hesitated. Here is honestly why:')}</p>
    <div class="why"><span class="n">1</span><div><b>${L('No tiene firma digital de pago', "It has no paid digital signature")}</b><p>${L('Las grandes empresas pagan cada año un certificado para "firmar" sus programas. RetroLimpia es un proyecto independiente y gratuito, sin ese certificado. Windows avisa de cualquier programa nuevo sin firma, aunque no tenga nada malo: el aviso significa "no conozco a este autor", no "he encontrado un virus".', 'Big companies pay every year for a certificate to "sign" their software. RetroLimpia is an independent free project without one. Windows warns about any new unsigned program even if it is harmless: the warning means "I don\'t know this author", not "I found a virus".')}</p></div></div>
    <div class="why"><span class="n">2</span><div><b>${L('Hace cosas "poderosas" a propósito', 'It does "powerful" things on purpose')}</b><p>${L('Para limpiar de verdad, RetroLimpia necesita permisos de administrador, borrar archivos, tocar el registro y manejar drivers. Los antivirus usan reglas automáticas, y esas acciones también las hacen los programas malos. Por eso a veces dan una "falsa alarma" con limpiadores y desinstaladores.', 'To clean properly, RetroLimpia needs admin rights, deletes files, edits the registry and handles drivers. Antivirus use automatic rules, and malware does those things too. That\'s why cleaners and uninstallers sometimes get a "false alarm".')}</p></div></div>
    <div class="why"><span class="n">3</span><div><b>${L('Puedes comprobarlo tú mismo', 'You can check it yourself')}</b><p>${L('Su código es abierto: cualquiera puede leerlo en GitHub. Puedes subir el instalador a VirusTotal, que lo revisa con más de 60 antivirus a la vez. Y RetroLimpia no envía ningún dato tuyo a internet.', 'Its code is open: anyone can read it on GitHub. You can upload the installer to VirusTotal, which scans it with 60+ antivirus engines. And RetroLimpia sends none of your data to the internet.')}</p></div></div>
    <div class="why"><span class="n">4</span><div><b>${L('Y todo se puede deshacer', 'And everything can be undone')}</b><p>${L('Antes de cambiar nada crea un punto de restauración, y lo que quita pasa unos días en la cuarentena antes de borrarse.', 'Before changing anything it creates a restore point, and anything it removes spends a few days in quarantine before deletion.')}</p></div></div>
    <div class="foot"><button class="btn primary" data-act="trustOk">${L('Entendido, empezar', 'Got it, let\'s start')}</button>
      ${repo ? `<button class="btn ghost" data-open="${repo}">${L('Ver el código', 'View the code')}</button>` : ''}
      <button class="btn ghost" data-open="https://www.virustotal.com/">VirusTotal</button></div></div>`;
  $('#modal').classList.remove('hidden');
}

function freqSelect(attr) {
  return `<select ${attr}>${[[1, 'Cada día', 'Every day'], [3, 'Cada 3 días', 'Every 3 days'], [7, 'Cada semana', 'Every week'], [14, 'Cada 2 semanas', 'Every 2 weeks']].map(([d, es, en]) => `<option value="${d}" ${Number(S.settings.frecuenciaDias) === d ? 'selected' : ''}>${L(es, en)}</option>`).join('')}</select>`;
}
function showReminders() {
  $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h2>${L('¿Te aviso cuando tu PC lo necesite?', 'Shall I remind you when your PC needs it?')}</h2>
    <p class="lead">${L('RetroLimpia puede arrancar en silencio con Windows y revisar cada pocos días si hay basura acumulada o actualizaciones pendientes. <b>Solo te avisa cuando de verdad hay algo que hacer</b>, y nunca cambia nada sin que tú lo confirmes.', 'RetroLimpia can start quietly with Windows and check every few days for piled-up junk or pending updates. <b>It only notifies you when there is actually something to do</b>, and never changes anything without your OK.')}</p>
    <div class="why"><span class="n">🛡</span><div><b>${L('Más seguro', 'Safer')}</b><p>${L('Las actualizaciones de seguridad cierran los agujeros que usan los virus. Cuanto antes se instalen, mejor.', 'Security updates close the holes viruses use. The sooner they are installed, the better.')}</p></div></div>
    <div class="why"><span class="n">⚡</span><div><b>${L('Más rápido', 'Faster')}</b><p>${L('La basura se acumula sola, varios GB al mes. Un repaso de vez en cuando mantiene el PC ágil.', 'Junk piles up by itself, several GB a month. A regular tune-up keeps the PC snappy.')}</p></div></div>
    <div class="why"><span class="n">🧠</span><div><b>${L('Sin tener que acordarte', 'Without remembering')}</b><p>${L('Casi nadie se acuerda de revisar su PC. RetroLimpia se acuerda por ti y apenas usa recursos mientras espera.', 'Hardly anyone remembers to check their PC. RetroLimpia remembers for you and barely uses resources while waiting.')}</p></div></div>
    <div class="setting" style="border:0;padding-bottom:0"><div class="grow"><b>${L('¿Cada cuánto reviso?', 'How often should I check?')}</b></div>${freqSelect('id="remFreq"')}</div>
    <div class="foot"><button class="btn primary" data-act="remindYes">${L('Sí, avísame (recomendado)', 'Yes, remind me (recommended)')}</button>
      <button class="btn ghost" data-act="remindNo">${L('Ahora no', 'Not now')}</button>
      <span class="meta">${L('Puedes cambiarlo cuando quieras en Ajustes.', 'You can change it any time in Settings.')}</span></div></div>`;
  $('#modal').classList.remove('hidden');
}

function showDonate() {
  $('#modal').innerHTML = `<div class="modal donate-modal" role="dialog" aria-modal="true">
    <div class="heart-anim" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg><span></span><span></span><span></span></div>
    <h2>${L('¡Gracias de corazón!', 'Thank you from the heart!')}</h2>
    <p class="lead">${L('Cualquier monto que envíes se agradece muchísimo. Gracias a gente como tú, RetroLimpia sigue siendo gratis, sin anuncios y mejorando cada día.', 'Any amount you send is deeply appreciated. Thanks to people like you, RetroLimpia stays free, ad-free and keeps improving.')}</p>
    <div class="why"><span class="n">💜</span><div><b>${L('Tú eliges el monto', 'You choose the amount')}</b><p>${L('Te llevaremos a un enlace de donación donde podrás poner la cantidad que quieras y, si te apetece, un mensaje.', 'We will take you to a donation link where you can enter any amount you like and, if you want, a message.')}</p></div></div>
    <div class="why"><span class="n">🔒</span><div><b>${L('Pago seguro a través de PayPal', 'Secure payment through PayPal')}</b><p>${L('El pago lo procesa PayPal de forma segura. RetroLimpia no ve ni guarda ningún dato personal tuyo: ni tu nombre, ni tu correo, ni tu tarjeta.', 'PayPal processes the payment securely. RetroLimpia never sees or stores any of your personal data: not your name, email or card.')}</p></div></div>
    <div class="banner good" style="margin-top:14px"><div class="grow">😊 <b>${L('Puedes estar tranquilo.', 'You can relax.')}</b> ${L('Se abrirá en tu navegador y puedes cerrarlo cuando quieras.', 'It opens in your browser and you can close it whenever you like.')}</div></div>
    <div class="foot"><button class="btn primary" data-act="donateGo">💜 ${L('Ir a donar', 'Go to donate')}</button><button class="btn ghost" data-act="modalClose">${L('Ahora no', 'Not now')}</button></div></div>`;
  $('#modal').classList.remove('hidden');
}

// ============================================================ Notas del parche
// REGLA: después de cada actualización se muestran las novedades (data/novedades.json).
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
async function showNews(desde, todas) {
  let datos;
  try { datos = await rl.data('novedades'); } catch { return false; }
  const lista = (datos && datos.versiones || []).filter((v) => {
    if (cmpVer(v.version, S.info.version) > 0) return false;   // nunca notas de versiones futuras
    if (todas) return true;                                    // Ajustes > Ver novedades: todas
    if (desde) return cmpVer(v.version, desde) > 0;            // tras actualizar: todo lo nuevo desde la versión anterior
    return v.version === S.info.version;
  });
  if (!lista.length) return false;
  const en = S.settings.idioma === 'en';
  $('#modal').innerHTML = `<div class="modal news-modal" role="dialog" aria-modal="true">
    <div class="news-badge">✨ v${esc(S.info.version)}</div>
    <h2>${todas ? L('Novedades de RetroLimpia', "What's new in RetroLimpia") : L('¡RetroLimpia se actualizó!', 'RetroLimpia was updated!')}</h2>
    <p class="lead">${todas ? L('Lo que cambió en cada versión.', 'What changed in each version.') : L('Esto es lo que se arregló y mejoró:', 'Here is what was fixed and improved:')}</p>
    <div class="news-list">${lista.map((v) => `<div class="news-ver"><div class="news-head"><b>${L('Versión', 'Version')} ${esc(v.version)}</b>${v.fecha ? `<span>${esc(v.fecha)}</span>` : ''}</div><ul>${(en ? v.en || v.es : v.es).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="foot"><button class="btn primary" data-act="modalClose">${L('¡Genial!', 'Great!')}</button>${S.info.discord ? `<button class="btn ghost" data-open="${S.info.discord}">💬 ${L('Comentar en Discord', 'Discuss on Discord')}</button>` : ''}</div></div>`;
  $('#modal').classList.remove('hidden');
  return true;
}

// ============================================================ Reportar un problema
// Nada se envía solo: se muestra exactamente qué se manda y la persona pulsa Enviar.
const VIEW_NAMES = { inicio: 'Revisar mi PC', programas: 'Programas y bloatware', limpieza: 'Limpieza', arranque: 'Arranque de Windows', hardware: 'Hardware y salud', drivers: 'Drivers', actualizaciones: 'Actualizaciones', procesos: 'Procesos', deshacer: 'Deshacer y cuarentena', ajustes: 'Ajustes' };
function monitorLogText() {
  if (!S.mon) return '';
  return S.mon.items.map((it) => `--- ${it.nombre} [${it.estado}] ---\n` + it.log.map((l) => `${l.tipo}: ${l.msg}${l.ruta ? ' | ' + l.ruta : ''}`).join('\n') + (it.res ? `\nresultado: ${JSON.stringify({ ok: it.res.ok, metodo: it.res.metodo, plataforma: it.res.plataforma, registroLimpio: it.res.registroLimpio, mensaje: it.res.mensaje })}` : '')).join('\n');
}
async function openReport(ctx) {
  // La captura se hace ANTES de abrir la ventana, para que muestre lo que la persona estaba viendo
  const modalAbierto = !$('#modal').classList.contains('hidden');
  let auto = null;
  if (!modalAbierto) auto = await rl.reportCapture().catch(() => null);
  const prep = await rl.reportPrepare().catch(() => ({ log: '' }));
  const errores = S.scan && S.scan.errors ? '\n\n===== Errores del último análisis =====\n' + Object.entries(S.scan.errors).map(([k, v]) => k + ': ' + v).join('\n') : '';
  const mon = monitorLogText();
  S.rep = {
    desc: ctx ? L('Problema al ', 'Problem with ') + ctx + ':\n' : '', contacto: '',
    seccion: ctx || VIEW_NAMES[S.view] || S.view || '',
    auto, img: auto, imgNombre: L('Captura de RetroLimpia (lo que estabas viendo)', 'RetroLimpia screenshot (what you were seeing)'), useImg: !!auto,
    incluirLog: true, verLog: false,
    log: (prep.log || '') + errores + (mon ? '\n\n===== Última desinstalación (ventana de seguimiento) =====\n' + mon : ''),
    enviando: false, hecho: null
  };
  S.crashSeen = true;
  renderReport();
  $('#modal').classList.remove('hidden');
  setTimeout(() => { const t = document.getElementById('repDesc'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 50);
}
function renderReport() {
  const r = S.rep; if (!r) return;
  if (r.hecho) {
    $('#modal').innerHTML = `<div class="modal rep-modal" role="dialog" aria-modal="true">
      <div class="rep-ok">✔</div>
      <h2>${L('¡Reporte enviado! Gracias 💜', 'Report sent! Thank you 💜')}</h2>
      <p class="lead">${L('Llegó a un canal privado que solo ve el creador de RetroLimpia. Con esto se puede preparar el parche.', 'It reached a private channel only the creator of RetroLimpia can see. This helps prepare the fix.')}</p>
      <div class="card"><div class="kv"><span>${L('Número de reporte', 'Report number')}</span><span><b>${esc(r.hecho)}</b> <button class="link" data-copy="${esc(r.hecho)}">${L('Copiar', 'Copy')}</button></span></div></div>
      ${S.info.discord ? `<p class="meta" style="margin-top:12px">${L('Si quieres seguir el arreglo o dar más detalles, entra a la comunidad y menciona este número en #ayuda.', 'To follow the fix or add details, join the community and mention this number in #help.')}</p>` : ''}
      <div class="foot">${S.info.discord ? `<button class="btn primary" data-open="${S.info.discord}">💬 ${L('Ir al Discord', 'Open Discord')}</button>` : ''}<button class="btn ghost" data-act="modalClose">${L('Cerrar', 'Close')}</button></div></div>`;
    return;
  }
  const img = r.useImg && r.img;
  $('#modal').innerHTML = `<div class="modal rep-modal" role="dialog" aria-modal="true" aria-label="${L('Reportar un problema', 'Report a problem')}">
    <h2>🐞 ${L('Reportar un problema', 'Report a problem')}</h2>
    <p class="lead">${L('Cuéntanos qué pasó. El reporte llega a un canal privado del creador de RetroLimpia para preparar el arreglo.', 'Tell us what happened. The report goes to a private channel of the RetroLimpia creator to prepare a fix.')}</p>
    <label class="rep-label" for="repDesc">${L('¿Qué pasó? ¿Qué estabas haciendo?', 'What happened? What were you doing?')} *</label>
    <textarea id="repDesc" class="rep-text" rows="5" maxlength="3500" placeholder="${L('Ejemplo: le di a Desinstalar a un juego de Steam y la barra se quedó en 0%...', 'Example: I clicked Uninstall on a Steam game and the bar stayed at 0%...')}">${esc(r.desc)}</textarea>
    <div class="rep-shot ${img ? '' : 'empty'}">
      ${img ? `<img src="${img}" alt="${L('Vista previa de la captura', 'Screenshot preview')}"><div class="grow"><b>📸 ${esc(r.imgNombre || '')}</b><span>${L('Se enviará esta imagen.', 'This image will be sent.')}</span>
        <div class="rep-btns"><button class="btn small ghost" data-act="repPick">${L('Elegir otra imagen…', 'Choose another image…')}</button><button class="btn small ghost" data-act="repNoImg">${L('No enviar imagen', 'Do not send image')}</button></div></div>`
      : `<div class="grow"><b>📸 ${L('Te recomendamos añadir una captura de pantalla', 'We recommend adding a screenshot')}</b><span>${L('Una imagen del error ayuda muchísimo: muestra exactamente lo que ves. Puedes pegarla con Ctrl+V (tecla Impr Pant o Windows + Shift + S para capturar).', 'A picture of the error helps a lot: it shows exactly what you see. You can paste it with Ctrl+V (Print Screen key or Windows + Shift + S to capture).')}</span>
        <div class="rep-btns"><button class="btn small primary" data-act="repPick">${L('Elegir imagen…', 'Choose image…')}</button>${r.auto ? `<button class="btn small ghost" data-act="repUseAuto">${L('Usar captura de RetroLimpia', 'Use RetroLimpia screenshot')}</button>` : ''}</div></div>`}
    </div>
    <label class="rep-check"><input type="checkbox" id="repLog" ${r.incluirLog ? 'checked' : ''}> <span><b>${L('Adjuntar registro técnico (recomendado)', 'Attach technical log (recommended)')}</b><br>${L('Versión, Windows, hardware básico y lo que hizo RetroLimpia. Tu nombre de usuario y el nombre del PC se cambian por &lt;usuario&gt; y &lt;equipo&gt;.', 'Version, Windows, basic hardware and what RetroLimpia did. Your username and PC name are replaced with &lt;user&gt; and &lt;pc&gt;.')}</span></label>
    <button class="link" data-act="repToggleLog">${r.verLog ? L('Ocultar lo que se envía', 'Hide what is sent') : L('Ver exactamente lo que se envía', 'See exactly what is sent')}</button>
    ${r.verLog ? `<pre class="rep-log">${esc(r.log || L('(vacío)', '(empty)'))}</pre>` : ''}
    <label class="rep-label" for="repContacto">${L('Tu usuario de Discord (opcional, por si hace falta preguntarte algo)', 'Your Discord username (optional, in case we need to ask you)')}</label>
    <input id="repContacto" class="rep-input" maxlength="100" value="${esc(r.contacto)}" placeholder="${L('ej. usuario123', 'e.g. user123')}">
    <p class="meta">🔒 ${L('No se envía nada más: ni tus archivos, ni contraseñas, ni la lista completa de tus programas.', 'Nothing else is sent: no files, passwords or full list of your programs.')}</p>
    <div class="foot"><button class="btn primary" data-act="repSend" ${r.enviando ? 'disabled' : ''}>${r.enviando ? L('Enviando…', 'Sending…') : L('Enviar reporte', 'Send report')}</button><button class="btn ghost" data-act="modalClose" ${r.enviando ? 'disabled' : ''}>${L('Cancelar', 'Cancel')}</button></div></div>`;
}
function repSyncFields() {
  const r = S.rep; if (!r) return;
  const d = document.getElementById('repDesc'); if (d) r.desc = d.value;
  const c = document.getElementById('repContacto'); if (c) r.contacto = c.value;
  const l = document.getElementById('repLog'); if (l) r.incluirLog = l.checked;
}
document.addEventListener('input', (e) => { if (S.rep && e.target && /^rep/.test(e.target.id || '')) repSyncFields(); }, true);
document.addEventListener('change', (e) => { if (S.rep && e.target && e.target.id === 'repLog') repSyncFields(); }, true);
// Pegar una captura con Ctrl+V dentro de la ventana de reporte
document.addEventListener('paste', (e) => {
  if (!S.rep || S.rep.hecho || $('#modal').classList.contains('hidden')) return;
  const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type && i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  const f = item.getAsFile();
  if (f.size > 7 * 1024 * 1024) return toast(L('La imagen pesa más de 7 MB.', 'The image is larger than 7 MB.'), 'err');
  const fr = new FileReader();
  fr.onload = () => { repSyncFields(); S.rep.img = fr.result; S.rep.imgNombre = L('Imagen pegada', 'Pasted image'); S.rep.useImg = true; renderReport(); };
  fr.readAsDataURL(f);
});
async function sendReport() {
  repSyncFields();
  const r = S.rep;
  if ((r.desc || '').trim().length < 10) { toast(L('Cuéntanos un poco más qué pasó (mínimo 10 letras).', 'Tell us a bit more (at least 10 characters).'), 'err'); const d = document.getElementById('repDesc'); if (d) d.focus(); return; }
  if (!(r.useImg && r.img) && !r.avisadoImg) {
    r.avisadoImg = true;
    toast(L('📸 Consejo: una captura ayuda mucho. Si aun así quieres enviarlo sin imagen, pulsa Enviar otra vez.', '📸 Tip: a screenshot helps a lot. To send without one, press Send again.'));
    return;
  }
  r.enviando = true; renderReport();
  const res = await rl.reportSend({ descripcion: r.desc.trim(), contacto: r.contacto.trim(), seccion: r.seccion, log: r.incluirLog ? r.log : '', imagen: r.useImg ? r.img : null }).catch((e) => ({ ok: false, error: String(e.message || e) }));
  r.enviando = false;
  if (res && res.ok) { r.hecho = res.id || 'OK'; renderReport(); return; }
  renderReport();
  toast(L('No se pudo enviar: ', 'Could not send: ') + ((res && res.error) || '?'), 'err');
}
