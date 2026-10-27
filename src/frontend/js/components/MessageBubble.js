/**
 * Componente Reutilizable: MessageBubble
 * Responsabilidad única: Renderizar la estructura base de una burbuja de chat (agente o usuario),
 * componiendo opcionalmente tarjetas hijas (OrderSummaryCard, RegistrationForm, ActionButtons).
 */
class MessageBubble {
  /**
   * Crea una burbuja de mensaje compuesta
   * @param {Object} props - { id, sender, text, timestamp, status, actions, order, form }
   * @returns {HTMLElement}
   */
  static render({ id, sender, text, timestamp, status, actions = [], order = null, form = null, provider = null }) {
    const bubbleRow = document.createElement('div');
    bubbleRow.className = `message-row ${sender === 'user' ? 'message-user' : 'message-agent'}`;
    bubbleRow.id = id || `msg-${Date.now()}`;
    bubbleRow.setAttribute('data-component', 'MessageBubble');

    // 1. Avatar (Agente)
    if (sender === 'agent') {
      const avatar = document.createElement('div');
      avatar.className = 'agent-avatar';
      avatar.setAttribute('aria-label', 'Avatar del Agente Barrio Market');
      avatar.innerHTML = '<span>BM</span>';
      bubbleRow.appendChild(avatar);
    }

    // 2. Contenedor de contenido
    const content = document.createElement('div');
    content.className = `bubble-content ${status === 'ERROR' ? 'bubble-error' : ''}`;

    // 2.1 Badge de estado
    const badgeHtml = MessageBubble.getStatusBadgeHtml(status, provider);
    if (badgeHtml) {
      const badgeRow = document.createElement('div');
      badgeRow.className = 'bubble-badge-row';
      badgeRow.innerHTML = badgeHtml;
      content.appendChild(badgeRow);
    }

    // 2.2 Texto principal del mensaje
    if (text) {
      const textDiv = document.createElement('div');
      textDiv.className = 'bubble-text';
      textDiv.innerHTML = window.ChatUtils.escapeHtml(text);
      content.appendChild(textDiv);
    }

    // 2.3 Subcomponente: OrderSummaryCard (RF-007)
    if (order && window.OrderSummaryCard) {
      const orderCard = window.OrderSummaryCard.render(order);
      if (orderCard) content.appendChild(orderCard);
    }

    // 2.4 Subcomponente: RegistrationForm (BR-003)
    if (form && window.RegistrationForm) {
      const regForm = window.RegistrationForm.render(form);
      if (regForm) content.appendChild(regForm);
    }

    // 2.5 Subcomponente: ActionButtons (RF-006 / Retry)
    if (actions && actions.length > 0 && !form && window.ActionButtons) {
      const actionGroup = window.ActionButtons.render(actions);
      if (actionGroup) content.appendChild(actionGroup);
    }

    // 2.6 Metadatos (Hora y confirmación de lectura)
    const meta = document.createElement('div');
    meta.className = 'bubble-meta';
    meta.innerHTML = `
      <span class="message-time">${timestamp || window.ChatUtils.formatTime()}</span>
      ${sender === 'user' ? '<span class="read-receipt" title="Entregado">✓✓</span>' : ''}
    `;
    content.appendChild(meta);

    bubbleRow.appendChild(content);
    return bubbleRow;
  }

  static getStatusBadgeHtml(status, provider) {
    const isGroq = provider === 'GroqNluProvider';
    const providerBadge = isGroq 
      ? `<span class="badge badge-groq" style="background: rgba(245, 80, 54, 0.15); color: #f55036; border: 1px solid rgba(245, 80, 54, 0.4); font-weight: 600;">⚡ Groq AI (LPU)</span>`
      : '';

    switch (status) {
      case 'ERROR':
        return `${providerBadge} <span class="badge badge-error">❌ Error en Creación (RF-006)</span>`;
      case 'SUCCESS':
        return `${providerBadge} <span class="badge badge-success">✅ Orden Exitosa (RF-007)</span>`;
      case 'WAITING':
      case 'FORM':
        return `${providerBadge} <span class="badge badge-warning">📝 Formulario de Registro (BR-003)</span>`;
      case 'GREETING':
        return `${providerBadge} <span class="badge badge-info">👋 Saludo</span>`;
      case 'OUT_OF_SCOPE':
        return `${providerBadge} <span class="badge badge-info">ℹ️ Fuera de Alcance</span>`;
      default:
        return providerBadge;
    }
  }
}

window.MessageBubble = MessageBubble;
