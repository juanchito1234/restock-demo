const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../data/barrio_market.db');

// Ensure parent dir exists or SQLite creates file
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      default_supplier_id TEXT NOT NULL,
      current_stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 10,
      default_order_quantity INTEGER DEFAULT 20,
      unit_cost REAL DEFAULT 1500.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (default_supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      idempotency_key TEXT UNIQUE,
      supplier_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL, -- 'CREATED', 'FAILED', 'CANCELLED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      session_id TEXT,
      payload TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.exec(schema);

  // Seed default suppliers if empty
  const supplierCount = db.prepare('SELECT count(*) as count FROM suppliers').get().count;
  if (supplierCount === 0) {
    const insertSupplier = db.prepare('INSERT INTO suppliers (id, name, contact_info) VALUES (?, ?, ?)');
    insertSupplier.run('sup-dist-1', 'Distribuidora Central Mayorista', 'contacto@central.com - 3105550100');
    insertSupplier.run('sup-lacteos-2', 'Lácteos del Valle S.A.S.', 'pedidos@lacteosvalle.com - 3125550200');
    insertSupplier.run('sup-granos-3', 'Granos y Abastos La Esmeralda', 'ventas@esmeralda.com - 3155550300');
  }

  // Seed default products if empty
  const productCount = db.prepare('SELECT count(*) as count FROM products').get().count;
  if (productCount === 0) {
    const insertProd = db.prepare(`
      INSERT INTO products (id, name, default_supplier_id, current_stock, min_stock, default_order_quantity, unit_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertProd.run('prod-arroz-500', 'arroz de 500 gramos', 'sup-granos-3', 5, 10, 24, 2100.0);
    insertProd.run('prod-leche-1l', 'leche entera 1 litro', 'sup-lacteos-2', 8, 15, 30, 3400.0);
    insertProd.run('prod-aceite-1000', 'aceite vegetal 1000 ml', 'sup-dist-1', 4, 8, 12, 8500.0);
  }
}

initDb();

module.exports = db;
