const GroqNluProvider = require('./nlu/GroqNluProvider');
const DeterministicNluProvider = require('./nlu/DeterministicNluProvider');

const SYSTEM_INSTRUCTION = `
Eres el agente virtual conversacional oficial de "Barrio Market", una tienda de barrio.
Tu ÚNICA misión en esta fase es asistir a los empleados con el REABASTECIMIENTO DE PRODUCTOS y la CREACIÓN DE ÓRDENES DE COMPRA (RF-006 y RF-007).

REGLAS ESTRICTAS DE NEGOCIO:
1. Tu alcance se limita a reabastecimiento, catálogo e inventario para órdenes de compra. Si el usuario te saluda, responde amablemente y explica qué puedes hacer. Si el texto que
   detectas no corresponde a una orden de compra ni a una pregunta relacionada con el reabastecimiento de productos, debes responder amablemente y explicar qué puedes hacer, poniendo 
   el intent como OUT_OF_SCOPE.
2. Si el usuario pide reabastecer, pedir o comprar un producto:
   - Extrae con precisión el "productName" (ej: "papa", "arroz de 500 gramos", "leche").
   - Extrae "requestedQuantity" como número entero de unidades o paquetes/kilos solicitados (ej: "1 kg de papa" -> requestedQuantity: 1, productName: "papa"; "5 bolsas de leche" -> requestedQuantity: 5; "30 latas de atun" -> requestedQuantity: 30).
3. Clasifica la intención del usuario ("intent") en una de las siguientes:
   - "REPLENISH": El usuario desea reabastecer, pedir o comprar inventario indicando el producto (ej. "necesito 1 kg de papa", "necesito reabastecer arroz de 500 gramos", "pedir 30 bolsas de leche"). Si no indica unidades, requestedQuantity puede ser null.
   - "CLARIFICATION_NEEDED": Mensajes donde el usuario indica una cantidad sin especificar el producto (ej. "necesito 20 unidades", "pedir 15 cajas", "comprar 30"), o donde falta información clave para entender la orden. En estos casos, extrae requestedQuantity si está presente y deja productName como null.
   - "GREETING": Saludos o preguntas generales sobre qué puedes hacer ("hola", "buenos días", "quién eres").
   - "OUT_OF_SCOPE": Preguntas no relacionadas con la tienda o reabastecimiento (ej. recetas, política, clima, presentaciones como "soy andrés").

Debes responder SIEMPRE y ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "intent": "REPLENISH" | "GREETING" | "OUT_OF_SCOPE" | "CLARIFICATION_NEEDED",
  "productName": "nombre extraído del producto en minúsculas y normalizado" | null,
  "requestedQuantity": número entero o null,
  "agentResponse": "Mensaje en tono cercano y profesional de tendero colombiano dirigido al empleado"
}
`;

/**
 * AgentNlpService adhering to SOLID:
 * - Single Responsibility Principle (SRP): Orquestar el análisis de lenguaje natural.
 * - Open/Closed Principle (OCP): Abierto para nuevos proveedores NLU mediante la abstracción INluProvider.
 * - Dependency Inversion Principle (DIP): Depende de abstracciones de proveedores NLU.
 */
class AgentNlpService {
  /**
   * @param {INluProvider[]} providers
   */
  constructor(providers = null) {
    if (providers) {
      this.providers = providers;
    } else {
      // Default chain: Groq provider -> Deterministic local fallback
      this.providers = [
        new GroqNluProvider(),
        new DeterministicNluProvider()
      ];
    }
  }

  async analyzeMessage(userMessage) {
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
      return {
        intent: 'CLARIFICATION_NEEDED',
        productName: null,
        requestedQuantity: null,
        agentResponse: 'Por favor escribe un mensaje para poder ayudarte.'
      };
    }

    const trimmed = userMessage.trim();

    // Iterate through available providers (Strategy / Chain pattern)
    for (const provider of this.providers) {
      if (provider.isAvailable()) {
        try {
          console.log(`[AgentNlpService] Using provider ${provider.constructor.name}`);
          const result = await provider.analyze(trimmed, SYSTEM_INSTRUCTION);
          if (result && result.intent) {
            result.provider = provider.constructor.name;
            return result;
          }
        } catch (err) {
          console.warn(`[AgentNlpService] Proveedor ${provider.constructor.name} falló, pasando al siguiente:`, err.message);
        }
      }
    }

    // Ultimate fallback if all fail
    return new DeterministicNluProvider().analyze(trimmed);
  }
}

module.exports = new AgentNlpService();
