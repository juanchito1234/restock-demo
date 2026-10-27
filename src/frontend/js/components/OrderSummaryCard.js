/**
 * Componente Reutilizable: OrderSummaryCard (RF-007)
 * Responsabilidad única: Renderizar la estructura visual y datos de una orden de compra generada.
 */
class OrderSummaryCard {
  /**
   * Genera el elemento HTML estructurado para la orden
   * @param {Object} order - Datos de la orden (orderNumber, productName, supplierName, quantity, unitCost, totalAmount)
   * @returns {HTMLElement}
   */
  static render(order) {
    if (!order) return null;

    const card = document.createElement('div');
    card.className = 'order-summary-card';
    card.setAttribute('data-component', 'OrderSummaryCard');

    card.innerHTML = `
      <div class="order-card-header">
        <div class="order-icon">📦</div>
        <div>
          <div class="order-title">Orden de Compra Generada</div>
          <div class="order-number">${window.ChatUtils.escapeHtml(order.orderNumber)}</div>
        </div>
      </div>
      <div class="order-details-grid">
        <div class="order-field">
          <span class="field-label">Producto:</span>
          <span class="field-value">${window.ChatUtils.escapeHtml(order.productName)}</span>
        </div>
        <div class="order-field">
          <span class="field-label">Proveedor Predeterminado:</span>
          <span class="field-value highlight">${window.ChatUtils.escapeHtml(order.supplierName)}</span>
        </div>
        <div class="order-field">
          <span class="field-label">Cantidad a Ordenar:</span>
          <span class="field-value">${order.quantity} unidades</span>
        </div>
        <div class="order-field">
          <span class="field-label">Costo Unitario:</span>
          <span class="field-value">$${Number(order.unitCost).toLocaleString('es-CO')} COP</span>
        </div>
      </div>
      <div class="order-total-row">
        <span>Total de la Compra:</span>
        <span class="order-total-price">${window.ChatUtils.formatCurrencyCOP(order.totalAmount)}</span>
      </div>
    `;

    return card;
  }
}

window.OrderSummaryCard = OrderSummaryCard;
