'use strict';
/* RetroLimpia - lógica de la interfaz.
   Todo ocurre en una sola ventana: no hay ventanas emergentes salvo la
   explicación de confianza la primera vez que se abre. */

// ============================================================ Estado
const S = {
  settings: {}, info: {}, data: {},
  programs: null, hardware: null, drivers: null, updates: null, junk: null, startup: null, quarantine: null, restorePoints: null,
  scan: { state: 'idle', steps: {}, findings: [], score: null, date: null },
  fix: null,
  view: 'inicio',
  busy: null,            // { label, pct, msg }
  sel: new Set(),        // selección en Programas
  progFilter: 'todos', search: '',
  junkSel: null,
  pendingResidues: null, // restos dudosos esperando revisión
  needsReboot: false,
  appUpdate: null
};

const repoUrl = () => (S.info.repo && !S.info.repo.startsWith('TU_USUARIO') ? 'https://github.com/' + S.info.repo : null);
const DISCORD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 -.3 13.5.1 18a19.8 19.8 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6zM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>';
const GH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';
const L = (es, en) => (S.settings.idioma === 'en' ? (en ?? es) : es);
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GB = 1024 ** 3;

function fmtBytes(b) {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return (b >= 100 ? b.toFixed(0) : b.toFixed(1)).replace('.', S.settings.idioma === 'en' ? '.' : ',') + ' ' + u[i];
}
function globRe(p) { return new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); }
function yearsSince(dateStr) { if (!dateStr) return null; const d = new Date(dateStr); if (isNaN(d)) return null; return (Date.now() - d.getTime()) / (365.25 * 864e5); }
function prettyAppx(n) {
  let s = n.includes('.') ? n.split('.').slice(1).join(' ') : n;
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim() || n;
}

// ============================================================ Clasificación
function classifyProgram(p) {
  const lists = p.tipo === 'appx' ? S.data.bloat.appx : S.data.bloat.win32;
  for (const r of lists) {
    if (globRe(r.patron).test(p.nombre)) return { color: r.color, nombre: p.tipo === 'appx' ? r.nombre : p.nombre, nota: L(r.es, r.en) };
  }
  if (p.tipo === 'win32') {
    for (const r of S.data.prot.win32) if (globRe(r.patron).test(p.nombre)) return { color: 'rojo', nombre: p.nombre, nota: L(r.es, r.en) };
    return { color: null, nombre: p.nombre, nota: '' };
  }
  return { color: null, nombre: prettyAppx(p.nombre), nota: '' };
}
function classifyStartup(it) {
  const hay = it.nombre + ' ' + it.comando;
  for (const r of S.data.inicio.reglas) {
    const re = globRe(r.patron);
    if (re.test(it.nombre) || re.test(hay)) return { rec: r.rec, nota: L(r.es, r.en) };
  }
  return { rec: 'desconocido', nota: L('No lo conocemos: decide tú. Si no sabes qué es, déjalo como está.', "We don't know it: your call. If unsure, leave it as it is.") };
}
const REC = {
  desactivar: { c: 'verde', es: 'Se puede desactivar', en: 'Safe to disable' },
  opcional: { c: 'amarillo', es: 'Opcional', en: 'Optional' },
  mantener: { c: 'rojo', es: 'Mejor dejarlo', en: 'Better keep it' },
  desconocido: { c: 'gris', es: 'Desconocido', en: 'Unknown' }
};
const COLOR_TXT = {
  verde: ['Seguro quitarlo', 'Safe to remove'],
  amarillo: ['Opcional', 'Optional'],
  rojo: ['Mejor no tocar', 'Better not touch']
};
const JUNK = {
  temp_usuario: ['Archivos temporales', 'Temporary files', 'Restos que dejan los programas al trabajar.', 'Leftovers programs create while working.'],
  temp_windows: ['Temporales de Windows', 'Windows temp files', 'Archivos temporales del propio Windows.', "Windows' own temporary files."],
  wu_cache: ['Descargas de Windows Update', 'Windows Update downloads', 'Instaladores de actualizaciones que ya se aplicaron.', 'Installers of updates already applied.'],
  entrega: ['Caché de optimización de entrega', 'Delivery Optimization cache', 'Copias de actualizaciones para compartir con otros PCs.', 'Update copies shared with other PCs.'],
  informes: ['Informes de errores', 'Error reports', 'Registros de fallos que Windows guarda.', 'Crash logs Windows keeps.'],
  miniaturas: ['Miniaturas de imágenes', 'Thumbnail cache', 'Se vuelven a crear solas al abrir carpetas.', 'Rebuilt automatically when you open folders.'],
  navegadores: ['Caché de navegadores', 'Browser cache', 'Solo la caché: no borra contraseñas, historial ni sesiones. Las páginas tardarán un poco más la primera vez.', 'Cache only: passwords, history and sessions stay. Pages load a bit slower the first time.'],
  volcados: ['Volcados de memoria', 'Memory dumps', 'Archivos de pantallazos azules antiguos. Solo los usan técnicos.', 'Old blue-screen dumps. Only technicians use them.'],
  papelera: ['Papelera de reciclaje', 'Recycle Bin', 'Vacía la papelera. Revísala antes si tiene algo importante.', 'Empties the Recycle Bin. Check it first if it holds anything important.']
};
const PNP_CODES = {
  1: ['Está mal configurado.', 'Not configured correctly.'], 3: ['Su driver está dañado.', 'Its driver is corrupted.'],
  10: ['No puede arrancar.', 'Cannot start.'], 12: ['Le faltan recursos libres.', 'Not enough free resources.'],
  14: ['Necesita reiniciar el PC.', 'Needs a restart.'], 18: ['Hay que reinstalar su driver.', 'Its driver must be reinstalled.'],
  19: ['Su configuración en el registro está dañada.', 'Its registry configuration is damaged.'],
  24: ['No está presente o no funciona.', 'Not present or not working.'], 28: ['No tiene driver instalado.', 'Has no driver installed.'],
  29: ['Está desactivado en la BIOS.', 'Disabled in BIOS.'], 31: ['No funciona correctamente.', 'Not working properly.'],
  32: ['Su servicio está desactivado.', 'Its service is disabled.'], 37: ['Su driver falló al arrancar.', 'Its driver failed to start.'],
  39: ['Su driver falta o está dañado.', 'Driver missing or corrupted.'], 43: ['Windows lo detuvo porque reportó fallos.', 'Windows stopped it because it reported problems.'],
  52: ['Windows no pudo verificar la firma de su driver.', 'Windows could not verify its driver signature.']
};
const GPU_LINKS = {
  nvidia: ['NVIDIA App', 'https://www.nvidia.com/es-la/software/nvidia-app/'],
  amd: ['AMD Software: Adrenalin', 'https://www.amd.com/es/support/download/drivers.html'],
  intel: ['Intel Driver & Support Assistant', 'https://www.intel.com/content/www/us/en/support/detect.html']
};
