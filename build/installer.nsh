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
!macro customInstall
  nsExec::Exec '"$SYSDIR\icacls.exe" "$INSTDIR" /inheritance:r /grant:r *S-1-5-32-544:(OI)(CI)F *S-1-5-18:(OI)(CI)F *S-1-5-32-545:(OI)(CI)RX /T /C /Q'
  Pop $0
!macroend
