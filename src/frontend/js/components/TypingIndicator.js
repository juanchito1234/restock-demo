/**
 * Componente Reutilizable: TypingIndicator
 * Responsabilidad única: Renderizar el estado visual de carga y procesamiento del agente.
 */
class TypingIndicator {
  static render() {
    const el = document.createElement('div');
    el.className = 'message-row message-agent typing-indicator-row';
    el.id = 'typing-indicator';
    el.setAttribute('data-component', 'TypingIndicator');

    el.innerHTML = `
      <div class="agent-avatar" aria-hidden="true"><span>BM</span></div>
      <div class="bubble-content bubble-typing">
        <span class="typing-text">Agente procesando...</span>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    return el;
  }
}

window.TypingIndicator = TypingIndicator;
