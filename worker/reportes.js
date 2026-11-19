// RetroLimpia · intermediario de reportes (Cloudflare Worker)
// Recibe el reporte que la persona envía desde RetroLimpia y lo reenvía a un canal
// privado de Discord. La dirección del webhook vive en un secreto (WEBHOOK_URL):
// nunca va dentro del programa, así nadie puede sacarla para mandar spam.
//
// Protecciones: solo POST multipart, tamaños máximos, tipos de imagen permitidos,
// límite de reportes por IP y por hora, y textos recortados.

const MAX_TOTAL = 9 * 1024 * 1024;       // Discord acepta ~10 MB por mensaje sin mejoras
const MAX_LOG = 2 * 1024 * 1024;
const MAX_IMG = 7 * 1024 * 1024;
const MAX_POR_HORA = 5;
const IMG_OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// El canal de Discord es un FORO: cada reporte es una publicación con etiqueta.
// Etiquetas del foro 📋・reportes: los reportes nuevos entran como "🆕 Pendiente".
const TAG_PENDIENTE = '1572807440863596585';

const vistos = new Map(); // ip -> [marcas de tiempo] (memoria del Worker: límite aproximado)

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function corta(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function limiteSuperado(ip) {
  const ahora = Date.now();
  const lista = (vistos.get(ip) || []).filter((t) => ahora - t < 3600e3);
  if (lista.length >= MAX_POR_HORA) { vistos.set(ip, lista); return true; }
  lista.push(ahora); vistos.set(ip, lista);
  if (vistos.size > 5000) vistos.clear();
  return false;
}

export default {
  async fetch(req, env) {
    if (req.method === 'GET') return new Response('RetroLimpia · reportes OK', { status: 200 });
    if (req.method !== 'POST') return json({ ok: false, error: 'método no permitido' }, 405);
    if (!env.WEBHOOK_URL) return json({ ok: false, error: 'falta configurar el webhook' }, 500);

    const ct = req.headers.get('content-type') || '';
    if (!ct.startsWith('multipart/form-data')) return json({ ok: false, error: 'formato no válido' }, 400);
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_TOTAL) return json({ ok: false, error: 'el reporte es demasiado grande (máx. 9 MB)' }, 413);

    const ip = req.headers.get('CF-Connecting-IP') || 'desconocida';
    if (limiteSuperado(ip)) return json({ ok: false, error: 'demasiados reportes seguidos: prueba en una hora' }, 429);

    let form;
    try { form = await req.formData(); } catch { return json({ ok: false, error: 'no se pudo leer el reporte' }, 400); }

    let d = {};
    try { d = JSON.parse(String(form.get('datos') || '{}')); } catch { return json({ ok: false, error: 'datos no válidos' }, 400); }
    const id = 'RL-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();

    const log = form.get('log');
    const captura = form.get('captura');
    if (log && typeof log !== 'string' && log.size > MAX_LOG) return json({ ok: false, error: 'el log es demasiado grande' }, 413);
    if (captura && typeof captura !== 'string') {
      if (captura.size > MAX_IMG) return json({ ok: false, error: 'la captura es demasiado grande (máx. 7 MB)' }, 413);
      if (!IMG_OK.includes(captura.type)) return json({ ok: false, error: 'la captura debe ser PNG, JPG, WEBP o GIF' }, 400);
    }

    const campos = [
      { name: 'Versión', value: corta(d.version || '?', 40), inline: true },
      { name: 'Windows', value: corta(d.windows || '?', 80), inline: true },
      { name: 'Sección', value: corta(d.seccion || '?', 60), inline: true },
    ];
    if (d.equipo) campos.push({ name: 'Equipo', value: corta(d.equipo, 300) });
    if (d.contacto) campos.push({ name: 'Contacto (opcional)', value: corta(d.contacto, 100) });

    const embed = {
      title: '🐞 Reporte ' + id,
      description: corta(d.descripcion || '(sin descripción)', 3800),
      color: 0xff4fa3,
      fields: campos,
      timestamp: new Date().toISOString(),
      footer: { text: (captura && typeof captura !== 'string' ? '📸 con captura' : '📷 sin captura') + ' · ' + (log && typeof log !== 'string' ? '📄 con log' : 'sin log') },
    };

    const fd = new FormData();
    const adjuntos = [];
    let n = 0;
    if (log && typeof log !== 'string') { fd.append('files[' + n + ']', log, id + '-log.txt'); adjuntos.push({ id: n++, filename: id + '-log.txt' }); }
    if (captura && typeof captura !== 'string') {
      const ext = captura.type.split('/')[1].replace('jpeg', 'jpg');
      const nombre = id + '-captura.' + ext;
      fd.append('files[' + n + ']', captura, nombre); adjuntos.push({ id: n++, filename: nombre });
      embed.image = { url: 'attachment://' + nombre };
    }
    // Título de la publicación: qué pasó y en qué versión, para ver la lista de un vistazo
    const titulo = corta((d.seccion || 'Reporte') + ' · v' + (d.version || '?') + ' · ' + id, 95);
    fd.append('payload_json', JSON.stringify({ username: 'RetroLimpia Reportes', thread_name: titulo, applied_tags: [TAG_PENDIENTE], embeds: [embed], attachments: adjuntos, allowed_mentions: { parse: [] } }));

    const r = await fetch(env.WEBHOOK_URL + '?wait=true', { method: 'POST', body: fd });
    if (!r.ok) return json({ ok: false, error: 'Discord respondió ' + r.status }, 502);
    return json({ ok: true, id });
  },
};
