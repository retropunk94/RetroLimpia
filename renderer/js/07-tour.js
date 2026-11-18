'use strict';
// ============================================================ Tour de bienvenida
const TOUR = [
  [null, '👋', '¡Bienvenido a RetroLimpia!', 'Welcome to RetroLimpia!',
    'Te enseño en un minuto para qué sirve cada parte. <b>No necesitas saber nada de informática</b>: RetroLimpia te guía y nunca cambia nada sin preguntarte.',
    'Let me show you what each part does in one minute. <b>You do not need to know anything about computers</b>: RetroLimpia guides you and never changes anything without asking.'],
  ['inicio', '🩺', 'Revisar mi PC', 'Check my PC',
    'Empieza siempre aquí. Con <b>un solo botón</b> revisa todo tu PC y le pone una <b>nota de salud del 1 al 100</b>. Después, con "Arreglar todo", aplica lo recomendado.',
    'Always start here. <b>One button</b> checks your whole PC and gives it a <b>health score from 1 to 100</b>. Then "Fix all" applies what is recommended.'],
  ['programas', '📦', 'Programas y bloatware', 'Programs & bloatware',
    'Los PCs vienen con programas que casi nadie usa (se llaman <b>bloatware</b>). Aquí los quitas sin dejar restos. Los colores ayudan: <b style="color:var(--verde)">verde</b> es seguro quitarlo, <b style="color:var(--amarillo)">amarillo</b> es opcional y <b style="color:var(--rojo)">rojo</b> mejor no tocarlo.',
    'PCs come with programs hardly anyone uses (called <b>bloatware</b>). Remove them here without leftovers. Colours help: <b style="color:var(--verde)">green</b> is safe, <b style="color:var(--amarillo)">yellow</b> optional, <b style="color:var(--rojo)">red</b> better leave it.'],
  ['limpieza', '🧹', 'Limpieza', 'Cleanup',
    'Con el uso se acumulan <b>archivos basura</b>: temporales, restos de actualizaciones, cachés... Aquí los borras para recuperar espacio. Tus fotos, documentos y contraseñas no se tocan.',
    'Over time <b>junk files</b> pile up: temp files, update leftovers, caches... Delete them here to free space. Your photos, documents and passwords are never touched.'],
  ['arranque', '⚡', 'Arranque de Windows', 'Windows startup',
    'Programas que se abren solos al encender el PC y lo hacen arrancar más lento. Desactivar los que no necesitas es como un interruptor: <b>no borra nada</b>.',
    'Programs that open by themselves when you turn on the PC and slow down startup. Turning off the ones you do not need is like a switch: <b>nothing is deleted</b>.'],
  ['hardware', '🔧', 'Hardware y salud', 'Hardware & health',
    'Lo que tiene tu PC por dentro (procesador, gráfica, memoria...) y <b>si algo está fallando</b>, como un disco cansado o una temperatura alta. Te lo explica con consejos sencillos.',
    'What is inside your PC (processor, graphics, memory...) and <b>whether something is failing</b>, like a tired disk or high temperature. Explained with simple tips.'],
  ['drivers', '🔌', 'Drivers', 'Drivers',
    'Los drivers son los <b>"traductores"</b> entre Windows y tus piezas (sonido, red, gráfica). Aquí ves si alguno falla y los actualizas solo desde <b>fuentes oficiales</b>.',
    'Drivers are the <b>"translators"</b> between Windows and your parts (sound, network, graphics). See if any is failing and update them only from <b>official sources</b>.'],
  ['actualizaciones', '🔄', 'Actualizaciones', 'Updates',
    'Mantiene <b>Windows y tus programas al día</b>, lo más importante para estar protegido de virus. Puedes marcar lo que quieras o actualizarlo todo de una vez.',
    'Keeps <b>Windows and your programs up to date</b>, the most important thing to stay safe from viruses. Tick what you want or update everything at once.'],
  ['procesos', '📊', 'Procesos (avanzado)', 'Processes (advanced)',
    'Muestra qué está gastando la memoria y el procesador <b>ahora mismo</b>. Útil si el PC va lento. Es para quien sabe lo que hace: si no estás seguro, no cierres nada aquí.',
    'Shows what is using memory and processor <b>right now</b>. Useful if the PC is slow. It is for people who know what they are doing: if unsure, do not close anything here.'],
  ['deshacer', '🛟', 'Deshacer y cuarentena', 'Undo & quarantine',
    'Tu <b>red de seguridad</b>. Todo lo que RetroLimpia quita se guarda aquí unos días. Si algo deja de funcionar, lo <b>restauras con un clic</b>.',
    'Your <b>safety net</b>. Everything RetroLimpia removes is kept here for a few days. If something stops working, <b>restore it with one click</b>.'],
  ['ajustes', '⚙️', 'Ajustes', 'Settings',
    'Idioma, recordatorios automáticos, notificaciones... Y si algún día quieres <b>repetir este tour</b>, lo encuentras aquí.',
    'Language, automatic reminders, notifications... And if you ever want to <b>repeat this tour</b>, you will find it here.'],
  [null, '🚀', '¡Ya está! Así de fácil', "That's it! Easy as that",
    'Ahora pulsa <b>"Revisar mi PC"</b> y deja que RetroLimpia haga el trabajo. Recuerda: <b>nada cambia sin que tú lo confirmes</b>, y todo se puede deshacer.',
    'Now press <b>"Check my PC"</b> and let RetroLimpia do the work. Remember: <b>nothing changes without your OK</b>, and everything can be undone.']
];
let tourStep = 0;
function startTour() { tourStep = 0; S.view = 'inicio'; render(); $('#tour').classList.remove('hidden'); renderTour(); }
async function endTour(skipped) {
  $('#tour').classList.add('hidden'); $('#tour').innerHTML = '';
  S.view = 'inicio'; render();
  S.settings = await rl.setSettings({ tourVisto: true });
  if (skipped) toast(L('Tour saltado. Puedes verlo cuando quieras en Ajustes.', 'Tour skipped. You can watch it any time in Settings.'));
  if (!S.settings.recordatoriosPreguntado) showReminders();
}
function renderTour() {
  const [nav, ico, tes, ten, des, den] = TOUR[tourStep];
  const last = tourStep === TOUR.length - 1, first = tourStep === 0;
  const target = nav ? document.querySelector(`.nav-item[data-nav="${nav}"]`) : null;
  if (target) target.scrollIntoView({ block: 'nearest' });
  let spot = '', pos = 'left:50%;top:50%;transform:translate(-50%,-50%)';
  if (target) {
    const r = target.getBoundingClientRect(), pad = 6;
    spot = `<div class="tour-spot" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>`;
    const top = Math.max(16, Math.min(window.innerHeight - 330, r.top - 40));
    pos = `left:${r.right + 26}px;top:${top}px`;
  }
  $('#tour').innerHTML = `${target ? spot : '<div class="tour-dim"></div>'}
    <div class="tour-card ${target ? 'side' : 'center'}" style="${pos}">
      ${target ? `<div class="tour-arrow" style="top:${Math.max(18, target.getBoundingClientRect().top - Math.max(16, Math.min(window.innerHeight - 330, target.getBoundingClientRect().top - 40)) + target.getBoundingClientRect().height / 2 - 9)}px"></div>` : ''}
      <div class="tour-ico">${ico}</div>
      <h3>${L(tes, ten)}</h3>
      <p>${L(des, den)}</p>
      <div class="tour-dots">${TOUR.map((_, i) => `<i class="${i === tourStep ? 'on' : i < tourStep ? 'done' : ''}"></i>`).join('')}</div>
      <div class="tour-foot">
        ${last ? '' : `<button class="link" data-tour="skip">${L('Saltar tour', 'Skip tour')}</button>`}
        <span style="flex:1"></span>
        ${first ? '' : `<button class="btn small ghost" data-tour="back">${L('Atrás', 'Back')}</button>`}
        <button class="btn small primary" data-tour="next">${first ? L('Empezar el tour', 'Start the tour') : last ? L('¡A revisar mi PC!', "Let's check my PC!") : L('Siguiente', 'Next')} ${last ? '' : '→'}</button>
      </div>
      ${first ? '' : `<div class="tour-count">${tourStep} / ${TOUR.length - 1}</div>`}
    </div>`;
  const btn = $('#tour [data-tour="next"]'); if (btn) btn.focus();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tour]');
  if (!b) return;
  const a = b.dataset.tour;
  if (a === 'skip') return endTour(true);
  if (a === 'back') { tourStep = Math.max(0, tourStep - 1); return renderTour(); }
  if (a === 'next') { if (tourStep === TOUR.length - 1) return endTour(false); tourStep++; return renderTour(); }
});
document.addEventListener('keydown', (e) => {
  if ($('#tour').classList.contains('hidden')) return;
  if (e.key === 'Escape') endTour(true);
  else if (e.key === 'ArrowRight') { if (tourStep < TOUR.length - 1) { tourStep++; renderTour(); } }
  else if (e.key === 'ArrowLeft') { if (tourStep > 0) { tourStep--; renderTour(); } }
});
window.addEventListener('resize', () => { if (!$('#tour').classList.contains('hidden')) renderTour(); });

// ============================================================ Informe
function buildReport() {
  const h = S.hardware;
  const rows = (S.scan.findings || []).map((f) => `<li><b>[${f.nivel}]</b> ${esc(f.titulo)}${f.detalle ? ' — ' + esc(f.detalle) : ''}</li>`).join('');
  return `<!DOCTYPE html><html lang="${S.settings.idioma}"><head><meta charset="utf-8"><title>RetroLimpia - ${L('Informe', 'Report')}</title>
  <style>body{font:15px/1.6 Segoe UI,sans-serif;max-width:860px;margin:40px auto;padding:0 20px;color:#1a1631}h1{color:#8a5cff}td{padding:4px 14px 4px 0;vertical-align:top}.score{font-size:42px;font-weight:700}</style></head><body>
  <h1>RetroLimpia — ${L('Informe del PC', 'PC report')}</h1><p>${new Date().toLocaleString()} · ${esc(S.info.equipo || '')}</p>
  <p class="score">${S.scan.score ?? '—'}/100 <small>${S.scan.score != null ? scoreLabel(S.scan.score) : ''}</small></p>
  <h2>${L('Hallazgos', 'Findings')}</h2><ul>${rows || '<li>—</li>'}</ul>
  ${h ? `<h2>Hardware</h2><table>
   <tr><td>${L('Sistema', 'System')}</td><td>${esc(h.sistema.nombre)} ${esc(h.sistema.version)} (build ${esc(h.sistema.build)})</td></tr>
   <tr><td>CPU</td><td>${esc(h.cpu.nombre)}</td></tr><tr><td>RAM</td><td>${fmtBytes(h.ram.total)}</td></tr>
   <tr><td>GPU</td><td>${(h.gpus || []).map((g) => esc(g.nombre) + ' (driver ' + esc(g.driver) + ')').join('<br>')}</td></tr>
   <tr><td>${L('Placa', 'Board')}</td><td>${esc(h.placa.fabricante)} ${esc(h.placa.modelo)} · BIOS ${esc(h.bios.version)} (${esc(h.bios.fecha)})</td></tr>
   <tr><td>${L('Discos', 'Disks')}</td><td>${(h.discos || []).map((d) => esc(d.nombre) + ' — ' + esc(d.salud) + (d.desgaste != null ? ', ' + L('desgaste', 'wear') + ' ' + d.desgaste + '%' : '')).join('<br>')}</td></tr></table>` : ''}
  <p style="color:#888;margin-top:40px">${L('Generado por RetroLimpia', 'Generated by RetroLimpia')} ${esc(S.info.version)}</p></body></html>`;
}
