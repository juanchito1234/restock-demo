# Barrio Market — Implementación de RF-006 y RF-007

Aplicación web conversacional que simula la interacción de un empleado de tienda de barrio con el agente virtual de Barrio Market (estilo Telegram), desarrollada bajo una **arquitectura monolítica modular**, con frontend interactivo, backend en Node.js/Express, persistencia real en SQLite y cumplimiento estricto de las reglas de negocio de la SPEC.

---

## 1. Alcance y Requisitos Implementados

- **RF-006 — Manejo de errores al crear una orden de compra:**
  - Detección controlada de fallos durante la comunicación con el proveedor/servicio de órdenes.
  - Notificación comprensible al empleado sin exponer trazas internas ni datos sensibles.
  - Oferta explícita de acción de reintento (`🔄 Reintentar orden`) o cancelación.
  - Mecanismo de **idempotencia** (`idempotencyKey`) que previene duplicidad de órdenes al reintentar.
- **RF-007 — Notificación de orden creada:**
  - Visualización estructurada con componente visual `OrderSummaryCard`: Número de orden (`OC-AAAA-XXXX`), proveedor asignado, producto, cantidad, costo unitario y valor total.
- **Reglas de Negocio Implementadas:**
  - **BR-002:** La orden se crea al solicitar el reabastecimiento sin bloquearse por niveles de stock previo.
  - **BR-003:** Si el producto no existe en catálogo, el agente solicita confirmación interactiva para registrarlo. Solo si el empleado acepta se procede a la creación del producto y de la orden.
  - **BR-004:** Asignación automática del proveedor predeterminado registrado para el producto sin forzar al usuario a seleccionarlo.
  - **BR-005:** Oferta de reintento ante fallos y registro de auditoría (`audit_logs`) ante cancelaciones o fallos.

---

## 2. Arquitectura y Estructura del Monolito Modular

```text
impl_req6/
├── package.json                   # Dependencias y scripts de ejecución y pruebas
├── data/
│   └── barrio_market.db           # Base de datos relacional SQLite (WAL mode activado)
├── src/
│   ├── backend/
│   │   ├── app.js                 # Servidor Express y configuración de rutas API
│   │   ├── controllers/
│   │   │   └── orderController.js # Manejo de solicitudes HTTP y respuestas JSON
│   │   ├── services/
│   │   │   └── PurchaseOrderService.js # Lógica de negocio, reglas de reabastecimiento e idempotencia
│   │   ├── repositories/
│   │   │   └── index.js           # Acceso a datos para productos, proveedores, órdenes y auditoría
│   │   └── db/
│   │       └── database.js        # Inicialización de esquema SQLite y semillas iniciales
│   └── frontend/
│       ├── index.html             # Interfaz web simulación chat Telegram
│       ├── css/
│       │   └── style.css          # Estilos modernos, responsive, dark theme y tarjetas de orden
│       └── js/
│           ├── app.js             # Controlador de estado conversacional y eventos de UI
│           ├── components/
│           │   └── chatComponents.js # Componentes MessageBubble, OrderSummaryCard, TypingIndicator
│           └── services/
│               └── apiService.js  # Abstracción de llamadas HTTP fetch al backend
└── tests/
    └── backend.test.js            # Pruebas automatizadas de los escenarios A, B, C, D e idempotencia
```

---

## 3. Instrucciones de Instalación y Ejecución

### Requisitos previos
- Node.js (v18 o superior)
- npm

### Pasos

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Ejecutar pruebas automatizadas:**
   ```bash
   npm test
   ```

3. **Iniciar la aplicación:**
   ```bash
   npm start
   ```

4. **Acceder a la aplicación:**
   Abre tu navegador en `http://localhost:3000`.

---

## 4. Contratos de la API REST

### `POST /api/chat/message`
Procesa una solicitud en lenguaje natural del empleado.
- **Body:**
  ```json
  {
    "message": "Necesito reabastecer arroz de 500 gramos",
    "sessionId": "sess-12345",
    "idempotencyKey": "idemp-abc-123",
    "forceError": false
  }
  ```
- **Respuesta Exitosa (RF-007):**
  ```json
  {
    "status": "SUCCESS",
    "order": {
      "orderNumber": "OC-2026-6232",
      "supplierName": "Granos y Abastos La Esmeralda",
      "productName": "arroz de 500 gramos",
      "quantity": 24,
      "unitCost": 2100,
      "totalAmount": 50400
    },
    "message": "¡Orden de compra generada exitosamente! Se ha creado la orden...",
    "latencyMs": 12
  }
  ```

### `POST /api/orders/retry`
Permite reintentar la creación de una orden fallida (RF-006).
- **Body:**
  ```json
  {
    "productName": "leche entera 1 litro",
    "idempotencyKey": "idemp-abc-123",
    "sessionId": "sess-12345",
    "forceError": false
  }
  ```

### `POST /api/orders/confirm-registration`
Responde a la confirmación de registro de producto nuevo (BR-003).
- **Body:**
  ```json
  {
    "productName": "jabón en polvo 1kg",
    "confirmed": true,
    "idempotencyKey": "idemp-xyz-987",
    "sessionId": "sess-12345"
  }
  ```

---

## 5. Escenarios de Demostración Verificados

- **Escenario A — Creación exitosa:** Solicitar «Necesito reabastecer arroz de 500 gramos» genera la orden `OC-2026-6232` y muestra la tarjeta resumen con proveedor y valor total.
- **Escenario B — Error al crear la orden (RF-006):** Activar «Simular Falla (RF-006)» y solicitar un producto. El sistema captura la falla, muestra la insignia de error y el botón `🔄 Reintentar orden`.
- **Escenario C — Reintento exitoso:** Desactivar la simulación de falla y presionar `🔄 Reintentar orden`. La orden se completa utilizando la misma clave de idempotencia, evitando duplicados.
- **Escenario D — Producto inexistente (BR-003):** Solicitar un producto nuevo como «jabón en polvo 1kg». El agente pregunta si desea registrarlo; al hacer clic en `Sí, registrar y ordenar`, se registra y se crea la orden automáticamente.
- **Escenario E — Entrada inválida:** Enviar mensajes vacíos o no reconocidos produce retroalimentación inmediata sin fallos inesperados del sistema.
