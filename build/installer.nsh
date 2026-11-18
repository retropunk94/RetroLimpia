; RetroLimpia necesita permisos de administrador. El botón "Ejecutar RetroLimpia" del final
; del instalador lo abría "como usuario", y Windows dejaba el aviso de administrador escondido
; en la barra de tareas: parecía que no abría a la primera.
; Aquí se abre directamente desde el instalador, que ya tiene esos permisos.

!macro customFinishPage
  Function RLStartApp
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "RLStartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend

; SEGURIDAD: RetroLimpia trabaja como administrador. Si su carpeta se puede modificar sin serlo
; (pasa al instalar fuera de "Archivos de programa", p. ej. en D:\), cualquier programa podría
; cambiar sus scripts y conseguir permisos de administrador. Se deja solo para administradores.
; SIDs en vez de nombres para que funcione en Windows en cualquier idioma.
;
; LECCIÓN (4.0.2): NUNCA usar /T junto a los permisos con (OI)(CI). En los archivos esas marcas no valen,
; icacls falla en cada archivo y los deja SIN permisos (el programa "desaparecía").
; Forma correcta: /reset /T (todo vuelve a heredar) y después el candado SOLO en la carpeta de arriba:
; Windows lo hereda a todo lo de dentro.

; Antes de copiar nada: si una instalación anterior quedó con archivos sin permisos (4.0.2), se reparan
!macro customInit
  ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  StrCmp $0 "" rl_sin_reparar
    nsExec::Exec '"$SYSDIR\icacls.exe" "$0" /reset /T /C /Q'
    Pop $1
  rl_sin_reparar:
!macroend

!macro customInstall
  nsExec::Exec '"$SYSDIR\icacls.exe" "$INSTDIR" /reset /T /C /Q'
  Pop $0
  nsExec::Exec '"$SYSDIR\icacls.exe" "$INSTDIR" /inheritance:r /grant:r *S-1-5-32-544:(OI)(CI)F *S-1-5-18:(OI)(CI)F *S-1-5-32-545:(OI)(CI)RX /C /Q'
  Pop $0
!macroend
