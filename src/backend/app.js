const express = require('express');
const cors = require('cors');
const path = require('path');
const orderController = require('./controllers/orderController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.post('/api/chat/message', orderController.handleChatMessage);
app.post('/api/orders/retry', orderController.handleRetry);
app.post('/api/orders/confirm-registration', orderController.handleConfirmRegistration);
app.post('/api/orders/cancel', orderController.handleCancel);

// Dev / Demo toggle endpoint
app.post('/api/dev/simulate-failure', orderController.toggleSimulatedFailure);

// Diagnostic endpoints for demo/testing verification
app.get('/api/dev/products', orderController.getProducts);
app.get('/api/dev/orders', orderController.getOrders);
app.get('/api/dev/audit-logs', orderController.getAuditLogs);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', service: 'Barrio Market Monolith', timestamp: new Date() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Barrio Market] Server running at http://localhost:${PORT}`);
    console.log(`[Barrio Market] Chat Web Interface ready.`);
  });
}

module.exports = app;
