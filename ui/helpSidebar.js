/**
 * HelpSidebar - Control de la sidebar de ayuda
 * Toggle abrir/cerrar y lógica de inserción de comandos en el editor activo
 */

export function initHelpSidebar() {
  const helpSidebar = document.getElementById('help-sidebar');
  const helpToggle = document.getElementById('help-toggle');
  const iframePreview = document.getElementById('preview');

  if (!helpSidebar || !helpToggle) {
    console.warn('Help sidebar elements not found');
    return;
  }

  // Toggle abrir/cerrar
  helpToggle.addEventListener('click', () => {
    helpSidebar.classList.toggle('abierto');
    helpToggle.textContent = helpSidebar.classList.contains('abierto') ? 'X' : '?';
  });

  // Insertar comandos en el sandbox activo
  document.querySelectorAll('.help-item').forEach(item => {
    item.addEventListener('click', () => {
      if (!window.editor) return;
      const insertText = item.getAttribute('data-insert');

      if (insertText.startsWith('[')) {
        let code = window.editor.getValue();
        const regexBusqueda = /\[[^\]]+\]/;

        if (regexBusqueda.test(code)) {
          code = code.replace(regexBusqueda, `${insertText}\n>$&`);
        } else {
          let salto = code.trim() !== "" ? "\n\n" : "";
          code += `${salto}${insertText}`;
        }
        window.editor.setValue(code);

        if (iframePreview.contentWindow && window.runActiveSandbox) window.runActiveSandbox();
        for (let i = 0; i < window.editor.lineCount(); i++) {
          let textoLinea = window.editor.getLine(i);
          let posicion = textoLinea.indexOf(insertText);
          if (posicion !== -1) {
            window.editor.setCursor({ line: i, ch: posicion + insertText.length - 1 });
            break;
          }
        }
      } else {
        window.editor.replaceSelection(insertText);
      }

      window.editor.focus();
    });
  });
}