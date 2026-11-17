# ¿Por qué Windows o mi antivirus avisan con RetroLimpia?

**Respuesta corta:** el aviso significa *"no conozco a este autor"*, no *"he encontrado un virus"*.

## 1. No tiene firma digital de pago

Las empresas grandes pagan cada año un certificado de "firma de código". Con él, Windows sabe quién hizo el programa. RetroLimpia es un proyecto independiente y gratuito, así que no tiene ese certificado.

Windows SmartScreen muestra **"Windows protegió su PC"** con *cualquier* programa nuevo que no esté firmado y que todavía no hayan descargado muchas personas. El aviso es el mismo para un programa inofensivo que para uno peligroso. Por eso conviene comprobarlo tú mismo (punto 3).

**Para continuar:** pulsa **Más información** y luego **Ejecutar de todas formas**. Solo pasa la primera vez.

## 2. Hace cosas "poderosas" a propósito

Para limpiar de verdad, RetroLimpia necesita:

- permisos de administrador,
- borrar archivos y claves del registro,
- desinstalar programas,
- manejar drivers y actualizaciones.

Los antivirus usan reglas automáticas (*heurística*), y esas mismas acciones también las hacen los programas maliciosos. Por eso los limpiadores y desinstaladores reciben a veces **falsos positivos**.

## 3. Cómo comprobarlo tú mismo

1. **Lee el código:** todo está en este repositorio. Los scripts que tocan el sistema están en [`scripts/`](../scripts) y llevan comentarios en español.
2. **VirusTotal:** sube el instalador a <https://www.virustotal.com>. Lo analizan más de 60 antivirus a la vez.
3. **Compara la huella:** cada versión publica un `SHA256.txt`. En PowerShell:
   ```powershell
   Get-FileHash .\RetroLimpia-Instalador-2.0.0.exe
   ```
   Si el número coincide, el archivo es exactamente el que compiló GitHub a partir de este código.
4. **Sin telemetría:** RetroLimpia no envía ningún dato de tu PC a internet. La única conexión que hace es preguntar a GitHub si hay una versión nueva.

## 4. Todo se puede deshacer

- Antes de cambiar nada crea un **punto de restauración** de Windows.
- Lo que quita va a una **cuarentena** (`C:\ProgramData\RetroLimpia\Cuarentena`) durante 7 días. Se restaura con un clic.
- Cada cambio queda anotado en `C:\ProgramData\RetroLimpia\logs`.

## Para quien publica el programa: cómo reducir los avisos sin pagar

- Envía cada versión nueva a Microsoft para análisis: <https://www.microsoft.com/wdsi/filesubmission> (opción *Software developer*). Si no encuentran nada, suelen quitar la detección de Defender.
- Si otro antivirus da falso positivo, la mayoría tiene un formulario de "false positive".
- No comprimas el .exe con empaquetadores como UPX: disparan las alarmas.
- Al ser código abierto, puedes solicitar firma gratuita a [SignPath Foundation](https://signpath.org).
