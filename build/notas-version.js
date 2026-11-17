// Genera el texto de la página de la versión en GitHub a partir de data/novedades.json.
// Uso: node build/notas-version.js 2.7.0 > RELEASE.md
const fs = require('fs');
const path = require('path');
const version = String(process.argv[2] || '').replace(/^v/, '');
const repo = process.env.GITHUB_REPOSITORY || 'retropunk94/RetroLimpia';
const datos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'novedades.json'), 'utf8'));
const v = (datos.versiones || []).find((x) => x.version === version);
const out = [];
out.push('## Novedades');
if (v && v.es && v.es.length) v.es.forEach((x) => out.push('- ' + x));
else out.push('- Mejoras y correcciones.');
out.push('');
out.push('## Descarga');
out.push('👉 **Descarga solo `RetroLimpia-Instalador-x.x.x.exe`**: se instala como cualquier programa y después se actualiza solo.');
out.push('');
out.push('<sub>Los demás archivos (`latest.yml`, `.blockmap` y `SHA256.txt`) **puedes ignorarlos**: los usa el propio programa para actualizarse solo y descargando solo lo que cambió, y `SHA256.txt` sirve para quien quiera comprobar que el archivo es original.</sub>');
out.push('');
out.push('### ¿Windows dice "Windows protegió su PC"?');
out.push('Es normal: el programa no tiene firma digital de pago. Pulsa **Más información → Ejecutar de todas formas**.');
out.push(`Lee [por qué pasa](https://github.com/${repo}/blob/main/docs/POR-QUE-AVISA-WINDOWS.md). Puedes comprobar el archivo en [VirusTotal](https://www.virustotal.com) y comparar su huella con \`SHA256.txt\`.`);
out.push('');
out.push('💬 ¿Dudas o algo falla? Usa **🐞 Reportar un problema** dentro del programa o entra al [Discord de la comunidad](https://discord.gg/55zDGujkgU).');
process.stdout.write(out.join('\n') + '\n');
