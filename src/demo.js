// Modo demostración: datos de ejemplo para ver y probar la interfaz
// sin tocar nada del sistema (se activa con "npm run demo" o fuera de Windows).

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GB = 1024 ** 3, MB = 1024 ** 2;

let token = 0;
const demoPriv = { id_publicidad: true };
let demoJuego = null;
const demoRestos = [
  { tipo: 'carpeta', clase: 'vacia', ruta: 'C:\\Program Files (x86)\\ManyCam', nombre: 'ManyCam', confianza: 'alta', tamano: 0 },
  { tipo: 'carpeta', clase: 'vacia', ruta: 'C:\\ProgramData\\FxSound LLC', nombre: 'FxSound LLC', confianza: 'alta', tamano: 0 },
  { tipo: 'archivo', clase: 'acceso', ruta: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Juego Viejo.lnk', nombre: 'Juego Viejo', confianza: 'alta', tamano: 0 },
  { tipo: 'carpeta', clase: 'huerfana', ruta: 'C:\\Program Files\\EditorDeFotos', nombre: 'EditorDeFotos', confianza: 'media', tamano: 48234496 },
  { tipo: 'registro', clase: 'fantasma', ruta: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ToolbarX', nombre: 'ToolbarX', confianza: 'alta', tamano: 0 }
];
function cancel() { token++; }
async function steps(onProgress, msgs, total = 1200) {
  const my = token;
  const n = Math.max(msgs.length, 6);
  for (let i = 0; i < n; i++) {
    if (my !== token) throw new Error('CANCELADO');
    onProgress({ pct: Math.round(((i + 1) / n) * 100), msg: msgs[Math.min(i, msgs.length - 1)], en: msgs[Math.min(i, msgs.length - 1)] });
    await wait(total / n);
  }
  if (my !== token) throw new Error('CANCELADO');
}

const programas = [
  { id: 'w:1', tipo: 'win32', nombre: 'McAfee LiveSafe', editor: 'McAfee, LLC', version: '16.0', fecha: '2024-02-11', tamano: 812 * MB, servicios: 4, serviciosAuto: 3, ram: 420 * MB, procesos: 5, carpeta: 'C:\\Program Files\\McAfee', clave: 'HKEY_LOCAL_MACHINE\\...\\McAfee', desinstalar: '"C:\\Program Files\\McAfee\\uninstall.exe"' },
  { id: 'w:2', tipo: 'win32', nombre: 'WildTangent Games', editor: 'WildTangent', version: '1.1.1', fecha: '2024-02-11', tamano: 120 * MB, carpeta: '', clave: '', desinstalar: 'x' },
  { id: 'w:3', tipo: 'win32', nombre: 'Google Chrome', editor: 'Google LLC', version: '142.0', fecha: '2025-10-02', tamano: 610 * MB, carpeta: 'C:\\Program Files\\Google\\Chrome', clave: '', desinstalar: 'x' },
  { id: 'w:4', tipo: 'win32', nombre: 'Microsoft Visual C++ 2015-2022 Redistributable (x64)', editor: 'Microsoft Corporation', version: '14.44', fecha: '2025-06-01', tamano: 25 * MB, carpeta: '', clave: '', desinstalar: 'x' },
  { id: 'w:5', tipo: 'win32', nombre: 'VLC media player', editor: 'VideoLAN', version: '3.0.21', fecha: '2025-01-15', tamano: 168 * MB, carpeta: 'C:\\Program Files\\VideoLAN\\VLC', clave: '', desinstalar: 'x' },
  { id: 'w:6', tipo: 'win32', nombre: 'OBS Studio', editor: 'OBS Project', version: '31.1', fecha: '2025-08-20', tamano: 410 * MB, ram: 1.2 * GB, procesos: 1, carpeta: '', clave: '', desinstalar: 'x' },
  { id: 'w:7', tipo: 'win32', nombre: 'Steam', editor: 'Valve Corporation', version: '2.10', fecha: '2023-11-03', tamano: 1.1 * GB, servicios: 1, serviciosAuto: 0, ram: 610 * MB, procesos: 9, carpeta: '', clave: '', desinstalar: 'x' },
  { id: 'w:8', tipo: 'win32', nombre: 'NVIDIA Graphics Driver 581.57', editor: 'NVIDIA Corporation', version: '581.57', fecha: '2025-10-14', tamano: 1.4 * GB, carpeta: '', clave: '', desinstalar: 'x' },
  { id: 'w:9', tipo: 'win32', nombre: 'CyberLink PowerDVD 14', editor: 'CyberLink Corp.', version: '14.0', fecha: '2024-02-11', tamano: 350 * MB, carpeta: '', clave: '', desinstalar: 'x' },
  { id: 'w:10', tipo: 'win32', nombre: '7-Zip 24.08 (x64)', editor: 'Igor Pavlov', version: '24.08', fecha: '2025-03-09', tamano: 6 * MB, carpeta: '', clave: '', desinstalar: 'x' }
];
const apps = [
  'Microsoft.BingNews', 'Microsoft.MicrosoftSolitaireCollection', 'Microsoft.Getstarted', 'king.com.CandyCrushSaga',
  'Microsoft.ZuneVideo', 'Microsoft.WindowsFeedbackHub', 'Clipchamp.Clipchamp', 'Microsoft.XboxGamingOverlay',
  'Microsoft.WindowsCalculator', 'Microsoft.WindowsStore', 'Microsoft.YourPhone', 'Microsoft.MicrosoftOfficeHub',
  'Facebook.InstagramBeta', 'Microsoft.XboxIdentityProvider'
].map((n, i) => ({ id: 'a:' + n, tipo: 'appx', nombre: n, editor: 'Microsoft Corporation', version: '1.0.' + i, tamano: (10 + i * 7) * MB, paquete: n + '_1.0_x64__8wekyb3d8bbwe' }));

const hardware = {
  equipo: { fabricante: 'ASUS', modelo: 'System Product Name', nombre: 'PC-DEMO' },
  sistema: { nombre: 'Microsoft Windows 11 Pro', version: '24H2', build: 26100, arquitectura: '64 bits', diasEncendido: 9.3 },
  cpu: { nombre: 'AMD Ryzen 7 7800X3D 8-Core Processor', nucleos: 8, hilos: 16, mhz: 4201, temp: 58 },
  ram: { total: 32 * GB, libre: 18 * GB, modulos: 2, velocidad: 6000 },
  placa: { fabricante: 'ASUSTeK COMPUTER INC.', modelo: 'ROG STRIX B650E-F GAMING WIFI' },
  bios: { version: '1813', fecha: '2023-09-12', fabricante: 'American Megatrends Inc.' },
  gpus: [{ nombre: 'NVIDIA GeForce RTX 4090', fabricante: 'nvidia', driver: '32.0.15.8157', fechaDriver: '2025-10-14', vram: 24 * GB, temp: 46 }],
  discos: [
    { nombre: 'Samsung SSD 990 PRO 2TB', tipo: 'NVMe', bus: 'NVMe', tamano: 2000 * GB, salud: 'Healthy', estado: 'OK', desgaste: 4, temperatura: 41, horas: 5210, errores: 0 },
    { nombre: 'WDC WD40EZAZ-00SF3B0', tipo: 'HDD', bus: 'SATA', tamano: 4000 * GB, salud: 'Warning', estado: 'Predictive Failure', desgaste: null, temperatura: 38, horas: 31877, errores: 12 }
  ],
  unidades: [
    { letra: 'C:', etiqueta: 'Windows', total: 1000 * GB, libre: 74 * GB },
    { letra: 'D:', etiqueta: 'Datos', total: 4000 * GB, libre: 1300 * GB }
  ],
  bateria: null
};

const drivers = {
  drivers: [
    { dispositivo: 'NVIDIA GeForce RTX 4090', clase: 'DISPLAY', fabricante: 'NVIDIA', proveedor: 'NVIDIA', version: '32.0.15.8157', fecha: '2025-10-14', inf: 'oem12.inf', firmado: true, generico: false, importante: true },
    { dispositivo: 'Realtek USB Audio', clase: 'MEDIA', fabricante: 'Realtek', proveedor: 'Realtek', version: '6.3.9600.2355', fecha: '2022-04-19', inf: 'oem5.inf', firmado: true, generico: false, importante: true },
    { dispositivo: 'Intel(R) Ethernet Controller I226-V', clase: 'NET', fabricante: 'Intel', proveedor: 'Intel', version: '2.1.3.3', fecha: '2022-11-30', inf: 'oem8.inf', firmado: true, generico: false, importante: true },
    { dispositivo: 'AMD GPIO Controller', clase: 'SYSTEM', fabricante: 'Advanced Micro Devices, Inc', proveedor: 'AMD', version: '2.2.0.130', fecha: '2023-03-02', inf: 'oem3.inf', firmado: true, generico: false, importante: true },
    { dispositivo: 'Controladora de almacenamiento NVM Express', clase: 'SCSIADAPTER', fabricante: 'Microsoft', proveedor: 'Microsoft', version: '10.0.26100.1', fecha: '2006-06-21', inf: 'stornvme.inf', firmado: true, generico: true, importante: true }
  ],
  problemas: [{ dispositivo: 'Dispositivo desconocido', codigo: 28, clase: '', id: 'ACPI\\VEN_XXXX' }, { dispositivo: 'Xbox Wireless Adapter for Windows', codigo: 10, clase: 'XnaComposite', id: 'USB\\VID_045E&PID_02FE\\1' }],
  respaldos: []
};

const updates = {
  windows: [
    { id: 'u1', titulo: 'Actualización acumulativa de seguridad para Windows 11 (KB5068861)', tipo: 'seguridad', opcional: false, grande: false, tamano: 820 * MB, kb: '5068861', reinicio: true },
    { id: 'u2', titulo: 'Realtek Semiconductor Corp. - Extension - 6.0.9800.1', tipo: 'driver', opcional: true, grande: false, tamano: 3 * MB, kb: '', reinicio: false, driver: { clase: 'Extension', fabricante: 'Realtek', modelo: 'Realtek Audio', dispositivo: 'Realtek High Definition Audio' } },
    { id: 'u3', titulo: 'Intel - Net - 23.60.0.10', tipo: 'driver', opcional: true, grande: false, tamano: 18 * MB, kb: '', reinicio: false, driver: { clase: 'Net', fabricante: 'Intel', modelo: 'Intel(R) Wi-Fi 6 AX201', dispositivo: 'Intel(R) Wi-Fi 6 AX201 160MHz' } },
    { id: 'u3', titulo: 'Inteligencia de seguridad de Microsoft Defender (KB2267602)', tipo: 'seguridad', opcional: false, grande: false, tamano: 90 * MB, kb: '2267602', reinicio: false }
  ],
  apps: [
    { nombre: 'Google Chrome', id: 'Google.Chrome', actual: '142.0.7444.60', nueva: '142.0.7444.135' },
    { nombre: 'VLC media player', id: 'VideoLAN.VLC', actual: '3.0.21', nueva: '3.0.22' },
    { nombre: '7-Zip', id: '7zip.7zip', actual: '24.08', nueva: '25.01' }
  ],
  wingetDisponible: true,
  error: ''
};

const limpieza = [
  ['temp_usuario', 3.2 * GB, 'verde'], ['temp_windows', 640 * MB, 'verde'], ['wu_cache', 2.1 * GB, 'verde'], ['entrega', 900 * MB, 'verde'],
  ['informes', 120 * MB, 'verde'], ['miniaturas', 260 * MB, 'verde'], ['navegadores', 1.4 * GB, 'amarillo'], ['volcados', 0, 'amarillo'], ['papelera', 5.6 * GB, 'amarillo'], ['shaders', 2.3 * GB, 'amarillo'], ['launchers', 640 * MB, 'verde']
].map(([id, tamano, color]) => ({ id, tamano, color }));

const inicio = [
  ['hkcu_run|Spotify', 'Spotify', true], ['hkcu_run|Discord', 'Discord', true], ['hkcu_run|Steam', 'Steam', true],
  ['hkcu_run|EpicGamesLauncher', 'EpicGamesLauncher', true], ['hklm_run|SecurityHealth', 'SecurityHealth', true],
  ['hklm_run|RtkAudUService', 'RtkAudUService', true], ['hkcu_run|OneDrive', 'OneDrive', true], ['hkcu_run|MicrosoftEdgeAutoLaunch_ABC', 'MicrosoftEdgeAutoLaunch_ABC', true],
  ['hkcu_run|com.squirrel.Teams.Teams', 'com.squirrel.Teams.Teams', false], ['user_dir|Herramienta rara.lnk', 'Herramienta rara', true]
].map(([id, nombre, activo]) => ({ id, nombre, comando: 'C:\\...\\' + nombre + '.exe', origen: id.split('|')[0], activo }));

let cuarentena = [
  { id: '20261110-210000-1', fecha: new Date(Date.now() - 3 * 864e5).toISOString(), motivo: 'Restos de Avast Free Antivirus', cantidad: 4, bytes: 210 * MB, items: [] }
];

async function run(script, p, onProgress) {
  switch (script) {
    case 'programas': await steps(onProgress, ['Buscando programas instalados...', 'Revisando apps de Microsoft Store...'], 900); return { programas, apps };
    case 'hardware': await steps(onProgress, ['Leyendo el procesador...', 'Leyendo la tarjeta gráfica...', 'Revisando discos...'], 1000); return hardware;
    case 'drivers':
      if (p.accion === 'reparar') { await steps(onProgress, ['Apagando y encendiendo...', 'Reinstalando el driver...'], 1200); drivers.problemas = drivers.problemas.filter((x) => x.id !== p.id); return { ok: true, antes: 28, despues: 0, pasos: ['reiniciar', 'reinstalar'], nombre: 'Dispositivo desconocido', clase: '' }; }
      if (p.accion === 'respaldar') { await steps(onProgress, ['Haciendo copia de tus drivers...'], 1500); return { ok: true, carpeta: 'C:\\ProgramData\\RetroLimpia\\RespaldoDrivers\\2026-11-16_2130', tamano: 1.2 * GB }; }
      await steps(onProgress, ['Leyendo drivers...', 'Buscando dispositivos con problemas...'], 900); return drivers;
    case 'actualizaciones':
      if (p.accion === 'buscar') { await steps(onProgress, ['Preguntando a Windows Update...', 'Buscando actualizaciones de programas...'], 1600); return updates; }
      if (p.accion === 'instalarWU') { await steps(onProgress, ['Descargando...', 'Instalando...'], 1800); return { resultados: (p.ids || updates.windows.map((u) => u.id)).map((id) => ({ id, ok: true })), reinicio: true }; }
      if (p.accion === 'winget') { await steps(onProgress, ['Actualizando...'], 1500); return { resultados: (p.ids || updates.apps.map((a) => a.id)).map((id) => ({ id, ok: true })) }; }
      if (p.accion === 'instalar') { for (const it of p.items || []) { onProgress({ msg: 'Instalando ' + it.nombre + '...', log: { tipo: 'ok', msg: 'Instalado: ' + it.nombre, en: 'Installed: ' + it.nombre } }); await wait(500); } return { ok: true, resultados: (p.items || []).map((it) => ({ id: it.id, ok: true })) }; }
      break;
    case 'limpieza':
      if (p.accion === 'analizar') { await steps(onProgress, ['Midiendo archivos basura...'], 900); return { categorias: limpieza }; }
      await steps(onProgress, ['Limpiando...'], 1500);
      return { liberado: limpieza.filter((c) => (p.categorias || []).includes(c.id)).reduce((a, c) => a + c.tamano, 0) * 0.93 };
    case 'inicio':
      if (p.accion === 'listar') { await wait(400); return { elementos: inicio }; }
      { const it = inicio.find((x) => x.id === p.id); if (it) it.activo = !!p.activar; }
      await wait(200); return { ok: true };
    case 'restauracion':
      if (p.accion === 'crear') { await steps(onProgress, ['Creando punto de restauración...'], 1200); return { ok: true }; }
      if (p.accion === 'listar') return { puntos: [{ numero: 41, descripcion: 'RetroLimpia - Antes de limpiar', fecha: '2026-11-10' }] };
      return { ok: true };
    case 'modojuego': {
      if (p.accion === 'listar') return { apps: [
        { nombre: 'onedrive', titulo: 'Microsoft OneDrive', ram: 96e6, sugerido: true, protegido: false, nota: 'Sincroniza tus archivos con la nube y usa disco e internet mientras juegas. Se vuelve a abrir al terminar.' },
        { nombre: 'phoneexperiencehost', titulo: 'Enlace Móvil', ram: 210e6, sugerido: true, protegido: false, nota: '"Enlace Móvil" de Windows: conecta tu teléfono. No hace falta para jugar.' },
        { nombre: 'chrome', titulo: 'Google Chrome', ram: 1.4e9, sugerido: false, protegido: false, nota: 'Navegador: si lo cierras, guarda antes lo que tengas abierto. Las pestañas suelen volver al reabrirlo.' },
        { nombre: 'spotify', titulo: 'Spotify', ram: 310e6, sugerido: false, protegido: false, nota: 'Programa abierto. Si lo cierras, guarda antes lo que estés haciendo.' },
        { nombre: 'discord', titulo: 'Discord', ram: 600e6, protegido: true }, { nombre: 'obs64', titulo: 'OBS Studio', ram: 400e6, protegido: true }, { nombre: 'steam', titulo: 'Steam', ram: 200e6, protegido: true }
      ], activo: !!demoJuego, estado: demoJuego };
      if (p.accion === 'activar') { await steps(onProgress, ['Cerrando lo que elegiste...', 'Poniendo el PC a máxima potencia...', 'Silenciando notificaciones...'], 600); demoJuego = { activo: true, desde: new Date().toISOString(), intensidad: p.intensidad, cerrados: (p.cerrar || []).map((nombre) => ({ nombre })) }; return { ok: true, estado: demoJuego, hecho: ['cerrar', 'energia'] }; }
      if (p.accion === 'restaurar') { await steps(onProgress, ['Devolviendo el PC a como estaba...'], 700); const m = demoJuego ? Math.round((Date.now() - new Date(demoJuego.desde)) / 60000) : 0; const nada = !demoJuego; demoJuego = null; return { ok: true, minutos: m, nada }; }
      return { activo: !!demoJuego, estado: demoJuego };
    }
    case 'reinicios': {
      await steps(onProgress, ['Leyendo el historial de Windows...'], 700);
      const h = (d, hr) => new Date(Date.now() - d * 864e5 - hr * 36e5).toISOString();
      return { eventos: [
        { fecha: h(0, 2), clase: 'usuario', titulo: 'Lo apagaste tú', detalle: 'Desde el menú Inicio o un programa que te lo pidió.' },
        { fecha: h(1, 5), clase: 'update', titulo: 'Windows Update reinició para instalar actualizaciones', detalle: 'Es normal. Si te molesta que pase mientras usas el PC, elige tus "horas activas" en Configuración > Windows Update.' },
        { fecha: h(3, 1), clase: 'bsod', titulo: 'Pantallazo azul', detalle: 'La tarjeta gráfica dejó de responder (driver de vídeo o gráfica forzada/caliente).', codigo: '0x00000116' },
        { fecha: h(9, 4), clase: 'corte', titulo: 'Se apagó de golpe', detalle: 'Sin aviso de Windows: corte de luz, botón de encendido mantenido, o la fuente/temperatura.' }
      ], dias: 30 };
    }
    case 'restos': {
      await steps(onProgress, ['Leyendo qué programas tienes instalados...', 'Buscando carpetas que quedaron de programas viejos...', 'Buscando accesos directos que ya no abren nada...'], 700);
      return { restos: demoRestos.filter((x) => !x.quitado), total: 0 };
    }
    case 'privacidad': {
      if (p.accion === 'listar') return { ajustes: ['anuncios_inicio', 'sugerencias_ajustes', 'consejos_windows', 'apps_solas', 'pantalla_bloqueo', 'id_publicidad', 'explorador_anuncios', 'bing_busqueda', 'experiencias_personalizadas', 'telemetria_opcional', 'copilot'].map((id) => ({ id, aplicado: !!demoPriv[id], permitido: true })) };
      await steps(onProgress, ['Aplicando...'], 500);
      for (const id of p.ids || []) demoPriv[id] = p.accion === 'aplicar';
      return { resultados: (p.ids || []).map((id) => ({ id, ok: true })) };
    }
    case 'procesos': {
      if (p.accion === 'terminar') { await wait(300); return { ok: true, terminados: (p.pids || []).length }; }
      await wait(500);
      const j = () => Math.random();
      const mk = (nombre, descripcion, empresa, ram, cpu, cantidad = 1, extra = {}) => ({ nombre, descripcion, empresa, ruta: 'C:\\Program Files\\' + nombre + '.exe', ram: Math.round(ram * (0.95 + j() * 0.1)), cpu: Math.round(cpu * (0.5 + j()) * 10) / 10, cantidad, pids: [1000 + nombre.length], critico: false, ventana: false, windows: false, titulo: '', ...extra });
      const win = { windows: true }, crit = { windows: true, critico: true };
      return { ramTotal: 64 * GB, ramLibre: 41 * GB, cpuTotal: Math.round(14 + j() * 8), procesos: [
        mk('chrome', 'Google Chrome', 'Google LLC', 3.1 * GB, 6, 28, { ventana: true, titulo: 'YouTube - Google Chrome' }),
        mk('obs64', 'OBS Studio', 'OBS Project', 1.2 * GB, 9, 1, { ventana: true, titulo: 'OBS 31.1 - Perfil: Directo' }),
        mk('Discord', 'Discord', 'Discord Inc.', 820 * MB, 1.5, 7, { ventana: true, titulo: '#general - Discord' }),
        mk('Code', 'Visual Studio Code', 'Microsoft Corporation', 540 * MB, 0.6, 12, { ventana: true, titulo: 'app.js - RetroLimpia' }),
        mk('steamwebhelper', 'Steam Client WebHelper', 'Valve Corporation', 610 * MB, 0.8, 9),
        mk('ollama', 'Ollama', 'Ollama', 4.6 * GB, 0.2, 2),
        mk('Spotify', 'Spotify', 'Spotify AB', 260 * MB, 0.7, 6),
        mk('GoogleUpdate', 'Google Installer', 'Google LLC', 4 * MB, 0, 1),
        mk('explorer', 'Explorador de Windows', 'Microsoft Corporation', 290 * MB, 0.4, 1, { ...win, ventana: true }),
        mk('svchost', 'Proceso host para los servicios de Windows', 'Microsoft Corporation', 1.4 * GB, 1.1, 92, crit),
        mk('MsMpEng', 'Antimalware Service Executable', 'Microsoft Corporation', 380 * MB, 0.9, 1, crit),
        mk('dwm', 'Administrador de ventanas del escritorio', 'Microsoft Corporation', 180 * MB, 1.9, 1, crit),
        mk('SearchHost', 'Búsqueda de Windows', 'Microsoft Corporation', 120 * MB, 0.1, 1, win)
      ] };
    }
    case 'desinstalar': {
      const log = async (tipo, msg, ruta = '', ms = 350) => { onProgress({ log: { tipo, msg, en: msg, ruta } }); await wait(ms); };
      if (p.tipo === 'appx') {
        await log('paso', 'Quitando la app de Microsoft Store', p.paquete);
        await log('ok', 'App quitada correctamente', '', 500);
        return { ok: true, metodo: 'appx', registroLimpio: true, nombre: p.nombre };
      }
      await log('info', 'Programa: ' + (p.etiqueta || p.nombre) + ' ' + (p.version || ''));
      if (p.carpeta) await log('info', 'Carpeta de instalación', p.carpeta);
      await log('info', 'Su entrada en el registro de Windows', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' + p.nombre);
      await log('paso', 'Ejecutando su desinstalador en silencio (tipo nsis)', (p.carpeta || 'C:\\Program Files\\' + p.nombre) + '\\uninstall.exe /S', 900);
      await log('ok', 'Su entrada del registro se borró', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' + p.nombre);
      await log('ok', 'Desinstalado correctamente (silencioso-nsis)');
      return { ok: true, metodo: 'silencioso-nsis', reinicio: false, registroLimpio: true, nombre: p.nombre };
    }
    case 'residuos': {
      const log = async (tipo, msg, ruta = '', ms = 160) => { onProgress({ log: { tipo, msg, en: msg, ruta } }); await wait(ms); };
      for (const b of ['C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData', 'C:\\Users\\Demo\\AppData\\Roaming', 'C:\\Users\\Demo\\AppData\\Local']) await log('buscar', 'Buscando restos en', b);
      await log('hallado', 'Carpeta que dejó el programa', `C:\\ProgramData\\${p.nombre}`);
      await log('hallado', 'Carpeta que dejó el programa', `C:\\Users\\Demo\\AppData\\Local\\${p.nombre}`);
      await log('buscar', 'Revisando el registro de Windows en', 'HKEY_CURRENT_USER\\Software');
      await log('hallado', 'Entrada del registro que dejó el programa', `HKEY_CURRENT_USER\\Software\\${p.nombre}`);
      await log('buscar', 'Revisando el registro de Windows en', 'HKEY_LOCAL_MACHINE\\SOFTWARE');
      await log('hallado', 'Carpeta que dejó el programa (posible, te lo preguntaremos)', `C:\\Program Files\\${(p.editor || 'Editor').split(/[ ,]/)[0]}`);
      await log('aviso', 'Quedaron 1 entrada(s) en el registro y 3 resto(s) en disco');
    }
      return { nombre: p.nombre, restos: [
        { tipo: 'carpeta', ruta: `C:\\ProgramData\\${p.nombre}`, tamano: 84 * MB, confianza: 'alta' },
        { tipo: 'carpeta', ruta: `C:\\Users\\Demo\\AppData\\Local\\${p.nombre}`, tamano: 31 * MB, confianza: 'alta' },
        { tipo: 'registro', ruta: `HKEY_CURRENT_USER\\Software\\${p.nombre}`, tamano: 0, confianza: 'alta' },
        { tipo: 'carpeta', ruta: `C:\\Program Files\\${(p.editor || 'Editor').split(/[ ,]/)[0]}`, tamano: 0, confianza: 'media' }
      ] };
    case 'cuarentena':
      if (p.accion === 'mover') {
        for (const it of p.items) { onProgress({ log: { tipo: 'ok', msg: it.tipo === 'registro' ? 'Entrada del registro copiada a la cuarentena y borrada' : 'Movido a la cuarentena', en: 'Moved to quarantine', ruta: it.ruta } }); await wait(250); }
        onProgress({ log: { tipo: 'info', msg: 'Todo lo quitado está guardado aquí unos días por si quieres restaurarlo', en: 'Kept here for a few days', ruta: 'C:\\ProgramData\\RetroLimpia\\Cuarentena\\20261117-0315' } });
        const lote = { id: String(Date.now()), fecha: new Date().toISOString(), motivo: p.motivo, cantidad: p.items.length, bytes: p.items.reduce((a, i) => a + (i.tamano || 0), 0), items: p.items };
        for (const it of p.items) { const d = demoRestos.find((x) => x.ruta === it.ruta); if (d) d.quitado = true; }
        cuarentena.unshift(lote); return { id: lote.id, guardados: p.items.length, fallidos: [], bytes: lote.bytes };
      }
      if (p.accion === 'listar') return { lotes: cuarentena };
      if (p.accion === 'restaurar') { cuarentena = cuarentena.filter((l) => l.id !== p.id); await wait(500); return { ok: true }; }
      return { purgados: 0 };
  }
  return {};
}

module.exports = { run, cancel };
