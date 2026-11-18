'use strict';
// ============================================================ Arranque
(async function init() {
  [S.settings, S.info] = await Promise.all([rl.getSettings(), rl.info()]);
  const [bloat, prot, inicio] = await Promise.all([rl.data('bloatware'), rl.data('protegidos'), rl.data('inicio')]);
  S.data = { bloat, prot, inicio };
  document.documentElement.lang = S.settings.idioma;
  $('#ver').textContent = 'v' + S.info.version;
  render();
  if (!S.settings.confianzaVista) showTrust();
  else if (!S.settings.tourVisto) startTour();
  else if (!S.settings.recordatoriosPreguntado) showReminders();
  rl.onUpdate((st) => { const was = S.upd && S.upd.estado; S.upd = st; if (was === 'descargando' && st.estado === 'lista') S.updHide = false; setTimeout(renderUpdWin, 0); if (st.estado !== 'lista') S.updCount = null; if (was !== st.estado) render(); else { const el = document.getElementById('updBanner'); if (el) el.outerHTML = updBannerHTML(); else if (st.estado === 'descargando') render(); } });
  // ¿Venimos de una actualización? Se avisa una sola vez
  if (S.settings.ultimaVersion && S.settings.ultimaVersion !== S.info.version) {
    const desde = S.settings.ultimaVersion;
    setTimeout(() => showNews(desde).then((ok) => { if (!ok) toast('✨ ' + L(`RetroLimpia se actualizó a la versión ${S.info.version}. ¡Ya estás al día!`, `RetroLimpia was updated to version ${S.info.version}. You're up to date!`)); }), 900);
  }
  if (S.settings.ultimaVersion !== S.info.version) rl.setSettings({ ultimaVersion: S.info.version }).then((st) => { S.settings = st; });
  rl.onSettings((st) => { S.settings = st; render(); });
  rl.onResumen(async () => { S.settings = await rl.getSettings(); render(); });
  rl.updateState().then((st) => {
    S.upd = st;
    // Sin actualizador automático (modo desarrollo): solo avisamos
    if (!st.auto) rl.checkUpdate().then((u) => { S.appUpdate = u; if (u.disponible) render(); }).catch(() => {});
    render();
  }).catch(() => {});
})();

// Amigable con el PC: si la ventana está oculta o minimizada, se pausan animaciones y relojes
function marcarDormido() { document.body.classList.toggle('dormido', document.hidden); }
document.addEventListener('visibilitychange', marcarDormido); marcarDormido();
