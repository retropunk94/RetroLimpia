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

; REPARACIÓN de la 4.0.2/4.0.3: aquellas versiones cambiaron los permisos de la carpeta del programa
; (y en 4.0.2 dejaron los archivos ilegibles). Se vuelve a los permisos normales de Windows,
; exactamente como estaba en la 4.0.1. /reset hace que todo herede los permisos de la carpeta de arriba.
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
  ExpandEnvStrings $1 "%ProgramData%\RetroLimpia"
  IfFileExists "$1\*.*" 0 rl_sin_datos
    nsExec::Exec '"$SYSDIR\icacls.exe" "$1" /reset /T /C /Q'
    Pop $0
  rl_sin_datos:
!macroend
