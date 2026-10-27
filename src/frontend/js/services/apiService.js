// Frontend API Service
// Encapsulates HTTP communication with the backend API

const apiClient = {
  baseUrl: window.location.origin,

  /**
   * Generates a unique idempotency key for transactions
   */
  generateIdempotencyKey() {
    return 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  },

  /**
   * Send user chat message
   */
  async sendMessage({ message, sessionId, idempotencyKey, forceError = false }) {
    const response = await fetch(`${this.baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, idempotencyKey, forceError })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Error HTTP ${response.status}`);
    }
    return data;
  },

  /**
   * Retry failed order creation
   */
  async retryOrder({ productName, idempotencyKey, sessionId, forceError = false }) {
    const response = await fetch(`${this.baseUrl}/api/orders/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, idempotencyKey, sessionId, forceError })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Error HTTP ${response.status}`);
    }
    return data;
  },

  /**
   * Confirm or reject new product registration with optional custom quantity and unitCost
   */
  async confirmRegistration({ productName, confirmed, idempotencyKey, sessionId, quantity, unitCost }) {
    const response = await fetch(`${this.baseUrl}/api/orders/confirm-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, confirmed, idempotencyKey, sessionId, quantity, unitCost })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Error HTTP ${response.status}`);
    }
    return data;
  },

  /**
   * Cancel operation
   */
  async cancelOperation({ sessionId, reason, productName }) {
    const response = await fetch(`${this.baseUrl}/api/orders/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, reason, productName })
    });
    return response.json();
  },

  /**
   * Dev helper: get orders
   */
  async getOrders() {
    const response = await fetch(`${this.baseUrl}/api/dev/orders`);
    return response.json();
  },

  /**
   * Dev helper: get audit logs
   */
  async getAuditLogs() {
    const response = await fetch(`${this.baseUrl}/api/dev/audit-logs`);
    return response.json();
  },

  /**
   * Dev helper: toggle backend simulated failure
   */
  async setSimulateFailure(enable) {
    const response = await fetch(`${this.baseUrl}/api/dev/simulate-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    });
    return response.json();
  }
};

window.apiClient = apiClient;
