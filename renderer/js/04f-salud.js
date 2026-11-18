'use strict';
// ============================================================ ¿Por qué se reinició? · Historial de salud · Lo que ganaste
const REINICIO_ICO = { update: '🔄', usuario: '👤', programa: '📦', bsod: '💙', corte: '⚡' };

async function loadReinicios() { const r = obj(await rl.run('reinicios', {})); S.reinicios = arr(r.eventos); }

function reiniciosHTML() {
  const ev = S.reinicios;
  const bsod = ev ? ev.filter((e) => e.clase === 'bsod').length : 0, cortes = ev ? ev.filter((e) => e.clase === 'corte').length : 0;
  const resumen = !ev ? '' : bsod >= 3 ? `<div class="banner bad"><div class="grow"><b>${L(`${bsod} pantallazos azules en 30 días`, `${bsod} blue screens in 30 days`)}</b> · ${L('No es normal. Lo más habitual es un driver (gráfica, sonido, red) o un ajuste de RAM/overclock inestable. Revisa la pestaña Drivers y, si tienes la RAM con XMP/EXPO activado, prueba a desactivarlo un tiempo. <b>No borres los "Volcados de memoria"</b> en Limpieza: un técnico los necesita para saber la causa exacta.', 'That is not normal. Usually a driver (graphics, sound, network) or unstable RAM/overclock settings. Check the Drivers tab and, if your RAM uses XMP/EXPO, try turning it off for a while. <b>Do not delete "Memory dumps"</b> in Cleanup: a technician needs them to find the exact cause.')}</div><button class="btn small" data-nav="drivers">${L('Ir a Drivers', 'Go to Drivers')}</button></div>`
    : bsod ? `<div class="banner warn"><div class="grow"><b>${L(`${bsod} pantallazo(s) azul(es) en 30 días`, `${bsod} blue screen(s) in 30 days`)}</b> · ${L('Uno suelto puede pasar. Si se repite, revisa los drivers (sobre todo el de la gráfica).', 'One alone can happen. If it repeats, check your drivers (especially graphics).')}</div><button class="btn small" data-nav="drivers">${L('Ir a Drivers', 'Go to Drivers')}</button></div>`
    : cortes >= 3 ? `<div class="banner warn"><div class="grow"><b>${L(`Se apagó de golpe ${cortes} veces`, `It shut down suddenly ${cortes} times`)}</b> · ${L('Si no fueron cortes de luz, puede ser la fuente de alimentación o temperaturas altas. Vigila las temperaturas arriba.', 'If it was not power cuts, it may be the power supply or high temperatures. Watch the temperatures above.')}</div></div>`
    : ev.length ? `<div class="banner good"><div class="grow">✔ ${L('Nada preocupante: los reinicios fueron normales.', 'Nothing worrying: restarts were normal.')}</div></div>` : '';
  return `<h2>${L('¿Por qué se reinició o se apagó mi PC?', 'Why did my PC restart or shut down?')}</h2>
    <div class="card"><div class="card-head"><p class="meta">${L('Windows apunta cada apagado y reinicio. RetroLimpia lo lee (sin cambiar nada) y te lo explica: los últimos 30 días.', 'Windows logs every shutdown and restart. RetroLimpia reads it (changing nothing) and explains it: the last 30 days.')}</p>
      <button class="btn ${ev ? 'ghost' : 'primary'}" data-act="reinicios" ${S.busy ? 'disabled' : ''}>${ev ? L('Leer otra vez', 'Read again') : L('Averiguarlo', 'Find out')}</button></div>
    ${resumen}
    ${ev ? (ev.length ? `<div class="list">${ev.map((e) => `<div class="row"><span class="priv-ico">${REINICIO_ICO[e.clase] || '•'}</span><div class="grow"><div class="name">${esc(e.titulo)}${e.codigo ? ` <span class="badge gris">${esc(e.codigo)}</span>` : ''}</div><div class="note">${esc(e.detalle)}</div></div><div class="meta nowrap">${new Date(e.fecha).toLocaleString(S.settings.idioma === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>`).join('')}</div>` : `<div class="empty">${L('Ningún apagado ni reinicio en los últimos 30 días.', 'No shutdowns or restarts in the last 30 days.')}</div>`) : ''}</div>`;
}

function reinicios() { return task(L('Leyendo el historial de Windows', 'Reading the Windows history'), loadReinicios); }

// Mini gráfico de la nota de salud (SVG a mano: sin librerías, no pesa nada)
function historialHTML() {
  const h = arr(S.settings.historial);
  if (h.length < 2) return '';
  const W = 260, H = 54, n = h.length;
  const min = Math.max(0, Math.min(...h.map((x) => x.n)) - 10), rango = Math.max(10, 100 - min);
  const pts = h.map((x, i) => [Math.round(i * (W - 8) / (n - 1)) + 4, Math.round(H - 6 - ((x.n - min) / rango) * (H - 12))]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p.join(' ')).join(' ');
  const dif = h[n - 1].n - h[0].n;
  return `<div class="card hist"><div class="grow"><div class="cat-t">${L('Historial de salud', 'Health history')}</div>
    <div class="meta">${dif > 0 ? L(`Subió ${dif} puntos desde el ${fechaCorta(h[0].d)} 📈`, `Up ${dif} points since ${fechaCorta(h[0].d)} 📈`) : dif < 0 ? L(`Bajó ${-dif} puntos desde el ${fechaCorta(h[0].d)}: toca revisar`, `Down ${-dif} points since ${fechaCorta(h[0].d)}: time for a check`) : L('Estable', 'Stable')}</div></div>
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="${L('Gráfico de la nota de salud', 'Health score chart')}"><path d="${d}" fill="none" stroke="#b14dff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === n - 1 ? 4 : 2.5}" fill="#b14dff"><title>${h[i].d}: ${h[i].n}</title></circle>`).join('')}</svg></div>`;
}
function fechaCorta(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString(S.settings.idioma === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' }); }

// Lo que RetroLimpia hizo por ti, desde siempre
function ganadoHTML() {
  const t = obj(S.settings.totales), j = Number(S.settings.juegoPartidas) || 0;
  const items = [
    [t.liberado, '🧹', fmtBytes(t.liberado || 0), L('liberados', 'freed')],
    [t.desinstalados, '🗑️', t.desinstalados, L('programas quitados', 'programs removed')],
    [t.restos, '📂', t.restos, L('restos borrados', 'leftovers removed')],
    [t.anuncios, '🛡️', t.anuncios, L('anuncios y rastreos apagados', 'ads & trackers off')],
    [t.programas, '📦', t.programas, L('programas instalados', 'programs installed')],
    [j, '🎮', j, L('partidas en Modo Juego', 'Game Mode sessions')]
  ].filter((x) => Number(x[0]) > 0);
  if (!items.length) return '';
  return `<div class="card ganado"><div class="cat-t">${L('Lo que RetroLimpia hizo por ti', 'What RetroLimpia did for you')}</div>
    <div class="ganado-g">${items.map(([, ico, v, txt]) => `<div><span class="gi">${ico}</span><b>${v}</b><span class="meta">${txt}</span></div>`).join('')}</div></div>`;
}
