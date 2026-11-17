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
