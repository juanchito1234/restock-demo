/**
 * Utility functions for frontend presentation and formatting
 */
const ChatUtils = {
  formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatCurrencyCOP(amount) {
    const num = Number(amount) || 0;
    return `$${num.toLocaleString('es-CO')} COP`;
  }
};

window.ChatUtils = ChatUtils;
