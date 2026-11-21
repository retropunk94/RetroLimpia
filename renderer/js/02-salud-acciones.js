'use strict';
// ============================================================ Consejos y nota de salud
function hardwareAdvice(hw) {
  const out = [];
  if (!hw) return out;
  const add = (nivel, es, en) => out.push({ nivel, t: L(es, en) });
  for (const d of hw.discos || []) {
    if (d.salud && d.salud !== 'Healthy') add('importante', `El disco "${d.nombre}" muestra señales de fallo. Haz una copia de tus archivos importantes cuanto antes y piensa en cambiarlo.`, `Disk "${d.nombre}" shows signs of failure. Back up your important files as soon as possible and consider replacing it.`);
    if (d.desgaste != null && d.desgaste >= 80) add('importante', `El SSD "${d.nombre}" está gastado al ${d.desgaste}%. Planea reemplazarlo pronto.`, `SSD "${d.nombre}" is ${d.desgaste}% worn. Plan to replace it soon.`);
    else if (d.desgaste != null && d.desgaste >= 50) add('recomendado', `El SSD "${d.nombre}" lleva un ${d.desgaste}% de desgaste. Todavía va bien, pero conviene tener copias.`, `SSD "${d.nombre}" is ${d.desgaste}% worn. Still fine, but keep backups.`);
    if (d.temperatura && d.temperatura >= 65) add('recomendado', `El disco "${d.nombre}" está a ${d.temperatura} °C. Revisa que le llegue aire.`, `Disk "${d.nombre}" is at ${d.temperatura} °C. Check its airflow.`);
  }
  for (const v of hw.unidades || []) {
    const pct = v.total ? v.libre / v.total : 1;
    if (pct < 0.1) add('importante', `A la unidad ${v.letra} solo le queda ${fmtBytes(v.libre)} libre (${Math.round(pct * 100)}%). Windows se vuelve lento con menos de un 10%.`, `Drive ${v.letra} has only ${fmtBytes(v.libre)} free (${Math.round(pct * 100)}%). Windows slows down below 10%.`);
    else if (pct < 0.2) add('recomendado', `A la unidad ${v.letra} le queda poco espacio (${fmtBytes(v.libre)}).`, `Drive ${v.letra} is getting full (${fmtBytes(v.libre)} free).`);
  }
  const s = hw.sistema || {};
  if (s.build && s.build < 22000) add('importante', 'Usas Windows 10, que ya no recibe actualizaciones de seguridad gratuitas desde octubre de 2025. Si tu PC lo permite, pasa a Windows 11.', 'You are on Windows 10, which stopped getting free security updates in October 2025. Upgrade to Windows 11 if your PC supports it.');
  if (s.diasEncendido >= 7) add('opcional', `Tu PC lleva ${Math.round(s.diasEncendido)} días sin reiniciarse. Reiniciar de vez en cuando aplica actualizaciones y libera memoria.`, `Your PC hasn't restarted in ${Math.round(s.diasEncendido)} days. Restarting now and then applies updates and frees memory.`);
  const ram = hw.ram || {};
  if (ram.total && ram.total < 7.5 * GB) add('recomendado', `Tienes ${fmtBytes(ram.total)} de RAM. Para usar Windows 11 con fluidez se recomiendan 16 GB.`, `You have ${fmtBytes(ram.total)} of RAM. 16 GB is recommended for a smooth Windows 11.`);
  for (const g of hw.gpus || []) {
    if (g.temp && g.temp >= 85) add('importante', `La gráfica está a ${g.temp} °C. Limpia el polvo de los ventiladores.`, `The GPU is at ${g.temp} °C. Clean the dust from its fans.`);
    const y = yearsSince(g.fechaDriver);
    if (y != null && y > 0.5) add('recomendado', `El driver de tu ${g.nombre} tiene más de ${y >= 1 ? Math.floor(y) + (Math.floor(y) === 1 ? ' año' : ' años') : '6 meses'}. Actualízalo desde la app oficial (sección Drivers).`, `Your ${g.nombre} driver is over ${y >= 1 ? Math.floor(y) + ' year(s)' : '6 months'} old. Update it from the official app (Drivers section).`);
  }
  if (hw.cpu && hw.cpu.temp && hw.cpu.temp >= 90) add('importante', `El procesador está a ${hw.cpu.temp} °C. Revisa la ventilación y la pasta térmica.`, `The CPU is at ${hw.cpu.temp} °C. Check cooling and thermal paste.`);
  const by = yearsSince(hw.bios && hw.bios.fecha);
  if (by != null && by > 2) add('opcional', `La BIOS de tu placa (${hw.placa.modelo}) es de ${hw.bios.fecha.slice(0, 4)}. Si tienes problemas de estabilidad, mira en la web de ${hw.placa.fabricante} si hay una más nueva. No la actualices si todo funciona bien.`, `Your motherboard BIOS (${hw.placa.modelo}) is from ${hw.bios.fecha.slice(0, 4)}. If you have stability issues, check ${hw.placa.fabricante}'s website. Don't update it if everything works.`);
  if (hw.bateria && hw.bateria.salud && hw.bateria.salud < 70) add('recomendado', `La batería conserva el ${hw.bateria.salud}% de su capacidad original.`, `The battery keeps ${hw.bateria.salud}% of its original capacity.`);
  return out;
}

function buildFindings() {
  const f = [];
  const add = (o) => f.push({ elegido: o.nivel !== 'opcional' && !!o.accion, ...o });
  // Hardware
  for (const a of hardwareAdvice(S.hardware)) add({ id: 'hw' + f.length, nivel: a.nivel, titulo: a.t, detalle: '', accion: null, ir: 'hardware' });
  // Drivers con problemas
  const prob = (S.drivers?.problemas || []).filter((p) => p.codigo !== 45);
  if (prob.length) add({ id: 'pnp', nivel: 'importante', titulo: L(`${prob.length} dispositivo(s) no funcionan bien`, `${prob.length} device(s) are not working properly`), detalle: prob.map((p) => p.dispositivo).join(', ') + ' · ' + L('Se intentará arreglarlos (apagar y encender, reinstalar su driver).', 'Will try to fix them (turn off and on, reinstall their driver).'), accion: 'pnp', ir: 'drivers' });
  // Actualizaciones
  const wu = S.updates?.windows || [];
  const wuImp = wu.filter((u) => !u.opcional && !u.grande);
  const wuDrv = wu.filter((u) => u.tipo === 'driver');
  if (wuImp.length || wuDrv.length) add({ id: 'wu', nivel: wuImp.some((u) => u.tipo === 'seguridad') ? 'importante' : 'recomendado', titulo: L(`Instalar ${wuImp.length + wuDrv.filter((u) => u.opcional).length} actualización(es) oficiales de Windows y drivers`, `Install ${wuImp.length + wuDrv.filter((u) => u.opcional).length} official Windows and driver update(s)`), detalle: L('Desde Windows Update, la fuente oficial de Microsoft.', 'From Windows Update, Microsoft\'s official source.'), accion: 'wu' });
  const apps = S.updates?.apps || [];
  if (apps.length) add({ id: 'apps', nivel: 'recomendado', titulo: L(`Actualizar ${apps.length} programa(s)`, `Update ${apps.length} program(s)`), detalle: apps.slice(0, 5).map((a) => a.nombre).join(', ') + (apps.length > 5 ? '…' : ''), accion: 'apps' });
  // Basura
  if (S.junk) {
    const verde = S.junk.categorias.filter((c) => c.color === 'verde');
    const total = verde.reduce((a, c) => a + c.tamano, 0);
    if (total > 300 * 1024 ** 2) add({ id: 'junk', nivel: total > 5 * GB ? 'recomendado' : 'opcional', titulo: L(`Liberar ${fmtBytes(total)} de archivos basura`, `Free ${fmtBytes(total)} of junk files`), detalle: L('Temporales y cachés. No toca tus documentos.', 'Temp files and caches. Your documents are not touched.'), accion: 'junk', elegido: true });
  }
  // Bloatware
  const bloat = allPrograms().filter((p) => p.cls.color === 'verde');
  if (bloat.length) add({ id: 'bloat', nivel: 'recomendado', titulo: L(`Quitar ${bloat.length} programa(s) basura preinstalados`, `Remove ${bloat.length} preinstalled bloatware app(s)`), detalle: bloat.slice(0, 6).map((p) => p.cls.nombre).join(', ') + (bloat.length > 6 ? '…' : ''), accion: 'bloat' });
  // Arranque
  const st = (S.startup?.elementos || []).filter((i) => i.activo && classifyStartup(i).rec === 'desactivar');
  if (st.length) add({ id: 'startup', nivel: 'recomendado', titulo: L(`Hacer que Windows arranque más rápido (${st.length} programa(s) innecesarios al inicio)`, `Make Windows start faster (${st.length} unneeded startup program(s))`), detalle: st.map((i) => i.nombre).join(', '), accion: 'startup' });
  const order = { importante: 0, recomendado: 1, opcional: 2 };
  f.sort((a, b) => order[a.nivel] - order[b.nivel]);
  return f;
}

function computeScore() {
  let s = 100;
  const hw = S.hardware;
  if (hw) {
    for (const d of hw.discos || []) { if (d.salud && d.salud !== 'Healthy') s -= 25; if (d.desgaste >= 80) s -= 15; }
    for (const v of hw.unidades || []) { const p = v.total ? v.libre / v.total : 1; if (p < 0.1) s -= 12; else if (p < 0.2) s -= 5; }
    if (hw.sistema?.build && hw.sistema.build < 22000) s -= 12;
    if (hw.sistema?.diasEncendido >= 7) s -= 3;
  }
  s -= Math.min(20, ((S.drivers?.problemas || []).filter((p) => p.codigo !== 45).length) * 8);
  const wu = (S.updates?.windows || []).filter((u) => !u.opcional && !u.grande);
  if (wu.some((u) => u.tipo === 'seguridad')) s -= 10; else if (wu.length) s -= 5;
  s -= Math.min(6, (S.updates?.apps || []).length);
  if (S.junk) { const t = S.junk.categorias.filter((c) => c.color === 'verde').reduce((a, c) => a + c.tamano, 0); if (t > 5 * GB) s -= 8; else if (t > 1 * GB) s -= 4; }
  const b = allPrograms().filter((p) => p.cls.color === 'verde').length; s -= Math.min(8, b);
  const st = (S.startup?.elementos || []).filter((i) => i.activo && classifyStartup(i).rec === 'desactivar').length; s -= Math.min(6, st * 1.5);
  return Math.max(5, Math.min(100, Math.round(s)));
}
function scoreLabel(n) {
  if (n >= 85) return L('Muy bien', 'Great');
  if (n >= 65) return L('Mejorable', 'Could be better');
  if (n >= 45) return L('Necesita atención', 'Needs attention');
  return L('Necesita ayuda', 'Needs help');
}

// ============================================================ Acciones principales
// [id, script, peso en la barra de progreso, texto es, texto en, función]
const SCAN_STEPS = [
  ['hardware', 'hardware', 8, 'Leyendo tu hardware y la salud de los discos', 'Reading your hardware and disk health', loadHardware],
  ['drivers', 'drivers', 10, 'Revisando drivers y dispositivos', 'Checking drivers and devices', loadDrivers],
  ['programas', 'programas', 17, 'Buscando programas y bloatware', 'Looking for programs and bloatware', loadPrograms],
  ['limpieza', 'limpieza', 25, 'Midiendo archivos basura', 'Measuring junk files', loadJunk],
  ['inicio', 'inicio', 5, 'Revisando lo que arranca con Windows', 'Checking startup programs', loadStartup],
  ['updates', 'actualizaciones', 35, 'Buscando actualizaciones oficiales', 'Looking for official updates', loadUpdates]
];
function scanPct() {
  let done = 0, total = 0;
  for (const [id, script, w] of SCAN_STEPS) {
    total += w;
    const st = S.scan.steps[id];
    if (st === 'ok' || st === 'err') done += w;
    else if (st === 'run') done += w * Math.min(95, S.scan.pct[script] || 0) / 100;
  }
  return Math.round((done / total) * 100);
}

// Todos los análisis son de solo lectura, así que corren a la vez (mucho más rápido).
async function scanAll() {
  S.view = 'inicio'; S.fix = null;
  S.scan = { state: 'running', steps: {}, pct: {}, findings: [], score: null };
  await task(L('Revisando tu PC', 'Checking your PC'), async () => {
    await Promise.all(SCAN_STEPS.map(async ([id, script, , , , fn]) => {
      S.scan.steps[id] = 'run'; render();
      try { await fn(); S.scan.steps[id] = 'ok'; }
      catch (e) { if (!isCancel(e)) console.error(id, e); S.scan.steps[id] = isCancel(e) ? 'cancel' : 'err'; S.scan.errors = { ...(S.scan.errors || {}), [id]: String(e.message || e).slice(0, 300) }; }
      if (S.busy) S.busy.pct = scanPct();
      render();
    }));
    if (S.cancelRequested) { S.scan.state = 'idle'; throw new Error('CANCELADO'); }
    S.scan.findings = buildFindings();
    S.scan.score = computeScore();
    S.scan.state = 'done';
    S.scan.date = new Date();
  });
  if (S.scan.state === 'done') {
    const n = S.scan.score;
    // Historial de salud: una nota por día (la última), máximo 30 días. Pesa casi nada.
    const hoy = new Date().toISOString().slice(0, 10);
    const h = arr(S.settings.historial).filter((x) => x.d !== hoy).concat([{ d: hoy, n }]).slice(-30);
    rl.setSettings({ historial: h }).then((st) => { S.settings = st; render(); }).catch(() => {});
    if (n >= 85) retroReacciona('feliz', L(`¡Un ${n}! Tu PC está en muy buena forma.`, `A ${n}! Your PC is in great shape.`));
    else retroReacciona('piensa', L(`Un ${n}. Tranquilo: abajo te dejo lo que lo mejora.`, `A ${n}. Don't worry: below is what improves it.`), 5000);
  }
  if (S.scan.state === 'running') S.scan.state = 'idle';   // por si algo inesperado cortó el análisis
}
