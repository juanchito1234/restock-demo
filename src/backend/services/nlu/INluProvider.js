/**
 * Interface / Base Class for NLU Providers (DIP - Dependency Inversion Principle)
 */
class INluProvider {
  /**
   * Analyzes text and returns structured NLU result
   * @param {string} text
   * @param {string} systemInstruction
   * @returns {Promise<{ intent: string, productName: string|null, requestedQuantity: number|null, agentResponse: string } | null>}
   */
  async analyze(text, systemInstruction) {
    throw new Error('Method analyze() must be implemented by concrete provider');
  }

  isAvailable() {
    return false;
  }
}

module.exports = INluProvider;
