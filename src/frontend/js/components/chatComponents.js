// Component Builders for Telegram-like Chat Interface

const ChatComponents = {
  /**
   * Builds a message bubble element
   */
  createMessageBubble({ id, sender, text, timestamp, status, actions = [], order = null }) {
    const bubble = document.createElement('div');
    bubble.className = `message-row ${sender === 'user' ? 'message-user' : 'message-agent'}`;
    bubble.id = id || `msg-${Date.now()}`;

    let avatarHtml = '';
    if (sender === 'agent') {
      avatarHtml = `
        <div class="agent-avatar" aria-label="Avatar del Agente Barrio Market">
          <span>BM</span>
        </div>
      `;
    }

    let orderCardHtml = '';
    if (order) {
      orderCardHtml = this.createOrderSummaryHtml(order);
    }

    let actionsHtml = '';
    if (actions && actions.length > 0) {
      actionsHtml = `
        <div class="message-actions">
          ${actions.map((act, idx) => `
            <button 
              type="button" 
              class="btn-action ${act.type === 'RETRY' ? 'btn-retry' : (act.value ? 'btn-confirm' : 'btn-cancel')}"
              data-action-type="${act.type}"
              data-action-value="${act.value}"
              data-idx="${idx}"
            >
              ${act.type === 'RETRY' ? '🔄 ' : ''}${act.label}
            </button>
          `).join('')}
        </div>
      `;
    }

    let statusBadge = '';
    if (status === 'ERROR') {
      statusBadge = `<span class="badge badge-error">Error al procesar</span>`;
    } else if (status === 'SUCCESS') {
      statusBadge = `<span class="badge badge-success">Completado</span>`;
    } else if (status === 'WAITING') {
      statusBadge = `<span class="badge badge-warning">Esperando confirmación</span>`;
    }

    bubble.innerHTML = `
      ${avatarHtml}
      <div class="bubble-content ${status === 'ERROR' ? 'bubble-error' : ''}">
        ${statusBadge ? `<div class="bubble-badge-row">${statusBadge}</div>` : ''}
        <div class="bubble-text">${this.escapeHtml(text)}</div>
        ${orderCardHtml}
        ${actionsHtml}
        <div class="bubble-meta">
          <span class="message-time">${timestamp || this.formatTime(new Date())}</span>
          ${sender === 'user' ? '<span class="read-receipt" title="Entregado">✓✓</span>' : ''}
        </div>
      </div>
    `;

    return bubble;
  },

  /**
   * Builds order summary card (RF-007)
   */
  createOrderSummaryHtml(order) {
    return `
      <div class="order-summary-card">
        <div class="order-card-header">
          <div class="order-icon">📦</div>
          <div>
            <div class="order-title">Orden de Compra Generada</div>
            <div class="order-number">${order.orderNumber}</div>
          </div>
        </div>
        <div class="order-details-grid">
          <div class="order-field">
            <span class="field-label">Producto:</span>
            <span class="field-value">${this.escapeHtml(order.productName)}</span>
          </div>
          <div class="order-field">
            <span class="field-label">Proveedor:</span>
            <span class="field-value highlight">${this.escapeHtml(order.supplierName)}</span>
          </div>
          <div class="order-field">
            <span class="field-label">Cantidad:</span>
            <span class="field-value">${order.quantity} unidades</span>
          </div>
          <div class="order-field">
            <span class="field-label">Costo Unitario:</span>
            <span class="field-value">$${order.unitCost.toLocaleString('es-CO')}</span>
          </div>
        </div>
        <div class="order-total-row">
          <span>Total de la Compra:</span>
          <span class="order-total-price">$${order.totalAmount.toLocaleString('es-CO')} COP</span>
        </div>
      </div>
    `;
  },

  /**
   * Builds typing indicator bubble
   */
  createTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'message-row message-agent typing-indicator-row';
    el.id = 'typing-indicator';
    el.innerHTML = `
      <div class="agent-avatar"><span>BM</span></div>
      <div class="bubble-content bubble-typing">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    return el;
  },

  formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.ChatComponents = ChatComponents;
