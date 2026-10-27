// Main Chat Controller / Application State Manager
// Implements RF-006 (Error handling & Retry) & RF-007 (Notification of created order)

class ChatController {
  constructor() {
    this.sessionId = 'sess-' + Date.now();
    this.isProcessing = false;
    this.pendingContext = null; // Stores retry/confirmation context

    // DOM Elements
    this.messagesContainer = document.getElementById('chat-messages');
    this.chatForm = document.getElementById('chat-form');
    this.messageInput = document.getElementById('message-input');
    this.btnSend = document.getElementById('btn-send');
    this.statusIndicator = document.getElementById('status-indicator');
    this.quickPromptsContainer = document.getElementById('quick-prompts');
    this.simulationToggle = document.getElementById('toggle-simulate-error');

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupQuickPrompts();
    this.renderWelcomeMessage();
  }

  setupEventListeners() {
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUserSubmit();
    });

    // Delegate action clicks (Retry, Confirm Registration, Cancel)
    this.messagesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-action');
      if (!btn) return;
      this.handleActionClick(btn);
    });

    // Delegate embedded registration form submit
    this.messagesContainer.addEventListener('submit', (e) => {
      const form = e.target.closest('.embedded-registration-form');
      if (!form) return;
      e.preventDefault();
      this.handleRegistrationFormSubmit(form);
    });

    if (this.simulationToggle) {
      this.simulationToggle.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        try {
          await window.apiClient.setSimulateFailure(isChecked);
          this.showStatusToast(`Simulación de falla: ${isChecked ? 'ACTIVADA (RF-006)' : 'DESACTIVADA'}`);
        } catch (err) {
          console.error('Error toggling failure:', err);
        }
      });
    }
  }

  setupQuickPrompts() {
    if (!this.quickPromptsContainer) return;
    this.quickPromptsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.prompt-chip');
      if (!chip) return;
      const promptText = chip.getAttribute('data-prompt');
      if (promptText) {
        this.messageInput.value = promptText;
        this.messageInput.focus();
      }
    });
  }

  renderWelcomeMessage() {
    const welcomeBubble = window.ChatComponents.createMessageBubble({
      sender: 'agent',
      text: '¡Hola! Soy tu asistente de Barrio Market 🛒. Puedo ayudarte a reabastecer productos de tu tienda. Escribe una solicitud como: «Necesito reabastecer arroz de 500 gramos».',
      status: 'READY'
    });
    this.messagesContainer.appendChild(welcomeBubble);
    this.scrollToBottom();
  }

  async handleUserSubmit() {
    const rawText = this.messageInput.value;
    const message = rawText ? rawText.trim() : '';

    // Client-side validation: Message cannot be empty
    if (!message) {
      this.shakeInput();
      return;
    }

    if (this.isProcessing) return;

    // Render user message bubble
    const userBubble = window.ChatComponents.createMessageBubble({
      sender: 'user',
      text: message
    });
    this.messagesContainer.appendChild(userBubble);
    this.messageInput.value = '';
    this.messageInput.style.height = 'auto'; // Reset textarea height
    this.scrollToBottom();

    // Generate idempotency key for this order attempt
    const idempotencyKey = window.apiClient.generateIdempotencyKey();
    const forceError = this.simulationToggle ? this.simulationToggle.checked : false;

    await this.processMessageWithBackend({ message, idempotencyKey, forceError });
  }

  async processMessageWithBackend({ message, idempotencyKey, forceError }) {
    this.setLoadingState(true);

    try {
      const response = await window.apiClient.sendMessage({
        message,
        sessionId: this.sessionId,
        idempotencyKey,
        forceError
      });

      this.handleApiResponse(response);
    } catch (error) {
      console.error('Error sending message:', error);
      this.handleCommunicationError(error, { message, idempotencyKey });
    } finally {
      this.setLoadingState(false);
    }
  }

  handleApiResponse(response) {
    const { status, message, order, actions, productName, idempotencyKey, provider } = response;

    if (status === 'SUCCESS') {
      this.pendingContext = null;
      const bubble = window.ChatComponents.createMessageBubble({
        sender: 'agent',
        text: message,
        status: 'SUCCESS',
        order: order,
        provider: provider
      });
      this.messagesContainer.appendChild(bubble);
    } else if (status === 'ERROR') {
      // RF-006: Manejo de errores al crear una orden de compra y ofrecer reintento
      this.pendingContext = {
        action: 'RETRY',
        productName: productName,
        idempotencyKey: idempotencyKey || window.apiClient.generateIdempotencyKey()
      };

      const bubble = window.ChatComponents.createMessageBubble({
        sender: 'agent',
        text: message,
        status: 'ERROR',
        provider: provider,
        actions: actions || [
          { type: 'RETRY', label: 'Reintentar orden', value: true },
          { type: 'CANCEL', label: 'Cancelar', value: false }
        ]
      });
      this.messagesContainer.appendChild(bubble);
    } else if (status === 'PRODUCT_NOT_FOUND') {
      // BR-003: Producto inexistente -> Formulario Interactivo Reutilizable
      this.pendingContext = {
        action: 'CONFIRM_REGISTRATION',
        productName: productName,
        idempotencyKey: idempotencyKey || window.apiClient.generateIdempotencyKey()
      };

      const bubble = window.ChatComponents.createMessageBubble({
        sender: 'agent',
        text: message,
        status: 'WAITING',
        provider: provider,
        form: {
          productName: productName,
          defaultQuantity: response.requestedQuantity || '',
          defaultCost: 2500,
          title: '📋 Registro de Nuevo Producto (BR-003)',
          helpText: 'Completa o ajusta los parámetros antes de registrar en catálogo y generar la orden:'
        }
      });
      this.messagesContainer.appendChild(bubble);
    } else if (status === 'CLARIFICATION_NEEDED') {
      // Manejo de persistencia: Si el usuario dio unidades o producto parcial, mostrar formulario con placeholders
      const reqQty = response.requestedQuantity || (this.pendingContext ? this.pendingContext.requestedQuantity : null);
      const prodN = productName || (this.pendingContext ? this.pendingContext.productName : null);

      if (reqQty || prodN) {
        this.pendingContext = {
          action: 'CONFIRM_REGISTRATION',
          productName: prodN || '',
          requestedQuantity: reqQty || '',
          idempotencyKey: idempotencyKey || window.apiClient.generateIdempotencyKey()
        };

        const bubble = window.ChatComponents.createMessageBubble({
          sender: 'agent',
          text: message,
          status: 'WAITING',
          provider: provider,
          form: {
            productName: prodN || '',
            defaultQuantity: reqQty || '',
            defaultCost: 2500,
            title: '📝 Completar Datos de Reabastecimiento',
            helpText: reqQty && !prodN 
              ? `Has indicado ${reqQty} unidades. Por favor ingresa el nombre del producto para generar la orden:`
              : `Has indicado el producto «${prodN}». Por favor ingresa las unidades a ordenar:`,
            productPlaceholder: 'Ej. arroz de 500 gramos',
            quantityPlaceholder: 'Ej. 24'
          }
        });
        this.messagesContainer.appendChild(bubble);
      } else {
        const bubble = window.ChatComponents.createMessageBubble({
          sender: 'agent',
          text: message,
          status: status,
          provider: provider
        });
        this.messagesContainer.appendChild(bubble);
      }
    } else if (status === 'UNRECOGNIZED_INTENT' || status === 'INVALID_INPUT' || status === 'GREETING' || status === 'OUT_OF_SCOPE') {
      const bubble = window.ChatComponents.createMessageBubble({
        sender: 'agent',
        text: message,
        status: status,
        provider: provider
      });
      this.messagesContainer.appendChild(bubble);
    } else {
      const bubble = window.ChatComponents.createMessageBubble({
        sender: 'agent',
        text: message || 'Operación finalizada.',
        provider: provider
      });
      this.messagesContainer.appendChild(bubble);
    }

    this.scrollToBottom();
  }

  async handleActionClick(button) {
    if (this.isProcessing) return;

    // Check if click was inside an embedded form button
    const form = button.closest('.embedded-registration-form');
    if (form) {
      const formAction = button.getAttribute('data-action');
      if (formAction === 'cancel-registration') {
        form.querySelectorAll('button, input').forEach(el => el.disabled = true);
        await this.executeCancel();
        return;
      }
      // If it's submit-registration, form submit event handles it
      return;
    }

    const actionType = button.getAttribute('data-action-type');
    const actionValue = button.getAttribute('data-action-value') === 'true';

    // Disable all buttons in this message card to prevent multi-clicks
    const parentActions = button.closest('.message-actions');
    if (parentActions) {
      parentActions.querySelectorAll('button').forEach((b) => (b.disabled = true));
    }

    if (actionType === 'RETRY') {
      await this.executeRetry();
    } else if (actionType === 'CONFIRM_REGISTRATION') {
      await this.executeConfirmRegistration(actionValue);
    } else if (actionType === 'CANCEL') {
      await this.executeCancel();
    }
  }

  /**
   * RF-006: Reintentar orden fallida
   */
  async executeRetry() {
    if (!this.pendingContext) {
      this.showStatusToast('No hay ninguna orden pendiente para reintentar.');
      return;
    }

    const { productName, message, idempotencyKey } = this.pendingContext;
    const forceError = this.simulationToggle ? this.simulationToggle.checked : false;

    if (!productName && message) {
      // Reintentar envío del mensaje original
      const userBubble = window.ChatComponents.createMessageBubble({
        sender: 'user',
        text: `Reintentando: «${message}»`
      });
      this.messagesContainer.appendChild(userBubble);
      this.scrollToBottom();
      await this.processMessageWithBackend({ message, idempotencyKey, forceError });
      return;
    }

    if (!productName) {
      this.showStatusToast('No hay ninguna orden pendiente para reintentar.');
      return;
    }

    // Echo user retry intent in chat
    const userBubble = window.ChatComponents.createMessageBubble({
      sender: 'user',
      text: `Reintentar orden de compra para «${productName}»`
    });
    this.messagesContainer.appendChild(userBubble);
    this.scrollToBottom();

    this.setLoadingState(true);

    try {
      const response = await window.apiClient.retryOrder({
        productName,
        idempotencyKey,
        sessionId: this.sessionId,
        forceError
      });

      this.handleApiResponse(response);
    } catch (error) {
      console.error('Error in retry:', error);
      this.handleCommunicationError(error, { productName, idempotencyKey });
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * Manejo y Validación de Formulario de Registro Interactivo (BR-003)
   */
  async handleRegistrationFormSubmit(form) {
    if (this.isProcessing) return;

    // Delegate validation to the RegistrationForm component
    const validatedData = window.RegistrationForm ? window.RegistrationForm.validate(form) : null;
    if (!validatedData) return;

    const { productName, quantity, unitCost } = validatedData;

    // Disable form fields to avoid duplicate submits
    form.querySelectorAll('input, button').forEach(el => el.disabled = true);

    const idempotencyKey = (this.pendingContext && this.pendingContext.idempotencyKey) || window.apiClient.generateIdempotencyKey();

    // Render user bubble confirming submission
    const userBubble = window.ChatComponents.createMessageBubble({
      sender: 'user',
      text: `Registrar «${productName}» (${quantity} unidades a $${unitCost.toLocaleString('es-CO')} c/u) y generar orden.`
    });
    this.messagesContainer.appendChild(userBubble);
    this.scrollToBottom();

    this.setLoadingState(true);

    try {
      const response = await window.apiClient.confirmRegistration({
        productName,
        confirmed: true,
        idempotencyKey,
        sessionId: this.sessionId,
        quantity,
        unitCost
      });

      this.handleApiResponse(response);
    } catch (error) {
      console.error('Error confirming registration via form:', error);
      this.handleCommunicationError(error);
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * BR-003: Confirmación de registro de producto (Fallback rápido)
   */
  async executeConfirmRegistration(confirmed) {
    if (!this.pendingContext) return;
    const { productName, idempotencyKey } = this.pendingContext;

    const userBubble = window.ChatComponents.createMessageBubble({
      sender: 'user',
      text: confirmed ? `Sí, deseo registrar «${productName}» y generar la orden.` : `No, deseo cancelar la solicitud de «${productName}».`
    });
    this.messagesContainer.appendChild(userBubble);
    this.scrollToBottom();

    this.setLoadingState(true);

    try {
      const response = await window.apiClient.confirmRegistration({
        productName,
        confirmed,
        idempotencyKey,
        sessionId: this.sessionId
      });

      this.handleApiResponse(response);
    } catch (error) {
      console.error('Error in registration confirmation:', error);
      this.handleCommunicationError(error);
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * Cancel operation
   */
  async executeCancel() {
    const productName = this.pendingContext ? this.pendingContext.productName : null;
    this.pendingContext = null;

    const userBubble = window.ChatComponents.createMessageBubble({
      sender: 'user',
      text: 'Cancelar operación'
    });
    this.messagesContainer.appendChild(userBubble);

    this.setLoadingState(true);
    try {
      const response = await window.apiClient.cancelOperation({
        sessionId: this.sessionId,
        reason: 'EMPLOYEE_CLICKED_CANCEL',
        productName
      });
      const bubble = window.ChatComponents.createMessageBubble({
        sender: 'agent',
        text: response.message || 'Operación cancelada.'
      });
      this.messagesContainer.appendChild(bubble);
    } catch (e) {
      console.error('Error al cancelar la operación:', e);
      const bubble = window.ChatComponents.createMessageBubble({
        sender: 'agent',
        text: `No se pudo completar la cancelación en el servidor: ${e.message || 'Error de conexión'}.`,
        status: 'ERROR'
      });
      this.messagesContainer.appendChild(bubble);
      this.showStatusToast('Error al cancelar la operación.');
    } finally {
      this.setLoadingState(false);
      this.scrollToBottom();
    }
  }

  handleCommunicationError(error, context = {}) {
    // Explicitly preserve pending context so that retry works (Hallazgo 3)
    if (context && (context.message || context.productName)) {
      this.pendingContext = {
        action: context.action || (context.productName ? 'RETRY' : 'RETRY_MESSAGE'),
        message: context.message,
        productName: context.productName,
        idempotencyKey: context.idempotencyKey || window.apiClient.generateIdempotencyKey()
      };
    }

    const bubble = window.ChatComponents.createMessageBubble({
      sender: 'agent',
      text: `Error de comunicación con el servidor: ${error.message}. Por favor verifica tu conexión y vuelve a intentar.`,
      status: 'ERROR',
      actions: [
        { type: 'RETRY', label: 'Reintentar comunicación', value: true }
      ]
    });
    this.messagesContainer.appendChild(bubble);
    this.scrollToBottom();
  }

  setLoadingState(isLoading) {
    this.isProcessing = isLoading;
    this.btnSend.disabled = isLoading;
    this.messageInput.disabled = isLoading;

    const existingIndicator = document.getElementById('typing-indicator');

    if (isLoading) {
      if (this.statusIndicator) {
        this.statusIndicator.textContent = 'Agente procesando...';
        this.statusIndicator.className = 'status-badge status-loading';
      }
      if (!existingIndicator) {
        const indicator = window.ChatComponents.createTypingIndicator();
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
      }
    } else {
      if (this.statusIndicator) {
        this.statusIndicator.textContent = 'En línea';
        this.statusIndicator.className = 'status-badge status-online';
      }
      if (existingIndicator) {
        existingIndicator.remove();
      }
      this.messageInput.focus();
    }
  }

  shakeInput() {
    this.messageInput.classList.add('input-shake');
    setTimeout(() => {
      this.messageInput.classList.remove('input-shake');
      this.messageInput.focus();
    }, 400);
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  showStatusToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.chatApp = new ChatController();
});
