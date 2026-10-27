const INluProvider = require('./INluProvider');

/**
 * Deterministic NLU Provider (Single Responsibility Principle & LSP)
 * High-precision local fallback that does not require network calls.
 */
class DeterministicNluProvider extends INluProvider {
  isAvailable() {
    return true; // Always available
  }

  async analyze(text) {
    const clean = text.toLowerCase().trim();

    // 1. Greetings
    if (/^(hola|buenos días|buenas tardes|buenas noches|saludos|hey|alo|hola bot|buen día)\b/i.test(clean)) {
      return {
        intent: 'GREETING',
        productName: null,
        requestedQuantity: null,
        agentResponse: '¡Hola! Soy tu asistente de Barrio Market 🛒. Estoy listo para ayudarte con el reabastecimiento de productos y órdenes de compra. ¿Qué producto deseas ordenar hoy?'
      };
    }

    // 2. Personal statements or non-operational phrases
    if (/^(soy\s+|yo\s+soy|me\s+llamo|mi\s+nombre\s+es|quién\s+eres|cómo\s+te\s+llamas|tengo\s+|estoy\s+|soy\s+un\s+|soy\s+una\s+|seré\s+|puedo\s+|quiero\s+)/i.test(clean)) {
      return {
        intent: 'OUT_OF_SCOPE',
        productName: null,
        requestedQuantity: null,
        agentResponse: '¡Hola! Como asistente de Barrio Market, mi única responsabilidad es gestionar el reabastecimiento de inventario y la creación de órdenes de compra (RF-006 / RF-007). Puedes decirme algo como: «Necesito reabastecer arroz de 500 gramos».'
      };
    }

    // 3. Out-of-scope topics (expanded list)
    if (/(receta|chiste|clima|fútbol|partido|noticias|canción|poema|quién ganó|música|película|política|chisme|dólar|cómic|serie|juego|deporte|horóscopo)/i.test(clean)) {
      return {
        intent: 'OUT_OF_SCOPE',
        productName: null,
        requestedQuantity: null,
        agentResponse: 'Como asistente de Barrio Market, mi función se enfoca exclusivamente en la gestión de compras y reabastecimiento de inventario para la tienda. ¿Hay algún producto que necesites ordenar?'
      };
    }

    // 4. Extraction with explicit replenishment patterns
    let requestedQuantity = null;
    const qtyMatch = clean.match(/(\d+)\s*(?:unidades|unid|cajas|paquetes|bolsas|latas|kilos|kg|gramos|g)?\s*(?:de\s+)?/i);
    if (qtyMatch && qtyMatch[1]) {
      requestedQuantity = parseInt(qtyMatch[1], 10);
    }

    const regexes = [
      /(?:necesito reabastecer|reabastecer|comprar|ordenar|pedir|solicito reabastecer|hacer pedido de|hacer orden de)\s+(?:(\d+)\s*(?:unidades|unid|cajas|paquetes|bolsas)?\s*(?:de\s+)?)?([a-záéíóúñ0-9\s]+)/i,
      /(?:reabastece|compra|ordena|pide|agrega orden para|crear orden de)\s+([a-záéíóúñ0-9\s]+)/i
    ];

    for (const rx of regexes) {
      const match = clean.match(rx);
      if (match) {
        let prod = match[match.length - 1];
        if (prod) {
          prod = prod.replace(/[.,;:!?]+$/, '').trim();
          prod = prod.replace(/^\d+\s*(?:unidades|cajas|paquetes|bolsas)?\s*(?:de\s+)?/i, '').trim();
          if (prod.length >= 2) {
            return {
              intent: 'REPLENISH',
              productName: prod,
              requestedQuantity: requestedQuantity,
              agentResponse: `Entendido. Procesando solicitud de reabastecimiento para «${prod}».`
            };
          }
        }
      }
    }

    // 5. Common grocery terms
    const commonStoreTerms = [
      'arroz', 'leche', 'aceite', 'jabón', 'jabon', 'café', 'cafe', 'azúcar', 'azucar',
      'harina', 'sal', 'pasta', 'frijol', 'lenteja', 'pan', 'huevos', 'atún', 'atun',
      'galletas', 'mantequilla', 'queso', 'gaseosa', 'agua', 'detergente', 'blanqueador',
      'papel', 'crema', 'shampoo', 'chocolatina', 'avena', 'sardinas', 'tomate', 'cebolla'
    ];

    const isRecognizedGrocery = commonStoreTerms.some(term => clean.includes(term));
    if (isRecognizedGrocery && !clean.includes('gracias') && !clean.includes('adiós') && clean.length > 2) {
      const cleanedProd = clean.replace(/[.,;:!?]+$/, '').trim();
      return {
        intent: 'REPLENISH',
        productName: cleanedProd,
        requestedQuantity: requestedQuantity,
        agentResponse: `Identifiqué el producto «${cleanedProd}». Consultando disponibilidad en catálogo.`
      };
    }

    // 6. Generic rejection
    if (clean.split(/\s+/).length >= 2) {
      return {
        intent: 'OUT_OF_SCOPE',
        productName: null,
        requestedQuantity: null,
        agentResponse: 'No reconozco esa solicitud como una orden de compra o consulta de reabastecimiento. Como asistente de Barrio Market, mi labor es crear órdenes de compra (RF-006 / RF-007). Puedes decir por ejemplo: «Necesito reabastecer arroz de 500 gramos».'
      };
    }

    return {
      intent: 'CLARIFICATION_NEEDED',
      productName: null,
      requestedQuantity: null,
      agentResponse: 'No alcancé a identificar el producto que deseas reabastecer. Por favor indícame el nombre, por ejemplo: «Necesito reabastecer arroz de 500 gramos».'
    };
  }
}

module.exports = DeterministicNluProvider;
