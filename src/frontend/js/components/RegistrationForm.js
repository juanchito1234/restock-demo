/**
 * Componente Reutilizable: RegistrationForm (BR-003)
 * Responsabilidad única: Renderizar formulario interactivo para registrar productos nuevos
 * y gestionar la validación del lado del cliente antes del envío.
 */
class RegistrationForm {
  /**
   * Crea el elemento de formulario interactivo
   * @param {Object} props - { productName, defaultQuantity, defaultCost }
   * @returns {HTMLElement}
   */
  static render({ productName = '', defaultQuantity = 24, defaultCost = 2500 } = {}) {
    const form = document.createElement('form');
    form.className = 'embedded-registration-form';
    form.setAttribute('data-component', 'RegistrationForm');
    form.noValidate = true;

    form.innerHTML = `
      <div class="form-title">
        <span>📋 Registro de Nuevo Producto (BR-003)</span>
      </div>
      <p class="form-help">Completa o ajusta los parámetros antes de registrar en catálogo y generar la orden:</p>
      
      <div class="form-field-group">
        <label class="form-label" for="form-prod-name">Nombre del Producto:</label>
        <input 
          type="text" 
          id="form-prod-name" 
          name="productName" 
          class="form-control" 
          value="${window.ChatUtils.escapeHtml(productName)}" 
          required 
        />
        <span class="form-error-msg" id="err-prod-name"></span>
      </div>

      <div class="form-row-two-col">
        <div class="form-field-group">
          <label class="form-label" for="form-prod-qty">Cantidad a Ordenar:</label>
          <input 
            type="number" 
            id="form-prod-qty" 
            name="quantity" 
            class="form-control" 
            value="${defaultQuantity}" 
            min="1" 
            max="500" 
            required 
          />
          <span class="form-error-msg" id="err-prod-qty"></span>
        </div>

        <div class="form-field-group">
          <label class="form-label" for="form-prod-cost">Costo Unitario Estimado (COP):</label>
          <input 
            type="number" 
            id="form-prod-cost" 
            name="unitCost" 
            class="form-control" 
            value="${defaultCost}" 
            min="100" 
            step="50" 
            required 
          />
          <span class="form-error-msg" id="err-prod-cost"></span>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-action btn-confirm" data-action="submit-registration">
          ✓ Guardar y Generar Orden
        </button>
        <button type="button" class="btn-action btn-cancel" data-action="cancel-registration">
          ✕ Cancelar Solicitud
        </button>
      </div>
    `;

    return form;
  }

  /**
   * Valida los campos del formulario en el cliente
   * @param {HTMLFormElement} form
   * @returns {Object|null} Retorna los datos validados o null si hay errores
   */
  static validate(form) {
    const prodNameInput = form.querySelector('[name="productName"]');
    const qtyInput = form.querySelector('[name="quantity"]');
    const costInput = form.querySelector('[name="unitCost"]');

    const errName = form.querySelector('#err-prod-name');
    const errQty = form.querySelector('#err-prod-qty');
    const errCost = form.querySelector('#err-prod-cost');

    // Reset error messages
    [errName, errQty, errCost].forEach(e => { if (e) e.textContent = ''; });

    const productName = prodNameInput.value.trim();
    const quantity = parseInt(qtyInput.value, 10);
    const unitCost = parseFloat(costInput.value);

    let hasError = false;

    if (!productName || productName.length < 2) {
      if (errName) errName.textContent = 'El nombre del producto debe tener al menos 2 caracteres.';
      prodNameInput.classList.add('input-shake');
      hasError = true;
    }

    if (isNaN(quantity) || quantity < 1 || quantity > 500) {
      if (errQty) errQty.textContent = 'Ingresa una cantidad válida entre 1 y 500 unidades.';
      qtyInput.classList.add('input-shake');
      hasError = true;
    }

    if (isNaN(unitCost) || unitCost < 100) {
      if (errCost) errCost.textContent = 'El costo unitario debe ser mínimo $100 COP.';
      costInput.classList.add('input-shake');
      hasError = true;
    }

    if (hasError) {
      setTimeout(() => {
        form.querySelectorAll('.input-shake').forEach(el => el.classList.remove('input-shake'));
      }, 500);
      return null;
    }

    return { productName, quantity, unitCost };
  }
}

window.RegistrationForm = RegistrationForm;
