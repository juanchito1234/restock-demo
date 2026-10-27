/**
 * Backward compatibility facade for ChatComponents
 * Delegates directly to the specialized components:
 * - MessageBubble
 * - OrderSummaryCard
 * - RegistrationForm
 * - ActionButtons
 * - TypingIndicator
 * - ChatUtils
 */
const ChatComponents = {
  createMessageBubble(props) {
    return window.MessageBubble.render(props);
  },

  createOrderSummaryHtml(order) {
    const el = window.OrderSummaryCard.render(order);
    return el ? el.outerHTML : '';
  },

  createRegistrationFormHtml(props) {
    const el = window.RegistrationForm.render(props);
    return el ? el.outerHTML : '';
  },

  createTypingIndicator() {
    return window.TypingIndicator.render();
  },

  formatTime(date) {
    return window.ChatUtils.formatTime(date);
  },

  escapeHtml(str) {
    return window.ChatUtils.escapeHtml(str);
  }
};

window.ChatComponents = ChatComponents;
