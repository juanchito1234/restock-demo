/**
 * Componente Reutilizable: ActionButtons (RF-006 / BR-005)
 * Responsabilidad única: Renderizar botones interactivos de reintento, confirmación o cancelación.
 */
class ActionButtons {
  /**
   * Renderiza el contenedor de botones de acción
   * @param {Array} actions - Array de objetos { type, label, value }
   * @returns {HTMLElement|null}
   */
  static render(actions = []) {
    if (!actions || actions.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'message-actions';
    container.setAttribute('data-component', 'ActionButtons');

    actions.forEach((act, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-action ${act.type === 'RETRY' ? 'btn-retry' : (act.value ? 'btn-confirm' : 'btn-cancel')}`;
      btn.setAttribute('data-action-type', act.type);
      btn.setAttribute('data-action-value', String(act.value));
      btn.setAttribute('data-idx', String(idx));
      btn.textContent = `${act.type === 'RETRY' ? '🔄 ' : ''}${act.label}`;
      container.appendChild(btn);
    });

    return container;
  }
}

window.ActionButtons = ActionButtons;
