const purchaseOrderService = require('../services/PurchaseOrderService');
const agentNlpService = require('../services/AgentNlpService');
const {
  productRepository,
  supplierRepository,
  purchaseOrderRepository,
  auditLogRepository
} = require('../repositories');

const orderController = {
  /**
   * Main conversational message processing endpoint
   * POST /api/chat/message
   */
  async handleChatMessage(req, res) {
    const startTime = Date.now();
    try {
      const { message, sessionId, idempotencyKey, forceError } = req.body;

      if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
          status: 'INVALID_INPUT',
          message: 'Por favor ingresa un mensaje válido para continuar.',
          latencyMs: Date.now() - startTime
        });
      }

      // Analyze message with the strict Agent NLP Service
      const analysis = await agentNlpService.analyzeMessage(message);

      if (analysis.intent !== 'REPLENISH' || !analysis.productName) {
        return res.status(200).json({
          status: analysis.intent || 'UNRECOGNIZED_INTENT',
          productName: analysis.productName || null,
          requestedQuantity: analysis.requestedQuantity || null,
          message: analysis.agentResponse || 'No pude entender la solicitud. Como asistente de Barrio Market, puedo ayudarte diciendo: «Necesito reabastecer arroz de 500 gramos».',
          provider: analysis.provider || 'Unknown',
          latencyMs: Date.now() - startTime
        });
      }

      const productName = analysis.productName;

      const result = await purchaseOrderService.processReplenishment({
        productName,
        idempotencyKey,
        sessionId,
        forceError: Boolean(forceError),
        requestedQuantity: analysis.requestedQuantity || null
      });

      if (analysis.agentResponse && result.status !== 'ERROR' && result.status !== 'PRODUCT_NOT_FOUND') {
        result.agentMessage = analysis.agentResponse;
      }

      result.latencyMs = Date.now() - startTime;
      result.provider = analysis.provider || 'GroqNluProvider';
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error handling chat message:', error);
      auditLogRepository.log({
        eventType: 'UNEXPECTED_SERVER_ERROR',
        details: error.message
      });
      return res.status(500).json({
        status: 'SERVER_ERROR',
        message: 'Ocurrió un error inesperado en el servidor al procesar la solicitud.',
        latencyMs: Date.now() - startTime
      });
    }
  },

  /**
   * Endpoint for retry action (RF-006 / Scenario C)
   * POST /api/orders/retry
   */
  async handleRetry(req, res) {
    const startTime = Date.now();
    try {
      const { productName, idempotencyKey, sessionId, forceError = false } = req.body;

      if (!productName) {
        return res.status(400).json({
          status: 'INVALID_INPUT',
          message: 'Se requiere el nombre del producto para reintentar la orden.',
          latencyMs: Date.now() - startTime
        });
      }

      auditLogRepository.log({
        eventType: 'RETRY_ATTEMPTED',
        sessionId,
        payload: { productName, idempotencyKey },
        details: 'El usuario solicitó reintentar la creación de orden fallida'
      });

      const product = productRepository.findByName(productName);
      if (!product) {
        return res.status(404).json({
          status: 'NOT_FOUND',
          message: `El producto «${productName}» no existe.`,
          latencyMs: Date.now() - startTime
        });
      }

      const result = purchaseOrderService.executeOrderCreation({
        product,
        idempotencyKey,
        sessionId,
        forceError: Boolean(forceError)
      });

      result.latencyMs = Date.now() - startTime;
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error handling retry:', error);
      return res.status(500).json({
        status: 'SERVER_ERROR',
        message: 'Error al reintentar la operación.',
        latencyMs: Date.now() - startTime
      });
    }
  },

  /**
   * Endpoint to confirm registration of non-existent product (BR-003 / Scenario D)
   * POST /api/orders/confirm-registration
   */
  async handleConfirmRegistration(req, res) {
    const startTime = Date.now();
    try {
      const { productName, confirmed, idempotencyKey, sessionId, quantity, unitCost } = req.body;

      if (!productName) {
        return res.status(400).json({
          status: 'INVALID_INPUT',
          message: 'El nombre del producto es requerido.',
          latencyMs: Date.now() - startTime
        });
      }

      if (!confirmed) {
        const result = purchaseOrderService.cancelOperation({
          sessionId,
          reason: 'EMPLOYEE_REJECTED_PRODUCT_REGISTRATION',
          productName
        });
        result.latencyMs = Date.now() - startTime;
        return res.status(200).json(result);
      }

      const result = purchaseOrderService.registerAndOrder({
        productName,
        sessionId,
        idempotencyKey,
        quantity,
        unitCost
      });

      result.latencyMs = Date.now() - startTime;
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error confirming registration:', error);
      return res.status(500).json({
        status: 'SERVER_ERROR',
        message: 'Error al registrar el producto y generar la orden.',
        latencyMs: Date.now() - startTime
      });
    }
  },

  /**
   * Endpoint to cancel an operation
   * POST /api/orders/cancel
   */
  async handleCancel(req, res) {
    const startTime = Date.now();
    try {
      const { sessionId, reason, productName } = req.body;
      const result = purchaseOrderService.cancelOperation({
        sessionId,
        reason: reason || 'EMPLOYEE_CANCELLED',
        productName
      });
      result.latencyMs = Date.now() - startTime;
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        status: 'SERVER_ERROR',
        message: 'Error al cancelar la operación.',
        latencyMs: Date.now() - startTime
      });
    }
  },

  /**
   * Development endpoint to toggle simulated failure for demo
   * POST /api/dev/simulate-failure
   */
  toggleSimulatedFailure(req, res) {
    const { enable } = req.body;
    purchaseOrderService.setSimulateFailure(Boolean(enable));
    res.json({
      simulateFailureNext: purchaseOrderService.simulateFailureNext,
      message: `Simulación de falla ${purchaseOrderService.simulateFailureNext ? 'ACTIVADA' : 'DESACTIVADA'}`
    });
  },

  /**
   * Diagnostic / Academic endpoints for verification
   */
  getProducts(req, res) {
    res.json(productRepository.listAll());
  },

  getOrders(req, res) {
    res.json(purchaseOrderRepository.listAll());
  },

  getAuditLogs(req, res) {
    res.json(auditLogRepository.listLogs());
  }
};

module.exports = orderController;
