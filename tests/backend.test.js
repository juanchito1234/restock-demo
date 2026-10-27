process.env.NODE_ENV = 'test';

const assert = require('assert');
const db = require('../src/backend/db/database');
const purchaseOrderService = require('../src/backend/services/PurchaseOrderService');
const {
  productRepository,
  supplierRepository,
  purchaseOrderRepository,
  auditLogRepository
} = require('../src/backend/repositories');

async function runTests() {
  // Reset database state for repeatable tests (Hallazgo 1)
  if (typeof db.resetDb === 'function') {
    db.resetDb();
  }
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

  // Test 8: Extracción NLP no permisiva (Hallazgo 2)
  console.log('Prueba 8: NLP no permisivo ante texto aleatorio');
  const pRand = purchaseOrderService.extractProductInfo('asdf 1234');
  assert.strictEqual(pRand, null);
  const pValid = purchaseOrderService.extractProductInfo('pedir arroz de 500 gramos');
  assert.strictEqual(pValid, 'arroz de 500 gramos');
  console.log('✅ Prueba 8 superada: Texto aleatorio no se interpreta como producto.');

  // Test 9: Órdenes fallidas persisten estado FAILED (Hallazgo 9)
  console.log('Prueba 9: Persistencia de orden con estado FAILED');
  const failedKey = `idemp-failed-check-${runId}`;
  await purchaseOrderService.processReplenishment({
    productName: 'arroz de 500 gramos',
    idempotencyKey: failedKey,
    sessionId: 'test-sess',
    forceError: true
  });
  const failedOrder = purchaseOrderRepository.findByIdempotencyKey(failedKey);
  assert.ok(failedOrder);
  assert.strictEqual(failedOrder.status, 'FAILED');
  console.log('✅ Prueba 9 superada: Intento fallido persistido con status FAILED.');

  // Test 10: Inserción repetida de producto no genera error (Hallazgo 6)
  console.log('Prueba 10: Prevención de error por producto duplicado');
  const dupProd = `pan centeno ${runId}`;
  const resDup1 = purchaseOrderService.registerAndOrder({
    productName: dupProd,
    sessionId: 'test-sess',
    idempotencyKey: `idemp-dup-1-${runId}`,
    quantity: 10,
    unitCost: 1500
  });
  assert.strictEqual(resDup1.status, 'SUCCESS');
  const resDup2 = purchaseOrderService.registerAndOrder({
    productName: dupProd,
    sessionId: 'test-sess',
    idempotencyKey: `idemp-dup-2-${runId}`,
    quantity: 10,
    unitCost: 1500
  });
  assert.strictEqual(resDup2.status, 'SUCCESS');
  console.log('✅ Prueba 10 superada: Registro duplicado manejado idóneamente sin error 500.');

  // Test 11: Detección de cantidad sin producto para formulario interactivo
  console.log('Prueba 11: Manejo de reabastecimiento con cantidad parcial');
  const agentNlpService = require('../src/backend/services/AgentNlpService');
  const partialAnalysis = await agentNlpService.analyzeMessage('necesito 20 unidades');
  assert.strictEqual(partialAnalysis.intent, 'CLARIFICATION_NEEDED');
  assert.strictEqual(partialAnalysis.requestedQuantity, 20);
  assert.strictEqual(partialAnalysis.productName, null);
  console.log('✅ Prueba 11 superada: Extracción de cantidad parcial lista para desplegar formulario.');

  console.log('\n======================================================');
  console.log('🎉 TODAS LAS PRUEBAS AUTOMATIZADAS PASARON SATISFACTORIAMENTE');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
