const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const productRepository = {
  findByName(name) {
    const normalized = name.toLowerCase().trim();
    // Exact or like match
    const stmt = db.prepare('SELECT * FROM products WHERE LOWER(name) = ? OR LOWER(name) LIKE ?');
    return stmt.get(normalized, `%${normalized}%`);
  },

  findById(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  create({ name, defaultSupplierId, currentStock = 0, minStock = 10, defaultOrderQuantity = 20, unitCost = 2000.0 }) {
    const id = `prod-${uuidv4().substring(0, 8)}`;
    const stmt = db.prepare(`
      INSERT INTO products (id, name, default_supplier_id, current_stock, min_stock, default_order_quantity, unit_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, name.toLowerCase().trim(), defaultSupplierId, currentStock, minStock, defaultOrderQuantity, unitCost);
    return this.findById(id);
  },

  listAll() {
    return db.prepare('SELECT * FROM products').all();
  }
};

const supplierRepository = {
  findById(id) {
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  },

  getDefaultSupplier() {
    return db.prepare('SELECT * FROM suppliers LIMIT 1').get();
  },

  listAll() {
    return db.prepare('SELECT * FROM suppliers').all();
  }
};

const purchaseOrderRepository = {
  findByIdempotencyKey(key) {
    if (!key) return null;
    return db.prepare('SELECT * FROM purchase_orders WHERE idempotency_key = ?').get(key);
  },

  findById(id) {
    return db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  },

  create({ idempotencyKey, supplierId, productId, quantity, unitCost, totalAmount, status = 'CREATED' }) {
    const id = `ord-${uuidv4().substring(0, 8)}`;
    const orderNumber = `OC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const stmt = db.prepare(`
      INSERT INTO purchase_orders (id, order_number, idempotency_key, supplier_id, product_id, quantity, unit_cost, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, orderNumber, idempotencyKey, supplierId, productId, quantity, unitCost, totalAmount, status);
    return this.findById(id);
  },

  listAll() {
    return db.prepare(`
      SELECT po.*, p.name as product_name, s.name as supplier_name
      FROM purchase_orders po
      JOIN products p ON po.product_id = p.id
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `).all();
  }
};

const auditLogRepository = {
  log({ eventType, sessionId, payload, details }) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (event_type, session_id, payload, details)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      eventType,
      sessionId || null,
      typeof payload === 'object' ? JSON.stringify(payload) : payload || null,
      typeof details === 'object' ? JSON.stringify(details) : details || null
    );
  },

  listLogs() {
    return db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50').all();
  }
};

module.exports = {
  productRepository,
  supplierRepository,
  purchaseOrderRepository,
  auditLogRepository
};
