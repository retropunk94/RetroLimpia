// Modo demostración: datos de ejemplo para ver y probar la interfaz
// sin tocar nada del sistema (se activa con "npm run demo" o fuera de Windows).

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GB = 1024 ** 3, MB = 1024 ** 2;

let token = 0;
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
  problemas: [{ dispositivo: 'Dispositivo desconocido', codigo: 28, clase: '', id: 'ACPI\\VEN_XXXX' }],
  respaldos: []
};

const updates = {
  windows: [
    { id: 'u1', titulo: 'Actualización acumulativa de seguridad para Windows 11 (KB5068861)', tipo: 'seguridad', opcional: false, grande: false, tamano: 820 * MB, kb: '5068861', reinicio: true },
    { id: 'u2', titulo: 'Realtek Semiconductor Corp. - Extension - 6.0.9800.1', tipo: 'driver', opcional: true, grande: false, tamano: 3 * MB, kb: '', reinicio: false },
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
  ['informes', 120 * MB, 'verde'], ['miniaturas', 260 * MB, 'verde'], ['navegadores', 1.4 * GB, 'amarillo'], ['volcados', 0, 'amarillo'], ['papelera', 5.6 * GB, 'amarillo']
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
      if (p.accion === 'respaldar') { await steps(onProgress, ['Haciendo copia de tus drivers...'], 1500); return { ok: true, carpeta: 'C:\\ProgramData\\RetroLimpia\\RespaldoDrivers\\2026-11-16_2130', tamano: 1.2 * GB }; }
      await steps(onProgress, ['Leyendo drivers...', 'Buscando dispositivos con problemas...'], 900); return drivers;
    case 'actualizaciones':
      if (p.accion === 'buscar') { await steps(onProgress, ['Preguntando a Windows Update...', 'Buscando actualizaciones de programas...'], 1600); return updates; }
      if (p.accion === 'instalarWU') { await steps(onProgress, ['Descargando...', 'Instalando...'], 1800); return { resultados: (p.ids || updates.windows.map((u) => u.id)).map((id) => ({ id, ok: true })), reinicio: true }; }
      if (p.accion === 'winget') { await steps(onProgress, ['Actualizando...'], 1500); return { resultados: (p.ids || updates.apps.map((a) => a.id)).map((id) => ({ id, ok: true })) }; }
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
    case 'procesos': {
      if (p.accion === 'terminar') { await wait(300); return { ok: true, terminados: (p.pids || []).length }; }
      await wait(500);
      const j = () => Math.random();
      const mk = (nombre, descripcion, empresa, ram, cpu, cantidad = 1, critico = false) => ({ nombre, descripcion, empresa, ruta: 'C:\\Program Files\\' + nombre + '.exe', ram: Math.round(ram * (0.95 + j() * 0.1)), cpu: Math.round(cpu * (0.5 + j()) * 10) / 10, cantidad, pids: [1000 + nombre.length], critico });
      return { ramTotal: 64 * GB, ramLibre: 41 * GB, cpuTotal: Math.round(14 + j() * 8), procesos: [
        mk('chrome', 'Google Chrome', 'Google LLC', 3.1 * GB, 6, 28), mk('obs64', 'OBS Studio', 'OBS Project', 1.2 * GB, 9), mk('Discord', 'Discord', 'Discord Inc.', 820 * MB, 1.5, 7),
        mk('steamwebhelper', 'Steam Client WebHelper', 'Valve Corporation', 610 * MB, 0.8, 9), mk('Code', 'Visual Studio Code', 'Microsoft Corporation', 540 * MB, 0.6, 12),
        mk('MsMpEng', 'Antimalware Service Executable', 'Microsoft Corporation', 380 * MB, 0.9, 1, true), mk('explorer', 'Explorador de Windows', 'Microsoft Corporation', 290 * MB, 0.4),
        mk('svchost', 'Proceso host para los servicios de Windows', 'Microsoft Corporation', 1.4 * GB, 1.1, 92, true), mk('Spotify', 'Spotify', 'Spotify AB', 260 * MB, 0.7, 6),
        mk('dwm', 'Administrador de ventanas del escritorio', 'Microsoft Corporation', 180 * MB, 1.9, 1, true), mk('ollama', 'Ollama', 'Ollama', 4.6 * GB, 0.2, 2)
      ] };
    }
    case 'desinstalar': await steps(onProgress, ['Desinstalando ' + p.nombre + ' en silencio...'], 1300); return { ok: true, metodo: 'silencioso-nsis', reinicio: false, nombre: p.nombre };
    case 'residuos':
      await steps(onProgress, ['Buscando restos...', 'Revisando el registro...'], 900);
      return { nombre: p.nombre, restos: [
        { tipo: 'carpeta', ruta: `C:\\ProgramData\\${p.nombre}`, tamano: 84 * MB, confianza: 'alta' },
        { tipo: 'carpeta', ruta: `C:\\Users\\Demo\\AppData\\Local\\${p.nombre}`, tamano: 31 * MB, confianza: 'alta' },
        { tipo: 'registro', ruta: `HKEY_CURRENT_USER\\Software\\${p.nombre}`, tamano: 0, confianza: 'alta' },
        { tipo: 'carpeta', ruta: `C:\\Program Files\\${(p.editor || 'Editor').split(/[ ,]/)[0]}`, tamano: 0, confianza: 'media' }
      ] };
    case 'cuarentena':
      if (p.accion === 'mover') {
        await steps(onProgress, ['Guardando en cuarentena...'], 700);
        const lote = { id: String(Date.now()), fecha: new Date().toISOString(), motivo: p.motivo, cantidad: p.items.length, bytes: p.items.reduce((a, i) => a + (i.tamano || 0), 0), items: p.items };
        cuarentena.unshift(lote); return { id: lote.id, guardados: p.items.length, fallidos: [], bytes: lote.bytes };
      }
      if (p.accion === 'listar') return { lotes: cuarentena };
      if (p.accion === 'restaurar') { cuarentena = cuarentena.filter((l) => l.id !== p.id); await wait(500); return { ok: true }; }
      return { purgados: 0 };
  }
  return {};
}

module.exports = { run, cancel };
