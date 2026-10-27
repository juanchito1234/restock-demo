const {
  productRepository,
  supplierRepository,
  purchaseOrderRepository,
  auditLogRepository
} = require('../repositories');

class PurchaseOrderService {
  constructor() {
    // Flag to control simulated errors for demonstration (RF-006 / Scenario B)
    this.simulateFailureNext = false;
  }

  setSimulateFailure(shouldFail) {
    this.simulateFailureNext = shouldFail;
  }

  /**
   * Identifies product from natural language query
   */
  extractProductInfo(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    // Look for keywords: "reabastecer", "comprar", "ordenar", "necesito", "pedir"
    const regexes = [
      /(?:necesito reabastecer|reabastecer|comprar|ordenar|pedir|solicito reabastecer)\s+(?:de\s+)?([a-záéíóúñ0-9\s]+)/i,
      /(?:reabastece|agrega orden para|crear orden de)\s+([a-záéíóúñ0-9\s]+)/i
    ];

    for (const rx of regexes) {
      const match = clean.match(rx);
      if (match && match[1]) {
        return match[1].replace(/[.,;:!?]+$/, '').trim();
      }
    }

    // If query is short and doesn't match verbs, it might just be the product name directly
    if (clean.length > 2 && !clean.includes('hola') && !clean.includes('gracias')) {
      return clean;
    }

    return null;
  }

  /**
   * Processes a purchase order request according to business rules:
   * BR-002: Order created on replenishment request without requiring stock < min.
   * BR-003: If product not found, return confirmation question.
   * BR-004: Default supplier is chosen automatically.
   * BR-005 & RF-006: Controlled failure handling with retry option.
   * RF-007: Return order_number, supplier, total_amount on success.
   */
  async processReplenishment({ productName, idempotencyKey, sessionId, forceError = false, requestedQuantity = null }) {
    auditLogRepository.log({
      eventType: 'REPLENISHMENT_REQUESTED',
      sessionId,
      payload: { productName, idempotencyKey, forceError },
      details: 'Evaluando producto en catálogo'
    });

    // 1. Search product in repository
    let product = productRepository.findByName(productName);

    if (!product) {
      // BR-003: Product does not exist -> ask user confirmation
      auditLogRepository.log({
        eventType: 'PRODUCT_NOT_FOUND',
        sessionId,
        payload: { productName },
        details: 'El producto no existe. Solicitando confirmación al empleado.'
      });

      return {
        status: 'PRODUCT_NOT_FOUND',
        productName,
        requestedQuantity: requestedQuantity || 1,
        message: `El producto «${productName}» no se encuentra en el catálogo. ¿Deseas registrarlo para proceder con la orden de compra?`,
        actions: [
          { type: 'CONFIRM_REGISTRATION', label: 'Sí, registrar y ordenar', value: true },
          { type: 'CANCEL', label: 'No, cancelar operación', value: false }
        ]
      };
    }

    return this.executeOrderCreation({ product, idempotencyKey, sessionId, forceError, requestedQuantity });
  }

  /**
   * Internal execution of order creation with idempotency and error simulation
   */
  executeOrderCreation({ product, idempotencyKey, sessionId, forceError = false, requestedQuantity = null }) {
    // Check Idempotency: If already created with this idempotencyKey, return existing order (prevent duplicates)
    if (idempotencyKey) {
      const existingOrder = purchaseOrderRepository.findByIdempotencyKey(idempotencyKey);
      if (existingOrder) {
        const supplier = supplierRepository.findById(existingOrder.supplier_id);
        auditLogRepository.log({
          eventType: 'IDEMPOTENT_ORDER_RETURNED',
          sessionId,
          payload: { idempotencyKey, orderId: existingOrder.id },
          details: 'Retornando orden ya existente para evitar duplicidad'
        });

        return {
          status: 'SUCCESS',
          isDuplicatePrevented: true,
          order: {
            orderNumber: existingOrder.order_number,
            supplierName: supplier ? supplier.name : 'Proveedor Predeterminado',
            productName: product.name,
            quantity: existingOrder.quantity,
            unitCost: existingOrder.unit_cost,
            totalAmount: existingOrder.total_amount,
            status: existingOrder.status,
            createdAt: existingOrder.created_at
          },
          message: `¡Orden ya registrada! La orden ${existingOrder.order_number} con ${supplier ? supplier.name : 'proveedor'} por un total de $${existingOrder.total_amount.toLocaleString('es-CO')} ya fue procesada anteriormente.`
        };
      }
    }

    // Determine error scenario: forceError param OR service simulation flag (RF-006 / Escenario B)
    const shouldFail = forceError || this.simulateFailureNext;
    if (this.simulateFailureNext) {
      this.simulateFailureNext = false; // Reset single-shot flag
    }

    if (shouldFail) {
      // BR-005 & RF-006: Log error and return retryable error structure
      auditLogRepository.log({
        eventType: 'PURCHASE_ORDER_FAILED',
        sessionId,
        payload: { productId: product.id, idempotencyKey },
        details: 'Fallo simulado/controlado en pasarela o servicio de órdenes (RF-006)'
      });

      return {
        status: 'ERROR',
        canRetry: true,
        idempotencyKey,
        productName: product.name,
        errorCode: 'ERR_ORDER_PROCESSING_FAILED',
        message: `No se pudo generar la orden de compra para «${product.name}» debido a una interrupción en el servicio de proveedores. ¿Deseas reintentar la operación?`,
        actions: [
          { type: 'RETRY', label: 'Reintentar orden', value: true },
          { type: 'CANCEL', label: 'Cancelar', value: false }
        ]
      };
    }

    // BR-004: Use default supplier
    const supplier = supplierRepository.findById(product.default_supplier_id) || supplierRepository.getDefaultSupplier();

    // Calculate quantity: Use requested quantity or default_order_quantity
    const quantity = requestedQuantity || product.default_order_quantity || 20;
    const totalAmount = quantity * product.unit_cost;

    // Create the order
    const order = purchaseOrderRepository.create({
      idempotencyKey,
      supplierId: supplier.id,
      productId: product.id,
      quantity,
      unitCost: product.unit_cost,
      totalAmount,
      status: 'CREATED'
    });

    // Audit log success
    auditLogRepository.log({
      eventType: 'PURCHASE_ORDER_CREATED',
      sessionId,
      payload: { orderNumber: order.order_number, totalAmount, supplierId: supplier.id },
      details: 'Orden generada exitosamente conforme a RF-007'
    });

    return {
      status: 'SUCCESS',
      order: {
        id: order.id,
        orderNumber: order.order_number,
        supplierName: supplier.name,
        productName: product.name,
        quantity: order.quantity,
        unitCost: order.unit_cost,
        totalAmount: order.total_amount,
        status: order.status,
        createdAt: order.created_at
      },
      message: `¡Orden de compra generada exitosamente! Se ha creado la orden ${order.order_number} con el proveedor «${supplier.name}» por un valor total de $${order.total_amount.toLocaleString('es-CO')}.`
    };
  }

  /**
   * Handles user's confirmation to register non-existent product (BR-003)
   */
  registerAndOrder({ productName, sessionId, idempotencyKey, quantity = 24, unitCost = 2500.0 }) {
    const defaultSupplier = supplierRepository.getDefaultSupplier();
    const qty = parseInt(quantity, 10) || 24;
    const cost = parseFloat(unitCost) || 2500.0;

    const newProduct = productRepository.create({
      name: productName,
      defaultSupplierId: defaultSupplier.id,
      currentStock: 0,
      minStock: 10,
      defaultOrderQuantity: qty,
      unitCost: cost
    });

    auditLogRepository.log({
      eventType: 'PRODUCT_REGISTERED_BY_AGENT',
      sessionId,
      payload: { productId: newProduct.id, productName: newProduct.name, defaultOrderQuantity: qty, unitCost: cost },
      details: 'Producto registrado mediante formulario interactivo (BR-003)'
    });

    // Once registered, proceed with order creation
    return this.executeOrderCreation({
      product: newProduct,
      idempotencyKey,
      sessionId,
      forceError: false,
      requestedQuantity: qty
    });
  }

  /**
   * Logs cancellation when employee decides not to retry or not to register
   */
  cancelOperation({ sessionId, reason, productName }) {
    auditLogRepository.log({
      eventType: 'OPERATION_CANCELLED',
      sessionId,
      payload: { reason, productName },
      details: 'El empleado decidió cancelar la operación.'
    });

    return {
      status: 'CANCELLED',
      message: `Operación cancelada. El registro de auditoría ha sido actualizado.`
    };
  }
}

module.exports = new PurchaseOrderService();
