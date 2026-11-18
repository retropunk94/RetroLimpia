'use strict';
// ============================================================ Restos de programas antiguos
// Lo que dejaron programas que YA NO tienes: carpetas vacías, accesos directos rotos,
// carpetas sin ningún programa dentro y entradas "fantasma". Todo va a la cuarentena (se puede deshacer).
const RESTO_CLASE = {
  vacia: ['📂', 'Carpeta vacía', 'Empty folder', 'No tiene nada dentro. Quedó de un programa que ya no está.', 'Nothing inside. Left by a program that is gone.'],
  huerfana: ['🗂️', 'Carpeta de un programa que ya no está', 'Folder of a removed program', 'No hay ningún programa dentro, solo archivos sueltos que dejó. Revísala antes.', 'No program inside, just files it left. Check it first.'],
  acceso: ['🔗', 'Acceso directo roto', 'Broken shortcut', 'Apunta a algo que ya no existe: al pulsarlo no abre nada.', 'Points to something that no longer exists: it opens nothing.'],
  fantasma: ['👻', 'Programa fantasma', 'Ghost program', 'Sale en la lista de programas de Windows, pero ya no está instalado.', 'Shows up in the Windows program list but is no longer installed.']
};

async function loadRestos() {
  const r = obj(await rl.run('restos', {}));
  S.restos = arr(r.restos);
  S.restosSel = new Set(S.restos.filter((x) => x.confianza === 'alta').map((x) => x.ruta));
}

function restosCardHTML() {
  const head = `<div class="card-head"><div><h3>🧹 ${L('Restos de programas antiguos', 'Leftovers of old programs')}</h3>
    <p class="meta">${L('Carpetas vacías, accesos directos rotos y programas "fantasma" que dejaron cosas que ya desinstalaste. Windows no los quita nunca. Nada de esto es tuyo y todo pasa por la cuarentena.', 'Empty folders, broken shortcuts and "ghost" programs left by things you already uninstalled. Windows never removes them. None of it is yours and everything goes through quarantine.')}</p></div>
    <button class="btn ${S.restos ? 'ghost' : 'primary'}" data-act="restosBuscar" ${S.busy ? 'disabled' : ''}>${S.restos ? L('Buscar otra vez', 'Search again') : L('Buscar restos', 'Find leftovers')}</button></div>`;
  if (!S.restos) return `<div class="card restos">${head}</div>`;
  if (!S.restos.length) return `<div class="card restos">${head}<div class="empty">✨ ${L('No quedó nada de programas viejos. Tu PC está ordenado.', 'Nothing left from old programs. Your PC is tidy.')}</div></div>`;
  const sel = S.restos.filter((x) => S.restosSel.has(x.ruta));
  const rows = S.restos.map((x) => {
    const [ico, es, en, des, den] = RESTO_CLASE[x.clase] || RESTO_CLASE.vacia;
    return `<label class="row"><input type="checkbox" class="check" data-resto="${esc(x.ruta)}" ${S.restosSel.has(x.ruta) ? 'checked' : ''}>
      <span class="priv-ico" aria-hidden="true">${ico}</span>
      <div class="grow"><div class="name">${esc(x.nombre || x.ruta)}</div><div class="note">${L(es, en)} · ${L(des, den)}</div><div class="tech">${esc(x.ruta)}</div></div>
      ${x.confianza === 'alta' ? `<span class="badge verde">${L('Seguro', 'Safe')}</span>` : `<span class="badge amarillo">${L('Revisa antes', 'Check first')}</span>`}
      ${x.tamano ? `<div class="size">${fmtBytes(x.tamano)}</div>` : ''}</label>`;
  }).join('');
  return `<div class="card restos">${head}<div class="list">${rows}</div>
    <div class="actionbar"><div class="info">${L(`${sel.length} de ${S.restos.length} marcados`, `${sel.length} of ${S.restos.length} selected`)}</div>
    <button class="btn primary" data-act="restosQuitar" ${!sel.length || S.busy ? 'disabled' : ''}>${L('Quitar marcados', 'Remove selected')}</button></div></div>`;
}

function restosBuscar() {
  return task(L('Buscando restos de programas viejos', 'Looking for leftovers of old programs'), async () => {
    await loadRestos();
    if (S.restos.length) retroReacciona('piensa', L(`Encontré ${S.restos.length} resto(s) de programas viejos.`, `Found ${S.restos.length} leftover(s) of old programs.`));
    else retroReacciona('feliz', L('¡Ni un resto! Muy ordenado.', 'Not a single leftover! Very tidy.'));
  });
}

function restosQuitar() {
  const items = S.restos.filter((x) => S.restosSel.has(x.ruta)).map((x) => ({ tipo: x.tipo, ruta: x.ruta }));
  if (!items.length) return;
  return taskC(L('Quitando restos', 'Removing leftovers'), async () => {
    const q = obj(await rl.run('cuarentena', { accion: 'mover', items, motivo: L('Restos de programas antiguos', 'Leftovers of old programs') }));
    const fallos = arr(q.fallidos).length;
    const n = items.length - fallos;
    ganar('restos', n);
    toast(L(`Listo: ${n} resto(s) quitados. Están en "Deshacer y cuarentena" por si acaso.`, `Done: ${n} leftover(s) removed. They are in "Undo & quarantine" just in case.`) + (fallos ? L(` (${fallos} no se pudieron mover)`, ` (${fallos} could not be moved)`) : ''), fallos ? 'err' : undefined);
    retroReacciona('guino', L('¡Más ordenado que nunca! 😉', 'Tidier than ever! 😉'));
    // Sin volver a escanear: se quita de la lista lo que ya se movió
    const fallidos = new Set(arr(q.fallidos).map((x) => x.ruta || x));
    const movidos = new Set(items.map((x) => x.ruta).filter((r) => !fallidos.has(r)));
    S.restos = S.restos.filter((x) => !movidos.has(x.ruta)); movidos.forEach((r) => S.restosSel.delete(r));
    refreshAfter('programas', 'cuarentena');
  });
}
