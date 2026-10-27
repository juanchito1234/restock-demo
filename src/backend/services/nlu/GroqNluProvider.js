const INluProvider = require('./INluProvider');

let Groq = null;
try {
  Groq = require('groq-sdk');
} catch (e) {
  // groq-sdk not installed or unavailable
}

/**
 * Groq NLU Provider (Single Responsibility Principle & Liskov Substitution Principle)
 * Uses ultra-fast Groq inference with the requested model.
 */
class GroqNluProvider extends INluProvider {
  constructor(apiKey, model = 'openai/gpt-oss-120b') {
    super();
    this.apiKey = apiKey || process.env.GROQ_API_KEY || null;
    this.model = model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    this.client = null;

    if (this.apiKey && Groq) {
      try {
        this.client = new Groq({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('[GroqNluProvider] Error al inicializar cliente Groq:', err.message);
      }
    }
  }

  isAvailable() {
    return Boolean(this.client && this.apiKey);
  }

  async analyze(text, systemInstruction) {
    if (!this.isAvailable()) {
      console.log('[GroqNluProvider] Not available (missing key or SDK)');
      return null;
    }
    console.log('[GroqNluProvider] Invoking Groq model', this.model);
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  }
}

module.exports = GroqNluProvider;
