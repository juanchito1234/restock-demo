const assert = require('assert');
const purchaseOrderService = require('../src/backend/services/PurchaseOrderService');
const {
  productRepository,
  supplierRepository,
  purchaseOrderRepository,
  auditLogRepository
} = require('../src/backend/repositories');

async function runTests() {
  console.log('--- INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS (RF-006 & RF-007) ---');

  // Test 1: NLP Extraction
  console.log('Prueba 1: Reconocimiento de producto en lenguaje natural');
  const p1 = purchaseOrderService.extractProductInfo('Necesito reabastecer arroz de 500 gramos');
  assert.strictEqual(p1, 'arroz de 500 gramos');
  const p2 = purchaseOrderService.extractProductInfo('Reabastecer leche entera 1 litro');
  assert.strictEqual(p2, 'leche entera 1 litro');
  console.log('✅ Prueba 1 superada: Extracción de producto correcta.');

  const runId = Date.now();
  // Test 2: Escenario A - Creación Exitosa (RF-007)
  console.log('Prueba 2: Escenario A - Creación de orden exitosa (RF-007)');
  const keyA = `idemp-test-success-${runId}`;
  const resA = await purchaseOrderService.processReplenishment({
    productName: 'arroz de 500 gramos',
    idempotencyKey: keyA,
    sessionId: 'test-sess',
    forceError: false
  });
  assert.strictEqual(resA.status, 'SUCCESS');
  assert.ok(resA.order.orderNumber.startsWith('OC-'));
  assert.strictEqual(resA.order.productName, 'arroz de 500 gramos');
  assert.ok(resA.order.totalAmount > 0);
  console.log(`✅ Prueba 2 superada: Orden generada (${resA.order.orderNumber}) por $${resA.order.totalAmount}.`);

  // Test 3: Idempotencia - No duplicar orden con la misma idempotencyKey
  console.log('Prueba 3: Control de idempotencia y prevención de órdenes duplicadas');
  const resAIdemp = await purchaseOrderService.processReplenishment({
    productName: 'arroz de 500 gramos',
    idempotencyKey: keyA, // Misma clave
    sessionId: 'test-sess',
    forceError: false
  });
  assert.strictEqual(resAIdemp.status, 'SUCCESS');
  assert.strictEqual(resAIdemp.isDuplicatePrevented, true);
  assert.strictEqual(resAIdemp.order.orderNumber, resA.order.orderNumber);
  console.log('✅ Prueba 3 superada: Idempotencia garantizada, se evitó orden duplicada.');

  // Test 4: Escenario B - Error controlado (RF-006)
  console.log('Prueba 4: Escenario B - Detección de error y oferta de reintento (RF-006)');
  const keyFail = `idemp-test-fail-${runId}`;
  const resB = await purchaseOrderService.processReplenishment({
    productName: 'arroz de 500 gramos',
    idempotencyKey: keyFail,
    sessionId: 'test-sess',
    forceError: true
  });
  assert.strictEqual(resB.status, 'ERROR');
  assert.strictEqual(resB.canRetry, true);
  assert.ok(resB.actions.some(a => a.type === 'RETRY'));
  console.log('✅ Prueba 4 superada: Error capturado y acción de reintento ofrecida.');

  // Test 5: Escenario C - Reintento exitoso (RF-006)
  console.log('Prueba 5: Escenario C - Reintento completado sin duplicidad');
  const prod = productRepository.findByName('arroz de 500 gramos');
  const resC = purchaseOrderService.executeOrderCreation({
    product: prod,
    idempotencyKey: keyFail, // Misma clave tras solucionar falla
    sessionId: 'test-sess',
    forceError: false
  });
  assert.strictEqual(resC.status, 'SUCCESS');
  assert.ok(resC.order.orderNumber.startsWith('OC-'));
  console.log(`✅ Prueba 5 superada: Reintento exitoso, orden ${resC.order.orderNumber} creada.`);

  // Test 6: Escenario D - Producto inexistente y confirmación de creación (BR-003)
  console.log('Prueba 6: Escenario D - Producto no existente (BR-003)');
  const randomProdName = `aceite oliva ${runId}`;
  const keyNew = `idemp-test-new-prod-${runId}`;
  const resD1 = await purchaseOrderService.processReplenishment({
    productName: randomProdName,
    idempotencyKey: keyNew,
    sessionId: 'test-sess'
  });
  assert.strictEqual(resD1.status, 'PRODUCT_NOT_FOUND');
  assert.ok(resD1.actions.some(a => a.type === 'CONFIRM_REGISTRATION'));

  // Simular confirmación afirmativa del usuario
  const resD2 = purchaseOrderService.registerAndOrder({
    productName: randomProdName,
    sessionId: 'test-sess',
    idempotencyKey: keyNew,
    quantity: 30,
    unitCost: 3200
  });
  assert.strictEqual(resD2.status, 'SUCCESS');
  assert.strictEqual(resD2.order.productName, randomProdName);
  assert.strictEqual(resD2.order.quantity, 30);
  console.log('✅ Prueba 6 superada: Producto registrado y orden generada tras confirmación.');

  // Test 7: Verificación de auditoría
  console.log('Prueba 7: Verificación de logs de auditoría');
  const logs = auditLogRepository.listLogs();
  assert.ok(logs.length > 0);
  console.log(`✅ Prueba 7 superada: ${logs.length} eventos registrados en auditoría.`);

  console.log('\n======================================================');
  console.log('🎉 TODAS LAS PRUEBAS AUTOMATIZADAS PASARON SATISFACTORIAMENTE');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
